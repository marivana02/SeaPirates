const { FIGHT_TIMEOUT_MS, CLEANUP_INTERVAL_MS } = require('./constants');

function startFightCleanup(pool) {
  setInterval(async () => {
    try {
      const timeoutLimit = new Date(Date.now() - FIGHT_TIMEOUT_MS);
      await pool.query('DELETE FROM active_fights WHERE last_activity < $1', [timeoutLimit]);
    } catch (err) {
      console.error('active_fights periyodik temizleme hatası:', err.message);
    }
  }, CLEANUP_INTERVAL_MS);
}

module.exports = { startFightCleanup };
