const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');

// Simple in-memory rate limiter for admin endpoints
const adminRateLimit = new Map();
setInterval(() => adminRateLimit.clear(), 60000); // clear every 60s

function checkAdminRateLimit(ip) {
  const count = adminRateLimit.get(ip) || 0;
  if (count >= 10) return false;
  adminRateLimit.set(ip, count + 1);
  return true;
}

const AUTO_EVENTS = [
  { name: '2x NPC Ödül', desc: 'NPC savaşlarından kazanılan altın, inci ve XP 2 katına çıkar!', icon: '💰', type: 'npc_reward', mult: 2 },
  { name: '2x ELP Ödül', desc: 'Kazanılan Elit Puanları 2 katına çıkar!', icon: '⭐', type: 'elp_reward', mult: 2 },
  { name: '2x Hasar', desc: 'Patlayan Gülle ile verdiğiniz hasar 2 katına çıkar!', icon: '⚔️', type: 'damage', mult: 2 }
];

// Bu haftanın sabit rotasyon etkinliğini bul veya oluştur (Pazartesi 00:00 → Pazar 23:59)
function getWeekRange(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Pazartesi'ye ayarla
  const startOfWeek = new Date(d.setDate(diff));
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 7);
  return { startOfWeek, endOfWeek };
}

async function ensureThisWeekAutoEvent() {
  const now = new Date();
  const { startOfWeek } = getWeekRange(now);

  // Cumartesi 00:00 ve Pazar 00:00 zamanlarını ayarla (Haftalık 1 gün aktiflik kuralı)
  const eventStart = new Date(startOfWeek);
  eventStart.setDate(startOfWeek.getDate() + 5); // Cumartesi
  eventStart.setHours(0, 0, 0, 0);

  const eventEnd = new Date(eventStart);
  eventEnd.setDate(eventStart.getDate() + 1); // Pazar
  eventEnd.setHours(0, 0, 0, 0);

  // Bu hafta için auto etkinlik var mı?
  const existing = await pool.query(
    `SELECT * FROM events WHERE is_auto = TRUE AND start_at >= $1 AND start_at < $2 ORDER BY start_at DESC LIMIT 1`,
    [eventStart, eventEnd]
  );
  if (existing.rows.length > 0) return existing.rows[0];

  // Hangi rotasyon sırası? (haftalık)
  const daysSinceEpoch = Math.floor(startOfWeek.getTime() / 86400000);
  const weeksSinceEpoch = Math.floor(daysSinceEpoch / 7);
  const eventIndex = weeksSinceEpoch % AUTO_EVENTS.length;
  const e = AUTO_EVENTS[eventIndex];

  const ins = await pool.query(
    `INSERT INTO events (name, description, icon, type, mult, start_at, end_at, is_auto)
     VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE) RETURNING *`,
    [e.name, e.desc, e.icon, e.type, e.mult, eventStart, eventEnd]
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

  // Yoksa bu haftanın auto etkinliğini kontrol et
  const autoEvent = await ensureThisWeekAutoEvent();
  
  // Eğer şu an bu auto etkinliğin aktif olduğu Cumartesi günü ise geri döndür
  if (now >= new Date(autoEvent.start_at) && now < new Date(autoEvent.end_at)) {
    return autoEvent;
  }

  // Aktif etkinlik yoksa dummy/boş etkinlik döndür
  return { id: 0, name: 'Etkinlik Yok', description: 'Şu an aktif etkinlik bulunmuyor.', icon: '🎯', type: 'none', mult: 1 };
}

// GET /api/events
router.get('/', authMiddleware, async (req, res) => {
  try {
    const now = new Date();
    
    // 1. Aktif bir özel veya auto etkinlik var mı?
    const special = await pool.query(
      `SELECT * FROM events WHERE is_auto = FALSE AND start_at <= $1 AND end_at > $1 ORDER BY start_at DESC LIMIT 1`,
      [now]
    );
    
    let activeEvent = null;
    if (special.rows.length > 0) {
      activeEvent = special.rows[0];
    } else {
      const autoEvent = await ensureThisWeekAutoEvent();
      if (now >= new Date(autoEvent.start_at) && now < new Date(autoEvent.end_at)) {
        activeEvent = autoEvent;
      }
    }

    const { startOfWeek } = getWeekRange(now);
    const daysSinceEpoch = Math.floor(startOfWeek.getTime() / 86400000);
    const weeksSinceEpoch = Math.floor(daysSinceEpoch / 7);
    const nextIdx = (weeksSinceEpoch + 1) % AUTO_EVENTS.length;
    const nextAuto = AUTO_EVENTS[nextIdx];

    if (activeEvent) {
      // Aktif etkinlik var!
      const endMs = new Date(activeEvent.end_at).getTime();
      return res.json({
        isActive: true,
        id: activeEvent.id,
        name: activeEvent.name,
        desc: activeEvent.description,
        icon: activeEvent.icon,
        type: activeEvent.type,
        mult: Number(activeEvent.mult),
        start: Math.floor(new Date(activeEvent.start_at).getTime() / 1000),
        end: Math.floor(endMs / 1000),
        remaining: Math.max(0, Math.floor((endMs - now.getTime()) / 1000)),
        is_auto: activeEvent.is_auto,
        next: { name: nextAuto.name, icon: nextAuto.icon }
      });
    }

    // Aktif etkinlik yok! En yakın gelecek auto etkinliği bulup gösterelim.
    const autoEvent = await ensureThisWeekAutoEvent();
    const startMs = new Date(autoEvent.start_at).getTime();
    const endMs = new Date(autoEvent.end_at).getTime();
    
    let remaining = 0;
    let displayEvent = autoEvent;

    if (now.getTime() < startMs) {
      // Cumartesi gününden önceyiz (Hafta içi)
      remaining = Math.max(0, Math.floor((startMs - now.getTime()) / 1000));
    } else {
      // Pazar günündeyiz. Gelecek haftanın auto etkinliğini hesaplayalım.
      const nextWeekStart = new Date(startOfWeek);
      nextWeekStart.setDate(startOfWeek.getDate() + 7);
      
      const nextEventStart = new Date(nextWeekStart);
      nextEventStart.setDate(nextWeekStart.getDate() + 5);
      nextEventStart.setHours(0, 0, 0, 0);

      const nextEventEnd = new Date(nextEventStart);
      nextEventEnd.setDate(nextEventStart.getDate() + 1);
      nextEventEnd.setHours(0, 0, 0, 0);

      const nextDaysSinceEpoch = Math.floor(nextWeekStart.getTime() / 86400000);
      const nextWeeksSinceEpoch = Math.floor(nextDaysSinceEpoch / 7);
      const nextEventIndex = nextWeeksSinceEpoch % AUTO_EVENTS.length;
      const nextE = AUTO_EVENTS[nextEventIndex];

      // Mock bir etkinlik objesi olarak gösterelim
      displayEvent = {
        id: 0,
        name: nextE.name,
        description: nextE.desc,
        icon: nextE.icon,
        type: nextE.type,
        mult: nextE.mult,
        start_at: nextEventStart,
        end_at: nextEventEnd,
        is_auto: true
      };
      remaining = Math.max(0, Math.floor((nextEventStart.getTime() - now.getTime()) / 1000));
    }

    res.json({
      isActive: false,
      id: displayEvent.id,
      name: displayEvent.name,
      desc: displayEvent.description,
      icon: displayEvent.icon,
      type: displayEvent.type,
      mult: Number(displayEvent.mult),
      start: Math.floor(new Date(displayEvent.start_at).getTime() / 1000),
      end: Math.floor(new Date(displayEvent.end_at).getTime() / 1000),
      remaining: remaining,
      is_auto: displayEvent.is_auto,
      next: { name: nextAuto.name, icon: nextAuto.icon }
    });

  } catch (err) {
    console.error('Etkinlik hatası:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/events/admin/create — özel etkinlik başlat
router.post('/admin/create', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const ip = req.ip || req.connection.remoteAddress;
    if (!checkAdminRateLimit(ip)) {
      return res.status(429).json({ error: 'Too many requests. Please wait.' });
    }

    const { name, description, icon, type, mult, durationHours } = req.body;
    if (!name || !type) {
      return res.status(400).json({ error: 'Name and type are required' });
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
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/events/admin/stop — özel etkinliği bitir
router.post('/admin/stop', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const ip = req.ip || req.connection.remoteAddress;
    if (!checkAdminRateLimit(ip)) {
      return res.status(429).json({ error: 'Too many requests. Please wait.' });
    }

    const now = new Date();
    await pool.query(
      `UPDATE events SET end_at = $1 WHERE is_auto = FALSE AND start_at <= $2 AND end_at > $2`,
      [now, now]
    );

    res.json({ success: true, message: 'Special event ended' });
  } catch (err) {
    console.error('Etkinlik durdurma hatası:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Son 5 geçmiş etkinlik (bitmiş auto etkinlikler + özel)
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const now = new Date();
    const past = await pool.query(
      `SELECT * FROM events WHERE end_at < $1 ORDER BY end_at DESC LIMIT 5`,
      [now]
    );
    res.json(past.rows.map(e => ({
      id: e.id,
      name: e.name,
      desc: e.description,
      icon: e.icon,
      type: e.type,
      mult: Number(e.mult),
      is_auto: e.is_auto,
      date: e.start_at
    })));
  } catch (err) {
    console.error('Geçmiş etkinlik hatası:', err);
    res.json([]);
  }
});

module.exports = router;
module.exports.getCurrentEvent = getCurrentEvent;
