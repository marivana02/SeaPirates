async function checkAndApplyLevelUp(pool, playerId, currentXp, currentLevel) {
  let newLevel = currentLevel;
  let leveledUp = false;

  while (true) {
    const checkLvl = await pool.query(
      'SELECT required_xp FROM level_requirements WHERE level = $1',
      [newLevel + 1]
    );
    if (checkLvl.rows.length === 0) break;
    const reqXp = checkLvl.rows[0].required_xp;
    if (parseInt(currentXp) >= parseInt(reqXp)) {
      newLevel += 1;
      leveledUp = true;
    } else {
      break;
    }
  }

  if (leveledUp) {
    await pool.query(
      'UPDATE players SET level = $1 WHERE id = $2',
      [newLevel, playerId]
    );
  }

  return { leveledUp, newLevel };
}

async function getNextLevelXp(pool, level) {
  const nextLvlRes = await pool.query(
    'SELECT required_xp FROM level_requirements WHERE level = $1',
    [level + 1]
  );
  if (nextLvlRes.rows.length > 0) {
    return parseInt(nextLvlRes.rows[0].required_xp);
  }
  const curLvlRes = await pool.query(
    'SELECT required_xp FROM level_requirements WHERE level = $1',
    [level]
  );
  return curLvlRes.rows.length > 0 ? parseInt(curLvlRes.rows[0].required_xp) : 900000;
}

module.exports = { checkAndApplyLevelUp, getNextLevelXp };
