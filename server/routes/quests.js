const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth');
const QUESTS = require('../config/questsData');

const ACTIVE_SLOTS = ['active_quest_id', 'active_quest_id2'];

async function canAcceptAnother(pool, playerId) {
  const res = await pool.query(
    'SELECT active_quest_id, active_quest_id2, vip_until FROM players WHERE id = $1',
    [playerId]
  );
  if (res.rows.length === 0) return { allowed: false, reason: 'err_player_not_found' };
  const p = res.rows[0];
  const isVip = p.vip_until && new Date(p.vip_until) > new Date();
  const slots = ACTIVE_SLOTS.filter(s => p[s] !== null);
  if (slots.length === 0) return { allowed: true, isVip };
  if (slots.length === 1 && isVip) return { allowed: true, isVip };
  return { allowed: false, reason: 'err_quest_already_active' };
}

router.get('/', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  try {
    const todayStr = new Date().toISOString().slice(0, 10);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const dateRes = await client.query('SELECT last_quest_reset_date FROM players WHERE id = $1 FOR UPDATE', [playerId]);

      if (dateRes.rows.length > 0 && dateRes.rows[0].last_quest_reset_date !== todayStr) {
        await client.query(
          `UPDATE players SET completed_quests = '{}', last_quest_reset_date = $1,
           active_quest_id = NULL, active_quest_id2 = NULL,
           quest_kills = 0, quest_damage = 0, quest_glitters = 0,
           quest_kills2 = 0, quest_damage2 = 0, quest_glitters2 = 0,
           quest_progress = '[]'::json,
           quest_progress2 = '[]'::json,
           bonus_quest_id = NULL, bonus_quest_expires_at = NULL WHERE id = $2`,
          [todayStr, playerId]
        );
      }
      await client.query('COMMIT');
      client.release();
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      client.release();
      throw e;
    }

    const pRes = await pool.query(
      `SELECT level, active_quest_id, active_quest_id2, quest_kills, quest_damage, quest_glitters,
               quest_kills2, quest_damage2, quest_glitters2,
               completed_quests, bonus_quest_id, bonus_quest_expires_at, bonus_quest_progress, quest_progress, quest_progress2, vip_until
       FROM players WHERE id = $1`,
      [playerId]
    );

    if (pRes.rows.length === 0) return res.status(404).json({ error: 'err_player_not_found' });

    const p = pRes.rows[0];
    const playerLevel = p.level;
    const isVip = p.vip_until && new Date(p.vip_until) > new Date();

    // VIP süresi dolduysa 2. slotu temizle
    if (!isVip && p.active_quest_id2) {
      await pool.query(
        'UPDATE players SET active_quest_id2 = NULL, quest_kills2 = 0, quest_damage2 = 0, quest_glitters2 = 0, quest_progress2 = \'[]\'::json WHERE id = $1',
        [playerId]
      );
      p.active_quest_id2 = null;
    }

    const activeQuestIds = [p.active_quest_id, p.active_quest_id2].filter(id => id !== null);
    const questProgress = p.quest_progress || [];
    const questProgress2 = p.quest_progress2 || [];
    const bonusQuestProgress = p.bonus_quest_progress || [];
    const completedQuests = p.completed_quests || [];
    let bonusQuestId = p.bonus_quest_id;
    let bonusQuestExpiresAt = p.bonus_quest_expires_at;

    if (bonusQuestExpiresAt && new Date() > new Date(bonusQuestExpiresAt)) {
      await pool.query(
        'UPDATE players SET bonus_quest_id = NULL, bonus_quest_expires_at = NULL WHERE id = $1',
        [playerId]
      );
      bonusQuestId = null;
      bonusQuestExpiresAt = null;
    }

    const normalQuestIds = Array.from({ length: 30 }, (_, i) => i + 1);
    const levelQuests = normalQuestIds.filter(id => QUESTS[id] && QUESTS[id].levelReq === playerLevel);
    const allLevelQuestsDone = levelQuests.length > 0 && levelQuests.every(id => completedQuests.includes(id));

    if (allLevelQuestsDone && !bonusQuestId && activeQuestIds.length < (isVip ? 2 : 1)) {
      const bonusQuest = Object.values(QUESTS).find(q => q.timeLimit && q.levelReq === playerLevel);
      if (bonusQuest) {
        const expiresAt = new Date(Date.now() + bonusQuest.timeLimit * 60 * 1000);
        const bonusProgress = bonusQuest.objectives.map(() => 0);
        await pool.query(
          'UPDATE players SET bonus_quest_id = $1, bonus_quest_expires_at = $2, bonus_quest_progress = $3 WHERE id = $4',
          [bonusQuest.id, expiresAt, JSON.stringify(bonusProgress), playerId]
        );
        bonusQuestId = bonusQuest.id;
        bonusQuestExpiresAt = expiresAt;
      }
    }

    const result = Object.values(QUESTS)
      .filter(q => (q.id < 100 && q.levelReq === playerLevel) || activeQuestIds.includes(q.id) || q.id === bonusQuestId)
      .map(q => {
        let state = 'locked';
        if (completedQuests.includes(q.id)) {
          state = 'completed';
        } else if (activeQuestIds.includes(q.id)) {
          state = 'active';
        } else if (bonusQuestId === q.id) {
          state = 'bonus';
        } else if (playerLevel >= q.levelReq) {
          state = 'available';
        }

        const isActiveOrBonus = activeQuestIds.includes(q.id) || q.id === bonusQuestId;
        const isSlot2 = q.id === p.active_quest_id2;

        const isBonus = q.id === bonusQuestId;
        return {
          ...q,
          state,
          expiresAt: isBonus && bonusQuestExpiresAt ? bonusQuestExpiresAt : null,
          progress: isActiveOrBonus
            ? (isBonus ? bonusQuestProgress : (isSlot2 ? questProgress2 : questProgress))
            : []
        };
      });

    res.json({
      quests: result,
      activeQuestIds,
      playerLevel,
      isVip,
      bonusQuestId,
      bonusQuestExpiresAt
    });

  } catch (err) {
    console.error('Quest list fetch error:', err);
    res.status(500).json({ error: 'err_server' });
  }
});

router.post('/accept', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  const { questId } = req.body;
  const qId = parseInt(questId);

  const quest = QUESTS[qId];
  if (!quest) return res.status(400).json({ error: 'err_quest_invalid_id' });

  try {
    const pRes = await pool.query(
      'SELECT level, active_quest_id, active_quest_id2, completed_quests, vip_until FROM players WHERE id = $1',
      [playerId]
    );
    if (pRes.rows.length === 0) return res.status(404).json({ error: 'err_player_not_found' });

    const p = pRes.rows[0];
    const isVip = p.vip_until && new Date(p.vip_until) > new Date();

    if (p.level !== quest.levelReq) {
      return res.status(400).json({ error: 'err_quest_level_mismatch' });
    }

    const check = await canAcceptAnother(pool, playerId);
    if (!check.allowed) {
      return res.status(400).json({ error: check.reason });
    }

    if ((p.completed_quests || []).includes(qId)) {
      return res.status(400).json({ error: 'err_quest_already_completed' });
    }

    if (qId === p.active_quest_id || qId === p.active_quest_id2) {
      return res.status(400).json({ error: 'err_quest_already_active' });
    }

    const progress = quest.objectives.map(() => 0);

    let slot;
    if (p.active_quest_id === null) {
      slot = 'active_quest_id';
    } else if (isVip && p.active_quest_id2 === null) {
      slot = 'active_quest_id2';
    } else {
      return res.status(400).json({ error: 'err_quest_already_active' });
    }

    const isSlot2 = slot === 'active_quest_id2';
    await pool.query(
      `UPDATE players
       SET ${slot} = $1,
           ${isSlot2 ? 'quest_kills2 = 0, quest_damage2 = 0, quest_glitters2 = 0, quest_progress2' : 'quest_kills = 0, quest_damage = 0, quest_glitters = 0, quest_progress'} = $2
       WHERE id = $3`,
      [qId, JSON.stringify(progress), playerId]
    );

    res.json({ success: true, message: 'quest_accepted', slot, isVip });

  } catch (err) {
    console.error('Quest accept error:', err);
    res.status(500).json({ error: 'err_server' });
  }
});

router.post('/deliver', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  const { questId } = req.body;

  try {
    const pRes = await pool.query(
      `SELECT level, active_quest_id, active_quest_id2, quest_kills, quest_damage, quest_glitters,
              quest_kills2, quest_damage2, quest_glitters2, quest_progress, quest_progress2
       FROM players WHERE id = $1`,
      [playerId]
    );
    if (pRes.rows.length === 0) return res.status(404).json({ error: 'err_player_not_found' });

    const p = pRes.rows[0];
    const targetId = parseInt(questId) || p.active_quest_id;

    if (!targetId) {
      return res.status(400).json({ error: 'err_quest_no_active_deliver' });
    }

    if (targetId !== p.active_quest_id && targetId !== p.active_quest_id2) {
      return res.status(400).json({ error: 'err_quest_not_found' });
    }

    const quest = QUESTS[targetId];
    if (!quest) {
      await pool.query(
        'UPDATE players SET active_quest_id = NULL, active_quest_id2 = NULL WHERE id = $1',
        [playerId]
      );
      return res.status(400).json({ error: 'err_quest_not_found' });
    }

    const isSlot2Deliver = targetId === p.active_quest_id2;
    const deliverProgress = isSlot2Deliver ? (p.quest_progress2 || []) : (p.quest_progress || []);
    const allDone = quest.objectives.every((obj, i) => (deliverProgress[i] || 0) >= obj.amount);
    if (!allDone) {
      return res.status(400).json({ error: 'err_quest_objectives_pending' });
    }

    await pool.query(
      `UPDATE players
       SET gold = gold + $1,
           pearl = pearl + $2,
           xp = xp + $3,
           ${targetId === p.active_quest_id ? 'active_quest_id' : 'active_quest_id2'} = NULL,
           ${isSlot2Deliver
             ? 'quest_kills2 = 0, quest_damage2 = 0, quest_glitters2 = 0, quest_progress2'
             : 'quest_kills = 0, quest_damage = 0, quest_glitters = 0, quest_progress'} = '[]'::json,
           completed_quests = array_append(completed_quests, $4)
       WHERE id = $5`,
      [quest.rewards.gold, quest.rewards.pearl, quest.rewards.xp, targetId, playerId]
    );

    const updatedRes = await pool.query('SELECT level, xp FROM players WHERE id = $1', [playerId]);
    const u = updatedRes.rows[0];
    let leveledUp = false;
    let newLevel = u.level;

    while (true) {
      const checkLvl = await pool.query('SELECT required_xp FROM level_requirements WHERE level = $1', [newLevel + 1]);
      if (checkLvl.rows.length > 0) {
        const reqXp = checkLvl.rows[0].required_xp;
        if (parseInt(u.xp) >= parseInt(reqXp)) {
          newLevel += 1;
          leveledUp = true;
        } else {
          break;
        }
      } else {
        break;
      }
    }

    if (leveledUp) {
      await pool.query('UPDATE players SET level = $1 WHERE id = $2', [newLevel, playerId]);
    }

    const normalQuestIds = Array.from({ length: 30 }, (_, i) => i + 1);
    const levelQuests = normalQuestIds.filter(id => QUESTS[id] && QUESTS[id].levelReq === newLevel);
    const completedRes = await pool.query('SELECT completed_quests FROM players WHERE id = $1', [playerId]);
    const completedQuests = completedRes.rows[0].completed_quests || [];
    const allLevelQuestsDone = levelQuests.length > 0 && levelQuests.every(id => completedQuests.includes(id));

    let bonusQuestAssigned = null;
    let bonusExpiresAt = null;
    if (allLevelQuestsDone) {
      const bonusQuest = Object.values(QUESTS).find(q => q.timeLimit && q.levelReq === newLevel);
      if (bonusQuest) {
        bonusExpiresAt = new Date(Date.now() + bonusQuest.timeLimit * 60 * 1000);
        const bonusProgress = bonusQuest.objectives.map(() => 0);
        await pool.query(
          'UPDATE players SET bonus_quest_id = $1, bonus_quest_expires_at = $2, bonus_quest_progress = $3 WHERE id = $4',
          [bonusQuest.id, bonusExpiresAt, JSON.stringify(bonusProgress), playerId]
        );
        bonusQuestAssigned = bonusQuest;
      }
    }

    res.json({
      success: true,
      message: 'quest_delivered',
      rewards: quest.rewards,
      leveledUp,
      newLevel,
      bonusQuestAssigned: bonusQuestAssigned ? { id: bonusQuestAssigned.id, title: bonusQuestAssigned.title, expiresAt: bonusExpiresAt } : null
    });

  } catch (err) {
    console.error('Quest deliver error:', err);
    res.status(500).json({ error: 'err_server' });
  }
});

router.post('/cancel', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  const { questId } = req.body;

  try {
    const pRes = await pool.query(
      'SELECT active_quest_id, active_quest_id2 FROM players WHERE id = $1',
      [playerId]
    );
    if (pRes.rows.length === 0) return res.status(404).json({ error: 'err_player_not_found' });

    const p = pRes.rows[0];
    const targetId = parseInt(questId) || p.active_quest_id;

    if (!targetId) {
      return res.status(400).json({ error: 'err_quest_no_active_cancel' });
    }

    if (targetId !== p.active_quest_id && targetId !== p.active_quest_id2) {
      return res.status(400).json({ error: 'err_quest_not_found' });
    }

    const isSlot2Cancel = targetId === p.active_quest_id2;
    await pool.query(
      `UPDATE players
       SET ${targetId === p.active_quest_id ? 'active_quest_id' : 'active_quest_id2'} = NULL,
           ${isSlot2Cancel
             ? 'quest_kills2 = 0, quest_damage2 = 0, quest_glitters2 = 0, quest_progress2'
             : 'quest_kills = 0, quest_damage = 0, quest_glitters = 0, quest_progress'} = '[]'::json
       WHERE id = $1`,
      [playerId]
    );

    res.json({ success: true, message: 'quest_cancelled' });

  } catch (err) {
    console.error('Quest cancel error:', err);
    res.status(500).json({ error: 'err_server' });
  }
});

router.post('/deliver-bonus', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  try {
    const pRes = await pool.query(
      `SELECT level, bonus_quest_id, bonus_quest_expires_at,
              quest_kills, quest_damage, quest_glitters, bonus_quest_progress
       FROM players WHERE id = $1`,
      [playerId]
    );
    if (pRes.rows.length === 0) return res.status(404).json({ error: 'err_player_not_found' });

    const p = pRes.rows[0];
    const bonusQuestId = p.bonus_quest_id;
    if (!bonusQuestId) {
      return res.status(400).json({ error: 'err_quest_no_bonus' });
    }

    if (p.bonus_quest_expires_at && new Date() > new Date(p.bonus_quest_expires_at)) {
      await pool.query(
        'UPDATE players SET bonus_quest_id = NULL, bonus_quest_expires_at = NULL WHERE id = $1',
        [playerId]
      );
      return res.status(400).json({ error: 'err_quest_bonus_expired' });
    }

    const quest = QUESTS[bonusQuestId];
    if (!quest) {
      await pool.query('UPDATE players SET bonus_quest_id = NULL, bonus_quest_expires_at = NULL WHERE id = $1', [playerId]);
      return res.status(400).json({ error: 'err_quest_bonus_not_found' });
    }

    const progress = p.bonus_quest_progress || [];
    const allDone = quest.objectives.every((obj, i) => (progress[i] || 0) >= obj.amount);
    if (!allDone) {
      return res.status(400).json({ error: 'err_quest_bonus_objectives_pending' });
    }

    await pool.query(
      `UPDATE players
       SET gold = gold + $1,
           pearl = pearl + $2,
           xp = xp + $3,
           bonus_quest_id = NULL,
           bonus_quest_expires_at = NULL,
           bonus_quest_progress = '[]'::json
       WHERE id = $4`,
      [quest.rewards.gold, quest.rewards.pearl, quest.rewards.xp, playerId]
    );

    res.json({
      success: true,
      message: 'quest_bonus_delivered',
      rewards: quest.rewards
    });

  } catch (err) {
    console.error('Bonus quest deliver error:', err);
    res.status(500).json({ error: 'err_server' });
  }
});

module.exports = router;
