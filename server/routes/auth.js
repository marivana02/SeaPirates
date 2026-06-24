const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const response = require('../helpers/response');
const { validate, VALIDATORS } = require('../middleware/validate');
const { asyncHandler } = require('../middleware/errorHandler');
const { 
  loginRateLimiter, 
  recordFailedLogin, 
  recordSuccessfulLogin, 
  registerRateLimiter 
} = require('../middleware/rateLimiter');

async function logAction(playerId, action, details = {}, ip = null) {
  try {
    await pool.query(
      'INSERT INTO action_logs (player_id, action_type, details, ip) VALUES ($1, $2, $3, $4)',
      [playerId, action, JSON.stringify(details), ip]
    );
  } catch (e) { /* silent */ }
}

const registerRules = {
  username: [
    (v) => VALIDATORS.username(v) || 'Username must be 3-20 characters (letters, numbers, underscore)'
  ],
  email: [
    (v) => VALIDATORS.email(v) || 'Invalid email format'
  ],
  password: [
    (v) => VALIDATORS.password(v) || 'Password must be 8-100 characters'
  ]
};

const loginRules = {
  username: [
    (v) => VALIDATORS.string(v) || 'Username is required'
  ],
  password: [
    (v) => VALIDATORS.password(v) || 'Invalid password'
  ]
};

router.post('/register', registerRateLimiter, validate(registerRules), asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;

  const exists = await pool.query(
    'SELECT id FROM players WHERE username = $1 OR email = $2',
    [username, email]
  );
  if (exists.rows.length > 0) {
    return response.badRequest(res, 'Username or email already in use');
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const result = await pool.query(
    `INSERT INTO players 
      (username, display_name, email, password, gold, pearl, xp, level, elite_points, ship_level)
     VALUES ($1, $1, $2, $3, 5000, 0, 0, 1, 0, 0)
     RETURNING id, username, display_name, email, gold, pearl, xp, level, elite_points, ship_level`,
    [username, email, hashedPassword]
  );

  const player = result.rows[0];

  const token = jwt.sign(
    { id: player.id, username: player.username, isAdmin: !!player.is_admin, session_counter: 0 },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  logAction(player.id, 'register', { username }, req.ip);
  response.success(res, { token, player }, 201);
}));

router.post('/login', loginRateLimiter, validate(loginRules), asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  const result = await pool.query(
    `SELECT id, username, display_name, email, gold, pearl, xp, level, elite_points, ship_level,
            hp, max_hp, vip_until, is_admin, is_banned, ban_reason, banned_at, ban_expires_at,
            password, current_map_level, has_elite_ship, active_design, created_at,
            pvp_points, dmg_pve, dmg_pvp, kill_npc, kill_pvp, dmg_amiral
     FROM players WHERE username = $1`,
    [username]
  );

  if (result.rows.length > 0 && (result.rows[0].display_name === null || result.rows[0].display_name === undefined)) {
    await pool.query('UPDATE players SET display_name = username WHERE id = $1', [result.rows[0].id]);
    result.rows[0].display_name = result.rows[0].username;
  }

  if (result.rows.length === 0) {
    recordFailedLogin(ip);
    return response.badRequest(res, 'User not found or incorrect password');
  }

  const player = result.rows[0];

  // Ban kontrolü
  if (player.is_banned) {
    if (player.ban_expires_at && new Date(player.ban_expires_at) < new Date()) {
      await pool.query(
        'UPDATE players SET is_banned = false, ban_reason = NULL, banned_at = NULL, ban_expires_at = NULL WHERE id = $1',
        [player.id]
      );
      player.is_banned = false;
    } else {
      recordFailedLogin(ip);
      return res.status(403).json({
        error: 'err_account_banned',
        ban_reason: player.ban_reason,
        ban_expires_at: player.ban_expires_at,
        banned_at: player.banned_at
      });
    }
  }

  const validPassword = await bcrypt.compare(password, player.password);
  if (!validPassword) {
    recordFailedLogin(ip);
    return response.badRequest(res, 'User not found or incorrect password');
  }

  recordSuccessfulLogin(ip);

  let session_counter = 0;
  try {
    await pool.query('UPDATE players SET session_counter = COALESCE(session_counter, 0) + 1 WHERE id = $1', [player.id]);
    const updatedPlayer = (await pool.query('SELECT session_counter FROM players WHERE id = $1', [player.id])).rows[0];
    if (updatedPlayer) session_counter = updatedPlayer.session_counter;
  } catch (_) { /* session_counter column may not exist yet */ }

  const token = jwt.sign(
    { id: player.id, username: player.username, isAdmin: !!player.is_admin, session_counter },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  logAction(player.id, 'login', {}, ip);
  const { password: _, device_id: _d, banned_devices: _bd, ...playerData } = player;
  response.success(res, { token, player: playerData });
}));

module.exports = router;