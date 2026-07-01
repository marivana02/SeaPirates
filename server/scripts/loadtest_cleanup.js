const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres@localhost:5432/seapirates'
});

async function main() {
  console.log('Cleaning up test users...');
  const res = await pool.query("SELECT id, username FROM players WHERE username LIKE 'loadtest_%'");
  console.log(`Found ${res.rows.length} test users.`);

  for (const row of res.rows) {
    await pool.query('DELETE FROM active_fights WHERE player_id = $1', [row.id]);
    await pool.query('DELETE FROM player_cannons WHERE player_id = $1', [row.id]);
    await pool.query('DELETE FROM players WHERE id = $1', [row.id]);
  }

  console.log(`Deleted ${res.rows.length} test users.`);
  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
