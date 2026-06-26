const express = require('express');
const router = express.Router();
const pool = require('../../config/db');
const authMiddleware = require('../../middleware/auth');
const { checkAndApplyLevelUp, getNextLevelXp } = require('../../helpers/levelUp');
const { upsertAmmo } = require('../../helpers/rewards');
const QUESTS = require('../../config/questsData');

const GLITTER_CONFIG = {
  HOURLY_LIMIT: 200,
  HISTORY_CLEANUP_MS: 1800000,
};

const glitterClickHistory = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [playerId, history] of glitterClickHistory) {
    const lastTime = history.length > 0 ? history[history.length - 1].timestamp : 0;
    if (now - lastTime > GLITTER_CONFIG.HISTORY_CLEANUP_MS) {
      glitterClickHistory.delete(playerId);
    }
  }
}, 900000);

router.get('/glitter/status', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  const currentHour = Math.floor(Date.now() / 3600000);
  try {
    const pRes = await pool.query(
      'SELECT glitter_hour, glitter_hour_count FROM players WHERE id = $1',
      [playerId]
    );
    if (pRes.rows.length === 0) {
      return res.status(404).json({ error: 'err_player_not_found' });
    }
    let { glitter_hour, glitter_hour_count } = pRes.rows[0];
    if (glitter_hour < currentHour) {
      glitter_hour_count = 0;
    }
    const remaining = Math.max(0, GLITTER_CONFIG.HOURLY_LIMIT - glitter_hour_count);
    res.json({ remaining, limit: GLITTER_CONFIG.HOURLY_LIMIT });
  } catch (err) {
    console.error('Glitter status error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/glitter/collect', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  const { clickX, clickY, mouseDelta } = req.body || {};
  const now = Date.now();
  const currentHour = Math.floor(now / 3600000);

  const history = glitterClickHistory.get(playerId) || [];
  const lastClick = history.length > 0 ? history[history.length - 1].timestamp : 0;

  try {
    const pRes = await pool.query(
      'SELECT glitter_hour, glitter_hour_count, gold, pearl, xp, level FROM players WHERE id = $1',
      [playerId]
    );
    if (pRes.rows.length === 0) {
      return res.status(404).json({ error: 'err_player_not_found' });
    }

    let { glitter_hour, glitter_hour_count } = pRes.rows[0];
    if (glitter_hour < currentHour) {
      glitter_hour_count = 0;
      glitter_hour = currentHour;
    }
    glitter_hour_count++;
    if (glitter_hour_count > GLITTER_CONFIG.HOURLY_LIMIT) {
      return res.status(429).json({ error: 'err_glitter_hourly_limit', remaining: 0 });
    }

    const roll = Math.floor(Math.random() * 100);

    let xpReward = 0;
    let goldReward = 0;
    let pearlReward = 0;
    let ammoReward = null;

    if (roll < 35) {
      xpReward = Math.floor(Math.random() * 5) + 1;
    } else if (roll < 70) {
      goldReward = Math.floor(Math.random() * 101) + 100;
    } else if (roll < 88) {
      const qty = Math.floor(Math.random() * 51) + 100;
      ammoReward = { type: 2, name: 'Hollow Shot', qty };
    } else if (roll < 96) {
      pearlReward = Math.floor(Math.random() * 3) + 3;
    } else {
      const qty = Math.floor(Math.random() * 41) + 10;
      ammoReward = { type: 3, name: 'Explosive Shot', qty };
    }

    const remaining = GLITTER_CONFIG.HOURLY_LIMIT - glitter_hour_count;

    const glitterClient = await pool.connect();
    try {
      await glitterClient.query('BEGIN');

      await glitterClient.query(
        `UPDATE players 
         SET gold = gold + $1, 
             pearl = pearl + $2, 
             xp = xp + $3,
             glitter_hour = $4,
             glitter_hour_count = $5,
             quest_glitters = CASE WHEN active_quest_id IS NOT NULL THEN COALESCE(quest_glitters, 0) + 1 ELSE COALESCE(quest_glitters, 0) END,
             quest_glitters2 = CASE WHEN active_quest_id2 IS NOT NULL THEN COALESCE(quest_glitters2, 0) + 1 ELSE COALESCE(quest_glitters2, 0) END
         WHERE id = $6`,
        [goldReward, pearlReward, xpReward, glitter_hour, glitter_hour_count, playerId]
      );

      const qRes = await glitterClient.query(
        'SELECT active_quest_id, active_quest_id2, quest_progress, quest_progress2 FROM players WHERE id = $1',
        [playerId]
      );
      if (qRes.rows.length > 0) {
        const qRow = qRes.rows[0];

        if (qRow.active_quest_id) {
          const questDef = QUESTS[qRow.active_quest_id];
          if (questDef && questDef.objectives) {
            let progress = qRow.quest_progress || [];
            let needUpdate = false;
            questDef.objectives.forEach((obj, i) => {
              if (obj.type === 'glitter') {
                progress[i] = (progress[i] || 0) + 1;
                needUpdate = true;
              }
            });
            if (needUpdate) {
              await glitterClient.query(
                'UPDATE players SET quest_progress = $1 WHERE id = $2',
                [JSON.stringify(progress), playerId]
              );
            }
          }
        }

        if (qRow.active_quest_id2) {
          const questDef = QUESTS[qRow.active_quest_id2];
          if (questDef && questDef.objectives) {
            let progress = qRow.quest_progress2 || [];
            let needUpdate = false;
            questDef.objectives.forEach((obj, i) => {
              if (obj.type === 'glitter') {
                progress[i] = (progress[i] || 0) + 1;
                needUpdate = true;
              }
            });
            if (needUpdate) {
              await glitterClient.query(
                'UPDATE players SET quest_progress2 = $1 WHERE id = $2',
                [JSON.stringify(progress), playerId]
              );
            }
          }
        }
      }

      await glitterClient.query('COMMIT');
    } catch (txErr) {
      await glitterClient.query('ROLLBACK');
      console.error('Glitter transaction error:', txErr);
    } finally {
      glitterClient.release();
    }

    if (ammoReward) {
      await upsertAmmo(pool, playerId, ammoReward.type, ammoReward.qty);
    }

    const updatedRes = await pool.query(
      'SELECT gold, pearl, xp, level FROM players WHERE id = $1',
      [playerId]
    );
    const p = updatedRes.rows[0];

    const { leveledUp, newLevel } = await checkAndApplyLevelUp(pool, playerId, p.xp, p.level);
    if (leveledUp) {
      p.level = newLevel;
    }

    const xpNext = await getNextLevelXp(pool, newLevel);

    history.push({ timestamp: now, x: clickX, y: clickY, mouseDelta });
    if (history.length > 15) history.shift();
    glitterClickHistory.set(playerId, history);

    res.json({
      message: 'Glitter collected successfully!',
      rewards: {
        gold: goldReward,
        xp: xpReward,
        pearl: pearlReward,
        ammo: ammoReward
      },
      player: {
        gold: parseInt(p.gold),
        pearl: parseInt(p.pearl),
        xp: parseInt(p.xp),
        level: p.level,
        xpNext: xpNext
      },
      glitterRemaining: remaining,
      leveledUp,
      newLevel
    });

  } catch (err) {
    console.error("Glitter Collect Error:", err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
