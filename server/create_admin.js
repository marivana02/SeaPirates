const bcrypt = require('bcryptjs');
const pool = require('./config/db');

async function createAdmin() {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const email = process.env.ADMIN_EMAIL || 'admin@test.com';

  const exists = await pool.query('SELECT id FROM players WHERE username = $1 OR email = $2', [username, email]);
  if (exists.rows.length > 0) {
    console.log('Admin hesabı zaten var, mevcut hesap güncelleniyor...');
    const playerId = exists.rows[0].id;
    await updateAdmin(playerId);
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const result = await pool.query(
    `INSERT INTO players (username, display_name, email, password, gold, pearl, xp, level, elite_points, ship_level, hp, max_hp, vip_until, has_elite_ship, current_map_level, is_admin)
     VALUES ($1, 'Admin', $2, $3, 999999999, 999999999, 999999999, 100, 999999999, 10, 190000, 190000, '2099-12-31 23:59:59', true, 10, true)
     RETURNING id`,
    [username, email, hashedPassword]
  );
  const playerId = result.rows[0].id;
  await giveItems(playerId);
  console.log(`Admin hesabı oluşturuldu!`);
  console.log(`  Kullanıcı: ${username}`);
  console.log(`  Şifre:     ${password}`);
  await pool.end();
}

async function updateAdmin(playerId) {
  await pool.query(
    `UPDATE players SET
       gold = 999999999, pearl = 999999999, xp = 999999999, level = 100,
       elite_points = 999999999, ship_level = 10, hp = 190000, max_hp = 190000,
       vip_until = '2099-12-31 23:59:59', has_elite_ship = true, current_map_level = 10,
       is_admin = true
     WHERE id = $1`,
    [playerId]
  );
  await pool.query('DELETE FROM player_cannons WHERE player_id = $1', [playerId]);
  await pool.query('DELETE FROM player_ammo WHERE player_id = $1', [playerId]);
  await pool.query('DELETE FROM player_items WHERE player_id = $1', [playerId]);
  await pool.query('DELETE FROM player_planks WHERE player_id = $1', [playerId]);
  await giveItems(playerId);
  console.log('Admin hesabı güncellendi!');
  await pool.end();
}

async function giveItems(playerId) {
  const maxEquip = 60;
  await pool.query(
    `INSERT INTO player_cannons (player_id, cannon_type, quantity, equipped) VALUES
     ($1, 1, ${maxEquip + 100}, ${maxEquip}),
     ($1, 2, ${maxEquip + 100}, ${maxEquip}),
     ($1, 3, ${maxEquip + 100}, ${maxEquip})`,
    [playerId]
  );

  await pool.query(
    `INSERT INTO player_ammo (player_id, ammo_type, quantity) VALUES
     ($1, 1, 100000),
     ($1, 2, 100000),
     ($1, 3, 100000)`,
    [playerId]
  );

  await pool.query(
    `INSERT INTO player_items (player_id, item_type, quantity) VALUES
     ($1, 'barut', 100000),
     ($1, 'zirh', 100000)`,
    [playerId]
  );

  await pool.query(
    `INSERT INTO player_planks (player_id, plank_type, quantity, equipped) VALUES
     ($1, 'tahta', 125, 25),
     ($1, 'elit', 125, 25)`,
    [playerId]
  );
}

createAdmin().catch(err => {
  console.error('Hata:', err);
  pool.end();
});
