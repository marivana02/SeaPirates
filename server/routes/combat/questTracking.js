const QUESTS = require('../../config/questsData');

function checkNpcMatch(obj, npcNameStr) {
  if (!obj.target) return true;
  if (obj.target === npcNameStr) return true;
  const target = obj.target.toLowerCase();
  const npc = npcNameStr.toLowerCase();
  if (npc.includes(target)) return true;
  if (target === 'admiral jack' && npc.includes('jack')) return true;
  return false;
}

async function updateQuestProgress(pool, playerId, { type, npcNameStr, amount }) {
  try {
    const pQuestRes = await pool.query(
      'SELECT active_quest_id, active_quest_id2, quest_progress, quest_progress2 FROM players WHERE id = $1',
      [playerId]
    );
    if (pQuestRes.rows.length === 0) return;

    const pRow = pQuestRes.rows[0];

    // Slot 1
    if (pRow.active_quest_id) {
      const quest = QUESTS[pRow.active_quest_id];
      if (quest && quest.objectives) {
        let progress = pRow.quest_progress || [];
        let needUpdate = false;

        quest.objectives.forEach((obj, i) => {
          if (obj.type === type && checkNpcMatch(obj, npcNameStr)) {
            progress[i] = (progress[i] || 0) + amount;
            needUpdate = true;
          }
        });

        if (needUpdate) {
          if (type === 'damage') {
            await pool.query(
              'UPDATE players SET quest_progress = $1, quest_damage = quest_damage + $2 WHERE id = $3',
              [JSON.stringify(progress), amount, playerId]
            );
          } else if (type === 'kill') {
            await pool.query(
              'UPDATE players SET quest_progress = $1, quest_kills = quest_kills + 1 WHERE id = $2',
              [JSON.stringify(progress), playerId]
            );
          }
        }
      }
    }

    // Slot 2 (VIP)
    if (pRow.active_quest_id2) {
      const quest = QUESTS[pRow.active_quest_id2];
      if (quest && quest.objectives) {
        let progress = pRow.quest_progress2 || [];
        let needUpdate = false;

        quest.objectives.forEach((obj, i) => {
          if (obj.type === type && checkNpcMatch(obj, npcNameStr)) {
            progress[i] = (progress[i] || 0) + amount;
            needUpdate = true;
          }
        });

        if (needUpdate) {
          if (type === 'damage') {
            await pool.query(
              'UPDATE players SET quest_progress2 = $1, quest_damage2 = quest_damage2 + $2 WHERE id = $3',
              [JSON.stringify(progress), amount, playerId]
            );
          } else if (type === 'kill') {
            await pool.query(
              'UPDATE players SET quest_progress2 = $1, quest_kills2 = quest_kills2 + 1 WHERE id = $2',
              [JSON.stringify(progress), playerId]
            );
          }
        }
      }
    }
  } catch (qErr) {
    console.error('Quest update error in combat:', qErr);
  }
}

module.exports = { updateQuestProgress };
