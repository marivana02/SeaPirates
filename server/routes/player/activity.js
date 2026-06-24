const express = require('express');
const router = express.Router();
const pool = require('../../config/db');
const authMiddleware = require('../../middleware/auth');

router.post('/ping', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  try {
    const result = await pool.query(
      `UPDATE players SET playtime = playtime + 1 WHERE id = $1 RETURNING playtime`,
      [playerId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Player not found" });
    }
    res.json({ success: true, playtime: parseInt(result.rows[0].playtime) });
  } catch (err) {
    console.error("Ping Error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
