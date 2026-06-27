const express = require('express');
const router = express.Router();
const pool = require('../../config/db');
const authMiddleware = require('../../middleware/auth');
const response = require('../../helpers/response');
const { validate, VALIDATORS } = require('../../middleware/validate');
const { asyncHandler } = require('../../middleware/errorHandler');
const displayNameRules = {
  newDisplayName: [
    (v) => (v && typeof v === 'string' && v.trim().length >= 3 && v.trim().length <= 30) || 'Display name must be 3-30 characters'
  ]
};

router.post('/settings/change-username', authMiddleware, validate(displayNameRules), asyncHandler(async (req, res) => {
  const { newDisplayName } = req.body;
  const playerId = req.player.id;

  const trimmedName = newDisplayName.trim();

  if (!/^[a-zA-Z0-9_ğüşıöçĞÜŞİÖÇ ]+$/.test(trimmedName)) {
    return response.badRequest(res, 'Display name can only contain letters, numbers, spaces and underscores');
  }

  const pRes = await pool.query('SELECT username, display_name, last_username_change FROM players WHERE id = $1', [playerId]);
  if (pRes.rows.length === 0) return response.notFound(res, 'Player not found');

  const player = pRes.rows[0];

  if (player.last_username_change) {
    const diffMs = Date.now() - new Date(player.last_username_change).getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffDays < 7) {
      const days = Math.ceil(7 - diffDays);
      return res.status(400).json({ error: 'err_username_change_limit', days });
    }
  }

  const uniqueRes = await pool.query(
    'SELECT id FROM players WHERE LOWER(display_name) = LOWER($1) AND id <> $2',
    [trimmedName, playerId]
  );
  if (uniqueRes.rows.length > 0) {
    return response.badRequest(res, 'This display name is already taken by another player');
  }

  await pool.query(
    'UPDATE players SET display_name = $1, last_username_change = CURRENT_TIMESTAMP WHERE id = $2',
    [trimmedName, playerId]
  );

  response.success(res, {
    success: true,
    message: 'Your display name has been changed successfully!',
    display_name: trimmedName
  });
}));

module.exports = router;
