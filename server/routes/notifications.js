const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authenticateToken = require('../middleware/auth');

// Subscribe to push notifications
router.post('/subscribe', authenticateToken, async (req, res) => {
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys || !keys.auth || !keys.p256dh) {
    return res.status(400).json({ error: 'Missing subscription data' });
  }
  try {
    await pool.query(
      `INSERT INTO push_subscriptions (player_id, endpoint, auth, p256dh)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (player_id, endpoint) DO UPDATE SET auth = $3, p256dh = $4`,
      [req.player.id, endpoint, keys.auth, keys.p256dh]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Push subscribe error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Unsubscribe from push notifications
router.post('/unsubscribe', authenticateToken, async (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) {
    return res.status(400).json({ error: 'Missing endpoint' });
  }
  try {
    await pool.query(
      'DELETE FROM push_subscriptions WHERE player_id = $1 AND endpoint = $2',
      [req.player.id, endpoint]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Push unsubscribe error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
