const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const pool = new Pool({ host: process.env.DB_HOST, port: parseInt(process.env.DB_PORT)||5432, database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD, max: 2 });

(async () => {
  const r = await pool.query(`SELECT pid, extract(epoch from now()-state_change)::int as idle_sec, substring(query,1,60) as q FROM pg_stat_activity WHERE datname=current_database() AND backend_type='client backend' AND state='idle in transaction' AND state_change < now()-interval '10 seconds'`);
  for (const row of r.rows) {
    console.log('KILL PID ' + row.pid + ' idle=' + row.idle_sec + 's  ' + row.q);
    await pool.query('SELECT pg_terminate_backend(' + row.pid + ')');
  }
  if (r.rows.length === 0) console.log('No stuck connections');
  const r2 = await pool.query(`SELECT pid, state, wait_event FROM pg_stat_activity WHERE datname=current_database() AND backend_type='client backend' AND state != 'idle' AND pid != pg_backend_pid()`);
  for (const row of r2.rows) {
    console.log('PID ' + row.pid + ' | ' + row.state + ' | ' + (row.wait_event||'-'));
  }
  await pool.end();
})().catch(e => { console.error(e); process.exit(1); });
