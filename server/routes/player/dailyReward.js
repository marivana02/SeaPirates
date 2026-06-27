const express = require('express');
const router = express.Router();
const pool = require('../../config/db');
const authMiddleware = require('../../middleware/auth');
const { isPlayerVip } = require('../../helpers/rewards');
const { upsertAmmo, upsertItem } = require('../../helpers/rewards');
const { DAILY_REWARDS, VIP_DAILY_REWARDS } = require('../../config/rewardsData');

// Helper: get current month string 'YYYY-MM'
function getCurrentMonth() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

// Helper: get today's day of month (1-31)
function getTodayDay() {
  return new Date().getDate();
}

// Helper: get number of days in current month
function getDaysInMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

// Reset arrays if month changed
async function ensureMonthReset(playerId) {
  const currentMonth = getCurrentMonth();
  const res = await pool.query(
    'SELECT daily_reward_month FROM players WHERE id = $1',
    [playerId]
  );
  if (res.rows.length === 0) return;
  const savedMonth = res.rows[0].daily_reward_month || '';
  if (savedMonth !== currentMonth) {
    await pool.query(
      `UPDATE players SET claimed_daily_days = '{}', claimed_vip_days = '{}', daily_reward_month = $1 WHERE id = $2`,
      [currentMonth, playerId]
    );
  }
}

router.get('/daily-reward/status', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  try {
    await ensureMonthReset(playerId);

    const pRes = await pool.query(
      'SELECT claimed_daily_days, claimed_vip_days, vip_until FROM players WHERE id = $1',
      [playerId]
    );
    if (pRes.rows.length === 0) return res.status(404).json({ error: 'Player not found.' });

    const p = pRes.rows[0];
    const isVip = isPlayerVip(p);
    const today = getTodayDay();
    const daysInMonth = getDaysInMonth();
    const claimedNormal = p.claimed_daily_days || [];
    const claimedVip = p.claimed_vip_days || [];

    const canClaimNormal = !claimedNormal.includes(today);
    const canClaimVip = isVip && !claimedVip.includes(today);

    res.json({
      today,
      daysInMonth,
      claimedNormal,
      claimedVip,
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
    await ensureMonthReset(playerId);

    const pRes = await pool.query(
      'SELECT claimed_daily_days, claimed_vip_days, vip_until FROM players WHERE id = $1',
      [playerId]
    );
    if (pRes.rows.length === 0) return res.status(404).json({ error: 'Player not found.' });

    const p = pRes.rows[0];
    const isVip = isPlayerVip(p);
    const today = getTodayDay();
    const claimedNormal = p.claimed_daily_days || [];
    const claimedVip = p.claimed_vip_days || [];

    // Reward day is capped at 30 (day 31 gets day 30 reward)
    const rewardDay = Math.min(today, 30);

    let goldReward = 0;
    let pearlReward = 0;
    let ammos = [];
    let items = [];
    let rewardsList = [];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      if (type === 'vip') {
        if (!isVip) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'err_daily_vip_not_active' });
        }
        const upRes = await client.query(
          `UPDATE players SET claimed_vip_days = array_append(claimed_vip_days, $1) WHERE id = $2 AND NOT ($1 = ANY(claimed_vip_days))`,
          [today, playerId]
        );
        if (upRes.rowCount === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'err_daily_vip_already_claimed' });
        }
        const r = VIP_DAILY_REWARDS[rewardDay];
        if (!r) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'err_daily_no_reward' }); }
        if (r.gold) goldReward += r.gold;
        if (r.pearl) pearlReward += r.pearl;
        if (r.ammo) ammos.push(r.ammo);
        if (r.items) items.push(...r.items);
        rewardsList.push(r.name);
      } else {
        const upRes = await client.query(
          `UPDATE players SET claimed_daily_days = array_append(claimed_daily_days, $1) WHERE id = $2 AND NOT ($1 = ANY(claimed_daily_days))`,
          [today, playerId]
        );
        if (upRes.rowCount === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'err_daily_already_claimed' });
        }
        const r = DAILY_REWARDS[rewardDay];
        if (!r) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'err_daily_no_reward' }); }
        if (r.gold) goldReward += r.gold;
        if (r.pearl) pearlReward += r.pearl;
        if (r.ammo) ammos.push(r.ammo);
        if (r.items) items.push(...r.items);
        rewardsList.push(r.name);
      }

      if (goldReward > 0 || pearlReward > 0) {
        await client.query(
          'UPDATE players SET gold = gold + $1, pearl = pearl + $2 WHERE id = $3',
          [goldReward, pearlReward, playerId]
        );
      }

      for (const am of ammos) {
        await upsertAmmo(client, playerId, am.type, am.qty);
      }

      for (const it of items) {
        await upsertItem(client, playerId, it.type, it.qty);
      }

      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      console.error('Daily reward transaction error:', txErr);
      return res.status(500).json({ error: 'Server error' });
    } finally {
      client.release();
    }

    res.json({
      success: true,
      message: 'daily_claimed_success',
      rewardDay,
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
