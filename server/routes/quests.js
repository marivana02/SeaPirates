const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth');
const QUESTS = require('../config/questsData');

// Tüm Görevleri & Oyuncunun Mevcut İlerleme Durumunu Getir
router.get('/', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  try {


    // Daily reset check
    const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const dateRes = await pool.query('SELECT last_quest_reset_date, completed_quests FROM players WHERE id = $1', [playerId]);
    
    if (dateRes.rows.length > 0 && dateRes.rows[0].last_quest_reset_date !== todayStr) {
      await pool.query(
        'UPDATE players SET completed_quests = \'{}\', last_quest_reset_date = $1, active_quest_id = NULL, quest_kills = 0, quest_damage = 0, quest_glitters = 0 WHERE id = $2',
        [todayStr, playerId]
      );
    }

    const pRes = await pool.query(
      'SELECT level, active_quest_id, quest_kills, quest_damage, quest_glitters, completed_quests FROM players WHERE id = $1',
      [playerId]
    );

    if (pRes.rows.length === 0) return res.status(404).json({ error: 'Oyuncu bulunamadı.' });

    const p = pRes.rows[0];
    const playerLevel = p.level;
    const activeQuestId = p.active_quest_id;
    const questKills = p.quest_kills || 0;
    const questDamage = p.quest_damage || 0;
    const questGlitters = p.quest_glitters || 0;
    const completedQuests = p.completed_quests || [];

    const result = Object.values(QUESTS)
      .filter(q => q.levelReq === playerLevel || q.id === activeQuestId)
      .map(q => {
        let state = 'locked'; // locked, available, active, completed
        if (completedQuests.includes(q.id)) {
          state = 'completed';
        } else if (activeQuestId === q.id) {
          state = 'active';
        } else if (playerLevel >= q.levelReq) {
          state = 'available';
        }

        return {
          ...q,
          state,
          currentKills: activeQuestId === q.id ? questKills : 0,
          currentDamage: activeQuestId === q.id ? questDamage : 0,
          currentGlitters: activeQuestId === q.id ? questGlitters : 0
        };
      });

    res.json({
      quests: result,
      activeQuestId,
      playerLevel
    });

  } catch (err) {
    console.error('Quest list fetch error:', err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Görev Kabul Et
router.post('/accept', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  const { questId } = req.body;
  const qId = parseInt(questId);

  const quest = QUESTS[qId];
  if (!quest) return res.status(400).json({ error: 'Geçersiz görev ID\'si.' });

  try {
    const pRes = await pool.query(
      'SELECT level, active_quest_id, completed_quests FROM players WHERE id = $1',
      [playerId]
    );
    if (pRes.rows.length === 0) return res.status(404).json({ error: 'Oyuncu bulunamadı.' });

    const p = pRes.rows[0];
    if (p.level !== quest.levelReq) {
      return res.status(400).json({ error: 'Sadece mevcut seviyenizin görevlerini kabul edebilirsiniz.' });
    }
    if (p.active_quest_id !== null) {
      return res.status(400).json({ error: 'Zaten aktif bir göreviniz var. Önce onu tamamlamalısınız.' });
    }
    if ((p.completed_quests || []).includes(qId)) {
      return res.status(400).json({ error: 'Bu görevi zaten tamamladınız.' });
    }

    // Görevi aktif yap, sayaçları sıfırla
    await pool.query(
      `UPDATE players 
       SET active_quest_id = $1, 
           quest_kills = 0, 
           quest_damage = 0,
           quest_glitters = 0 
       WHERE id = $2`,
      [qId, playerId]
    );

    res.json({ success: true, message: `"${quest.title}" görevi kabul edildi!` });

  } catch (err) {
    console.error('Quest accept error:', err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Görev Teslim Et (Ödülü Al)
router.post('/deliver', authMiddleware, async (req, res) => {
  const playerId = req.player.id;

  try {
    const pRes = await pool.query(
      'SELECT level, active_quest_id, quest_kills, quest_damage, quest_glitters FROM players WHERE id = $1',
      [playerId]
    );
    if (pRes.rows.length === 0) return res.status(404).json({ error: 'Oyuncu bulunamadı.' });

    const p = pRes.rows[0];
    const activeQuestId = p.active_quest_id;
    if (activeQuestId === null) {
      return res.status(400).json({ error: 'Teslim edilecek aktif bir göreviniz yok.' });
    }

    const quest = QUESTS[activeQuestId];
    if (!quest) {
      // Beklenmedik durum: aktif görev listede yoksa temizle
      await pool.query('UPDATE players SET active_quest_id = NULL WHERE id = $1', [playerId]);
      return res.status(400).json({ error: 'Görev bulunamadı.' });
    }

    const kills = p.quest_kills || 0;
    const damage = p.quest_damage || 0;
    const glitters = p.quest_glitters || 0;

    if (kills < quest.requiredKills || damage < quest.requiredDamage || glitters < quest.requiredGlitters) {
      return res.status(400).json({ error: 'Görevin hedefleri henüz tamamlanmadı!' });
    }

    // Ödülleri dağıt + Görevi tamamlanmışlar listesine ekle
    await pool.query(
      `UPDATE players 
       SET gold = gold + $1, 
           pearl = pearl + $2, 
           xp = xp + $3,
           active_quest_id = NULL,
           quest_kills = 0,
           quest_damage = 0,
           quest_glitters = 0,
           completed_quests = array_append(completed_quests, $4)
       WHERE id = $5`,
      [quest.rewards.gold, quest.rewards.pearl, quest.rewards.xp, activeQuestId, playerId]
    );

    // Seviye atlama kontrolü
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
        break; // Max level
      }
    }

    if (leveledUp) {
      await pool.query('UPDATE players SET level = $1 WHERE id = $2', [newLevel, playerId]);
    }

    res.json({
      success: true,
      message: `Tebrikler! "${quest.title}" görevi başarıyla teslim edildi ve ödülleriniz verildi!`,
      rewards: quest.rewards,
      leveledUp,
      newLevel
    });

  } catch (err) {
    console.error('Quest deliver error:', err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

module.exports = router;
