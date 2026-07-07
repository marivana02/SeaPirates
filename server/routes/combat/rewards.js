const { getCurrentWeekString } = require('../../helpers/date');
const { getWeeklyBossRewards, distributeAdmiralRewards, distributeTiamatRewards } = require('../../helpers/combat');
const { checkLevelUp } = require('../../helpers/combatRoute');
const { sendPushToAll } = require('../../helpers/fcm');
const { isPlayerVip } = require('../../helpers/rewards');

async function getRespawnHp(pool, playerId, maxHp) {
  const pRes = await pool.query('SELECT vip_until FROM players WHERE id = $1', [playerId]);
  const player = pRes.rows[0] || {};
  if (isPlayerVip(player)) return Math.floor(maxHp * 0.1);
  return 1000;
}

async function distributeOldWeekRewards(pool) {
  const currentWeek = getCurrentWeekString();
  const oldWeekCheck = await pool.query(
    `SELECT DISTINCT weekly_boss_week 
     FROM players 
     WHERE weekly_boss_week IS NOT NULL 
       AND weekly_boss_week != '' 
       AND weekly_boss_week != $1 
       AND weekly_boss_damage > 0`,
    [currentWeek]
  );

  if (oldWeekCheck.rows.length === 0) return;

  const rewardClient = await pool.connect();
  try {
    await rewardClient.query('BEGIN');
    await rewardClient.query("SELECT pg_advisory_xact_lock(7372767)");

    const oldWeekRes = await rewardClient.query(
      `SELECT weekly_boss_week 
       FROM players 
       WHERE weekly_boss_week IS NOT NULL 
         AND weekly_boss_week != '' 
         AND weekly_boss_week != $1 
         AND weekly_boss_damage > 0
       GROUP BY weekly_boss_week
       ORDER BY weekly_boss_week ASC`,
      [currentWeek]
    );

    const rewardsMap = await getWeeklyBossRewards();

    for (const row of oldWeekRes.rows) {
      const oldWeek = row.weekly_boss_week;
      const topRes = await rewardClient.query(
        `SELECT id, COALESCE(display_name, username) AS username, weekly_boss_damage 
         FROM players 
         WHERE weekly_boss_week = $1 AND weekly_boss_damage > 0 
         ORDER BY weekly_boss_damage DESC LIMIT 10`,
        [oldWeek]
      );

      for (let idx = 0; idx < topRes.rows.length; idx++) {
        const player = topRes.rows[idx];
        const rank = idx + 1;

        const reward = rewardsMap[rank] || { pearls: 0, ammo: 0 };
        let pearls = reward.pearls;
        let ammo = reward.ammo;

        if (pearls > 0) {
          await rewardClient.query(
            'UPDATE players SET pearl = pearl + $1 WHERE id = $2',
            [pearls, player.id]
          );
        }
        if (ammo > 0) {
          await rewardClient.query(
            `INSERT INTO player_ammo (player_id, ammo_type, quantity) 
             VALUES ($1, 3, $2) 
             ON CONFLICT (player_id, ammo_type) 
             DO UPDATE SET quantity = player_ammo.quantity + EXCLUDED.quantity`,
            [player.id, ammo]
          );
        }
        console.log(`[WEEKLY BOSS REWARD] Week ${oldWeek} - Rank ${rank} (${player.username}): Sent ${pearls} Pearls and ${ammo} Ammo`);
      }

      await rewardClient.query(
        `UPDATE players 
         SET weekly_boss_damage = 0, weekly_boss_week = $1 
         WHERE weekly_boss_week = $2 AND weekly_boss_damage > 0`,
        [currentWeek, oldWeek]
      );
    }

    await rewardClient.query('COMMIT');
  } catch (err) {
    await rewardClient.query('ROLLBACK');
    console.error('[WEEKLY BOSS REWARD ERROR] Rollback triggered:', err);
  } finally {
    rewardClient.release();
  }
}

async function grantRewards(pool, { fight, playerId, playerDamage, npcObj, isBoss, evMult, actualCannonsFired, useBarut, useZirh }, client) {
  const db = client || pool;
  let rewGold = Math.floor((npcObj.gold || 0) * evMult);
  let rewPearl = Math.floor((npcObj.pearl || 0) * evMult);
  let rewXp = Math.floor((npcObj.xp || 0) * evMult);

  if (npcObj.isTower) {
    await db.query(
      `UPDATE players 
       SET pearl = pearl + $1,
            hp = $2,
            tower_level = LEAST(COALESCE(tower_level, 1) + 1, 100)
       WHERE id = $3`,
      [rewPearl, fight.playerHp, playerId]
    );
  } else if (fight.isAdmiral) {
    await db.query(
      `UPDATE players 
       SET dmg_amiral = dmg_amiral + $1
       WHERE id = $2`,
      [playerDamage, playerId]
    );

    const dmgRes = await db.query(
      'SELECT COALESCE(damage_dealt, 0) as dmg FROM admiral_damage WHERE player_id = $1 AND map_level = $2',
      [playerId, fight.mapLevel]
    );
    const totalDmg = parseInt(dmgRes.rows[0]?.dmg || 0) + playerDamage;

    const bossRes = await db.query('SELECT hp, pearl, xp FROM bosses WHERE map_level = $1 LIMIT 1', [fight.mapLevel]);
    const bossInfo = bossRes.rows[0];
    const bossMaxHp = parseInt(bossInfo?.hp) || 150000;
    const totalPearls = parseInt(bossInfo?.pearl) || 15000;
    const totalXp = parseInt(bossInfo?.xp) || 250;

    const pct = Math.min(1.0, totalDmg / bossMaxHp);
    const rewAdmPearl = Math.floor(totalPearls * pct);
    const rewAdmXp = Math.floor(totalXp * pct);
    const rewAdmElite = Math.floor(rewAdmXp * 0.5);

    const { rewardsGiven, skipReason } = await distributeAdmiralRewards(fight.mapLevel);

    await db.query('DELETE FROM active_fights WHERE player_id = $1', [playerId]);

    const { leveledUp: admiralLeveledUp, newLevel: admiralNewLevel } = await checkLevelUp(pool, playerId, db);
    return {
      state: 'won', npcHp: 0, npcMaxHp: fight.npcMaxHp, playerHp: fight.playerHp, playerDamage: 0, npcDamage: 0,
      rewards: rewardsGiven ? { gold: 0, pearl: rewAdmPearl, xp: rewAdmXp } : { gold: 0, pearl: 0, xp: 0 },
      consumed: { ammo: actualCannonsFired, barut: (useBarut && actualCannonsFired > 0) ? 1 : 0, zirh: useZirh ? 1 : 0 },
      leveledUp: admiralLeveledUp,
      newLevel: admiralNewLevel,
      isAdmiral: true,
      rewardSkipReason: skipReason || null
    };
  } else if (fight.isTiamat) {
    await db.query(
      `UPDATE players 
       SET dmg_amiral = dmg_amiral + $1
       WHERE id = $2`,
      [playerDamage, playerId]
    );
    const tiamatRewards = await distributeTiamatRewards(playerId);

    await db.query('DELETE FROM active_fights WHERE player_id = $1', [playerId]);

    const respawnHp = await getRespawnHp(pool, playerId, fight.playerMaxHp);
    await db.query('UPDATE players SET hp = $1 WHERE id = $2', [respawnHp, playerId]);

    const { leveledUp, newLevel } = await checkLevelUp(pool, playerId, db);
    return {
      state: 'won', npcHp: 0, npcMaxHp: fight.npcMaxHp, playerHp: respawnHp, playerDamage: 0, npcDamage: 0,
      rewards: { gold: 0, pearl: tiamatRewards.pearl, xp: tiamatRewards.xp },
      consumed: { ammo: actualCannonsFired, barut: (useBarut && actualCannonsFired > 0) ? 1 : 0, zirh: useZirh ? 1 : 0 },
      leveledUp,
      newLevel,
      isTiamat: true
    };
  } else if (isBoss) {
    await db.query(
      `UPDATE players 
       SET gold = gold + $1, 
            pearl = pearl + $2, 
            xp = xp + $3,
            dmg_amiral = dmg_amiral + $4
       WHERE id = $5`,
      [rewGold, rewPearl, rewXp, playerDamage, playerId]
    );
  } else {
    await db.query(
      `UPDATE players 
       SET gold = gold + $1, 
            pearl = pearl + $2, 
            xp = xp + $3,
            dmg_pve = dmg_pve + $4,
            kill_npc = kill_npc + 1
       WHERE id = $5`,
      [rewGold, rewPearl, rewXp, playerDamage, playerId]
    );

    if (!npcObj.isTower && !npcObj.isWeeklyBoss) {
      try {
        const fightMapLvl = fight.mapLevel || 1;
        const spawnClient = await pool.connect();
        try {
          await spawnClient.query('BEGIN');
          await spawnClient.query(
            `INSERT INTO npc3_kill_counter (map_level, kill_count)
             VALUES ($1, 1)
             ON CONFLICT (map_level)
             DO UPDATE SET kill_count = npc3_kill_counter.kill_count + 1`,
            [fightMapLvl]
          );

          const bcRes = await spawnClient.query(
            'SELECT kill_count, is_spawned FROM npc3_kill_counter WHERE map_level = $1 FOR UPDATE',
            [fightMapLvl]
          );
          const bossRes = await spawnClient.query(
            'SELECT required_kills, name FROM bosses WHERE map_level = $1',
            [fightMapLvl]
          );

          if (bcRes.rows.length > 0 && bossRes.rows.length > 0) {
            const bc = bcRes.rows[0];
            const bossInfo = bossRes.rows[0];

            if (!bc.is_spawned && bc.kill_count >= bossInfo.required_kills) {
              const maxSubs = fightMapLvl <= 4 ? 2 : 1;
              const randomSubMap = Math.floor(Math.random() * maxSubs) + 1;

              await spawnClient.query(
                `UPDATE npc3_kill_counter 
                 SET is_spawned = TRUE, 
                     spawned_sub_map = $1, 
                     kill_count = 0 
                 WHERE map_level = $2`,
                [randomSubMap, fightMapLvl]
              );
              console.log(`[BOSS SPAWN] ${bossInfo.name} spawned in Map ${fightMapLvl}-${randomSubMap}!`);
              sendPushToAll('admiral_spawn', { map: fightMapLvl, sub: randomSubMap, name: bossInfo.name }, fightMapLvl);
            }
          }
          await spawnClient.query('COMMIT');
        } catch (txErr) {
          await spawnClient.query('ROLLBACK');
          throw txErr;
        } finally {
          spawnClient.release();
        }
      } catch (counterErr) {
        console.error('NPC3 kill counter increment error:', counterErr);
      }
    }
  }

  const { leveledUp, newLevel } = await checkLevelUp(pool, playerId, db);

  await db.query('DELETE FROM active_fights WHERE player_id = $1', [playerId]);
  return {
    state: 'won', npcHp: 0, npcMaxHp: fight.npcMaxHp, playerHp: fight.playerHp, playerDamage: 0, npcDamage: 0,
    rewards: { gold: rewGold, xp: rewXp, pearl: rewPearl },
    consumed: { ammo: actualCannonsFired, barut: (useBarut && actualCannonsFired > 0) ? 1 : 0, zirh: useZirh ? 1 : 0 },
    leveledUp,
    newLevel,
    isAdmiral: fight.isAdmiral,
    isTiamat: fight.isTiamat
  };
}

async function handlePlayerDeath(pool, { fight, playerId, playerDamage, npcObj, isBoss, gainedElp, isWeeklyBoss, actualCannonsFired, useBarut, useZirh, npcUseBarut, npcUseZirh, npcAmmoId, actualNpcDamage, targetHitUsername }, client) {
  const db = client || pool;
  let beamsBroken = [];
  try {
    const plankRes = await db.query(`
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
        await db.query(
          `UPDATE player_planks
           SET equipped = GREATEST(0, equipped - $1), quantity = GREATEST(0, quantity - $1)
           WHERE player_id = $2 AND plank_type = $3`,
          [broken, playerId, row.plank_type]
        );
      }
    }
    if (totalHpLoss > 0) {
      await db.query(
        `UPDATE players SET max_hp = GREATEST(100, max_hp - $1), hp = LEAST(hp, GREATEST(100, max_hp - $1)) WHERE id = $2`,
        [totalHpLoss, playerId]
      );
    }
  } catch (beamErr) {
    console.error('Beam break error:', beamErr.message);
  }

  const pInfo = await db.query('SELECT max_hp, vip_until FROM players WHERE id = $1', [playerId]);
  const respawnHp = pInfo.rows.length ? await getRespawnHp(pool, playerId, parseInt(pInfo.rows[0].max_hp)) : 1000;

  if (npcObj.isWeeklyBoss) {
    const totalSessionDmg = fight.weeklyBossDamageDealt || 0;
    await db.query(
      `UPDATE players SET hp = max_hp WHERE id = $1`,
      [playerId]
    );
    await db.query('DELETE FROM active_fights WHERE player_id = $1', [playerId]);
    return {
      state: 'lost', npcHp: fight.npcHp, npcMaxHp: fight.npcMaxHp, playerHp: 0, playerDamage: 0, npcDamage: actualNpcDamage,
      isWeeklyBoss: true,
      weeklyBossDamageDealt: totalSessionDmg,
      rewards: { gold: 0, xp: 0, pearl: 0 },
      consumed: { ammo: actualCannonsFired, barut: (useBarut && actualCannonsFired > 0) ? 1 : 0, zirh: useZirh ? 1 : 0 },
      opponentConsumed: { barut: npcUseBarut ? 1 : 0, zirh: npcUseZirh ? 1 : 0, ammoId: npcAmmoId },
      beamsBroken
    };
  }

  if (fight.isAdmiral) {
    await db.query(
      `UPDATE players SET hp = $1, dmg_amiral = dmg_amiral + $2 WHERE id = $3`,
      [respawnHp, playerDamage, playerId]
    );
  } else if (fight.isTiamat) {
    await db.query(
      `UPDATE players SET hp = $1, dmg_amiral = dmg_amiral + $2 WHERE id = $3`,
      [respawnHp, playerDamage, playerId]
    );
    await db.query('DELETE FROM active_fights WHERE player_id = $1', [playerId]);
    return {
      state: 'lost', npcHp: fight.npcHp, npcMaxHp: fight.npcMaxHp, playerHp: respawnHp, playerDamage: 0, npcDamage: actualNpcDamage,
      consumed: { ammo: actualCannonsFired, barut: (useBarut && actualCannonsFired > 0) ? 1 : 0, zirh: useZirh ? 1 : 0 },
      targetHit: targetHitUsername,
      isTiamat: true,
      beamsBroken
    };
  } else if (isBoss) {
    await db.query(
      `UPDATE players SET hp = $1, dmg_amiral = dmg_amiral + $2 WHERE id = $3`,
      [respawnHp, playerDamage, playerId]
    );
  } else {
    await db.query(
      `UPDATE players SET hp = $1, dmg_pve = dmg_pve + $2 WHERE id = $3`,
      [respawnHp, playerDamage, playerId]
    );
  }
  await db.query('DELETE FROM active_fights WHERE player_id = $1', [playerId]);
  return {
    state: 'lost', npcHp: fight.npcHp, npcMaxHp: fight.npcMaxHp, playerHp: respawnHp, playerDamage: 0, npcDamage: actualNpcDamage,
    consumed: { ammo: actualCannonsFired, barut: (useBarut && actualCannonsFired > 0) ? 1 : 0, zirh: useZirh ? 1 : 0 },
    targetHit: targetHitUsername,
    beamsBroken
  };
}

module.exports = { distributeOldWeekRewards, grantRewards, handlePlayerDeath };
