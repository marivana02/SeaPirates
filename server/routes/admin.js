const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');
const { asyncHandler } = require('../middleware/errorHandler');

router.use(authMiddleware, adminMiddleware);

router.get('/players', asyncHandler(async (req, res) => {
  const { search, page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let where = '';
  let params = [];
  if (search) {
    where = `WHERE (LOWER(username) LIKE $1 OR LOWER(display_name) LIKE $1 OR LOWER(email) LIKE $1 OR CAST(id AS TEXT) = $2)`;
    params = [`%${search.toLowerCase()}%`, search];
  }

  const countRes = await pool.query(`SELECT COUNT(*) FROM players ${where}`, params);
  const total = parseInt(countRes.rows[0].count);

  const result = await pool.query(
    `SELECT id, username, display_name, email, level, ship_level, gold, pearl, xp,
            hp, max_hp, vip_until, is_admin, is_banned, ban_reason, banned_at, ban_expires_at,
            created_at, device_id
     FROM players ${where}
     ORDER BY id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, parseInt(limit), offset]
  );

  res.json({ players: result.rows, total, page: parseInt(page), limit: parseInt(limit) });
}));

router.get('/players/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const pRes = await pool.query(
    `SELECT id, username, display_name, email, level, ship_level, gold, pearl, xp,
            elite_points, hp, max_hp, vip_until, is_admin, is_banned, ban_reason,
            banned_at, ban_expires_at, created_at, device_id, current_map_level,
            tower_level, pvp_points, daily_streak
     FROM players WHERE id = $1`,
    [id]
  );

  if (pRes.rows.length === 0) {
    return res.status(404).json({ error: 'Oyuncu bulunamadı' });
  }

  const logsRes = await pool.query(
    `SELECT id, action_type, details, ip, created_at
     FROM action_logs WHERE player_id = $1 ORDER BY created_at DESC LIMIT 100`,
    [id]
  );

  res.json({ player: pRes.rows[0], logs: logsRes.rows });
}));

router.post('/ban', asyncHandler(async (req, res) => {
  const { player_id, reason, duration_hours, device_ban } = req.body;
  if (!player_id || !reason) {
    return res.status(400).json({ error: 'player_id ve reason gerekli' });
  }

  const pRes = await pool.query('SELECT id, username, device_id FROM players WHERE id = $1', [player_id]);
  if (pRes.rows.length === 0) {
    return res.status(404).json({ error: 'Oyuncu bulunamadı' });
  }

  const player = pRes.rows[0];

  if (duration_hours && duration_hours > 0) {
    const expireAt = new Date(Date.now() + duration_hours * 60 * 60 * 1000);
    await pool.query(
      `UPDATE players SET is_banned = true, ban_reason = $1, banned_at = CURRENT_TIMESTAMP,
       ban_expires_at = $2 WHERE id = $3`,
      [reason, expireAt, player_id]
    );
  } else {
    await pool.query(
      `UPDATE players SET is_banned = true, ban_reason = $1, banned_at = CURRENT_TIMESTAMP,
       ban_expires_at = NULL WHERE id = $2`,
      [reason, player_id]
    );
  }

  if (device_ban && player.device_id) {
    await pool.query(
      `UPDATE players SET banned_devices = array_append(banned_devices, $1) WHERE id = $2 AND (banned_devices IS NULL OR NOT ($1 = ANY(banned_devices)))`,
      [player.device_id, player_id]
    );
  }

  await pool.query(
    'INSERT INTO action_logs (player_id, action_type, details, ip) VALUES ($1, $2, $3, $4)',
    [req.player.id, 'admin_ban', JSON.stringify({ target: player.username, reason, duration_hours, device_ban }), req.ip]
  );

  res.json({ success: true, message: `${player.username} banlandı` });
}));

router.post('/unban', asyncHandler(async (req, res) => {
  const { player_id } = req.body;
  if (!player_id) {
    return res.status(400).json({ error: 'player_id gerekli' });
  }

  const pRes = await pool.query('SELECT id, username FROM players WHERE id = $1', [player_id]);
  if (pRes.rows.length === 0) {
    return res.status(404).json({ error: 'Oyuncu bulunamadı' });
  }

  await pool.query(
    `UPDATE players SET is_banned = false, ban_reason = NULL, banned_at = NULL,
     ban_expires_at = NULL WHERE id = $1`,
    [player_id]
  );

  await pool.query(
    'INSERT INTO action_logs (player_id, action_type, details, ip) VALUES ($1, $2, $3, $4)',
    [req.player.id, 'admin_unban', JSON.stringify({ target: pRes.rows[0].username }), req.ip]
  );

  res.json({ success: true, message: `${pRes.rows[0].username} banı kaldırıldı` });
}));

router.post('/vip', asyncHandler(async (req, res) => {
  const { player_id, days } = req.body;
  if (!player_id || !days || days < 1) {
    return res.status(400).json({ error: 'player_id ve days (>=1) gerekli' });
  }

  const pRes = await pool.query('SELECT id, username FROM players WHERE id = $1', [player_id]);
  if (pRes.rows.length === 0) {
    return res.status(404).json({ error: 'Oyuncu bulunamadı' });
  }

  const expireAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  await pool.query(
    'UPDATE players SET vip_until = GREATEST(vip_until, $1) WHERE id = $2',
    [expireAt, player_id]
  );

  await pool.query(
    'INSERT INTO action_logs (player_id, action_type, details, ip) VALUES ($1, $2, $3, $4)',
    [req.player.id, 'admin_vip', JSON.stringify({ target: pRes.rows[0].username, days }), req.ip]
  );

  res.json({ success: true, message: `${pRes.rows[0].username} -> ${days} gün VIP` });
}));

router.get('/logs', asyncHandler(async (req, res) => {
  const { type, page = 1, limit = 100 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let where = '';
  let whereCount = '';
  let params = [];
  let paramsCount = [];
  if (type) {
    where = 'WHERE al.action_type = $1';
    whereCount = 'WHERE action_type = $1';
    params = [type];
    paramsCount = [type];
  }

  const result = await pool.query(
    `SELECT al.id, al.player_id, p.username, al.action_type, al.details, al.ip, al.created_at
     FROM action_logs al
     LEFT JOIN players p ON p.id = al.player_id
     ${where}
     ORDER BY al.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, parseInt(limit), offset]
  );

  const countRes = await pool.query(`SELECT COUNT(*) FROM action_logs ${whereCount}`, paramsCount);
  const total = parseInt(countRes.rows[0].count);

  res.json({ logs: result.rows, total, page: parseInt(page), limit: parseInt(limit) });
}));

router.post('/tiamat-spawn', asyncHandler(async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE tiamat SET spawn_generation = spawn_generation + 1, current_hp = hp, respawn_at = NULL, manual_spawn = false WHERE id = 1');
    await client.query('DELETE FROM tiamat_damage');
    await client.query('COMMIT');
    const { sendPushToAll } = require('../helpers/fcm');
    sendPushToAll('tiamat_spawn', {});
    res.json({ ok: true, message: 'Tiamat spawned + push sent!' });
  } catch (txErr) {
    await client.query('ROLLBACK');
    console.error('Tiamat spawn error:', txErr);
    res.status(500).json({ error: 'Spawn failed' });
  } finally {
    client.release();
  }
}));

router.post('/test-push', asyncHandler(async (req, res) => {
  const { playerId, type, params } = req.body;
  if (!playerId || !type) {
    return res.status(400).json({ error: 'Missing playerId or type' });
  }
  const { sendPush } = require('../helpers/fcm');
  await sendPush(playerId, type, params || {});
  res.json({ ok: true, message: `Push '${type}' sent to player ${playerId}` });
}));

router.post('/admiral-spawn', asyncHandler(async (req, res) => {
  const mapLevel = parseInt(req.body.mapLevel) || 1;
  const maxSubs = mapLevel <= 4 ? 2 : 1;
  const subMap = Math.floor(Math.random() * maxSubs) + 1;
  await pool.query('DELETE FROM admiral_damage WHERE map_level = $1', [mapLevel]);
  await pool.query(
    `UPDATE npc3_kill_counter SET is_spawned = TRUE, spawned_sub_map = $1, kill_count = 0, last_reset = NOW() WHERE map_level = $2`,
    [subMap, mapLevel]
  );
  const bossRes = await pool.query('SELECT name FROM bosses WHERE map_level = $1', [mapLevel]);
  const bossName = bossRes.rows[0]?.name || 'Amiral';
  const { sendPushToAll } = require('../helpers/fcm');
  sendPushToAll('admiral_spawn', { map: mapLevel, sub: subMap, name: bossName }, mapLevel, subMap);
  res.json({ ok: true, message: `${bossName} Map ${mapLevel}-${subMap}'de spawnlandı, push gönderildi` });
}));

router.post('/push-all', asyncHandler(async (req, res) => {
  const { title, body, type, params } = req.body;
  if (!title || !body) {
    return res.status(400).json({ error: 'Missing title or body' });
  }
  const { sendPushToAllCustom } = require('../helpers/fcm');
  await sendPushToAllCustom(title, body, type || 'custom', params || {});
  res.json({ ok: true, message: `Push '${title}' sent to all devices` });
}));

module.exports = router;
