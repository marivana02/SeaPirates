const express = require('express');
const router = express.Router();
const pool = require('../../../config/db');
const authMiddleware = require('../../../middleware/auth');
const { getCurrentEvent } = require('../../events');
const { FIGHT_TIMEOUT_MS } = require('../constants');
const { acquireAttackLock, releaseAttackLock } = require('../locks');
const { calculatePlayerDamage } = require('../playerDamage');
const { calculatePlayerCooldownMs } = require('../playerDamage');
const { simulatePvPOpponent, resolvePvPOpponentInfo, clearBotLoadout } = require('./simulation');
const { getOpponentReloadMs } = require('../../../helpers/combatRoute');

// Opponent attack throttle (in-memory, limits to 1 attack per 2s per player)
const lastOpponentAttack = new Map();

async function deductOpponentInventory(pool, opponentId, simResult) {
  if (opponentId <= 0) return;
  if (simResult.npcAmmoId && simResult.npcCannons > 0) {
    await pool.query(
      'UPDATE player_ammo SET quantity = GREATEST(0, quantity - $1) WHERE player_id = $2 AND ammo_type = $3',
      [simResult.npcCannons, opponentId, simResult.npcAmmoId]
    );
  }
  if (simResult.npcUseBarut) {
    await pool.query(
      "UPDATE player_items SET quantity = GREATEST(0, quantity - 1) WHERE player_id = $1 AND item_type = 'barut' AND quantity >= 1",
      [opponentId]
    );
  }
  if (simResult.npcUseZirh) {
    await pool.query(
      "UPDATE player_items SET quantity = GREATEST(0, quantity - 1) WHERE player_id = $1 AND item_type = 'zirh' AND quantity >= 1",
      [opponentId]
    );
  }
}
const { applyPvPDamageModifiers } = require('./damage');
const { grantPvPRewards, handlePvPPlayerDeath } = require('./rewards');
const { initPvPTarget } = require('./target');

router.post('/start', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  try {
    const existingRes = await pool.query('SELECT * FROM active_fights WHERE player_id = $1', [playerId]);
    if (existingRes.rows.length > 0) {
      const existing = existingRes.rows[0];
      if (Date.now() - new Date(existing.last_activity).getTime() < FIGHT_TIMEOUT_MS) {
        const playerCooldownMs = await calculatePlayerCooldownMs(pool, playerId, existing.is_tower);
        let pvpResult = { pvpOpponentId: null, pvpOpponentRankBadge: null, pvpOpponentRankName: null, pvpOpponentMainRankBadge: null, pvpOpponentMainRankName: null, opponentReloadMs: null };
        const pInfo = await pool.query('SELECT pvp_target_id, level FROM players WHERE id = $1', [playerId]);
        if (pInfo.rows.length > 0) {
          pvpResult = await resolvePvPOpponentInfo(pool, pInfo.rows[0].pvp_target_id, pInfo.rows[0].level, playerId);
        }
        return res.json({
          message: 'Fight ongoing', npcName: existing.npc_name, npcHp: parseInt(existing.npc_hp), npcMaxHp: parseInt(existing.npc_max_hp),
          playerHp: parseInt(existing.player_hp), playerMaxHp: parseInt(existing.player_max_hp), isTower: !!existing.is_tower,
          isPvP: !!existing.is_pvp, fullImg: existing.full_img, damagedImg: existing.damaged_img,
          isAdmiral: false, isTiamat: false,
          playerCooldownMs, ...pvpResult
        });
      }
      await pool.query('DELETE FROM active_fights WHERE player_id = $1', [playerId]);
      clearBotLoadout(playerId);
    }

    const pRes = await pool.query('SELECT id, hp, max_hp, level, username, display_name, ship_level, pvp_target_id, current_map_level FROM players WHERE id = $1', [playerId]);
    if (pRes.rows.length === 0) return res.status(404).json({ error: 'Player not found' });
    const pInfo = pRes.rows[0];
    if (pInfo.hp <= 0) return res.status(400).json({ error: 'Your ship is sunk! You cannot enter combat without repairing first.' });

    const cannonCheck = await pool.query('SELECT COALESCE(SUM(equipped), 0) as total FROM player_cannons WHERE player_id = $1 AND equipped > 0', [playerId]);
    if (parseInt(cannonCheck.rows[0].total) === 0) return res.status(400).json({ error: 'No cannons equipped! Please equip cannons from the equipment screen first.', noCannons: true });

    const targetNpc = await initPvPTarget(pool, pInfo);
    if (!targetNpc) {
      return res.status(400).json({ error: 'PvP target player is no longer active!' });
    }

    const playerCooldownMs = await calculatePlayerCooldownMs(pool, playerId, false);

    await pool.query(`INSERT INTO active_fights (
      player_id, npc_name, npc_hp, npc_max_hp, npc_damage, npc_gold, npc_pearl, npc_xp,
      player_hp, player_max_hp, weekly_boss_damage_dealt, map_level, is_admiral, is_tiamat,
      is_tower, tower_id, full_img, damaged_img, is_weekly_boss, is_pvp, last_activity, last_npc_attack
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT (player_id) DO UPDATE SET
      npc_name = EXCLUDED.npc_name, npc_hp = EXCLUDED.npc_hp, npc_max_hp = EXCLUDED.npc_max_hp,
      npc_damage = EXCLUDED.npc_damage, npc_gold = EXCLUDED.npc_gold, npc_pearl = EXCLUDED.npc_pearl,
      npc_xp = EXCLUDED.npc_xp, player_hp = EXCLUDED.player_hp, player_max_hp = EXCLUDED.player_max_hp,
      weekly_boss_damage_dealt = EXCLUDED.weekly_boss_damage_dealt, map_level = EXCLUDED.map_level,
      is_admiral = EXCLUDED.is_admiral, is_tiamat = EXCLUDED.is_tiamat, is_tower = EXCLUDED.is_tower,
      tower_id = EXCLUDED.tower_id, full_img = EXCLUDED.full_img, damaged_img = EXCLUDED.damaged_img,
      is_weekly_boss = EXCLUDED.is_weekly_boss, is_pvp = EXCLUDED.is_pvp, last_activity = CURRENT_TIMESTAMP, last_npc_attack = CURRENT_TIMESTAMP
    `, [
      playerId, targetNpc.name, targetNpc.hp, targetNpc.hp,
      targetNpc.damage || 0, targetNpc.gold || 0, targetNpc.pearl || 0, targetNpc.xp || 0,
      pInfo.hp, pInfo.max_hp, 0, pInfo.current_map_level || 1, false, false,
      false, null, targetNpc.fullImg || null, targetNpc.damagedImg || null,
      false, true
    ]);

    const pvpResult = await resolvePvPOpponentInfo(pool, pInfo.pvp_target_id, pInfo.level, playerId);

    res.json({
      message: 'Battle started', npcName: targetNpc.name,
      npcHp: targetNpc.hp, npcMaxHp: targetNpc.hp,
      playerHp: pInfo.hp, playerMaxHp: pInfo.max_hp, isTower: false, isPvP: true,
      fullImg: targetNpc.fullImg || null, damagedImg: targetNpc.damagedImg || null,
      isAdmiral: false, isTiamat: false, playerCooldownMs, ...pvpResult
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/attack', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  const { ammoId, useBarut, useZirh, opponentOnly } = req.body;
  if (!acquireAttackLock(playerId)) return res.status(429).json({ error: 'Attack already in progress' });
  try {
    const fightRes = await pool.query('SELECT * FROM active_fights WHERE player_id = $1', [playerId]);
    if (fightRes.rows.length === 0) return res.status(400).json({ error: 'No active fight' });
    const fightRow = fightRes.rows[0];

    const cooldownMs = await calculatePlayerCooldownMs(pool, playerId, false);
    const elapsed = Date.now() - new Date(fightRow.last_activity).getTime();
    const tolerance = Math.min(1000, Math.round(cooldownMs * 0.2));
    if (!opponentOnly && elapsed + tolerance < cooldownMs) {
      return res.status(429).json({ error: 'Too fast!', retryAfter: Math.ceil(cooldownMs - elapsed) });
    }

    const currentEvent = await getCurrentEvent();
    const pDbInfo = (await pool.query('SELECT username, display_name, ship_level, max_hp, hp, level, pvp_target_id FROM players WHERE id = $1', [playerId])).rows[0];
    const opponentId = pDbInfo.pvp_target_id;

    // Opponent throttle: use opponent's own reload speed
    if (opponentOnly) {
      const simResult = await simulatePvPOpponent(pool, opponentId, pDbInfo.level || 1, currentEvent, playerId);
      const opponentReloadMs = opponentId === -1 ? simResult.npcReloadMs : (await getOpponentReloadMs(pool, opponentId));
      const now = Date.now();
      const lastOpp = lastOpponentAttack.get(playerId) || 0;
      if (now - lastOpp < opponentReloadMs) {
        releaseAttackLock(playerId);
        return res.json({ state: 'ongoing', npcHp: parseInt(fightRow.npc_hp), npcMaxHp: parseInt(fightRow.npc_max_hp), playerHp: parseInt(fightRow.player_hp), playerDamage: 0, npcDamage: 0, elpGained: 0, consumed: { ammo: 0, barut: 0, zirh: 0 }, opponentConsumed: { barut: 0, zirh: 0, ammoId: null } });
      }
      lastOpponentAttack.set(playerId, now);
      await deductOpponentInventory(pool, opponentId, simResult);
      await pool.query('UPDATE active_fights SET last_activity = CURRENT_TIMESTAMP WHERE player_id = $1', [playerId]);
      res.json({
        state: 'ongoing', npcHp: parseInt(fightRow.npc_hp), npcMaxHp: parseInt(fightRow.npc_max_hp), playerHp: parseInt(fightRow.player_hp), playerDamage: 0, npcDamage: simResult.npcDamage,
        elpGained: 0,
        consumed: { ammo: 0, barut: 0, zirh: 0 },
        opponentConsumed: { barut: simResult.npcUseBarut ? 1 : 0, zirh: simResult.npcUseZirh ? 1 : 0, ammoId: simResult.npcAmmoId },
        opponentReloadMs,
        npcCannons: simResult.npcCannons
      });
      return;
    }

    const simResult = await simulatePvPOpponent(pool, opponentId, pDbInfo.level || 1, currentEvent, playerId);

    // Opponent throttle: use opponent's own reload speed
    const opponentReloadMs = opponentId === -1 ? simResult.npcReloadMs : (await getOpponentReloadMs(pool, opponentId));
    const now = Date.now();
    const lastOpp = lastOpponentAttack.get(playerId) || 0;
    if (now - lastOpp < opponentReloadMs) {
      simResult.npcDamage = 0;
      simResult.npcUseBarut = false;
      simResult.npcUseZirh = false;
      simResult.npcAmmoId = null;
    } else {
      lastOpponentAttack.set(playerId, now);
      await deductOpponentInventory(pool, opponentId, simResult);
    }

    const pd = await calculatePlayerDamage(pool, playerId, ammoId);

    const dm = await applyPvPDamageModifiers(pool, playerId, pd, simResult, { useBarut, useZirh, currentEvent, ammoId });

    let playerDamage = dm.finalDamage;
    let npcDamage = dm.finalNpcDamage;
    let gainedElp = dm.gainedElp;

    if (gainedElp > 0) {
      await pool.query('UPDATE players SET elite_points = elite_points + $1 WHERE id = $2', [gainedElp, playerId]);
    }

    let fight = { npcHp: parseInt(fightRow.npc_hp), playerHp: parseInt(fightRow.player_hp), npcMaxHp: parseInt(fightRow.npc_max_hp) };
    const prevNpcHp = fight.npcHp;
    fight.npcHp -= playerDamage;
    if (fight.npcHp < 0) fight.npcHp = 0;
    const actualHpLost = prevNpcHp - fight.npcHp;

    fight.playerHp -= npcDamage;
    if (fight.playerHp < 0) fight.playerHp = 0;

    await pool.query('UPDATE players SET hp = $1, dmg_pvp = COALESCE(dmg_pvp, 0) + $2 WHERE id = $3', [fight.playerHp, playerDamage, playerId]);
    await pool.query('UPDATE active_fights SET npc_hp = $1, player_hp = $2, last_activity = CURRENT_TIMESTAMP WHERE player_id = $3',
      [fight.npcHp, fight.playerHp, playerId]);

    if (fight.npcHp === 0) {
      clearBotLoadout(playerId);
      const rewardResult = await grantPvPRewards(pool, { fight, playerId, playerDamage, gainedElp, actualCannonsFired: pd.actualCannonsFired, useBarut, useZirh, npcUseBarut: simResult.npcUseBarut, npcUseZirh: simResult.npcUseZirh, npcAmmoId: simResult.npcAmmoId });
      return res.json(rewardResult);
    }

    if (fight.playerHp === 0) {
      clearBotLoadout(playerId);
      const deathResult = await handlePvPPlayerDeath(pool, { fight, playerId, playerDamage, gainedElp, actualCannonsFired: pd.actualCannonsFired, useBarut, useZirh, npcUseBarut: simResult.npcUseBarut, npcUseZirh: simResult.npcUseZirh, npcAmmoId: simResult.npcAmmoId, actualNpcDamage: npcDamage });
      return res.json(deathResult);
    }

    res.json({
      state: 'ongoing', npcHp: fight.npcHp, npcMaxHp: fight.npcMaxHp, playerHp: fight.playerHp, playerDamage: actualHpLost, npcDamage: npcDamage,
      elpGained: gainedElp, weeklyBossDamageDealt: 0,
      consumed: { ammo: pd.actualCannonsFired, barut: (useBarut && pd.actualCannonsFired > 0) ? 1 : 0, zirh: useZirh ? 1 : 0 },
      opponentConsumed: { barut: simResult.npcUseBarut ? 1 : 0, zirh: simResult.npcUseZirh ? 1 : 0, ammoId: simResult.npcAmmoId },
      npcCannons: simResult.npcCannons
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error during combat' });
  } finally {
    releaseAttackLock(playerId);
  }
});

module.exports = router;
