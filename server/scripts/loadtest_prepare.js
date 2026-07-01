const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const fs = require('fs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres@localhost:5432/seapirates'
});

async function main() {
  const count = parseInt(process.argv[2]) || 50;
  const startId = parseInt(process.argv[3]) || 1;
  
  console.log(`Creating ${count} test users starting from loadtest_${startId}...`);

  const password = 'test123';
  const hash = await bcrypt.hash(password, 10);

  const results = [];

  for (let i = startId; i < startId + count; i++) {
    const username = `loadtest_${i}`;
    try {
      await pool.query('DELETE FROM active_fights WHERE player_id IN (SELECT id FROM players WHERE username = $1)', [username]);
      await pool.query('DELETE FROM player_cannons WHERE player_id IN (SELECT id FROM players WHERE username = $1)', [username]);
      await pool.query('DELETE FROM player_ammo WHERE player_id IN (SELECT id FROM players WHERE username = $1)', [username]);
      await pool.query('DELETE FROM players WHERE username = $1', [username]);

      const res = await pool.query(`
        INSERT INTO players (username, password, display_name, gold, pearl, hp, max_hp, level, ship_level, current_map_level, vip_until, session_counter)
        VALUES ($1, $2, $3, 999999, 999999, 200000, 200000, 50, 6, 7, '2099-12-31', 0)
        RETURNING id
      `, [username, hash, `Test User ${i}`]);
      const playerId = res.rows[0].id;

      // Equip 15 cannons of type 1
      await pool.query(`
        INSERT INTO player_cannons (player_id, cannon_type, quantity, equipped)
        VALUES ($1, 1, 15, 15)
        ON CONFLICT (player_id, cannon_type) DO UPDATE SET quantity = 15, equipped = 15
      `, [playerId]);

      // Give them plenty of ammo
      await pool.query(`
        INSERT INTO player_ammo (player_id, ammo_type, quantity)
        VALUES ($1, 1, 10000)
        ON CONFLICT (player_id, ammo_type) DO UPDATE SET quantity = 10000
      `, [playerId]);

      const token = jwt.sign(
        { id: playerId, username, isAdmin: false, session_counter: 0 },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      results.push({ username, playerId, token });
      process.stdout.write(`\rCreated ${i - startId + 1}/${count}`);
    } catch (err) {
      console.error(`\nError creating ${username}:`, err.message);
    }
  }

  console.log(`\n\nStarting fights for ${results.length} users vs Flyingdutchman (300k HP)...`);
  const fights = [];

  for (const user of results) {
    try {
      const startRes = await fetch('http://localhost:3000/api/combat/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`,
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({ mapLevel: 7, npcName: 'Flyingdutchman' })
      });
      const data = await startRes.json();
      if (data.message === 'Battle started' || data.message === 'Fight ongoing') {
        fights.push({ username: user.username, token: user.token, playerId: user.playerId });
      } else {
        console.error(`\n✗ ${user.username}: ${JSON.stringify(data)}`);
      }
    } catch (err) {
      console.error(`\n✗ ${user.username}: ${err.message}`);
    }
    process.stdout.write(`\rStarted ${fights.length}/${results.length} fights`);
  }

  console.log(`\n\nSaving ${fights.length} tokens...`);
  fs.writeFileSync(path.join(__dirname, 'loadtest_tokens.json'), JSON.stringify(fights, null, 2));

  await pool.end();
  console.log('Done. Tokens saved to loadtest_tokens.json');
}

main().catch(err => { console.error(err); process.exit(1); });
