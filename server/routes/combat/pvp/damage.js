const gameData = require('../../../config/gameData');
const { BARUT_MULTIPLIER, ZIRH_MULTIPLIER } = require('../constants');

async function calculateOpponentDamage(pool, opponentId) {
  const pRes = await pool.query('SELECT ship_level FROM players WHERE id = $1', [opponentId]);
  const shipLevel = pRes.rows[0]?.ship_level || 0;
  const activeShip = gameData.SHIPS.find(s => s.level === shipLevel) || gameData.SHIPS[0];

  const eqCannons = await pool.query(`
    SELECT pc.equipped as equipped, c.damage 
    FROM player_cannons pc
    JOIN cannons c ON pc.cannon_type = c.id
    WHERE pc.player_id = $1 AND pc.equipped > 0
    ORDER BY c.damage DESC
  `, [opponentId]);

  let totalCannons = 0;
  let totalCannonDamage = 0;
  let remainingSlots = activeShip.cannonSlots;

  for (const row of eqCannons.rows) {
    if (remainingSlots <= 0) break;
    const usable = Math.min(row.equipped, remainingSlots);
    totalCannons += usable;
    totalCannonDamage += usable * row.damage;
    remainingSlots -= usable;
  }

  let ammoId = 1;
  let ammoDamage = 0;
  let givesElp = false;
  const ammoPriorities = [3, 2, 1];
  for (const at of ammoPriorities) {
    const ammoRes = await pool.query(
      'SELECT pa.quantity, a.damage_bonus as damage FROM player_ammo pa JOIN ammo a ON pa.ammo_type = a.id WHERE pa.player_id = $1 AND pa.ammo_type = $2 AND pa.quantity >= $3',
      [opponentId, at, totalCannons]
    );
    if (ammoRes.rows.length > 0) {
      ammoId = at;
      ammoDamage = ammoRes.rows[0].damage;
      if (at === 3) givesElp = true;
      break;
    }
  }

  const barutRes = await pool.query("SELECT quantity FROM player_items WHERE player_id = $1 AND item_type = 'barut' AND quantity >= 1", [opponentId]);
  const zirhRes = await pool.query("SELECT quantity FROM player_items WHERE player_id = $1 AND item_type = 'zirh' AND quantity >= 1", [opponentId]);
  const useBarut = barutRes.rows.length > 0;
  const useZirh = zirhRes.rows.length > 0;

  let damage = totalCannonDamage + (totalCannons * ammoDamage);

  if (useBarut) {
    damage = Math.floor(damage * BARUT_MULTIPLIER);
  }

  return {
    cannons: totalCannons,
    ammoId,
    useBarut,
    useZirh,
    damage,
    givesElp,
    gainedElp: givesElp ? totalCannons : 0
  };
}

async function applyPvPDamageModifiers(pool, playerId, pd, simResult, { useBarut, useZirh, currentEvent, ammoId }) {
  let finalDamage = 0;
  if (pd.actualCannonsFired > 0) {
    finalDamage = pd.totalCannonDamage + (pd.actualCannonsFired * pd.ammoDamage);
  }
  if (simResult.npcUseZirh) {
    finalDamage = Math.floor(finalDamage * ZIRH_MULTIPLIER);
  }

  let finalNpcDamage = simResult.npcDamage || 0;

  if (useBarut && pd.actualCannonsFired > 0) {
    const bRes = await pool.query(`UPDATE player_items SET quantity = quantity - 1 WHERE player_id = $1 AND item_type = 'barut' AND quantity >= 1`, [playerId]);
    if (bRes.rowCount > 0) {
      finalDamage = Math.floor(finalDamage * BARUT_MULTIPLIER);
    }
  }

  if (useZirh) {
    const zRes = await pool.query(`UPDATE player_items SET quantity = quantity - 1 WHERE player_id = $1 AND item_type = 'zirh' AND quantity >= 1`, [playerId]);
    if (zRes.rowCount > 0) {
      finalNpcDamage = Math.floor(finalNpcDamage * ZIRH_MULTIPLIER);
    }
  }

  if (currentEvent.type === 'damage' && ammoId == 3) {
    finalDamage = Math.floor(finalDamage * currentEvent.mult);
  }

  let gainedElp = pd.gainedElp || 0;
  if (pd.givesElp && pd.actualCannonsFired > 0) {
    gainedElp = pd.actualCannonsFired;
    if (currentEvent.type === 'elp_reward') gainedElp *= currentEvent.mult;
  }

  return { finalDamage, finalNpcDamage, gainedElp };
}

module.exports = { calculateOpponentDamage, applyPvPDamageModifiers };
