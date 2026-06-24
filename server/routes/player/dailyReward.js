const express = require('express');
const router = express.Router();
const pool = require('../../config/db');
const authMiddleware = require('../../middleware/auth');
const { isPlayerVip } = require('../../helpers/rewards');
const { upsertAmmo, upsertItem } = require('../../helpers/rewards');
const { DAILY_REWARDS, VIP_DAILY_REWARDS } = require('../../config/rewardsData');

router.get('/daily-reward/status', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  try {
    const pRes = await pool.query('SELECT daily_streak, last_daily_claim, last_vip_claim, vip_until FROM players WHERE id = $1', [playerId]);
    if (pRes.rows.length === 0) return res.status(404).json({ error: 'Player not found.' });

    const p = pRes.rows[0];
    let streak = p.daily_streak || 0;
    let lastClaim = p.last_daily_claim;
    let lastVipClaim = p.last_vip_claim;
    const isVip = isPlayerVip(p);

    let canClaimNormal = false;
    let canClaimVip = false;

    if (!lastClaim) {
      canClaimNormal = true;
    } else {
      const today = new Date();
      today.setHours(0,0,0,0);
      const last = new Date(lastClaim);
      last.setHours(0,0,0,0);
      
      const diffMs = today.getTime() - last.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        canClaimNormal = true;
      } else if (diffDays > 1) {
        streak = 0;
        canClaimNormal = true;
      }
    }

    if (isVip) {
      if (!lastVipClaim) {
        canClaimVip = true;
      } else {
        const today = new Date();
        today.setHours(0,0,0,0);
        const lastV = new Date(lastVipClaim);
        lastV.setHours(0,0,0,0);
        if (today.getTime() - lastV.getTime() >= 1000 * 60 * 60 * 24) {
          canClaimVip = true;
        }
      }
    }

    res.json({
      streak,
      lastClaim,
      lastVipClaim,
      isVip,
      canClaimNormal,
      canClaimVip
    });
  } catch (err) {
    console.error("Daily Reward Status Error:", err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/daily-reward/claim', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  const { type } = req.body;
  
  try {
    const pRes = await pool.query('SELECT daily_streak, last_daily_claim, last_vip_claim, vip_until FROM players WHERE id = $1', [playerId]);
    if (pRes.rows.length === 0) return res.status(404).json({ error: 'Player not found.' });

    const p = pRes.rows[0];
    let streak = p.daily_streak || 0;
    let lastClaim = p.last_daily_claim;
    let lastVipClaim = p.last_vip_claim;
    const isVip = isPlayerVip(p);

    const today = new Date();
    today.setHours(0,0,0,0);

    let canClaimNormal = false;
    if (!lastClaim) {
      canClaimNormal = true;
    } else {
      const last = new Date(lastClaim);
      last.setHours(0,0,0,0);
      const diffMs = today.getTime() - last.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        canClaimNormal = true;
      } else if (diffDays > 1) {
        streak = 0;
        canClaimNormal = true;
      }
    }

    let canClaimVip = false;
    if (isVip) {
      if (!lastVipClaim) {
        canClaimVip = true;
      } else {
        const lastV = new Date(lastVipClaim);
        lastV.setHours(0,0,0,0);
        if (today.getTime() - lastV.getTime() >= 1000 * 60 * 60 * 24) {
          canClaimVip = true;
        }
      }
    }

    let claimNormalAction = false;
    let claimVipAction = false;

    if (type === 'vip') {
      if (!canClaimVip) {
        return res.status(400).json({ error: 'err_daily_vip_not_claimable' });
      }
      claimVipAction = true;
    } else {
      if (!canClaimNormal) {
        return res.status(400).json({ error: 'err_daily_already_claimed' });
      }
      claimNormalAction = true;
    }

    let goldReward = 0;
    let pearlReward = 0;
    let ammos = [];
    let items = [];
    let rewardsList = [];

    const normalRewards = DAILY_REWARDS;
    const vipRewards = VIP_DAILY_REWARDS;

    let newStreak = streak;

    if (claimNormalAction) {
      newStreak = streak + 1;
      const rewardDay = ((newStreak - 1) % 30) + 1;
      const r = normalRewards[rewardDay];
      if (r.gold) goldReward += r.gold;
      if (r.pearl) pearlReward += r.pearl;
      if (r.ammo) ammos.push(r.ammo);
      if (r.items) items.push(...r.items);
      rewardsList.push(r.name);
    }

    if (claimVipAction) {
      const effectiveVipStreak = claimNormalAction ? newStreak : streak;
      const vipDay = ((effectiveVipStreak - 1) % 30) + 1;
      if (vipDay >= 1 && vipDay <= 30) {
        const r = vipRewards[vipDay];
        if (r.gold) goldReward += r.gold;
        if (r.pearl) pearlReward += r.pearl;
        if (r.ammo) ammos.push(r.ammo);
        if (r.items) items.push(...r.items);
        rewardsList.push(r.name);
      }
    }

    if (goldReward > 0 || pearlReward > 0) {
      await pool.query(
        'UPDATE players SET gold = gold + $1, pearl = pearl + $2 WHERE id = $3',
        [goldReward, pearlReward, playerId]
      );
    }

    for (const am of ammos) {
      await upsertAmmo(pool, playerId, am.type, am.qty);
    }

    for (const it of items) {
      await upsertItem(pool, playerId, it.type, it.qty);
    }

    if (claimNormalAction) {
      await pool.query(
        'UPDATE players SET daily_streak = $1, last_daily_claim = CURRENT_TIMESTAMP WHERE id = $2',
        [newStreak, playerId]
      );
    }
    if (claimVipAction) {
      await pool.query(
        'UPDATE players SET last_vip_claim = CURRENT_TIMESTAMP WHERE id = $1',
        [playerId]
      );
    }

    res.json({
      success: true,
      message: 'daily_claimed_success',
      streak: newStreak,
      rewardDay: claimNormalAction ? newStreak : streak,
      rewardType: type,
      reward: {
        name: rewardsList.join(' & '),
        gold: goldReward,
        pearl: pearlReward
      }
    });

  } catch (err) {
    console.error("Daily Reward Claim Error:", err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
