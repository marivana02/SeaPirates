const gameData = require('../../config/gameData');
const { DEFAULT_PLAYER_COOLDOWN_MS, TOWER_COOLDOWN_MS, BARUT_MULTIPLIER } = require('./constants');

async function calculatePlayerCooldownMs(pool, playerId, isTower) {
  const reloadQuery = await pool.query(`
    SELECT pc.equipped, c.reload_time_ms
    FROM player_cannons pc
    JOIN cannons c ON pc.cannon_type = c.id
    WHERE pc.player_id = $1 AND pc.equipped > 0
  `, [playerId]);
  let totalWeighted = 0;
  let totalQty = 0;
  for (const row of reloadQuery.rows) {
    totalWeighted += row.equipped * row.reload_time_ms;
    totalQty += row.equipped;
  }
  let cooldown = totalQty > 0 ? Math.round(totalWeighted / totalQty) : DEFAULT_PLAYER_COOLDOWN_MS;
  if (isTower) cooldown = TOWER_COOLDOWN_MS;
  return cooldown;
}

async function calculatePlayerDamage(pool, playerId, ammoId) {
  let actualCannonsFired = 0;
  let totalCannons = 0;
  let totalCannonDamage = 0;
  let ammoDamage = 0;
  let givesElp = false;
  let gainedElp = 0;
  let playerDamage = 0;

  const pRes = await pool.query('SELECT ship_level FROM players WHERE id = $1', [playerId]);
  const shipLevel = pRes.rows[0]?.ship_level || 0;
  const activeShip = gameData.SHIPS.find(s => s.level === shipLevel) || gameData.SHIPS[0];

  const eqCannons = await pool.query(`
    SELECT pc.equipped as equipped, c.damage 
    FROM player_cannons pc
    JOIN cannons c ON pc.cannon_type = c.id
    WHERE pc.player_id = $1 AND pc.equipped > 0
    ORDER BY c.damage DESC
  `, [playerId]);

  let remainingSlots = activeShip.cannonSlots;

  for (const row of eqCannons.rows) {
    if (remainingSlots <= 0) break;
    const usable = Math.min(row.equipped, remainingSlots);
    totalCannons += usable;
    totalCannonDamage += usable * row.damage;
    remainingSlots -= usable;
  }

  actualCannonsFired = totalCannons;

  if (ammoId) {
    const ammoRes = await pool.query(`
      SELECT pa.quantity, a.damage_bonus as damage
      FROM player_ammo pa
      JOIN ammo a ON pa.ammo_type = a.id
      WHERE pa.player_id = $1 AND pa.ammo_type = $2
    `, [playerId, ammoId]);

    if (ammoRes.rows.length > 0) {
      let availableAmmo = ammoRes.rows[0].quantity;
      if (availableAmmo < totalCannons) {
        actualCannonsFired = availableAmmo;
      }
      if (actualCannonsFired > 0) {
        ammoDamage = ammoRes.rows[0].damage;
        if (ammoId === 3) givesElp = true;
        const ammoUpdate = await pool.query(
          'UPDATE player_ammo SET quantity = quantity - $1 WHERE player_id = $2 AND ammo_type = $3 AND quantity >= $1',
          [actualCannonsFired, playerId, ammoId]
        );
        if (ammoUpdate.rowCount === 0) {
          const retryRes = await pool.query(
            'SELECT quantity FROM player_ammo WHERE player_id = $1 AND ammo_type = $2',
            [playerId, ammoId]
          );
          if (retryRes.rows.length > 0 && retryRes.rows[0].quantity > 0) {
            actualCannonsFired = retryRes.rows[0].quantity;
            const retryUpd = await pool.query(
              'UPDATE player_ammo SET quantity = quantity - $1 WHERE player_id = $2 AND ammo_type = $3 AND quantity >= $1',
              [actualCannonsFired, playerId, ammoId]
            );
            if (retryUpd.rowCount === 0) actualCannonsFired = 0;
          } else {
            actualCannonsFired = 0;
          }
        }
      }
    } else {
      actualCannonsFired = 0;
    }
  } else {
    actualCannonsFired = 0;
  }

  if (actualCannonsFired > 0) {
    playerDamage = totalCannonDamage + (actualCannonsFired * ammoDamage);
  }

  if (givesElp && actualCannonsFired > 0) {
    gainedElp = actualCannonsFired;
  }

  return {
    actualCannonsFired,
    totalCannons,
    totalCannonDamage,
    ammoDamage,
    givesElp,
    gainedElp,
    playerDamage
  };
}

module.exports = { calculatePlayerCooldownMs, calculatePlayerDamage };
