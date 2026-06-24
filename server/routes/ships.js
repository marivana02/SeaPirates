const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth');
const gameData = require('../config/gameData');

const DESIGNS = {
  kristal_queen: { key: 'kristal_queen', name: 'Crystal Queen', img: 'assets/items/shop/kristalquen/1.png' },
  seahawk: { key: 'seahawk', name: 'Seahawk', img: 'assets/items/shop/seahawk/1.png' }
};

// GET SHIPS STATUS FOR THE PLAYER
router.get('/', authMiddleware, async (req, res) => {
  const playerId = req.player.id;

  try {
    const pRes = await pool.query(
      'SELECT elite_points, ship_level, has_elite_ship, gold, pearl, active_design, visual_ship_level FROM players WHERE id = $1',
      [playerId]
    );

    if (pRes.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const player = pRes.rows[0];

    const designsRes = await pool.query(
      'SELECT design_key FROM player_designs WHERE player_id = $1',
      [playerId]
    );
    const ownedDesigns = designsRes.rows.map(r => r.design_key);

    res.json({
      elitePoints: player.elite_points,
      activeShipLevel: player.ship_level,
      visualShipLevel: player.visual_ship_level,
      hasEliteShip: player.has_elite_ship,
      activeDesign: player.active_design,
      ownedDesigns,
      shipsList: gameData.SHIPS
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// SELECT ACTIVE SHIP TIER
router.post('/select', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  const { level } = req.body; // Selected ship level (0 to 10)

  const selectedLevel = parseInt(level);
  if (isNaN(selectedLevel) || selectedLevel < 0 || selectedLevel > 10) {
    return res.status(400).json({ error: 'Invalid ship level' });
  }

  const targetShip = gameData.SHIPS.find(s => s.level === selectedLevel);
  if (!targetShip) {
    return res.status(400).json({ error: 'Ship level not found' });
  }

  try {
    const pRes = await pool.query(
      'SELECT elite_points, ship_level, has_elite_ship, max_hp, hp, visual_ship_level FROM players WHERE id = $1',
      [playerId]
    );

    if (pRes.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const player = pRes.rows[0];

    // Level 0 is the starter, always selectable.
    const lv1Elp = gameData.SHIPS.find(s => s.level === 1)?.requiredElp || 35000;
    // Level 1: must have purchased from shop/auction (has_elite_ship) or collected 35,000 ELP
    if (selectedLevel === 1 && !player.has_elite_ship && player.elite_points < lv1Elp) {
      return res.status(400).json({ 
        error: `Either purchase Elite Ship I or collect ${lv1Elp.toLocaleString('en-US')} ELP!`
      });
    }
    // Level 2+: sufficient ELP required
    if (selectedLevel > 1 && player.elite_points < targetShip.requiredElp) {
      return res.status(400).json({ 
        error: `Insufficient Elite Points! Required: ${targetShip.requiredElp.toLocaleString('en-US')} ELP`
      });
    }

    // Update active ship level
    await pool.query('UPDATE players SET ship_level = $1, visual_ship_level = NULL WHERE id = $2', [selectedLevel, playerId]);

    // ── MOVE OVER-EQUIPPED CANNONS TO STORAGE (higher tier first: top3→top2→top1) ──
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

    // ── MOVE OVER-EQUIPPED PLANKS TO STORAGE (elite first) ──
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

    // ── NEW MAX HP (after excess planks removed) ──
    const planksRes = await pool.query(`
      SELECT pp.equipped, p.hp_bonus
      FROM player_planks pp
      JOIN planks p ON pp.plank_type = p.type_key
      WHERE pp.player_id = $1
    `, [playerId]);
    let hpBonus = 0;
    planksRes.rows.forEach(row => {
      hpBonus += parseInt(row.hp_bonus || 0) * (row.equipped || 0);
    });
    const newMaxHp = targetShip.baseHp + hpBonus;

    await pool.query(
      `UPDATE players SET max_hp = $1, hp = LEAST(hp, $1) WHERE id = $2`,
      [newMaxHp, playerId]
    );

    res.json({
      message: `${targetShip.name} activated successfully!`,
      activeShipLevel: selectedLevel,
      maxHp: newMaxHp,
      cannonSlotsMax: targetShip.cannonSlots,
      plankSlotsMax: targetShip.plankSlots
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// SELECT ACTIVE DESIGN
router.post('/select-design', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  const { designKey } = req.body;

  try {
    if (designKey === null || designKey === undefined || designKey === 'null') {
      await pool.query('UPDATE players SET active_design = NULL WHERE id = $1', [playerId]);
      return res.json({ message: 'Design removed.', activeDesign: null });
    }

    const owned = await pool.query(
      'SELECT id FROM player_designs WHERE player_id = $1 AND design_key = $2',
      [playerId, designKey]
    );
    if (owned.rows.length === 0) {
      return res.status(400).json({ error: 'You do not own this design!' });
    }

    if (!DESIGNS[designKey]) {
      return res.status(400).json({ error: 'Invalid design!' });
    }

    await pool.query('UPDATE players SET active_design = $1 WHERE id = $2', [designKey, playerId]);
    res.json({ message: `${DESIGNS[designKey].name} activated!`, activeDesign: designKey });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// SELECT VISUAL SHIP LEVEL (görünüm için, stats değişmez)
router.post('/select-visual', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  const { visualLevel } = req.body;

  const selectedLevel = parseInt(visualLevel);
  if (isNaN(selectedLevel) || selectedLevel < 0 || selectedLevel > 10) {
    return res.status(400).json({ error: 'Invalid ship level' });
  }

  const targetShip = gameData.SHIPS.find(s => s.level === selectedLevel);
  if (!targetShip) {
    return res.status(400).json({ error: 'Ship level not found' });
  }

  try {
    const pRes = await pool.query(
      'SELECT elite_points, ship_level, has_elite_ship, visual_ship_level FROM players WHERE id = $1',
      [playerId]
    );

    if (pRes.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const player = pRes.rows[0];

    // Görünüm olarak kendi seviyenden yüksek bir gemi seçemezsin
    if (selectedLevel > player.ship_level) {
      return res.status(400).json({ error: 'You cannot use a higher level ship as visual!' });
    }

    // Seçilen seviyenin kilidini açmış olmalı
    const lv1Elp = gameData.SHIPS.find(s => s.level === 1)?.requiredElp || 35000;
    if (selectedLevel === 1 && !player.has_elite_ship && player.elite_points < lv1Elp) {
      return res.status(400).json({
        error: `Either purchase Elite Ship I or collect ${lv1Elp.toLocaleString('en-US')} ELP!`
      });
    }
    if (selectedLevel > 1 && player.elite_points < targetShip.requiredElp) {
      return res.status(400).json({
        error: `Insufficient Elite Points! Required: ${targetShip.requiredElp.toLocaleString('en-US')} ELP`
      });
    }

    // Kendi level'ınla aynıysa NULL yap (override gerekmez)
    const newVisual = selectedLevel === player.ship_level ? null : selectedLevel;
    await pool.query('UPDATE players SET visual_ship_level = $1 WHERE id = $2', [newVisual, playerId]);

    res.json({
      message: newVisual === null
        ? `${targetShip.name} default view activated!`
        : `${targetShip.name} view activated!`,
      visualShipLevel: newVisual
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

