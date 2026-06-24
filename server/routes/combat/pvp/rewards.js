const { isPlayerVip } = require('../../../helpers/rewards');

async function grantPvPRewards(pool, { fight, playerId, playerDamage, gainedElp, actualCannonsFired, useBarut, useZirh, npcUseBarut, npcUseZirh, npcAmmoId }) {
  const pData = await pool.query('SELECT pvp_target_id FROM players WHERE id = $1', [playerId]);
  const targetId = pData.rows.length > 0 ? pData.rows[0].pvp_target_id : null;

  await pool.query(
    `UPDATE players 
     SET pvp_points = pvp_points + 3, 
         kill_pvp = COALESCE(kill_pvp, 0) + 1,
         dmg_pvp = COALESCE(dmg_pvp, 0) + $1,
         pvp_target_id = NULL
     WHERE id = $2`,
    [playerDamage, playerId]
  );

  if (targetId && targetId > 0) {
    await pool.query(
      `UPDATE players 
       SET pvp_points = GREATEST(0, pvp_points - 3) 
       WHERE id = $1`,
      [targetId]
    );
  }

  await pool.query('DELETE FROM active_fights WHERE player_id = $1', [playerId]);
  return {
    state: 'won', npcHp: 0, playerHp: fight.playerHp, playerDamage: 0, npcDamage: 0,
    isPvP: true,
    rewards: { gold: 0, xp: 0, pearl: 0, elp: gainedElp, pvpPoints: 3 },
    consumed: { ammo: actualCannonsFired, barut: (useBarut && actualCannonsFired > 0) ? 1 : 0, zirh: useZirh ? 1 : 0 },
    opponentConsumed: { barut: npcUseBarut ? 1 : 0, zirh: npcUseZirh ? 1 : 0, ammoId: npcAmmoId }
  };
}

async function handlePvPPlayerDeath(pool, { fight, playerId, playerDamage, gainedElp, actualCannonsFired, useBarut, useZirh, npcUseBarut, npcUseZirh, npcAmmoId, actualNpcDamage }) {
  let beamsBroken = [];
  try {
    const plankRes = await pool.query(`
      SELECT pp.plank_type, pp.equipped, p.break_chance, p.hp_bonus, p.name
      FROM player_planks pp
      JOIN planks p ON pp.plank_type = p.type_key
      WHERE pp.player_id = $1 AND pp.equipped > 0
    `, [playerId]);
    let totalHpLoss = 0;
    for (const row of plankRes.rows) {
      let broken = 0;
      for (let i = 0; i < row.equipped; i++) {
        if (Math.random() * 100 < row.break_chance) {
          broken++;
        }
      }
      if (broken > 0) {
        totalHpLoss += broken * row.hp_bonus;
        beamsBroken.push({ type: row.plank_type, name: row.name, qty: broken });
        await pool.query(
          `UPDATE player_planks
           SET equipped = GREATEST(0, equipped - $1), quantity = GREATEST(0, quantity - $1)
           WHERE player_id = $2 AND plank_type = $3`,
          [broken, playerId, row.plank_type]
        );
      }
    }
    if (totalHpLoss > 0) {
      await pool.query(
        `UPDATE players SET max_hp = GREATEST(100, max_hp - $1), hp = LEAST(hp, GREATEST(100, max_hp - $1)) WHERE id = $2`,
        [totalHpLoss, playerId]
      );
    }
  } catch (beamErr) {
    console.error('Beam break error:', beamErr.message);
  }

  const pData = await pool.query('SELECT pvp_target_id, max_hp, vip_until FROM players WHERE id = $1', [playerId]);
  const targetId = pData.rows.length > 0 ? pData.rows[0].pvp_target_id : null;

  await pool.query(
    `UPDATE players 
     SET pvp_points = GREATEST(0, pvp_points - 3), 
          dmg_pvp = COALESCE(dmg_pvp, 0) + $1,
          pvp_target_id = NULL
     WHERE id = $2`,
    [playerDamage, playerId]
  );

  const respawnHp = (pData.rows.length > 0 && isPlayerVip(pData.rows[0]))
    ? Math.floor(parseInt(pData.rows[0].max_hp) * 0.1)
    : 1000;
  await pool.query('UPDATE players SET hp = $1 WHERE id = $2', [respawnHp, playerId]);

  if (targetId && targetId > 0) {
    await pool.query(
      `UPDATE players 
       SET pvp_points = pvp_points + 3 
       WHERE id = $1`,
      [targetId]
    );
  }

  await pool.query('DELETE FROM active_fights WHERE player_id = $1', [playerId]);
  return {
    state: 'lost', npcHp: fight.npcHp, playerHp: respawnHp, playerDamage: 0, npcDamage: actualNpcDamage,
    isPvP: true,
    rewards: { gold: 0, xp: 0, pearl: 0, elp: gainedElp, pvpPoints: 0 },
    consumed: { ammo: actualCannonsFired, barut: (useBarut && actualCannonsFired > 0) ? 1 : 0, zirh: useZirh ? 1 : 0 },
    opponentConsumed: { barut: npcUseBarut ? 1 : 0, zirh: npcUseZirh ? 1 : 0, ammoId: npcAmmoId },
    beamsBroken
  };
}

module.exports = { grantPvPRewards, handlePvPPlayerDeath };
