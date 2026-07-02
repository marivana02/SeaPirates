const { BARUT_MULTIPLIER, ZIRH_MULTIPLIER, EXPLOSIVE_MULTIPLIER } = require('./constants');

async function applyDamageModifiers(pool, playerId, {
  totalCannonDamage, actualCannonsFired, ammoDamage, givesElp, gainedElp
}, {
  npcUseBarut, npcUseZirh
}, fight, { useBarut, useZirh, currentEvent, ammoId }, client) {

  let finalDamage = 0;
  if (actualCannonsFired > 0) {
    finalDamage = totalCannonDamage + (actualCannonsFired * ammoDamage);
  }
  if (npcUseZirh) {
    finalDamage = Math.floor(finalDamage * ZIRH_MULTIPLIER);
  }

  let finalNpcDamage = fight.npc.damage;

  const db = client || pool;
  if (useBarut && actualCannonsFired > 0) {
    const bRes = await db.query(`UPDATE player_items SET quantity = quantity - 1 WHERE player_id = $1 AND item_type = 'barut' AND quantity >= 1`, [playerId]);
    if (bRes.rowCount > 0) {
      finalDamage = Math.floor(finalDamage * BARUT_MULTIPLIER);
    }
  }

  if (useZirh) {
    const zRes = await db.query(`UPDATE player_items SET quantity = quantity - 1 WHERE player_id = $1 AND item_type = 'zirh' AND quantity >= 1`, [playerId]);
    if (zRes.rowCount > 0) {
      finalNpcDamage = Math.floor(finalNpcDamage * ZIRH_MULTIPLIER);
    }
  }

  if (ammoId === 3 && actualCannonsFired > 0) {
    finalDamage = Math.floor(finalDamage * EXPLOSIVE_MULTIPLIER);
  }

  if (currentEvent.type === 'damage' && ammoId == 3) {
    finalDamage = Math.floor(finalDamage * currentEvent.mult);
  }

  if (givesElp && actualCannonsFired > 0) {
    gainedElp = actualCannonsFired;
    if (currentEvent.type === 'elp_reward') gainedElp *= currentEvent.mult;
  }

  return { finalDamage, finalNpcDamage, gainedElp };
}

module.exports = { applyDamageModifiers };
