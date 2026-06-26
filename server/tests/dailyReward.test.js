const test = require('node:test');
const assert = require('node:assert/strict');

// Mock pool before importing the route or helpers
const pool = require('../config/db');

const originalQuery = pool.query;

test.after(() => {
  pool.query = originalQuery;
  return pool.end().catch(() => {});
});

const router = require('../routes/player/dailyReward');

// Helper: Find handler in Express Router stack
function getHandler(path, method) {
  const layer = router.stack.find(l => l.route && l.route.path === path && l.route.methods[method]);
  if (!layer) throw new Error(`Route not found for path ${path} [${method}]`);
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

test('Daily Reward Status Handler', async (t) => {
  const statusHandler = getHandler('/daily-reward/status', 'get');

  await t.test('returns status successfully for a VIP player when month is current', async () => {
    let queries = [];
    pool.query = async (sql, params) => {
      queries.push({ sql, params });
      if (sql.includes('daily_reward_month FROM players')) {
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        return { rows: [{ daily_reward_month: currentMonth }] };
      }
      if (sql.includes('claimed_daily_days, claimed_vip_days')) {
        const futureVipDate = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
        return {
          rows: [{
            claimed_daily_days: [1, 2],
            claimed_vip_days: [1],
            vip_until: futureVipDate
          }]
        };
      }
      return { rows: [] };
    };

    const req = { player: { id: 42 } };
    let jsonBody;
    const res = {
      status() { return this; },
      json(body) { jsonBody = body; }
    };

    await statusHandler(req, res);

    assert.ok(jsonBody);
    assert.equal(jsonBody.isVip, true);
    assert.deepEqual(jsonBody.claimedNormal, [1, 2]);
    assert.deepEqual(jsonBody.claimedVip, [1]);
    
    const today = new Date().getDate();
    const expectedCanClaimNormal = !jsonBody.claimedNormal.includes(today);
    const expectedCanClaimVip = !jsonBody.claimedVip.includes(today);
    assert.equal(jsonBody.canClaimNormal, expectedCanClaimNormal);
    assert.equal(jsonBody.canClaimVip, expectedCanClaimVip);

    const hasResetUpdate = queries.some(q => q.sql.includes('UPDATE players SET claimed_daily_days'));
    assert.equal(hasResetUpdate, false);
  });

  await t.test('triggers monthly reset when stored month differs from current', async () => {
    let queries = [];
    pool.query = async (sql, params) => {
      queries.push({ sql, params });
      if (sql.includes('daily_reward_month FROM players')) {
        return { rows: [{ daily_reward_month: '2000-01' }] };
      }
      if (sql.includes('claimed_daily_days, claimed_vip_days')) {
        return {
          rows: [{
            claimed_daily_days: [],
            claimed_vip_days: [],
            vip_until: null
          }]
        };
      }
      return { rows: [] };
    };

    const req = { player: { id: 42 } };
    const res = {
      status() { return this; },
      json() {}
    };

    await statusHandler(req, res);

    const hasResetUpdate = queries.some(q => q.sql.includes('UPDATE players SET claimed_daily_days'));
    assert.equal(hasResetUpdate, true);
  });
});

test('Daily Reward Claim Handler', async (t) => {
  const claimHandler = getHandler('/daily-reward/claim', 'post');

  await t.test('claims normal reward successfully', async () => {
    let queries = [];
    pool.query = async (sql, params) => {
      queries.push({ sql, params });
      if (sql.includes('daily_reward_month FROM players')) {
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        return { rows: [{ daily_reward_month: currentMonth }] };
      }
      if (sql.includes('claimed_daily_days, claimed_vip_days')) {
        return {
          rows: [{
            claimed_daily_days: [],
            claimed_vip_days: [],
            vip_until: null
          }]
        };
      }
      return { rows: [] };
    };

    const req = { player: { id: 42 }, body: { type: 'normal' } };
    let jsonBody;
    const res = {
      status() { return this; },
      json(body) { jsonBody = body; }
    };

    await claimHandler(req, res);

    assert.ok(jsonBody);
    assert.equal(jsonBody.success, true);
    assert.equal(jsonBody.message, 'daily_claimed_success');
    
    const hasClaimUpdate = queries.some(q => q.sql.includes('claimed_daily_days = array_append'));
    assert.equal(hasClaimUpdate, true);
  });

  await t.test('rejects claiming normal reward twice on same day', async () => {
    const today = new Date().getDate();
    pool.query = async (sql, params) => {
      if (sql.includes('daily_reward_month FROM players')) {
        const now = new Date();
        return { rows: [{ daily_reward_month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}` }] };
      }
      if (sql.includes('claimed_daily_days, claimed_vip_days')) {
        return {
          rows: [{
            claimed_daily_days: [today],
            claimed_vip_days: [],
            vip_until: null
          }]
        };
      }
      return { rows: [] };
    };

    const req = { player: { id: 42 }, body: { type: 'normal' } };
    let statusCode = 200;
    let jsonBody;
    const res = {
      status(code) { statusCode = code; return this; },
      json(body) { jsonBody = body; }
    };

    await claimHandler(req, res);

    assert.equal(statusCode, 400);
    assert.equal(jsonBody.error, 'err_daily_already_claimed');
  });

  await t.test('rejects claiming VIP reward if player is not VIP', async () => {
    pool.query = async (sql, params) => {
      if (sql.includes('daily_reward_month FROM players')) {
        const now = new Date();
        return { rows: [{ daily_reward_month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}` }] };
      }
      if (sql.includes('claimed_daily_days, claimed_vip_days')) {
        return {
          rows: [{
            claimed_daily_days: [],
            claimed_vip_days: [],
            vip_until: null
          }]
        };
      }
      return { rows: [] };
    };

    const req = { player: { id: 42 }, body: { type: 'vip' } };
    let statusCode = 200;
    let jsonBody;
    const res = {
      status(code) { statusCode = code; return this; },
      json(body) { jsonBody = body; }
    };

    await claimHandler(req, res);

    assert.equal(statusCode, 400);
    assert.equal(jsonBody.error, 'err_daily_vip_not_active');
  });

  await t.test('claims VIP reward successfully if player is VIP', async () => {
    let queries = [];
    pool.query = async (sql, params) => {
      queries.push({ sql, params });
      if (sql.includes('daily_reward_month FROM players')) {
        const now = new Date();
        return { rows: [{ daily_reward_month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}` }] };
      }
      if (sql.includes('claimed_daily_days, claimed_vip_days')) {
        return {
          rows: [{
            claimed_daily_days: [],
            claimed_vip_days: [],
            vip_until: new Date(Date.now() + 1000000).toISOString()
          }]
        };
      }
      return { rows: [] };
    };

    const req = { player: { id: 42 }, body: { type: 'vip' } };
    let jsonBody;
    const res = {
      status() { return this; },
      json(body) { jsonBody = body; }
    };

    await claimHandler(req, res);

    assert.ok(jsonBody);
    assert.equal(jsonBody.success, true);
    assert.equal(jsonBody.message, 'daily_claimed_success');
    
    const hasVipClaimUpdate = queries.some(q => q.sql.includes('claimed_vip_days = array_append'));
    assert.equal(hasVipClaimUpdate, true);
  });
});
