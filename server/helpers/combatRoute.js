function mapDbFightRowToFightState(dbFight) {
  return {
    npc: {
      name: dbFight.npc_name,
      hp: parseInt(dbFight.npc_max_hp),
      damage: parseInt(dbFight.npc_damage || 0),
      gold: parseInt(dbFight.npc_gold || 0),
      pearl: parseInt(dbFight.npc_pearl || 0),
      xp: parseInt(dbFight.npc_xp || 0),
      isTower: dbFight.is_tower,
      towerId: dbFight.tower_id,
      fullImg: dbFight.full_img,
      damagedImg: dbFight.damaged_img,
      isWeeklyBoss: dbFight.is_weekly_boss,
      isTiamat: dbFight.is_tiamat,
      isAdmiral: dbFight.is_admiral,
      isPvP: dbFight.is_pvp
    },
    npcHp: parseInt(dbFight.npc_hp),
    npcMaxHp: parseInt(dbFight.npc_max_hp),
    playerHp: parseInt(dbFight.player_hp),
    playerMaxHp: parseInt(dbFight.player_max_hp),
    weeklyBossDamageDealt: parseInt(dbFight.weekly_boss_damage_dealt || 0),
    mapLevel: dbFight.map_level,
    isAdmiral: dbFight.is_admiral,
    isTiamat: dbFight.is_tiamat,
    isTower: dbFight.is_tower,
    isPvP: dbFight.is_pvp,
    lastNpcAttack: dbFight.last_npc_attack
  };
}

async function getOpponentReloadMs(pool, opponentId) {
  try {
    if (opponentId === 'BOT') return 3000;
    const res = await pool.query(`
      SELECT pc.equipped, c.reload_time_ms
      FROM player_cannons pc
      JOIN cannons c ON pc.cannon_type = c.id
      WHERE pc.player_id = $1 AND pc.equipped > 0
    `, [opponentId]);
    if (res.rows.length === 0) return 3000;
    let totalWeighted = 0;
    let totalQty = 0;
    for (const row of res.rows) {
      totalWeighted += row.equipped * row.reload_time_ms;
      totalQty += row.equipped;
    }
    return totalQty > 0 ? Math.round(totalWeighted / totalQty) : 3000;
  } catch (e) {
    console.error('getOpponentReloadMs error:', e);
    return 3000;
  }
}

async function checkLevelUp(pool, playerId, client) {
  let leveledUp = false;
  let newLevel = null;
  let maxIter = 20;
  const db = client || pool;
  while (maxIter-- > 0) {
    const lvlRes = await db.query(
      `SELECT p.level, p.xp, lr.required_xp
       FROM players p
       LEFT JOIN level_requirements lr ON lr.level = p.level + 1
       WHERE p.id = $1`,
      [playerId]
    );
    if (lvlRes.rows.length === 0) break;
    const row = lvlRes.rows[0];
    if (row.required_xp === null || parseInt(row.xp) < parseInt(row.required_xp)) break;
    const updateRes = await db.query(
      'UPDATE players SET level = level + 1 WHERE id = $1 AND level = $2',
      [playerId, row.level]
    );
    if (updateRes.rowCount === 0) break;
    leveledUp = true;
    newLevel = parseInt(row.level) + 1;
  }
  return { leveledUp, newLevel };
}

module.exports = {
  mapDbFightRowToFightState,
  getOpponentReloadMs,
  checkLevelUp
};
