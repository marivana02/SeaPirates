const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const pool = new Pool({ host: process.env.DB_HOST, port: parseInt(process.env.DB_PORT)||5432, database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD, max: 5 });

(async () => {
  console.log('=== DB CONNECTIONS ===');
  const r = await pool.query(`SELECT pid, state, query, wait_event, extract(epoch from now() - query_start)::int as age, extract(epoch from now() - state_change)::int as idle_sec FROM pg_stat_activity WHERE datname = current_database() AND backend_type = 'client backend' ORDER BY query_start`);
  for (const row of r.rows) {
    console.log(`  PID ${row.pid} | ${row.state} | age ${row.age}s | idle ${row.idle_sec}s | ${row.wait_event||'-'} | ${(row.query||'').substring(0,80)}`);
  }

  console.log('\n=== BLOCKED QUERIES ===');
  const b = await pool.query(`SELECT blocked_locks.pid AS blocked, blocking_locks.pid AS blocker, blocked_activity.query AS blocked_query FROM pg_catalog.pg_locks blocked_locks JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid AND blocking_locks.pid != blocked_locks.pid JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid WHERE NOT blocked_locks.granted`);
  for (const row of b.rows) {
    console.log(`  ${row.blocked} BLOCKED BY ${row.blocker}: "${(row.blocked_query||'').substring(0,100)}"`);
  }

  console.log('\n=== RECENT ERROR LOG ===');
  const fs = require('fs');
  const errs = fs.readFileSync('C:/Users/Administrator/.pm2/logs/seapirates-error.log', 'utf8').split('\n').filter(l => l.trim()).slice(-20);
  for (const line of errs) console.log('  ' + line);

  pool.end();
})();
