const jwt = require('jsonwebtoken');
const pool = require('../config/db');

module.exports = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token bulunamadı' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.player = decoded;

        try {
            const userRes = await pool.query(
                'SELECT is_admin, is_banned, ban_expires_at FROM players WHERE id = $1',
                [decoded.id]
            );
            if (userRes.rows.length === 0) {
                return res.status(401).json({ error: 'Account not found' });
            }
            const user = userRes.rows[0];

            req.player.isAdmin = !!user.is_admin;

            if (user.is_banned) {
                if (user.ban_expires_at && new Date(user.ban_expires_at) < new Date()) {
                    await pool.query(
                        'UPDATE players SET is_banned = false, ban_reason = NULL, banned_at = NULL, ban_expires_at = NULL WHERE id = $1',
                        [decoded.id]
                    );
                } else {
                    return res.status(403).json({ error: 'err_account_banned' });
                }
            }

            const deviceId = req.headers['x-device-id'];
            if (deviceId) {
                const bannedDevice = await pool.query(
                    'SELECT 1 FROM players WHERE $1 = ANY(banned_devices) LIMIT 1',
                    [deviceId]
                );
                if (bannedDevice.rows.length > 0) {
                    return res.status(403).json({ error: 'err_device_banned' });
                }
            }

            if (decoded.session_counter !== undefined) {
                const scRes = await pool.query(
                    'SELECT session_counter FROM players WHERE id = $1',
                    [decoded.id]
                ).catch(() => ({ rows: [{ session_counter: null }] }));
                const dbCounter = scRes.rows[0]?.session_counter;
                if (dbCounter !== null && dbCounter !== undefined && decoded.session_counter !== dbCounter) {
                    return res.status(401).json({ error: 'err_session_expired' });
                }
            }
        } catch (dbErr) {
            console.error('Auth check error:', dbErr.message);
            return res.status(503).json({ error: 'Database error, please try again' });
        }

        next();
    } catch (err) {
        return res.status(401).json({ error: 'Geçersiz token' });
    }
};