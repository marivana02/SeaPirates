const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authenticateToken = require('../middleware/auth');

// Register FCM push token (Android)
router.post('/register-token', authenticateToken, async (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ error: 'Missing token' });
  }
  try {
    await pool.query(
      `INSERT INTO fcm_tokens (player_id, token)
       VALUES ($1, $2)
       ON CONFLICT (player_id, token) DO NOTHING`,
      [req.player.id, token]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('FCM register error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Unregister FCM token
router.post('/unregister-token', authenticateToken, async (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ error: 'Missing token' });
  }
  try {
    await pool.query(
      'DELETE FROM fcm_tokens WHERE player_id = $1 AND token = $2',
      [req.player.id, token]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('FCM unregister error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
