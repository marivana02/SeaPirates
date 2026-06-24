const {
  DEFAULT_NPC_FALLBACK, WEEKLY_BOSS_HP, WEEKLY_BOSS_DMG,
  TOWER_MIN_LEVEL, TOWER_MAX_LEVEL, TOWER_BASE_HP, TOWER_HP_PER_LEVEL,
  TOWER_BASE_DAMAGE, TOWER_DAMAGE_PER_LEVEL, TOWER_BASE_PEARL, TOWER_PEARL_PER_LEVEL
} = require('./constants');

async function initTowerState(pool, playerId, towerLvl) {
  const cappedLvl = Math.min(towerLvl, TOWER_MAX_LEVEL);
  const hp = TOWER_BASE_HP + ((cappedLvl - 1) * TOWER_HP_PER_LEVEL);
  const damage = TOWER_BASE_DAMAGE + ((cappedLvl - 1) * TOWER_DAMAGE_PER_LEVEL);
  const pearl = TOWER_BASE_PEARL + (cappedLvl * TOWER_PEARL_PER_LEVEL);

  let name = '';
  let fullImg = '';
  let damagedImg = '';
  let calculatedTowerId = 1;

  if (towerLvl <= 25) {
    name = `Tower (Lvl ${towerLvl})`;
    fullImg = 'assets/enemies/tower/low1.png';
    damagedImg = 'assets/enemies/tower/low2.png';
    calculatedTowerId = 1;
  } else if (towerLvl <= 50) {
    name = `Tower (Lvl ${towerLvl})`;
    fullImg = 'assets/enemies/tower/low3.png';
    damagedImg = 'assets/enemies/tower/low4.png';
    calculatedTowerId = 2;
  } else if (towerLvl <= 75) {
    name = `Tower (Lvl ${towerLvl})`;
    fullImg = 'assets/enemies/tower/middle1.png';
    damagedImg = 'assets/enemies/tower/middle2.png';
    calculatedTowerId = 3;
  } else {
    name = towerLvl >= 100 ? 'Tower (MAX)' : `Tower (Lvl ${towerLvl})`;
    fullImg = 'assets/enemies/tower/hard1.png';
    damagedImg = 'assets/enemies/tower/hard2.png';
    calculatedTowerId = 5;
  }

  return {
    name, hp, damage, gold: 0, xp: 0, pearl,
    isTower: true, towerId: calculatedTowerId, fullImg, damagedImg
  };
}

async function initWeeklyBoss() {
  return {
    name: 'Efsanevi Leviathan',
    hp: WEEKLY_BOSS_HP,
    damage: WEEKLY_BOSS_DMG,
    gold: 0, xp: 0, pearl: 0,
    isWeeklyBoss: true,
    fullImg: 'assets/ui/weekly_boss.png',
    damagedImg: 'assets/ui/weekly_boss.png'
  };
}

async function initTiamatState(pool) {
  const tiamatRes = await pool.query('SELECT hp, damage, pearl, xp, current_hp, respawn_at FROM tiamat WHERE id = 1');
  if (tiamatRes.rows.length === 0) {
    return null;
  }
  const t = tiamatRes.rows[0];
  let tiamatHp;

  if (t.current_hp !== null && t.current_hp > 0) {
    tiamatHp = parseInt(t.current_hp);
  } else {
    if (t.respawn_at !== null && new Date(t.respawn_at) > new Date()) {
      return { error: 'Tiamat has not respawned yet. Check back later!' };
    }
    await pool.query('UPDATE tiamat SET current_hp = hp, respawn_at = NULL WHERE id = 1');
    tiamatHp = parseInt(t.hp);
  }

  return {
    targetNpc: {
      name: 'Tiamat',
      hp: parseInt(t.hp),
      damage: parseInt(t.damage),
      gold: 0,
      pearl: parseInt(t.pearl),
      xp: parseInt(t.xp),
      isTiamat: true
    },
    bossCurrentHp: tiamatHp
  };
}

async function initAdmiralState(pool, fightMapLvl, targetNpc, pInfo, playerHp) {
  const spawnCheck = await pool.query(
    'SELECT is_spawned FROM npc3_kill_counter WHERE map_level = $1',
    [fightMapLvl]
  );
  if (spawnCheck.rows.length > 0 && !spawnCheck.rows[0].is_spawned) {
    return { error: 'No active admiral boss on this map.' };
  }

  await pool.query(
    `INSERT INTO admiral_damage (map_level, player_id, username, ship_level, current_hp, max_hp)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (map_level, player_id) 
     DO UPDATE SET current_hp = $5, max_hp = $6, last_active = CURRENT_TIMESTAMP`,
    [fightMapLvl, pInfo.id, pInfo.display_name || pInfo.username, pInfo.ship_level, playerHp, pInfo.max_hp]
  );

  const bcRes = await pool.query(
    'SELECT boss_current_hp FROM npc3_kill_counter WHERE map_level = $1',
    [fightMapLvl]
  );
  let bossCurrentHp = targetNpc.hp;
  if (bcRes.rows.length > 0) {
    const row = bcRes.rows[0];
    if (row.boss_current_hp !== null && row.boss_current_hp > 0) {
      bossCurrentHp = parseInt(row.boss_current_hp);
    } else {
      await pool.query(
        'UPDATE npc3_kill_counter SET boss_current_hp = $1, boss_max_hp = $2 WHERE map_level = $3',
        [targetNpc.hp, targetNpc.hp, fightMapLvl]
      );
      bossCurrentHp = targetNpc.hp;
    }
  } else {
    await pool.query(
      'INSERT INTO npc3_kill_counter (map_level, kill_count, is_spawned, boss_current_hp, boss_max_hp) VALUES ($1, 0, TRUE, $2, $2)',
      [fightMapLvl, targetNpc.hp]
    );
    bossCurrentHp = targetNpc.hp;
  }

  return { bossCurrentHp };
}

async function resolveTargetNpc(pool, { mapLevel, isTower, isPvP, isWeeklyBoss, isTiamat, npcName, pInfo, playerId }) {
  const effectiveMapLevel = (isTower || isWeeklyBoss || isTiamat) ? (mapLevel || 1) : (pInfo.current_map_level || 1);

  if (isTower) {
    const pLvl = pInfo.level || 1;
    if (pLvl < TOWER_MIN_LEVEL) {
      return { error: 'You must be at least level 5 to participate in Tower Battles!' };
    }

    const checkLock = await pool.query('SELECT last_tower_attack FROM players WHERE id = $1', [playerId]);
    if (checkLock.rows.length > 0 && checkLock.rows[0].last_tower_attack) {
      const lastAttack = new Date(checkLock.rows[0].last_tower_attack).toISOString().split('T')[0];
      const today = new Date().toISOString().split('T')[0];
      if (lastAttack === today) {
        return { error: 'You already attacked a tower today. Try again tomorrow!' };
      }
    }

    const pRes2 = await pool.query('SELECT tower_level FROM players WHERE id = $1', [playerId]);
    const towerLvl = (pRes2.rows[0] && pRes2.rows[0].tower_level) || 1;

    await pool.query('UPDATE players SET last_tower_attack = CURRENT_DATE WHERE id = $1', [playerId]);

    const targetNpc = await initTowerState(pool, playerId, towerLvl);
    return { targetNpc, effectiveMapLevel };
  }

  if (isWeeklyBoss) {
    const checkLock = await pool.query('SELECT last_boss_attack FROM players WHERE id = $1', [playerId]);
    if (checkLock.rows.length > 0 && checkLock.rows[0].last_boss_attack) {
      const lastAttack = new Date(checkLock.rows[0].last_boss_attack).toISOString().split('T')[0];
      const today = new Date().toISOString().split('T')[0];
      if (lastAttack === today) {
        return { error: 'You already attacked the Boss today! Try again tomorrow.' };
      }
    }

    await pool.query('UPDATE players SET last_boss_attack = CURRENT_DATE WHERE id = $1', [playerId]);

    const targetNpc = await initWeeklyBoss();
    return { targetNpc, effectiveMapLevel };
  }

  if (isTiamat) {
    const result = await initTiamatState(pool);
    if (!result) {
      return { error: 'Tiamat data not found!' };
    }
    if (result.error) {
      return { error: result.error };
    }
    return { targetNpc: result.targetNpc, bossCurrentHp: result.bossCurrentHp, effectiveMapLevel };
  }

  let targetNpc = null;

  if (npcName && npcName.startsWith('Admiral')) {
    const bossDbRes = await pool.query(
      'SELECT name, hp, damage, pearl, xp FROM bosses WHERE map_level = $1 AND name = $2 LIMIT 1',
      [effectiveMapLevel, npcName]
    );
    if (bossDbRes.rows.length > 0) {
      const dbBoss = bossDbRes.rows[0];
      let bossImg = `assets/ships/npcc/map${effectiveMapLevel}/calicosJack.swf/images/amiraljack.png`;
      if (effectiveMapLevel === 2) {
        bossImg = `assets/ships/npcc/map2/ratpack.swf/images/amiralratpack.png`;
      } else if (effectiveMapLevel === 3) {
        bossImg = `assets/ships/npcc/map3/losrenegados.swf/images/amiralrenegado.png`;
      } else if (effectiveMapLevel !== 1) {
        bossImg = `assets/ships/npcc/map${effectiveMapLevel}/calicosJack.swf/images/amiraljack.png`;
      }

      targetNpc = {
        name: dbBoss.name,
        hp: parseInt(dbBoss.hp),
        damage: parseInt(dbBoss.damage),
        gold: 0,
        pearl: parseInt(dbBoss.pearl),
        xp: parseInt(dbBoss.xp),
        isAdmiral: true,
        fullImg: bossImg,
        damagedImg: bossImg
      };
    }
  }

  if (!targetNpc) {
    const npcDbRes = await pool.query(
      'SELECT name, hp, damage, gold, pearl, xp FROM npcs WHERE map_level = $1 AND name = $2 LIMIT 1',
      [effectiveMapLevel, npcName]
    );

    if (npcDbRes.rows.length > 0) {
      const dbNpc = npcDbRes.rows[0];
      targetNpc = {
        name: dbNpc.name,
        hp: parseInt(dbNpc.hp),
        damage: parseInt(dbNpc.damage),
        gold: parseInt(dbNpc.gold),
        pearl: parseInt(dbNpc.pearl),
        xp: parseInt(dbNpc.xp)
      };
    } else {
      return { error: 'NPC not found on this map' };
    }
  }

  return { targetNpc, effectiveMapLevel, bossCurrentHp: targetNpc.hp };
}

module.exports = { resolveTargetNpc, initTowerState, initWeeklyBoss, initAdmiralState, initTiamatState };
