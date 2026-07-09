const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth');
const { getCurrentEvent } = require('./events');
const { getCurrentWeekString, getLocalDateString } = require('../helpers/date');
const { getWeeklyBossRewards } = require('../helpers/combat');
const { mapDbFightRowToFightState } = require('../helpers/combatRoute');
const { FIGHT_TIMEOUT_MS } = require('./combat/constants');
const { acquireAttackLock, releaseAttackLock } = require('./combat/locks');
const { startFightCleanup } = require('./combat/cleanup');
const { calculatePlayerDamage, calculatePlayerCooldownMs } = require('./combat/playerDamage');
const { applyDamageModifiers } = require('./combat/damageModifiers');
const { deductAdmiralBossHp, deductTiamatBossHp, selectRandomAdmiralTarget, selectRandomTiamatTarget } = require('./combat/sharedBossHp');
const { broadcastBossHp } = require('../helpers/socket');
const { updateQuestProgress } = require('./combat/questTracking');
const { grantRewards, handlePlayerDeath, distributeOldWeekRewards } = require('./combat/rewards');
const { resolveTargetNpc, initAdmiralState } = require('./combat/fightState');
const { sendPushToAll } = require('../helpers/fcm');

const pvpRouter = require('./combat/pvp/router');
router.use('/pvp', pvpRouter);

startFightCleanup(pool);

// Weekly boss reward dağıtımı: her 60 saniyede bir kontrol et (GET side-effect'i yok)
setInterval(async () => {
  try {
    await distributeOldWeekRewards(pool);
  } catch (err) {
    console.error('[WEEKLY REWARD CRON] Error:', err);
  }
}, 60000);

router.get('/active', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  try {
    const result = await pool.query('SELECT * FROM active_fights WHERE player_id = $1', [playerId]);
    if (result.rows.length === 0) return res.json({ active: false });
    const fight = result.rows[0];
    const elapsed = Date.now() - new Date(fight.last_activity).getTime();
    if (elapsed >= FIGHT_TIMEOUT_MS) {
      await pool.query('DELETE FROM active_fights WHERE player_id = $1', [playerId]);
      return res.json({ active: false });
    }
    res.json({
      active: true, npcName: fight.npc_name, npcHp: parseInt(fight.npc_hp), npcMaxHp: parseInt(fight.npc_max_hp),
      playerHp: parseInt(fight.player_hp), playerMaxHp: parseInt(fight.player_max_hp), isTower: !!fight.is_tower,
      isPvP: !!fight.is_pvp, isWeeklyBoss: !!fight.is_weekly_boss, isTiamat: !!fight.is_tiamat,
      isAdmiral: !!fight.is_admiral, towerId: fight.tower_id,
      fullImg: fight.full_img, damagedImg: fight.damaged_img, mapLevel: fight.map_level
    });
  } catch (err) {
    console.error('active check error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/boss/status', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  try {
    const pRes = await pool.query('SELECT last_boss_attack, weekly_boss_damage, weekly_boss_week FROM players WHERE id = $1', [playerId]);
    if (pRes.rows.length === 0) return res.status(404).json({ error: 'Player not found' });
    let pData = pRes.rows[0];
    const currentWeek = getCurrentWeekString();
    if (pData.weekly_boss_week !== currentWeek) {
      await pool.query('UPDATE players SET weekly_boss_damage = 0, weekly_boss_week = $1 WHERE id = $2', [currentWeek, playerId]);
      pData.weekly_boss_damage = 0;
      pData.weekly_boss_week = currentWeek;
    }
    let canAttack = true;
    if (pData.last_boss_attack) {
      const lastAttack = new Date(pData.last_boss_attack).toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
      if (lastAttack === getLocalDateString()) canAttack = false;
    }
    const leaderboardRes = await pool.query(
      `SELECT COALESCE(display_name, username) AS username, weekly_boss_damage FROM players WHERE weekly_boss_week = $1 AND weekly_boss_damage > 0 ORDER BY weekly_boss_damage DESC LIMIT 100`,
      [currentWeek]
    );
    const now = new Date();
    const nextMonday = new Date();
    nextMonday.setUTCDate(now.getUTCDate() + (8 - (now.getUTCDay() || 7)));
    nextMonday.setUTCHours(0, 0, 0, 0);
    const msDiff = nextMonday - now;
    res.json({
      canAttack, weeklyDamage: parseInt(pData.weekly_boss_damage || 0),
      leaderboard: leaderboardRes.rows,
      countdownDays: Math.floor(msDiff / (1000 * 60 * 60 * 24)),
      countdownHours: Math.floor((msDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/end', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  const lockId = acquireAttackLock(playerId);
  if (!lockId) return res.status(429).json({ error: 'Attack in progress, cannot end fight now' });
  try {
    const fightRes = await pool.query('SELECT * FROM active_fights WHERE player_id = $1', [playerId]);
    if (fightRes.rows.length === 0) return res.json({ ok: true, message: 'No active fight' });
    const fight = fightRes.rows[0];
    if (fight.is_weekly_boss && fight.weekly_boss_damage_dealt > 0) {
      await pool.query('UPDATE players SET hp = GREATEST(0, $1) WHERE id = $2', [fight.player_hp, playerId]);
    } else {
      await pool.query('UPDATE players SET hp = GREATEST(0, $1) WHERE id = $2', [fight.player_hp, playerId]);
    }
    await pool.query('DELETE FROM active_fights WHERE player_id = $1', [playerId]);
    res.json({ ok: true, message: 'Fight ended' });
  } catch (err) {
    console.error('end fight error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    releaseAttackLock(playerId, lockId);
  }
});

router.post('/start', authMiddleware, async (req, res) => {
  const { mapLevel, npcName, isTower, towerId, isWeeklyBoss, isTiamat, isPvP } = req.body;
  const playerId = req.player.id;
  try {
    const existingRes = await pool.query('SELECT * FROM active_fights WHERE player_id = $1', [playerId]);
    if (existingRes.rows.length > 0) {
      const existing = existingRes.rows[0];
      if (Date.now() - new Date(existing.last_activity).getTime() < FIGHT_TIMEOUT_MS) {
        let playerCooldownMs = await calculatePlayerCooldownMs(pool, playerId, existing.is_tower);
      if (existing.is_tiamat) playerCooldownMs = 3000;
        const shipInfo = await pool.query('SELECT ship_level, visual_ship_level, active_design FROM players WHERE id = $1', [playerId]);
        const pShip = shipInfo.rows[0] || {};
        return res.json({
          message: 'Fight ongoing', npcName: existing.npc_name, npcHp: parseInt(existing.npc_hp), npcMaxHp: parseInt(existing.npc_max_hp),
          playerHp: parseInt(existing.player_hp), playerMaxHp: parseInt(existing.player_max_hp), isTower: !!existing.is_tower,
          isPvP: !!existing.is_pvp, fullImg: existing.full_img, damagedImg: existing.damaged_img,
          isAdmiral: !!existing.is_admiral, isTiamat: !!existing.is_tiamat,
          playerCooldownMs,
          ship_level: pShip.ship_level, visual_ship_level: pShip.visual_ship_level, active_design: pShip.active_design
        });
      }
      await pool.query('DELETE FROM active_fights WHERE player_id = $1', [playerId]);
    }

    const pRes = await pool.query('SELECT id, hp, max_hp, level, username, display_name, ship_level, visual_ship_level, active_design, pvp_target_id, current_map_level FROM players WHERE id = $1', [playerId]);
    if (pRes.rows.length === 0) return res.status(404).json({ error: 'Player not found' });
    const pInfo = pRes.rows[0];
    if (pInfo.hp <= 0) return res.status(400).json({ error: 'Your ship is sunk! You cannot enter combat without repairing first.' });

    const cannonCheck = await pool.query('SELECT COALESCE(SUM(equipped), 0) as total FROM player_cannons WHERE player_id = $1 AND equipped > 0', [playerId]);
    if (parseInt(cannonCheck.rows[0].total) === 0) return res.status(400).json({ error: 'No cannons equipped! Please equip cannons from the equipment screen first.', noCannons: true });

    if (mapLevel && parseInt(mapLevel) !== (pInfo.current_map_level || 1) && !isTower && !isWeeklyBoss && !isTiamat) {
      return res.status(403).json({ error: 'You must be on this map to attack an NPC here!' });
    }

    const result = await resolveTargetNpc(pool, { mapLevel, isTower, isWeeklyBoss, isTiamat, npcName, pInfo, playerId });
    if (result.error) return res.status(400).json({ error: result.error });
    const { targetNpc, effectiveMapLevel, bossCurrentHp: initialBossHp } = result;

    let playerCooldownMs = await calculatePlayerCooldownMs(pool, playerId, isTower);
    let isAdmiral = false;
    let isTiamatFight = false;
    let bossCurrentHp = targetNpc.hp;

    if (targetNpc.isAdmiral) {
      isAdmiral = true;
      const admResult = await initAdmiralState(pool, effectiveMapLevel, targetNpc, pInfo, pInfo.hp);
      if (admResult.error) return res.status(400).json({ error: admResult.error });
      bossCurrentHp = admResult.bossCurrentHp;
    }
    if (targetNpc.isTiamat) {
      isTiamatFight = true;
      bossCurrentHp = initialBossHp !== undefined ? initialBossHp : targetNpc.hp;
      await pool.query(
        `INSERT INTO tiamat_damage (player_id, username, ship_level, current_hp, max_hp) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (player_id) DO UPDATE SET current_hp = $4, max_hp = $5, last_active = CURRENT_TIMESTAMP`,
        [playerId, pInfo.display_name || pInfo.username, pInfo.ship_level, pInfo.hp, pInfo.max_hp]
      );
    }

    await pool.query(`INSERT INTO active_fights (
      player_id, npc_name, npc_hp, npc_max_hp, npc_damage, npc_gold, npc_pearl, npc_xp,
      player_hp, player_max_hp, weekly_boss_damage_dealt, map_level, is_admiral, is_tiamat,
      is_tower, tower_id, full_img, damaged_img, is_weekly_boss, is_pvp, last_activity, last_npc_attack
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, CURRENT_TIMESTAMP, NULL)
    ON CONFLICT (player_id) DO UPDATE SET
      npc_name = EXCLUDED.npc_name, npc_hp = EXCLUDED.npc_hp, npc_max_hp = EXCLUDED.npc_max_hp,
      npc_damage = EXCLUDED.npc_damage, npc_gold = EXCLUDED.npc_gold, npc_pearl = EXCLUDED.npc_pearl,
      npc_xp = EXCLUDED.npc_xp, player_hp = EXCLUDED.player_hp, player_max_hp = EXCLUDED.player_max_hp,
      weekly_boss_damage_dealt = EXCLUDED.weekly_boss_damage_dealt, map_level = EXCLUDED.map_level,
      is_admiral = EXCLUDED.is_admiral, is_tiamat = EXCLUDED.is_tiamat, is_tower = EXCLUDED.is_tower,
      tower_id = EXCLUDED.tower_id, full_img = EXCLUDED.full_img, damaged_img = EXCLUDED.damaged_img,
      is_weekly_boss = EXCLUDED.is_weekly_boss, is_pvp = EXCLUDED.is_pvp, last_activity = CURRENT_TIMESTAMP, last_npc_attack = CURRENT_TIMESTAMP
    `, [
      playerId, targetNpc.name, (isAdmiral || isTiamatFight) ? bossCurrentHp : targetNpc.hp, targetNpc.hp,
      targetNpc.damage || 0, targetNpc.gold || 0, targetNpc.pearl || 0, targetNpc.xp || 0,
      pInfo.hp, pInfo.max_hp, 0, effectiveMapLevel, isAdmiral, isTiamatFight,
      !!isTower, targetNpc.towerId || null, targetNpc.fullImg || null, targetNpc.damagedImg || null,
      !!isWeeklyBoss, !!(targetNpc.isPvP)
    ]);

    res.json({
      message: 'Battle started', npcName: targetNpc.name,
      npcHp: (isAdmiral || isTiamatFight) ? bossCurrentHp : targetNpc.hp, npcMaxHp: targetNpc.hp,
      playerHp: pInfo.hp, playerMaxHp: pInfo.max_hp, isTower: !!isTower, isPvP: false,
      fullImg: targetNpc.fullImg || null, damagedImg: targetNpc.damagedImg || null,
      isAdmiral: isAdmiral, isTiamat: isTiamatFight, playerCooldownMs,
      ship_level: pInfo.ship_level, visual_ship_level: pInfo.visual_ship_level, active_design: pInfo.active_design
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/attack', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  const { ammoId, useBarut, useZirh } = req.body;
  const lockId = acquireAttackLock(playerId);
  if (!lockId) return res.status(429).json({ error: 'Attack already in progress' });
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  let _lockReleased = false;
  const _releaseLock = () => { if (_lockReleased) return; _lockReleased = true; releaseAttackLock(playerId, lockId); };
  res.on('finish', _releaseLock);
  let txClient = null;
  const T = (step) => console.log(`[P${playerId}][${Date.now()}] ${step}`);
  T('START');
  try {
    const fightRes = await pool.query('SELECT * FROM active_fights WHERE player_id = $1', [playerId]);
    if (fightRes.rows.length === 0) { T('NO_FIGHT'); return res.status(400).json({ error: 'No active fight' }); }
    T('FIGHT_OK');
    const fightRow = fightRes.rows[0];
    const fight = mapDbFightRowToFightState(fightRow);

    const NPC_ATTACK_INTERVAL_MS = 3000;
    const lastNpcAttack = fightRow.last_npc_attack ? new Date(fightRow.last_npc_attack).getTime() : 0;
    const npcCanAttack = (Date.now() - lastNpcAttack) >= NPC_ATTACK_INTERVAL_MS;

    let cooldownMs = await calculatePlayerCooldownMs(pool, playerId, fight.isTower);
    if (fight.isTower) cooldownMs = 3000;
    const elapsed = Date.now() - new Date(fightRow.last_activity).getTime();
    const tolerance = Math.min(1000, Math.round(cooldownMs * 0.2));
    if (elapsed + tolerance < cooldownMs) {
      T('TOO_FAST'); return res.status(429).json({ error: 'Too fast!', retryAfter: Math.ceil(cooldownMs - elapsed) });
    }
    T('COOLDOWN_OK');

    const currentEvent = await getCurrentEvent();
    const playerDbRes = await pool.query('SELECT username, display_name, ship_level, max_hp, hp, level, pvp_target_id FROM players WHERE id = $1', [playerId]);
    const pDbInfo = playerDbRes.rows[0];

    if (parseInt(pDbInfo.hp) <= 0) {
      _releaseLock(); T('DEAD'); return res.status(400).json({ error: 'Your ship is sunk! You cannot attack.' });
    }
    T('PLAYER_OK');

    if (fight.isAdmiral) {
      const aliveRes = await pool.query('SELECT boss_current_hp FROM npc3_kill_counter WHERE map_level = $1', [fight.mapLevel]);
      const rawBossHp = aliveRes.rows[0] ? aliveRes.rows[0].boss_current_hp : null;
      const bossHp = rawBossHp !== null ? parseInt(rawBossHp) : 0;
      if (bossHp <= 0) { T('ADM_DEAD'); return res.json({ state: 'boss_defeated', npcHp: 0, npcMaxHp: fight.npcMaxHp, playerHp: fight.playerHp, playerDamage: 0, npcDamage: 0, elpGained: 0, consumed: { ammo: 0, barut: 0, zirh: 0 }, isAdmiral: true, message: 'This boss has already been defeated!' }); }
    } else if (fight.isTiamat) {
      const aliveRes = await pool.query('SELECT current_hp FROM tiamat WHERE id = 1');
      const rawBossHp = aliveRes.rows[0] ? aliveRes.rows[0].current_hp : null;
      const bossHp = rawBossHp !== null ? parseInt(rawBossHp) : 0;
      if (bossHp <= 0) { T('TIAMAT_DEAD'); return res.json({ state: 'boss_defeated', npcHp: 0, npcMaxHp: fight.npcMaxHp, playerHp: fight.playerHp, playerDamage: 0, npcDamage: 0, elpGained: 0, consumed: { ammo: 0, barut: 0, zirh: 0 }, isTiamat: true, message: 'Tiamat has already been defeated!' }); }
    }
    T('BOSS_CHECK_OK');

    txClient = await pool.connect();
    T('TXN_CONNECT');
    await txClient.query("SET statement_timeout = '30s'");
    await txClient.query("SET lock_timeout = '5s'");
    await txClient.query("SET idle_in_transaction_session_timeout = '30s'");
    await txClient.query('BEGIN');
    T('TXN_BEGIN');

    const pd = await calculatePlayerDamage(pool, playerId, ammoId, txClient);
    T('CALC_DMG_DONE');

    const dm = await applyDamageModifiers(pool, playerId, pd, { npcUseBarut: false, npcUseZirh: false }, fight, { useBarut, useZirh, currentEvent, ammoId }, txClient);
    T('DAMAGE_MODS_DONE');

    let playerDamage = dm.finalDamage;
    let npcDamage = dm.finalNpcDamage;
    if (!npcCanAttack) npcDamage = 0;
    let gainedElp = dm.gainedElp;

    if (gainedElp > 0) {
      await txClient.query('UPDATE players SET elite_points = elite_points + $1 WHERE id = $2', [gainedElp, playerId]);
    }
    const npcObj = fight.npc || {};
    const npcNameStr = npcObj.name || '';
    const isBoss = npcNameStr.includes('Admiral') || npcNameStr === 'Tiamat';
    let actualHpLost = 0;
    let targetHitUsername = pDbInfo.display_name || pDbInfo.username;
    let targetHitId = playerId;
    let actualNpcDamage = npcDamage;

    if (fight.isAdmiral) {
      T('ADMIRAL_PATH');
      await txClient.query(`INSERT INTO admiral_damage (map_level, player_id, username, ship_level, damage_dealt, current_hp, max_hp) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (map_level, player_id) DO UPDATE SET damage_dealt = admiral_damage.damage_dealt + $5`,
        [fight.mapLevel, playerId, pDbInfo.display_name || pDbInfo.username, pDbInfo.ship_level, playerDamage, fight.playerHp, fight.playerMaxHp]);
      T('ADM_INSERTED');
      const result = await deductAdmiralBossHp(pool, fight.mapLevel, playerDamage, parseInt(fight.npcMaxHp), txClient);
      T('ADM_DEDUCT_DONE');
      fight.npcHp = result.newHp;
      actualHpLost = result.actualHpLost;
    } else if (fight.isTiamat) {
      T('TIAMAT_PATH');
      await txClient.query(`INSERT INTO tiamat_damage (player_id, username, ship_level, damage_dealt, current_hp, max_hp, spawn_generation) SELECT $1, $2, $3, $4, $5, $6, spawn_generation FROM tiamat WHERE id = 1 ON CONFLICT (player_id) DO UPDATE SET damage_dealt = tiamat_damage.damage_dealt + $4, current_hp = $5, max_hp = $6, ship_level = $3, spawn_generation = (SELECT spawn_generation FROM tiamat WHERE id = 1), last_active = CURRENT_TIMESTAMP`,
        [playerId, pDbInfo.display_name || pDbInfo.username, pDbInfo.ship_level, playerDamage, fight.playerHp, fight.playerMaxHp]);
      T('TIAMAT_INSERTED');
      const result = await deductTiamatBossHp(pool, playerDamage, parseInt(fight.npcMaxHp), txClient);
      T('TIAMAT_DEDUCT_DONE');
      fight.npcHp = result.newHp;
      actualHpLost = result.actualHpLost;
    } else {
      const prevNpcHp = fight.npcHp;
      fight.npcHp -= playerDamage;
      if (fight.npcHp < 0) fight.npcHp = 0;
      actualHpLost = prevNpcHp - fight.npcHp;
    }
    T('BOSS_DMG_DONE');

    if (playerDamage > 0 && actualHpLost > 0) {
      await updateQuestProgress(pool, playerId, { type: 'damage', npcNameStr, amount: actualHpLost, npcObj }, txClient);
    }
    T('QUEST_DMG_DONE');

    if (npcObj.isWeeklyBoss) {
      fight.npcHp = fight.npcMaxHp;
      fight.weeklyBossDamageDealt = (fight.weeklyBossDamageDealt || 0) + playerDamage;
      const currentWeekStr = getCurrentWeekString();
      await txClient.query(`UPDATE players SET weekly_boss_damage = CASE WHEN weekly_boss_week = $1 THEN weekly_boss_damage + $2 ELSE $2 END, weekly_boss_week = $1 WHERE id = $3`, [currentWeekStr, playerDamage, playerId]);
      T('WEEKLY_DONE');
    }

    if (fight.npcHp === 0) {
      await updateQuestProgress(pool, playerId, { type: 'kill', npcNameStr, amount: 1, npcObj }, txClient);
      const evMult = currentEvent.type === 'npc_reward' ? currentEvent.mult : 1;
      const rewardResult = await grantRewards(pool, { fight, playerId, playerDamage: actualHpLost, npcObj, isBoss, evMult, actualCannonsFired: pd.actualCannonsFired, useBarut, useZirh }, txClient);
      await txClient.query('COMMIT');
      txClient.release();
      txClient = null;
      T('NPC_KILLED');
      // Broadcast Tiamat/Admiral death to all players
      try {
        if (fight.isAdmiral) {
          broadcastBossHp(fight.mapLevel, { bossHp: 0, bossMaxHp: fight.npcMaxHp, leaderboard: [] });
        } else if (fight.isTiamat) {
          broadcastBossHp(0, { bossHp: 0, bossMaxHp: fight.npcMaxHp, leaderboard: [] });
        }
      } catch (e) {
        console.error('Broadcast death error:', e.message);
      }
      return res.json(rewardResult);
    }
    T('NPC_ALIVE');

    if (fight.isAdmiral && npcDamage > 0) {
      T('SEL_ADM_TARGET');
      const sel = await selectRandomAdmiralTarget(pool, fight.mapLevel, npcDamage, playerId, txClient);
      T('ADM_TARGET_SELECTED');
      targetHitId = sel.targetHitId;
      targetHitUsername = sel.targetHitUsername;
      actualNpcDamage = sel.actualNpcDamage;
      if (targetHitId === playerId) {
        fight.playerHp -= npcDamage;
        if (fight.playerHp < 0) fight.playerHp = 0;
      } else if (targetHitId !== null && targetHitId > 0) {
        actualNpcDamage = 0;
        await txClient.query('UPDATE players SET hp = GREATEST(0, hp - $1) WHERE id = $2', [npcDamage, targetHitId]);
        await txClient.query('UPDATE active_fights SET player_hp = GREATEST(0, player_hp - $1) WHERE player_id = $2', [npcDamage, targetHitId]);
      } else {
        actualNpcDamage = npcDamage;
        fight.playerHp -= npcDamage;
        if (fight.playerHp < 0) fight.playerHp = 0;
      }
    } else if (fight.isTiamat && npcDamage > 0) {
      T('SEL_TIAMAT_TARGET');
      const sel = await selectRandomTiamatTarget(pool, npcDamage, playerId, txClient);
      T('TIAMAT_TARGET_SELECTED');
      targetHitId = sel.targetHitId;
      targetHitUsername = sel.targetHitUsername;
      actualNpcDamage = sel.actualNpcDamage;
      if (targetHitId === playerId) {
        fight.playerHp -= npcDamage;
        if (fight.playerHp < 0) fight.playerHp = 0;
      } else if (targetHitId !== null && targetHitId > 0) {
        actualNpcDamage = 0;
        await txClient.query('UPDATE players SET hp = GREATEST(0, hp - $1) WHERE id = $2', [npcDamage, targetHitId]);
        await txClient.query('UPDATE active_fights SET player_hp = GREATEST(0, player_hp - $1) WHERE player_id = $2', [npcDamage, targetHitId]);
      } else {
        actualNpcDamage = npcDamage;
        fight.playerHp -= npcDamage;
        if (fight.playerHp < 0) fight.playerHp = 0;
      }
    } else {
      fight.playerHp -= npcDamage;
      if (fight.playerHp < 0) fight.playerHp = 0;
      await txClient.query('UPDATE players SET hp = $1 WHERE id = $2', [fight.playerHp, playerId]);
    }
    T('NPC_ATTACK_DONE');

    if (fight.playerHp === 0) {
      T('PLAYER_DEATH');
      const deathResult = await handlePlayerDeath(pool, { fight, playerId, playerDamage: actualHpLost, npcObj, isBoss, gainedElp, isWeeklyBoss: npcObj.isWeeklyBoss, actualCannonsFired: pd.actualCannonsFired, useBarut, useZirh, npcUseBarut: false, npcUseZirh: false, npcAmmoId: null, actualNpcDamage, targetHitUsername }, txClient);
      await txClient.query('COMMIT');
      txClient.release();
      txClient = null;
      T('DEATH_DONE');
      return res.json(deathResult);
    }
    T('PLAYER_ALIVE');

    if (npcObj.isTower) {
      await txClient.query('UPDATE players SET hp = $1 WHERE id = $2', [fight.playerHp, playerId]);
    } else if (fight.isAdmiral || fight.isTiamat) {
      await txClient.query('UPDATE players SET hp = $1 WHERE id = $2', [fight.playerHp, playerId]);
    } else if (isBoss) {
      await txClient.query('UPDATE players SET hp = $1, dmg_amiral = dmg_amiral + $2 WHERE id = $3', [fight.playerHp, actualHpLost, playerId]);
    } else {
      await txClient.query('UPDATE players SET hp = $1, dmg_pve = dmg_pve + $2 WHERE id = $3', [fight.playerHp, actualHpLost, playerId]);
    }
    T('PLAYER_HP_UPDATE');
    await txClient.query(`UPDATE active_fights SET npc_hp = $1, player_hp = $2, weekly_boss_damage_dealt = $3, last_activity = CURRENT_TIMESTAMP, last_npc_attack = CASE WHEN $5 THEN CURRENT_TIMESTAMP ELSE last_npc_attack END WHERE player_id = $4`,
      [fight.npcHp, fight.playerHp, fight.weeklyBossDamageDealt, playerId, npcCanAttack]);
    T('ACTIVE_FIGHT_UPDATE');
    await txClient.query('COMMIT');
    txClient.release();
    txClient = null;
    T('TXN_COMMIT');

    // Tiamat/Admiral → broadcast güncel HP'yi tüm client'lara
    if (actualHpLost > 0) {
      try {
        if (fight.isAdmiral) {
          const lbRes = await pool.query(
            `SELECT a.player_id, a.username, a.ship_level, a.damage_dealt, a.current_hp, a.max_hp, p.active_design
             FROM admiral_damage a
             JOIN players p ON p.id = a.player_id
             WHERE a.map_level = $1 AND a.player_id > 0
             ORDER BY a.damage_dealt DESC LIMIT 30`,
            [fight.mapLevel]
          );
          broadcastBossHp(fight.mapLevel, { bossHp: fight.npcHp, bossMaxHp: fight.npcMaxHp, leaderboard: lbRes.rows });
        } else if (fight.isTiamat) {
          const lbRes = await pool.query(
            `SELECT player_id, username, ship_level, damage_dealt, current_hp, max_hp
             FROM tiamat_damage
             WHERE player_id > 0 AND spawn_generation = (SELECT spawn_generation FROM tiamat WHERE id = 1)
             ORDER BY damage_dealt DESC LIMIT 30`
          );
          broadcastBossHp(0, { bossHp: fight.npcHp, bossMaxHp: fight.npcMaxHp, leaderboard: lbRes.rows });
        }
      } catch (e) {
        console.error('Broadcast error:', e.message);
      }
    }

    res.json({
      state: 'ongoing', npcHp: fight.npcHp, npcMaxHp: fight.npcMaxHp, playerHp: fight.playerHp, playerDamage: actualHpLost, npcDamage: actualNpcDamage,
      elpGained: gainedElp, weeklyBossDamageDealt: fight.weeklyBossDamageDealt || 0,
      consumed: { ammo: pd.actualCannonsFired, barut: (useBarut && pd.actualCannonsFired > 0) ? 1 : 0, zirh: useZirh ? 1 : 0 },
      opponentConsumed: { barut: 0, zirh: 0, ammoId: null },
      targetHit: targetHitUsername, isAdmiral: fight.isAdmiral, isTiamat: fight.isTiamat
    });
  } catch (err) {
    if (txClient) {
      try { await txClient.query('ROLLBACK'); } catch (e) { /* silent */ }
      txClient.release();
      txClient = null;
    }
    console.error(err);
    res.status(500).json({ error: 'Server error during combat' });
  } finally {
    _releaseLock();
  }
});

router.get('/admiral-status', authMiddleware, async (req, res) => {
  try {
    const playerRes = await pool.query('SELECT current_map_level FROM players WHERE id = $1', [req.player.id]);
    if (playerRes.rows.length === 0) return res.status(404).json({ error: 'Player not found' });
    const mapLevel = playerRes.rows[0].current_map_level || 1;
    const bcRes = await pool.query('SELECT boss_current_hp, boss_max_hp, is_spawned FROM npc3_kill_counter WHERE map_level = $1', [mapLevel]);
    if (bcRes.rows.length === 0 || !bcRes.rows[0].is_spawned || bcRes.rows[0].boss_current_hp === null || parseInt(bcRes.rows[0].boss_current_hp) <= 0) return res.json({ spawned: false });
    const dmgRes = await pool.query(
      `SELECT a.player_id, a.username, a.ship_level, a.damage_dealt, a.current_hp, a.max_hp, p.active_design, p.visual_ship_level FROM admiral_damage a LEFT JOIN players p ON p.id = a.player_id WHERE a.map_level = $1 ORDER BY a.damage_dealt DESC`,
      [mapLevel]
    );
    res.json({ spawned: true, bossHp: parseInt(bcRes.rows[0].boss_current_hp), bossMaxHp: parseInt(bcRes.rows[0].boss_max_hp), leaderboard: dmgRes.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/tiamat-status', authMiddleware, async (req, res) => {
  try {
    const tRes = await pool.query('SELECT hp, current_hp, respawn_at, manual_spawn FROM tiamat WHERE id = 1');
    if (tRes.rows.length === 0) return res.json({ spawned: false });

    const t = tRes.rows[0];
    if (t.current_hp !== null && t.current_hp > 0) {
      const dmgRes = await pool.query('SELECT player_id, username, ship_level, damage_dealt, current_hp, max_hp FROM tiamat_damage WHERE spawn_generation = (SELECT spawn_generation FROM tiamat WHERE id = 1) ORDER BY damage_dealt DESC');
      return res.json({ spawned: true, bossHp: parseInt(t.current_hp), bossMaxHp: parseInt(t.hp), leaderboard: dmgRes.rows });
    }

    // Dead or not spawned — check respawn timer or manual_spawn flag
    if (t.respawn_at === null || new Date(t.respawn_at) <= new Date() || t.manual_spawn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('UPDATE tiamat SET spawn_generation = spawn_generation + 1, current_hp = hp, respawn_at = NULL, manual_spawn = false WHERE id = 1');
        await client.query('DELETE FROM tiamat_damage');
        await client.query('COMMIT');
        sendPushToAll('tiamat_spawn', {});
      } catch (txErr) {
        await client.query('ROLLBACK');
        throw txErr;
      } finally {
        client.release();
      }
      const dmgRes = await pool.query('SELECT player_id, username, ship_level, damage_dealt, current_hp, max_hp FROM tiamat_damage ORDER BY damage_dealt DESC');
      return res.json({ spawned: true, bossHp: parseInt(t.hp), bossMaxHp: parseInt(t.hp), leaderboard: dmgRes.rows });
    }

    res.json({ spawned: false, respawnAt: t.respawn_at });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/boss-rewards', authMiddleware, async (req, res) => {
  try {
    res.json(await getWeeklyBossRewards());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
