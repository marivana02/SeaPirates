const express = require('express');
const router = express.Router();
const pool = require('../../config/db');
const authMiddleware = require('../../middleware/auth');
const { calculateAllPlayerRanks } = require('../../helpers/rank');

router.get('/leaderboard', async (req, res) => {
  try {
    const allRanks = await calculateAllPlayerRanks(pool);
    const leaderboard = allRanks.map(r => ({
      id: r.id,
      username: r.login_username,
      display_name: r.username,
      level: r.level,
      elite_points: r.elite_points,
      score: r.score,
      rankBadge: r.rankBadge,
      rankName: r.rankName,
      rankKey: r.rankKey
    }));
    res.json(leaderboard);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/hall-of-fame', authMiddleware, async (req, res) => {
  const category = req.query.category || 'xp';
  const playerId = req.player.id;

  const COLUMN_MAP = {
    xp: 'xp', ep: 'elite_points', dmg_pve: 'dmg_pve',
    dmg_pvp: 'dmg_pvp', kill_npc: 'kill_npc', kill_pvp: 'kill_pvp',
    dmg_amiral: 'dmg_amiral', playtime: 'playtime', pvp_points: 'pvp_points'
  };
  const column = COLUMN_MAP[category] || 'xp';

  try {
    const listRes = await pool.query(
      `SELECT id, username, COALESCE(display_name, username) AS display_name, ${column} AS score,
              ROW_NUMBER() OVER (ORDER BY ${column} DESC, id ASC) as rank
       FROM players
       WHERE is_admin = false OR is_admin IS NULL
       ORDER BY score DESC, id ASC`
    );

    const allRanks = await calculateAllPlayerRanks(pool);
    const rankMap = {};
    allRanks.forEach(r => {
      rankMap[r.id] = { badge: r.rankBadge, name: r.rankName, key: r.rankKey };
    });

    const players = listRes.rows.map(row => ({
      rank: parseInt(row.rank),
      name: row.display_name || row.username,
      score: parseInt(row.score),
      isMe: row.id === playerId,
      rankBadge: rankMap[row.id] ? rankMap[row.id].badge : 13,
      rankName: rankMap[row.id] ? rankMap[row.id].name : "Kara Adamı",
      rankKey: rankMap[row.id] ? rankMap[row.id].key : "rank_13"
    }));

    const myData = players.find(p => p.isMe);
    const myRank = myData ? myData.rank : 0;

    res.json({
      players,
      myRank
    });

  } catch (err) {
    console.error("Hall of Fame Error:", err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/my-rank', authMiddleware, async (req, res) => {
  const playerId = req.player.id;

  try {
    const players = await calculateAllPlayerRanks(pool);
    const total = players.length;

    const myIndex = players.findIndex(p => p.id === playerId);
    if (myIndex === -1) {
      return res.status(404).json({ error: "Player not found" });
    }

    const me = players[myIndex];

    let target = null;
    for (let i = myIndex - 1; i >= 0; i--) {
      if (players[i].rankBadge !== me.rankBadge) {
        const t = players[i];
        target = {
          score: t.score,
          username: t.username,
          rankName: t.rankName,
          rankKey: t.rankKey,
          rankBadge: t.rankBadge,
          neededPoints: t.score - me.score
        };
        break;
      }
    }

    let lower = null;
    if (me.rankBadge < 13) {
      const nextBadge = me.rankBadge + 1;
      lower = {
        rankBadge: nextBadge,
        rankName: rankNames[nextBadge].tr,
        rankKey: rankNames[nextBadge].key
      };
    }

    res.json({
      me,
      target,
      lower,
      totalPlayers: total
    });

  } catch (err) {
    console.error("My Rank Error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
