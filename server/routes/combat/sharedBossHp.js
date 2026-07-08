const { broadcastBossHp } = require('../../helpers/socket');

async function deductAdmiralBossHp(pool, mapLevel, playerDamage, bossMaxHp, client) {
  const useOwnTxn = !client;
  const bossClient = client || await pool.connect();
  let actualHpLost = 0;
  let newHp = 0;
  try {
    if (useOwnTxn) await bossClient.query("SET lock_timeout = '3s'");
    if (useOwnTxn) await bossClient.query('BEGIN');
    const bcRes = await bossClient.query(
      'SELECT boss_current_hp, is_spawned FROM npc3_kill_counter WHERE map_level = $1 FOR UPDATE',
      [mapLevel]
    );
    let sharedHp = 0;
    let isSpawned = true;
    if (bcRes.rows.length > 0) {
      isSpawned = bcRes.rows[0].is_spawned;
      if (bcRes.rows[0].boss_current_hp !== null) {
        sharedHp = parseInt(bcRes.rows[0].boss_current_hp);
      } else if (!isSpawned) {
        sharedHp = 0;
      }
    } else {
      sharedHp = 0;
    }

    const oldSharedHp = sharedHp;
    newHp = Math.max(0, sharedHp - playerDamage);
    actualHpLost = oldSharedHp - newHp;

    if (isSpawned) {
      await bossClient.query(
        'UPDATE npc3_kill_counter SET boss_current_hp = $1 WHERE map_level = $2',
        [newHp, mapLevel]
      );
    }

    if (useOwnTxn) await bossClient.query('COMMIT');
  } catch (txErr) {
    if (useOwnTxn) await bossClient.query('ROLLBACK');
    throw txErr;
  } finally {
    if (useOwnTxn) bossClient.release();
  }

  if (useOwnTxn && actualHpLost > 0) {
    try {
      const lbRes = await pool.query(
        `SELECT a.player_id, a.username, a.ship_level, a.damage_dealt, a.current_hp, a.max_hp, p.active_design
         FROM admiral_damage a
         JOIN players p ON p.id = a.player_id
         WHERE a.map_level = $1 AND a.player_id > 0
         ORDER BY a.damage_dealt DESC LIMIT 30`,
        [mapLevel]
      );
      broadcastBossHp(mapLevel, {
        bossHp: newHp,
        bossMaxHp: bossMaxHp,
        leaderboard: lbRes.rows
      });
    } catch (e) {
      console.error('Admiral socket broadcast error:', e.message);
    }
  }

  return { newHp, actualHpLost };
}

async function deductTiamatBossHp(pool, playerDamage, bossMaxHp, client) {
  // client parametresi verilirse ana transaction içinde çalışır (atomik)
  // verilmezse ayrı connection açar (bot/broadcast çağrıları)
  const useOwnTxn = !client;
  const tiamatClient = client || await pool.connect();
  let actualHpLost = 0;
  let newHp = 0;
  try {
    await tiamatClient.query("SET lock_timeout = '3s'");
    if (useOwnTxn) await tiamatClient.query('BEGIN');
    const tRes = await tiamatClient.query(
      'SELECT current_hp FROM tiamat WHERE id = 1 FOR UPDATE'
    );
    let sharedHp = 0;
    if (tRes.rows.length > 0 && tRes.rows[0].current_hp !== null) {
      sharedHp = parseInt(tRes.rows[0].current_hp);
    }

    const oldTiamatHp = sharedHp;
    newHp = Math.max(0, sharedHp - playerDamage);
    actualHpLost = oldTiamatHp - newHp;

    await tiamatClient.query(
      'UPDATE tiamat SET current_hp = $1 WHERE id = 1',
      [newHp]
    );

    // Tiamat öldüyse 1-3 saat random spawn süresi ayarla
    if (newHp <= 0) {
      const respawnDelayMs = Math.floor(Math.random() * (3 * 3600000 - 1 * 3600000 + 1)) + 1 * 3600000;
      await tiamatClient.query(
        "UPDATE tiamat SET respawn_at = NOW() + (($1 || ' milliseconds')::interval) WHERE id = 1",
        [respawnDelayMs]
      );
      console.log(`[TIAMAT] Killed! Respawn in ${Math.round(respawnDelayMs / 60000)} min`);
    }

    if (useOwnTxn) await tiamatClient.query('COMMIT');
  } catch (txErr) {
    if (useOwnTxn) await tiamatClient.query('ROLLBACK');
    throw txErr;
  } finally {
    if (useOwnTxn) tiamatClient.release();
  }

  // Broadcast sadece ayrı connection kullanılıyorsa burada yapılır
  // Ana transaction içindeyken broadcast çağıran tarafa bırakılır
  if (useOwnTxn && actualHpLost > 0) {
    try {
      const lbRes = await pool.query(
        `SELECT player_id, username, ship_level, damage_dealt, current_hp, max_hp
         FROM tiamat_damage
         WHERE player_id > 0 AND spawn_generation = (SELECT spawn_generation FROM tiamat WHERE id = 1)
         ORDER BY damage_dealt DESC LIMIT 30`
      );
      broadcastBossHp(0, {
        bossHp: newHp,
        bossMaxHp: bossMaxHp,
        leaderboard: lbRes.rows
      });
    } catch (e) {
      console.error('Tiamat socket broadcast error:', e.message);
    }
  }

  return { newHp, actualHpLost };
}

async function selectRandomAdmiralTarget(pool, mapLevel, npcDamage, excludePlayerId, client) {
  const useOwnTxn = !client;
  const targetClient = client || await pool.connect();
  try {
    if (useOwnTxn) await targetClient.query("SET lock_timeout = '3s'");
    if (useOwnTxn) await targetClient.query('BEGIN');
    const partRes = await targetClient.query(
      'SELECT player_id, username, current_hp FROM admiral_damage WHERE map_level = $1 AND current_hp > 0 AND player_id != $2',
      [mapLevel, excludePlayerId]
    );

    let targetHitId = null;
    let targetHitUsername = null;
    let actualNpcDamage = 0;

    if (partRes.rows.length > 0) {
      const targetRow = partRes.rows[Math.floor(Math.random() * partRes.rows.length)];
      targetHitId = parseInt(targetRow.player_id);
      targetHitUsername = targetRow.username;
    }

    if (targetHitId !== null) {
      const lockRes = await targetClient.query(
        'SELECT current_hp FROM admiral_damage WHERE map_level = $1 AND player_id = $2 AND current_hp > 0 FOR UPDATE',
        [mapLevel, targetHitId]
      );
      if (lockRes.rows.length > 0) {
        actualNpcDamage = npcDamage;
        await targetClient.query(
          'UPDATE admiral_damage SET current_hp = GREATEST(0, current_hp - $1) WHERE map_level = $2 AND player_id = $3',
          [npcDamage, mapLevel, targetHitId]
        );
      }
    }

    if (useOwnTxn) await targetClient.query('COMMIT');

    return { targetHitId, targetHitUsername, actualNpcDamage };
  } catch (txErr) {
    if (useOwnTxn) await targetClient.query('ROLLBACK');
    throw txErr;
  } finally {
    if (useOwnTxn) targetClient.release();
  }
}

async function selectRandomTiamatTarget(pool, npcDamage, excludePlayerId, client) {
  const useOwnTxn = !client;
  const targetClient = client || await pool.connect();
  try {
    if (useOwnTxn) await targetClient.query("SET lock_timeout = '3s'");
    if (useOwnTxn) await targetClient.query('BEGIN');
    const partRes = await targetClient.query(
      'SELECT player_id, username, current_hp FROM tiamat_damage WHERE current_hp > 0 AND player_id != $1 AND spawn_generation = (SELECT spawn_generation FROM tiamat WHERE id = 1)',
      [excludePlayerId]
    );

    let targetHitId = null;
    let targetHitUsername = null;
    let actualNpcDamage = 0;

    if (partRes.rows.length > 0) {
      const targetRow = partRes.rows[Math.floor(Math.random() * partRes.rows.length)];
      targetHitId = parseInt(targetRow.player_id);
      targetHitUsername = targetRow.username;
    }

    if (targetHitId !== null) {
      const lockRes = await targetClient.query(
        'SELECT current_hp FROM tiamat_damage WHERE player_id = $1 AND current_hp > 0 FOR UPDATE',
        [targetHitId]
      );
      if (lockRes.rows.length > 0) {
        actualNpcDamage = npcDamage;
        await targetClient.query(
          'UPDATE tiamat_damage SET current_hp = GREATEST(0, current_hp - $1) WHERE player_id = $2',
          [npcDamage, targetHitId]
        );
      }
    }

    if (useOwnTxn) await targetClient.query('COMMIT');
    return { targetHitId, targetHitUsername, actualNpcDamage };
  } catch (txErr) {
    if (useOwnTxn) await targetClient.query('ROLLBACK');
    throw txErr;
  } finally {
    if (useOwnTxn) targetClient.release();
  }
}

module.exports = { deductAdmiralBossHp, deductTiamatBossHp, selectRandomAdmiralTarget, selectRandomTiamatTarget };
