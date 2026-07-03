const QUESTS = require('../../config/questsData');

function checkNpcMatch(obj, npcNameStr) {
  if (!obj.target) return true;
  if (obj.target === npcNameStr) return true;
  const target = obj.target.toLowerCase().replace(/[^a-z0-9 ]/g, '');
  const npc = npcNameStr.toLowerCase().replace(/[^a-z0-9 ]/g, '');
  if (npc.includes(target)) return true;
  if (target.includes('admiral') && npc.includes(target.split(' ').pop())) return true;
  return false;
}

function matchesObjective(obj, type, npcNameStr, itemGroup) {
  if (obj.type !== type) return false;
  if (type === 'buy') {
    return obj.itemGroup === itemGroup;
  }
  return checkNpcMatch(obj, npcNameStr);
}

async function updateQuestProgress(pool, playerId, { type, npcNameStr, amount, itemGroup }, client) {
  try {
    const db = client || pool;
    const pQuestRes = await db.query(
      'SELECT active_quest_id, active_quest_id2, quest_progress, quest_progress2 FROM players WHERE id = $1',
      [playerId]
    );
    if (pQuestRes.rows.length === 0) return;

    const pRow = pQuestRes.rows[0];

    const updateBonus = async () => {
      const bonusRes = await db.query(
        'SELECT bonus_quest_id, bonus_quest_progress FROM players WHERE id = $1',
        [playerId]
      );
      if (bonusRes.rows.length === 0) return;
      const bRow = bonusRes.rows[0];
      if (!bRow.bonus_quest_id) return;
      const quest = QUESTS[bRow.bonus_quest_id];
      if (!quest || !quest.objectives) return;

      let progress = bRow.bonus_quest_progress || [];
      let needUpdate = false;

      quest.objectives.forEach((obj, i) => {
        if (matchesObjective(obj, type, npcNameStr, itemGroup)) {
          progress[i] = (progress[i] || 0) + amount;
          needUpdate = true;
        }
      });

      if (needUpdate) {
        await db.query(
          'UPDATE players SET bonus_quest_progress = $1 WHERE id = $2',
          [JSON.stringify(progress), playerId]
        );
      }
    };

    const updateSlot = async (questId, progressArr, progressCol, damageCol, killsCol) => {
      if (!questId) return;
      const quest = QUESTS[questId];
      if (!quest || !quest.objectives) return;

      let progress = progressArr || [];
      let needUpdate = false;
      let totalDamage = 0;
      let totalKills = 0;

      quest.objectives.forEach((obj, i) => {
        if (matchesObjective(obj, type, npcNameStr, itemGroup)) {
          progress[i] = (progress[i] || 0) + amount;
          needUpdate = true;
          if (type === 'damage') totalDamage += amount;
          if (type === 'kill') totalKills += 1;
        }
      });

      if (!needUpdate) return;

      if (type === 'damage') {
        await db.query(
          `UPDATE players SET ${progressCol} = $1, ${damageCol} = ${damageCol} + $2 WHERE id = $3`,
          [JSON.stringify(progress), totalDamage, playerId]
        );
      } else if (type === 'kill') {
        await db.query(
          `UPDATE players SET ${progressCol} = $1, ${killsCol} = ${killsCol} + $2 WHERE id = $3`,
          [JSON.stringify(progress), totalKills, playerId]
        );
      } else {
        await db.query(
          `UPDATE players SET ${progressCol} = $1 WHERE id = $2`,
          [JSON.stringify(progress), playerId]
        );
      }
    };

    await updateSlot(pRow.active_quest_id, pRow.quest_progress, 'quest_progress', 'quest_damage', 'quest_kills');
    await updateSlot(pRow.active_quest_id2, pRow.quest_progress2, 'quest_progress2', 'quest_damage2', 'quest_kills2');
    await updateBonus();
  } catch (qErr) {
    console.error('Quest update error in combat:', qErr);
  }
}

module.exports = { updateQuestProgress };
