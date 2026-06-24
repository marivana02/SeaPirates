const express = require('express');
const router = express.Router();
const pool = require('../../config/db');
const authMiddleware = require('../../middleware/auth');
const { getPvPRank } = require('../../helpers/pvpRank');

function getLocalDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

router.get('/pvp/status', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  try {
    const pRes = await pool.query(
      "SELECT id, username, display_name, level, ship_level, pvp_points, pvp_target_id, pvp_changes_left, TO_CHAR(last_pvp_reset, 'YYYY-MM-DD') as last_pvp_reset, active_design, visual_ship_level FROM players WHERE id = $1",
      [playerId]
    );
    if (pRes.rows.length === 0) return res.status(404).json({ error: 'Player not found.' });
    
    let p = pRes.rows[0];
    const todayStr = getLocalDateStr();
    let changesLeft = p.pvp_changes_left;
    
    const resetDateStr = p.last_pvp_reset || '';
    if (resetDateStr !== todayStr) {
      changesLeft = 10;
      await pool.query(
        'UPDATE players SET pvp_changes_left = 10, last_pvp_reset = $1 WHERE id = $2',
        [todayStr, playerId]
      );
    }
    
    const rankInfo = getPvPRank(p.pvp_points);
    let target = null;
    let targetId = p.pvp_target_id;

    while (true) {
      if (targetId === null) {
        const rangeRes = await pool.query(
          `SELECT id FROM players WHERE id != $1 AND level BETWEEN $2 AND $3 ORDER BY RANDOM() LIMIT 1`,
          [playerId, Math.max(1, p.level - 3), p.level + 3]
        );

        if (rangeRes.rows.length > 0) {
          targetId = rangeRes.rows[0].id;
        } else {
          const anyRes = await pool.query(
            `SELECT id FROM players WHERE id != $1 ORDER BY RANDOM() LIMIT 1`,
            [playerId]
          );
          if (anyRes.rows.length > 0) {
            targetId = anyRes.rows[0].id;
          } else {
            targetId = -1;
          }
        }

        await pool.query('UPDATE players SET pvp_target_id = $1 WHERE id = $2', [targetId, playerId]);
      }

      if (targetId === -1) {
        const botLvl = Math.max(1, p.level);
        const botMaxHp = 25000 + (botLvl * 6500);
        const botEquippedCannons = 10 + (botLvl * 2);
        const botDamage = botEquippedCannons * 155;
        target = {
          id: -1,
          username: 'Captain Barbarossa [BOT]',
          level: botLvl,
          maxHp: botMaxHp,
          shipLevel: Math.min(10, Math.floor(botLvl / 2)),
          damage: botDamage
        };
        break;
      }

      const tRes = await pool.query(
        'SELECT id, username, display_name, level, max_hp, ship_level, active_design, visual_ship_level FROM players WHERE id = $1',
        [targetId]
      );

      if (tRes.rows.length === 0) {
        await pool.query('UPDATE players SET pvp_target_id = NULL WHERE id = $1', [playerId]);
        targetId = null;
        continue;
      }

      const t = tRes.rows[0];
      const tCannons = await pool.query(
        'SELECT COALESCE(SUM(equipped), 0) as total FROM player_cannons WHERE player_id = $1',
        [t.id]
      );
      const tEquipped = parseInt(tCannons.rows[0].total) || 5;

      const tDmg = tEquipped * 185;

      target = {
        id: t.id,
        username: t.display_name || t.username,
        level: parseInt(t.level),
        maxHp: parseInt(t.max_hp),
        shipLevel: parseInt(t.ship_level || 0),
        activeDesign: t.active_design,
        visualShipLevel: t.visual_ship_level,
        damage: tDmg
      };
      break;
    }
    
    res.json({
      pvpPoints: parseInt(p.pvp_points || 0),
      rankName: rankInfo.name,
      rankBadge: rankInfo.badge,
      rankMin: rankInfo.min,
      rankMax: rankInfo.max,
      nextRankName: rankInfo.nextName,
      nextRankBadge: rankInfo.nextBadge,
      changesLeft,
      player: {
        username: p.display_name || p.username,
        level: parseInt(p.level),
        shipLevel: parseInt(p.ship_level || 0),
        activeDesign: p.active_design,
        visualShipLevel: p.visual_ship_level
      },
      target
    });
    
  } catch (err) {
    console.error("PvP Status Error:", err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/pvp/change', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  try {
    const pRes = await pool.query(
      "SELECT id, level, pvp_changes_left, TO_CHAR(last_pvp_reset, 'YYYY-MM-DD') as last_pvp_reset FROM players WHERE id = $1",
      [playerId]
    );
    if (pRes.rows.length === 0) return res.status(404).json({ error: 'Player not found.' });
    
    let p = pRes.rows[0];
    const todayStr = getLocalDateStr();
    let changesLeft = p.pvp_changes_left;
    
    const resetDateStr = p.last_pvp_reset || '';
    if (resetDateStr !== todayStr) {
      changesLeft = 10;
    }
    
    if (changesLeft <= 0) {
      return res.status(400).json({ error: 'No enemy changes left for today! (Max: 10)' });
    }
    
    const rangeRes = await pool.query(
      `SELECT id FROM players WHERE id != $1 AND level BETWEEN $2 AND $3 ORDER BY RANDOM() LIMIT 1`,
      [playerId, Math.max(1, p.level - 3), p.level + 3]
    );
    
    let targetId = -1;
    if (rangeRes.rows.length > 0) {
      targetId = rangeRes.rows[0].id;
    } else {
      const anyRes = await pool.query(
        `SELECT id FROM players WHERE id != $1 ORDER BY RANDOM() LIMIT 1`,
        [playerId]
      );
      if (anyRes.rows.length > 0) {
        targetId = anyRes.rows[0].id;
      }
    }
    
    changesLeft -= 1;
    await pool.query(
      'UPDATE players SET pvp_target_id = $1, pvp_changes_left = $2, last_pvp_reset = $3 WHERE id = $4',
      [targetId, changesLeft, todayStr, playerId]
    );
    
    res.json({ success: true, message: 'Enemy changed successfully!', changesLeft });
    
  } catch (err) {
    console.error("PvP Change Error:", err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
