const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth');
const gameData = require('../config/gameData');

// GET SHIPS STATUS FOR THE PLAYER
router.get('/', authMiddleware, async (req, res) => {
  const playerId = req.player.id;

  try {
    const pRes = await pool.query(
      'SELECT elite_points, ship_level, gold, pearl FROM players WHERE id = $1',
      [playerId]
    );

    if (pRes.rows.length === 0) {
      return res.status(404).json({ error: 'Oyuncu bulunamadı' });
    }

    const player = pRes.rows[0];
    res.json({
      elitePoints: player.elite_points,
      activeShipLevel: player.ship_level,
      shipsList: gameData.SHIPS
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// SELECT ACTIVE SHIP TIER
router.post('/select', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  const { level } = req.body; // Selected ship level (0 to 10)

  const selectedLevel = parseInt(level);
  if (isNaN(selectedLevel) || selectedLevel < 0 || selectedLevel > 10) {
    return res.status(400).json({ error: 'Geçersiz gemi seviyesi' });
  }

  const targetShip = gameData.SHIPS.find(s => s.level === selectedLevel);
  if (!targetShip) {
    return res.status(400).json({ error: 'Gemi seviyesi bulunamadı' });
  }

  try {
    const pRes = await pool.query(
      'SELECT elite_points, ship_level, max_hp, hp FROM players WHERE id = $1',
      [playerId]
    );

    if (pRes.rows.length === 0) {
      return res.status(404).json({ error: 'Oyuncu bulunamadı' });
    }

    const player = pRes.rows[0];

    // Seviye 0 başlangıçtır, her zaman seçilebilir.
    // Seviye 1 veya daha üstünü seçmek için oyuncunun 'ship_level' değerinin en az 1 olması gerekir (yani Elit Gemi I satın almış olmalıdır).
    if (selectedLevel > 0 && player.ship_level < 1) {
      return res.status(400).json({ error: 'Elit gemileri etkinleştirmek için önce Dükkandan Elit Gemi I satın almalısınız!' });
    }

    // ELP Gereksinim Kontrolü
    if (player.elite_points < targetShip.requiredElp) {
      return res.status(400).json({ 
        error: `Yetersiz Elit Puanı! Gereken: ${targetShip.requiredElp.toLocaleString('tr-TR')} ELP` 
      });
    }

    // Aktif gemi seviyesini güncelle
    await pool.query('UPDATE players SET ship_level = $1 WHERE id = $2', [selectedLevel, playerId]);

    // ── FAZLA TAKILI TOPLARI DEPOYA AL (yüksek tier önce: top3→top2→top1) ──
    const cannonsEqRes = await pool.query(
      'SELECT cannon_type, equipped FROM player_cannons WHERE player_id = $1 AND equipped > 0 ORDER BY cannon_type DESC',
      [playerId]
    );
    let totalCannonsEq = cannonsEqRes.rows.reduce((s, r) => s + (r.equipped || 0), 0);
    let cannonExcess = Math.max(0, totalCannonsEq - targetShip.cannonSlots);
    for (const row of cannonsEqRes.rows) {
      if (cannonExcess <= 0) break;
      const reduce = Math.min(row.equipped, cannonExcess);
      if (reduce > 0) {
        await pool.query(
          'UPDATE player_cannons SET equipped = equipped - $1 WHERE player_id = $2 AND cannon_type = $3',
          [reduce, playerId, row.cannon_type]
        );
        cannonExcess -= reduce;
      }
    }

    // ── FAZLA TAKILI DİREKLERİ DEPOYA AL (elit önce) ──
    const planksEqRes = await pool.query(
      `SELECT plank_type, equipped FROM player_planks 
       WHERE player_id = $1 AND equipped > 0 
       ORDER BY CASE plank_type WHEN 'elit' THEN 1 ELSE 2 END`,
      [playerId]
    );
    let totalPlanksEq = planksEqRes.rows.reduce((s, r) => s + (r.equipped || 0), 0);
    let plankExcess = Math.max(0, totalPlanksEq - targetShip.plankSlots);
    for (const row of planksEqRes.rows) {
      if (plankExcess <= 0) break;
      const reduce = Math.min(row.equipped, plankExcess);
      if (reduce > 0) {
        await pool.query(
          'UPDATE player_planks SET equipped = equipped - $1 WHERE player_id = $2 AND plank_type = $3',
          [reduce, playerId, row.plank_type]
        );
        plankExcess -= reduce;
      }
    }

    // ── YENİ MAX HP (fazla direkler çıktıktan sonra hesapla) ──
    const planksRes = await pool.query(
      'SELECT plank_type, equipped FROM player_planks WHERE player_id = $1',
      [playerId]
    );
    let hpBonus = 0;
    planksRes.rows.forEach(row => {
      const bonus = row.plank_type === 'tahta' ? 500 : 1200;
      hpBonus += bonus * (row.equipped || 0);
    });
    const newMaxHp = targetShip.baseHp + hpBonus;

    await pool.query(
      `UPDATE players SET max_hp = $1, hp = LEAST(hp, $1) WHERE id = $2`,
      [newMaxHp, playerId]
    );

    res.json({
      message: `${targetShip.name} başarıyla aktif edildi!`,
      activeShipLevel: selectedLevel,
      maxHp: newMaxHp,
      cannonSlotsMax: targetShip.cannonSlots,
      plankSlotsMax: targetShip.plankSlots
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

module.exports = router;

