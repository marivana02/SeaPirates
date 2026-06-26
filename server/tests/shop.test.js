const test = require('node:test');
const assert = require('node:assert/strict');

const pool = require('../config/db');
const originalQuery = pool.query;
const originalConnect = pool.connect;

test.after(() => {
  pool.query = originalQuery;
  pool.connect = originalConnect;
  return pool.end().catch(() => {});
});

const router = require('../routes/shop');

function getHandler(path, method) {
  const layer = router.stack.find(l => l.route && l.route.path === path && l.route.methods[method]);
  if (!layer) throw new Error(`Route not found for path ${path} [${method}]`);
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

test('Shop Buy Handler with VIP Discount', async (t) => {
  const buyHandler = getHandler('/buy', 'post');

  await t.test('applies 10% discount for VIP player', async () => {
    let queries = [];
    const mockClient = {
      query: async (sql, params) => {
        queries.push({ sql, params });
        if (sql.includes('SELECT gold, pearl')) {
          const futureVipDate = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
          return {
            rows: [{
              gold: 100000,
              pearl: 100000,
              level: 1,
              elite_points: 0,
              ship_level: 0,
              has_elite_ship: false,
              vip_until: futureVipDate
            }]
          };
        }
        if (sql.includes('player_cannons')) {
          return { rows: [{ id: 1 }] };
        }
        return { rows: [] };
      },
      release: () => {}
    };

    pool.connect = async () => mockClient;

    const req = {
      player: { id: 42 },
      body: { itemId: 2, quantity: 10 }
    };
    let jsonBody;
    const res = {
      status() { return this; },
      json(body) { jsonBody = body; }
    };

    await buyHandler(req, res);

    assert.ok(jsonBody);
    const pearlQuery = queries.find(q => q.sql.includes('UPDATE players SET pearl = pearl - $1'));
    assert.ok(pearlQuery, 'Pearl update query should be executed');
    assert.equal(pearlQuery.params[0], 18000);
  });

  await t.test('does not apply discount for regular player', async () => {
    let queries = [];
    const mockClient = {
      query: async (sql, params) => {
        queries.push({ sql, params });
        if (sql.includes('SELECT gold, pearl')) {
          return {
            rows: [{
              gold: 100000,
              pearl: 100000,
              level: 1,
              elite_points: 0,
              ship_level: 0,
              has_elite_ship: false,
              vip_until: null
            }]
          };
        }
        if (sql.includes('player_cannons')) {
          return { rows: [{ id: 1 }] };
        }
        return { rows: [] };
      },
      release: () => {}
    };

    pool.connect = async () => mockClient;

    const req = {
      player: { id: 42 },
      body: { itemId: 2, quantity: 10 }
    };
    let jsonBody;
    const res = {
      status() { return this; },
      json(body) { jsonBody = body; }
    };

    await buyHandler(req, res);

    assert.ok(jsonBody);
    const pearlQuery = queries.find(q => q.sql.includes('UPDATE players SET pearl = pearl - $1'));
    assert.ok(pearlQuery);
    assert.equal(pearlQuery.params[0], 20000);
  });
});
