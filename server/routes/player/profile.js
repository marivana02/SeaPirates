const express = require('express');
const router = express.Router();
const pool = require('../../config/db');
const authMiddleware = require('../../middleware/auth');
const response = require('../../helpers/response');
const { checkAndApplyLevelUp, getNextLevelXp } = require('../../helpers/levelUp');
const { isPlayerVip } = require('../../helpers/rewards');
const { calculateAllPlayerRanks } = require('../../helpers/rank');
const { getPvPRank } = require('../../helpers/pvpRank');
const QUESTS = require('../../config/questsData');

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, display_name, gold, pearl, xp, level, 
              elite_points, ship_level, has_elite_ship, hp, max_hp, vip_until, created_at, last_tower_attack, tower_level,
              pvp_points, pvp_target_id, pvp_changes_left, last_pvp_reset, active_design,
              current_map_level, visual_ship_level
       FROM players WHERE id = $1`,
      [req.player.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    let p = result.rows[0];

    if (parseInt(p.hp) <= 0) {
      const respawnHp = isPlayerVip(p)
        ? Math.floor(parseInt(p.max_hp) * 0.1)
        : 1000;

      p.hp = respawnHp;
      await pool.query('UPDATE players SET hp = $1 WHERE id = $2', [respawnHp, req.player.id]);
    }

    const { leveledUp, newLevel } = await checkAndApplyLevelUp(pool, req.player.id, p.xp, p.level);
    if (leveledUp) p.level = newLevel;

    const xpNext = await getNextLevelXp(pool, p.level);

    const ammoRes = await pool.query('SELECT ammo_type, quantity FROM player_ammo WHERE player_id = $1', [req.player.id]);
    
    const itemRes = await pool.query('SELECT item_type, quantity FROM player_items WHERE player_id = $1', [req.player.id]);

    const cannonsRes = await pool.query('SELECT COALESCE(SUM(equipped), 0) as total FROM player_cannons WHERE player_id = $1', [req.player.id]);
    const equippedCannons = parseInt(cannonsRes.rows[0].total);

    const cannonsByTypeRes = await pool.query('SELECT cannon_type, SUM(quantity) as total FROM player_cannons WHERE player_id = $1 AND quantity > 0 GROUP BY cannon_type ORDER BY cannon_type', [req.player.id]);
    const planksRes = await pool.query('SELECT pp.plank_type, pp.quantity FROM player_planks pp WHERE pp.player_id = $1 AND pp.quantity > 0', [req.player.id]);

    const allRanks = await calculateAllPlayerRanks(pool);
    const myRankInfo = allRanks.find(r => r.id === req.player.id) || { rankBadge: 13, rankName: "Landlubber", rankKey: "rank_13", score: 0 };
    const pvpRankInfo = getPvPRank(p.pvp_points);

    const designsRes = await pool.query(
      'SELECT design_key FROM player_designs WHERE player_id = $1',
      [req.player.id]
    );
    const ownedDesigns = designsRes.rows.map(r => r.design_key);

    res.json({
        ...p,
        xpNext,
        equipped_cannons: equippedCannons,
        cannons_by_type: cannonsByTypeRes.rows,
        planks: planksRes.rows,
        ammo: ammoRes.rows,
        items: itemRes.rows,
        rankBadge: myRankInfo.rankBadge,
        rankName: myRankInfo.rankName,
        rankKey: myRankInfo.rankKey,
        score: myRankInfo.score,
        pvpRankBadge: pvpRankInfo.badge,
        pvpRankName: pvpRankInfo.name,
        ownedDesigns
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/cannons/check', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT COALESCE(SUM(equipped), 0) as total FROM player_cannons WHERE player_id = $1 AND equipped > 0',
      [req.player.id]
    );
    const total = parseInt(result.rows[0].total);
    res.json({ hasCannons: total > 0, equipped: total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/panel', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, display_name, gold, pearl, xp, level, elite_points, ship_level, hp, max_hp, vip_until, tower_level, pvp_points, active_quest_id, active_quest_id2, quest_kills, quest_damage, quest_glitters, quest_kills2, quest_damage2, quest_glitters2, quest_progress, quest_progress2 FROM players WHERE id = $1',
      [req.player.id]
    );
    if (result.rows.length === 0) return res.json({ success: false });
    const p = result.rows[0];

    if (parseInt(p.hp) <= 0) {
      const respawnHp = isPlayerVip(p)
        ? Math.floor(parseInt(p.max_hp) * 0.1)
        : 1000;
      p.hp = respawnHp;
      await pool.query('UPDATE players SET hp = $1 WHERE id = $2', [respawnHp, req.player.id]);
    }

    const isVip = isPlayerVip(p);
    const nextLvlRes = await pool.query('SELECT required_xp FROM level_requirements WHERE level = $1', [parseInt(p.level) + 1]);
    let xpNext;
    if (nextLvlRes.rows.length > 0) {
      xpNext = parseInt(nextLvlRes.rows[0].required_xp);
    } else {
      const curLvlRes = await pool.query('SELECT required_xp FROM level_requirements WHERE level = $1', [parseInt(p.level)]);
      xpNext = curLvlRes.rows.length > 0 ? parseInt(curLvlRes.rows[0].required_xp) : 900000;
    }
    const allRanks = await calculateAllPlayerRanks(pool);
    const myRankInfo = allRanks.find(r => r.id === req.player.id) || { rankBadge: 13, rankName: 'Landlubber', rankKey: 'rank_13', score: 0 };
    const pvpRankInfo = getPvPRank(p.pvp_points);

    function isRedeemable(questId, progress) {
      if (!questId || !progress || progress.length === 0) return false;
      const q = QUESTS[parseInt(questId)];
      if (!q) return false;
      return q.objectives.every((obj, i) => {
        const p = parseInt(progress[i] || 0);
        const a = parseInt(obj.amount);
        return p >= a;
      });
    }

    const progress1 = p.quest_progress || [];
    const progress2 = p.quest_progress2 || [];
    const hasActiveQuest = !!(p.active_quest_id || p.active_quest_id2);
    const hasRedeemableQuest = isRedeemable(p.active_quest_id, progress1) ||
                               isRedeemable(p.active_quest_id2, progress2);
    const completedQuests = p.completed_quests || [];
    const levelQuestIds = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30];
    const levelQuests = levelQuestIds.filter(id => QUESTS[id] && QUESTS[id].levelReq === parseInt(p.level));
    const questsAvailable = levelQuests.length === 0 ? false : !levelQuests.every(id => completedQuests.includes(id));

    res.json({
      success: true,
      player: {
        username: p.username,
        display_name: p.display_name || p.username,
        gold: parseInt(p.gold),
        pearl: parseInt(p.pearl),
        xp: parseInt(p.xp),
        level: parseInt(p.level),
        elite_points: parseInt(p.elite_points),
        hp: parseInt(p.hp),
        max_hp: parseInt(p.max_hp),
        tower_level: parseInt(p.tower_level) || 1,
        xpNext,
        vip_until: isVip ? p.vip_until : null,
        rankBadge: myRankInfo.rankBadge,
        rankName: myRankInfo.rankName,
        rankKey: myRankInfo.rankKey,
        score: myRankInfo.score,
        pvpPoints: parseInt(p.pvp_points || 0),
        pvpRankBadge: pvpRankInfo.badge,
        pvpRankName: pvpRankInfo.name,
        activeQuestId: p.active_quest_id,
        activeQuestId2: p.active_quest_id2,
        hasActiveQuest,
        hasRedeemableQuest,
        questsAvailable
      }
    });
  } catch (err) {
    console.error(err);
    res.json({ success: false });
  }
});

router.post('/repair', authMiddleware, async (req, res) => {
  try {
    const [vipRes, plankRes] = await Promise.all([
      pool.query('SELECT vip_until FROM players WHERE id = $1', [req.player.id]),
      pool.query(`
        SELECT pp.equipped, p.repair_bonus
        FROM player_planks pp
        JOIN planks p ON pp.plank_type = p.type_key
        WHERE pp.player_id = $1
      `, [req.player.id])
    ]);
    const isVip = vipRes.rows.length > 0 && isPlayerVip(vipRes.rows[0]);

    let mastBonus = 0;
    plankRes.rows.forEach(row => {
      mastBonus += parseInt(row.repair_bonus || 0) * (row.equipped || 0);
    });

    const healAmount = isVip ? (50 + mastBonus) * 2 : 50 + mastBonus;
    const costPerHp = 2;
    const totalCost = healAmount * costPerHp;

    const result = await pool.query(
      `UPDATE players
       SET hp = LEAST(max_hp, hp + $1)
       WHERE id = $2
       RETURNING hp, max_hp, gold`,
      [healAmount, req.player.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const { hp, max_hp, gold } = result.rows[0];
    res.json({ hp: parseInt(hp), max_hp: parseInt(max_hp), gold: parseInt(gold), full: parseInt(hp) >= parseInt(max_hp) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
