async function upsertAmmo(pool, playerId, ammoType, quantity) {
  await pool.query(
    `INSERT INTO player_ammo (player_id, ammo_type, quantity)
     VALUES ($1, $2, $3)
     ON CONFLICT (player_id, ammo_type)
     DO UPDATE SET quantity = player_ammo.quantity + EXCLUDED.quantity`,
    [playerId, ammoType, quantity]
  );
}

async function upsertItem(pool, playerId, itemType, quantity) {
  await pool.query(
    `INSERT INTO player_items (player_id, item_type, quantity)
     VALUES ($1, $2, $3)
     ON CONFLICT (player_id, item_type)
     DO UPDATE SET quantity = player_items.quantity + EXCLUDED.quantity`,
    [playerId, itemType, quantity]
  );
}

function isPlayerVip(player) {
  return !!(player.vip_until && new Date(player.vip_until) > new Date());
}

module.exports = { upsertAmmo, upsertItem, isPlayerVip };
