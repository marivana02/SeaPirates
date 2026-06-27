const express = require('express');
const router = express.Router();
const pool = require('../../config/db');
const authMiddleware = require('../../middleware/auth');

router.post('/ping', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  try {
    // last_seen her ping'te güncellenir, playtime sadece 30sn geçmişse artar
    const result = await pool.query(
      `UPDATE players SET
        last_seen = NOW(),
        is_online = true,
        playtime = CASE
          WHEN last_seen IS NULL OR EXTRACT(EPOCH FROM (NOW() - last_seen)) >= 30
          THEN playtime + 1
          ELSE playtime
        END
       WHERE id = $1
       RETURNING playtime`,
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
