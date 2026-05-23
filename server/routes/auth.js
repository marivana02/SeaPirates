const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { 
  loginRateLimiter, 
  recordFailedLogin, 
  recordSuccessfulLogin, 
  registerRateLimiter 
} = require('../middleware/rateLimiter');

// KAYIT OL
router.post('/register', registerRateLimiter, async (req, res) => {
  const { username, email, password } = req.body;

  try {
    // Kullanıcı var mı kontrol
    const exists = await pool.query(
      'SELECT id FROM players WHERE username = $1 OR email = $2',
      [username, email]
    );
    if (exists.rows.length > 0) {
      return res.status(400).json({ error: 'Kullanıcı adı veya email zaten kullanımda' });
    }

    // Şifre hashle
    const hashedPassword = await bcrypt.hash(password, 10);

    // Oyuncuyu kaydet
    const result = await pool.query(
      `INSERT INTO players 
        (username, display_name, email, password, gold, pearl, xp, level, elite_points, ship_level)
       VALUES ($1, $1, $2, $3, 5000, 0, 0, 1, 0, 0)
       RETURNING id, username, display_name, email, gold, pearl, xp, level, elite_points, ship_level`,
      [username, email, hashedPassword]
    );

    const player = result.rows[0];

    // Token oluştur
    const token = jwt.sign(
      { id: player.id, username: player.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({ token, player });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// GİRİŞ YAP
router.post('/login', loginRateLimiter, async (req, res) => {
  const { username, password } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  try {
    const result = await pool.query(
      'SELECT * FROM players WHERE username = $1',
      [username]
    );

    // display_name boşsa (eski kayıt) username ile doldur
    if (result.rows.length > 0 && !result.rows[0].display_name) {
      await pool.query('UPDATE players SET display_name = username WHERE id = $1', [result.rows[0].id]);
      result.rows[0].display_name = result.rows[0].username;
    }

    if (result.rows.length === 0) {
      recordFailedLogin(ip);
      return res.status(400).json({ error: 'Kullanıcı bulunamadı veya hatalı şifre' });
    }

    const player = result.rows[0];

    const validPassword = await bcrypt.compare(password, player.password);
    if (!validPassword) {
      recordFailedLogin(ip);
      return res.status(400).json({ error: 'Kullanıcı bulunamadı veya hatalı şifre' });
    }

    // Giriş başarılı: kilidi/sayacı sıfırla
    recordSuccessfulLogin(ip);

    const token = jwt.sign(
      { id: player.id, username: player.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const { password: _, ...playerData } = player;
    res.json({ token, player: playerData });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Başlangıç ekipmanı
async function giveStarterItems(playerId) {
  // 5 Top 1
  await pool.query(
    `INSERT INTO player_cannons (player_id, cannon_type, quantity)
     VALUES ($1, 1, 5)`,
    [playerId]
  );
  // 1 Top 2
  await pool.query(
    `INSERT INTO player_cannons (player_id, cannon_type, quantity)
     VALUES ($1, 2, 1)`,
    [playerId]
  );
  // Gülleler
  await pool.query(
    `INSERT INTO player_ammo (player_id, ammo_type, quantity)
     VALUES ($1, 1, 2000), ($1, 2, 1000), ($1, 3, 500)`,
    [playerId]
  );
  // Barut + Zırh
  await pool.query(
    `INSERT INTO player_items (player_id, item_type, quantity)
     VALUES ($1, 'barut', 100), ($1, 'zirh', 100)`,
    [playerId]
  );
  // 10 Tahta Direk
  await pool.query(
    `INSERT INTO player_planks (player_id, plank_type, quantity)
     VALUES ($1, 'tahta', 10)`,
    [playerId]
  );
}

module.exports = router;