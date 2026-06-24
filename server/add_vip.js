const pool = require('./config/db');

async function addVIP() {
  const args = process.argv.slice(2);
  const username = args[0] || 'admin';

  const res = await pool.query('SELECT id, username FROM players WHERE username = $1', [username]);
  if (res.rows.length === 0) {
    console.log(`❌ '${username}' kullanıcısı bulunamadı!`);
    await pool.end();
    return;
  }

  const playerId = res.rows[0].id;
  await pool.query(
    `UPDATE players SET vip_until = '2099-12-31 23:59:59' WHERE id = $1`,
    [playerId]
  );

  console.log(`✅ VIP eklendi: ${res.rows[0].username} (ID: ${playerId})`);
  console.log(`   VIP süresi: 31 Aralık 2099`);
  await pool.end();
}

addVIP().catch(err => {
  console.error('Hata:', err);
  pool.end();
});
