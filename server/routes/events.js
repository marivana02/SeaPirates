const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth');

const AUTO_EVENTS = [
  { name: '2x NPC Ödül', desc: 'NPC savaşlarından kazanılan altın, inci ve XP 2 katına çıkar!', icon: '💰', type: 'npc_reward', mult: 2 },
  { name: '2x ELP Ödül', desc: 'Kazanılan Elit Puanları 2 katına çıkar!', icon: '⭐', type: 'elp_reward', mult: 2 },
  { name: '2x Hasar', desc: 'Patlayan Gülle ile verdiğiniz hasar 2 katına çıkar!', icon: '⚔️', type: 'damage', mult: 2 }
];

// Bugünün sabit rotasyon etkinliğini bul veya oluştur
async function ensureTodayAutoEvent() {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 86400000);

  // Bugün için auto etkinlik var mı?
  const existing = await pool.query(
    `SELECT * FROM events WHERE is_auto = TRUE AND start_at >= $1 AND start_at < $2 ORDER BY start_at DESC LIMIT 1`,
    [startOfToday, endOfToday]
  );
  if (existing.rows.length > 0) return existing.rows[0];

  // Hangi rotasyon sırası?
  const daysSinceEpoch = Math.floor(startOfToday.getTime() / 86400000);
  const eventIndex = daysSinceEpoch % AUTO_EVENTS.length;
  const e = AUTO_EVENTS[eventIndex];

  const ins = await pool.query(
    `INSERT INTO events (name, description, icon, type, mult, start_at, end_at, is_auto)
     VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE) RETURNING *`,
    [e.name, e.desc, e.icon, e.type, e.mult, startOfToday, endOfToday]
  );
  return ins.rows[0];
}

// Şu anki aktif etkinliği döndür (özel > auto)
async function getCurrentEvent() {
  const now = new Date();

  // Önce özel etkinlik kontrol et
  const special = await pool.query(
    `SELECT * FROM events WHERE is_auto = FALSE AND start_at <= $1 AND end_at > $1 ORDER BY start_at DESC LIMIT 1`,
    [now]
  );
  if (special.rows.length > 0) return special.rows[0];

  // Yoksa bugünün auto etkinliğini al
  return await ensureTodayAutoEvent();
}

// GET /api/events
router.get('/', authMiddleware, async (req, res) => {
  try {
    const event = await getCurrentEvent();
    if (!event) {
      return res.json({ id: 0, name: 'Etkinlik Yok', desc: 'Şu an aktif etkinlik bulunmuyor.', icon: '🎯', type: 'none', mult: 1, remaining: 0, end: 0 });
    }

    const now = Date.now();
    const endMs = new Date(event.end_at).getTime();

    // Sıradaki auto etkinlik bilgisi
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const daysSinceEpoch = Math.floor(todayStart.getTime() / 86400000);
    const nextIdx = (daysSinceEpoch + 1) % AUTO_EVENTS.length;
    const nextAuto = AUTO_EVENTS[nextIdx];

    res.json({
      id: event.id,
      name: event.name,
      desc: event.description,
      icon: event.icon,
      type: event.type,
      mult: Number(event.mult),
      start: Math.floor(new Date(event.start_at).getTime() / 1000),
      end: Math.floor(endMs / 1000),
      remaining: Math.max(0, Math.floor((endMs - now) / 1000)),
      is_auto: event.is_auto,
      next: { name: nextAuto.name, icon: nextAuto.icon }
    });
  } catch (err) {
    console.error('Etkinlik hatası:', err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// POST /api/events/admin/create — özel etkinlik başlat
router.post('/admin/create', async (req, res) => {
  try {
    const key = req.query.key || req.body.key;
    if (key !== process.env.ADMIN_KEY) {
      return res.status(403).json({ error: 'Yetkisiz erişim' });
    }

    const { name, description, icon, type, mult, durationHours } = req.body;
    if (!name || !type) {
      return res.status(400).json({ error: 'İsim ve tip zorunlu' });
    }

    const startAt = new Date();
    const endAt = new Date(startAt.getTime() + (durationHours || 24) * 3600000);

    const ins = await pool.query(
      `INSERT INTO events (name, description, icon, type, mult, start_at, end_at, is_auto)
       VALUES ($1,$2,$3,$4,$5,$6,$7,FALSE) RETURNING *`,
      [name, description || '', icon || '🎉', type, mult || 2, startAt, endAt]
    );

    res.json({ success: true, event: ins.rows[0] });
  } catch (err) {
    console.error('Etkinlik oluşturma hatası:', err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// POST /api/events/admin/stop — özel etkinliği bitir
router.post('/admin/stop', async (req, res) => {
  try {
    const key = req.query.key || req.body.key;
    if (key !== process.env.ADMIN_KEY) {
      return res.status(403).json({ error: 'Yetkisiz erişim' });
    }

    const now = new Date();
    await pool.query(
      `UPDATE events SET end_at = $1 WHERE is_auto = FALSE AND start_at <= $2 AND end_at > $2`,
      [now, now]
    );

    res.json({ success: true, message: 'Özel etkinlik sonlandırıldı' });
  } catch (err) {
    console.error('Etkinlik durdurma hatası:', err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

module.exports = router;
module.exports.getCurrentEvent = getCurrentEvent;
