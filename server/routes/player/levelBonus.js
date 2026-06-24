const express = require('express');
const router = express.Router();
const pool = require('../../config/db');
const authMiddleware = require('../../middleware/auth');
const response = require('../../helpers/response');
const { validate, VALIDATORS } = require('../../middleware/validate');
const { asyncHandler } = require('../../middleware/errorHandler');
const { isPlayerVip } = require('../../helpers/rewards');
const { upsertAmmo, upsertItem } = require('../../helpers/rewards');
const { LEVEL_REWARDS, VIP_LEVEL_REWARDS } = require('../../config/rewardsData');

const levelClaimRules = {
  type: [
    (v) => (v === 'normal' || v === 'vip') || 'Type must be normal or vip'
  ],
  level: [
    (v) => VALIDATORS.inRange(v, 1, 10) || 'Level must be 1-10'
  ]
};

router.get('/level-bonus/status', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  try {
    const pRes = await pool.query('SELECT level, claimed_normal_levels, claimed_vip_levels, vip_until FROM players WHERE id = $1', [playerId]);
    if (pRes.rows.length === 0) return res.status(404).json({ error: 'Player not found.' });

    const p = pRes.rows[0];
    const claimedNormal = p.claimed_normal_levels || [];
    const claimedVip = p.claimed_vip_levels || [];
    const isVip = isPlayerVip(p);

    res.json({
      playerLevel: p.level,
      claimedNormal,
      claimedVip,
      isVip
    });
  } catch (err) {
    console.error("Level Bonus Status Error:", err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/level-bonus/claim', authMiddleware, validate(levelClaimRules), asyncHandler(async (req, res) => {
  const playerId = req.player.id;
  const { type, level } = req.body;
  const lvlNum = parseInt(level);

  const pRes = await pool.query('SELECT level, claimed_normal_levels, claimed_vip_levels, vip_until FROM players WHERE id = $1', [playerId]);
  if (pRes.rows.length === 0) return response.notFound(res, 'Player not found');

  const p = pRes.rows[0];
  const playerLevel = p.level;
  const claimedNormal = p.claimed_normal_levels || [];
  const claimedVip = p.claimed_vip_levels || [];
  const isVip = isPlayerVip(p);

  if (lvlNum > playerLevel) {
    return response.badRequest(res, `You must reach level ${lvlNum} to claim this reward`);
  }

  if (type === 'vip') {
    if (!isVip) {
      return response.badRequest(res, 'VIP membership must be active to claim VIP level rewards');
    }
    if (claimedVip.includes(lvlNum)) {
      return response.badRequest(res, 'You have already claimed this VIP level reward');
    }
  } else {
    if (claimedNormal.includes(lvlNum)) {
      return response.badRequest(res, 'You have already claimed this normal level reward');
    }
  }

  const normalRewards = LEVEL_REWARDS;
  const vipRewards = VIP_LEVEL_REWARDS;

  const reward = type === 'vip' ? vipRewards[lvlNum] : normalRewards[lvlNum];
  if (!reward) {
    return response.badRequest(res, 'Invalid level reward request');
  }

  let goldReward = reward.gold || 0;
  let pearlReward = reward.pearl || 0;
  let ammos = [];
  let items = [];
  if (reward.ammo) ammos.push(reward.ammo);
  if (reward.items) items.push(...reward.items);

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

  if (type === 'vip') {
    await pool.query('UPDATE players SET claimed_vip_levels = array_append(claimed_vip_levels, $1) WHERE id = $2', [lvlNum, playerId]);
  } else {
    await pool.query('UPDATE players SET claimed_normal_levels = array_append(claimed_normal_levels, $1) WHERE id = $2', [lvlNum, playerId]);
  }

  response.success(res, { success: true, message: `${reward.name} has been added to your account!`, reward });
}));

module.exports = router;
