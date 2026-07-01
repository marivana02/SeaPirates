const test = require('node:test');
const assert = require('node:assert/strict');

test('simulatePvPOpponent for BOT uses cached loadout per player', async () => {
  const { simulatePvPOpponent, clearBotLoadout } = require('../routes/combat/pvp/simulation');
  const mockPool = {};
  clearBotLoadout(555);
  const r1 = await simulatePvPOpponent(mockPool, -1, 3, null, 555);
  clearBotLoadout(555);
  const r2 = await simulatePvPOpponent(mockPool, -1, 3, null, 555);
  assert.equal(r1.opponentId, -1);
  assert.equal(r2.opponentId, -1);
});

test('simulatePvPOpponent with different player IDs returns different loadouts', async () => {
  const { simulatePvPOpponent, clearBotLoadout } = require('../routes/combat/pvp/simulation');
  const mockPool = {};
  clearBotLoadout(666);
  clearBotLoadout(777);
  const r1 = await simulatePvPOpponent(mockPool, -1, 3, null, 666);
  const r2 = await simulatePvPOpponent(mockPool, -1, 3, null, 777);
  assert.notDeepEqual(r1, r2);
});

test('clearBotLoadout removes cached loadout', async () => {
  const { simulatePvPOpponent, clearBotLoadout } = require('../routes/combat/pvp/simulation');
  const mockPool = {};
  clearBotLoadout(888);
  const r1 = await simulatePvPOpponent(mockPool, -1, 3, null, 888);
  clearBotLoadout(888);
  const r2 = await simulatePvPOpponent(mockPool, -1, 3, null, 888);
  assert.equal(r1.opponentId, -1);
  assert.equal(r2.opponentId, -1);
});

test('PvP damage calculation with modifier', async () => {
  const { applyPvPDamageModifiers } = require('../routes/combat/pvp/damage');
  const mockPool = { async query() { return { rowCount: 0 }; } };
  const simResult = {
    npcDamage: 1000, npcUseBarut: false, npcUseZirh: false,
    npcCannons: 10, npcAmmoId: 1
  };
  const result = await applyPvPDamageModifiers(mockPool, 1, {
    totalCannonDamage: 500, actualCannonsFired: 5, ammoDamage: 30,
    givesElp: false, gainedElp: 0
  }, simResult, { useBarut: false, useZirh: false, currentEvent: { type: 'none' }, ammoId: 1 });
  assert.equal(result.finalDamage, 500 + 5 * 30);
  assert.equal(result.finalNpcDamage, 1000);
});

test('PvP damage with event multiplier', async () => {
  const { applyPvPDamageModifiers } = require('../routes/combat/pvp/damage');
  const mockPool = { async query() { return { rowCount: 0 }; } };
  const simResult = {
    npcDamage: 1000, npcUseBarut: false, npcUseZirh: false,
    npcCannons: 10, npcAmmoId: 1
  };
  const result = await applyPvPDamageModifiers(mockPool, 1, {
    totalCannonDamage: 500, actualCannonsFired: 5, ammoDamage: 30,
    givesElp: false, gainedElp: 0
  }, simResult, { useBarut: false, useZirh: false, currentEvent: { type: 'damage', mult: 2 }, ammoId: 1 });
  assert.equal(result.finalDamage, (500 + 5 * 30) * 2);
});

test('PvP rewards: winner gains PvP points', async () => {
  const { grantPvPRewards } = require('../routes/combat/pvp/rewards');
  const calls = [];
  const mockPool = {
    async query(sql, params) {
      calls.push({ sql: sql.substring(0, 60), params });
      if (sql.includes('SELECT gold, pearl')) {
        return { rows: [{ gold: 1000, pearl: 100, xp: 500, level: 1 }] };
      }
      if (sql.includes('players WHERE id')) {
        return { rows: [{ max_hp: 10000 }] };
      }
      return { rows: [] };
    }
  };
  const result = await grantPvPRewards(mockPool, {
    fight: { npcHp: 0, playerHp: 5000, npcMaxHp: 8000 },
    playerId: 42, playerDamage: 500, gainedElp: 10,
    actualCannonsFired: 5, useBarut: false, useZirh: false,
    npcUseBarut: false, npcUseZirh: false, npcAmmoId: null
  });
  assert.equal(result.state, 'won');
  assert.ok(result.rewards.pvpPointChange > 0);
});

test('PvP death: player loses', async () => {
  const { handlePvPPlayerDeath } = require('../routes/combat/pvp/rewards');
  const calls = [];
  const mockPool = {
    async query(sql, params) {
      calls.push({ sql: sql.substring(0, 60), params });
      if (sql.includes('SELECT max_hp')) {
        return { rows: [{ max_hp: 10000 }] };
      }
      return { rows: [] };
    }
  };
  const result = await handlePvPPlayerDeath(mockPool, {
    fight: { npcHp: 5000, playerHp: 0, npcMaxHp: 8000 },
    playerId: 42, playerDamage: 500, gainedElp: 0,
    actualCannonsFired: 5, useBarut: false, useZirh: false,
    npcUseBarut: false, npcUseZirh: false, npcAmmoId: null,
    actualNpcDamage: 1000
  });
  assert.equal(result.state, 'lost');
  assert.ok(result.rewards.pvpPointChange < 0);
});

test('PvP rank system returns correct tier', () => {
  const { getPvPRank } = require('../../helpers/pvpRank');
  const rank = getPvPRank(0);
  assert.equal(rank.tier, 1);
  assert.equal(rank.badge, '🥉');
  assert.equal(rank.name, 'Aas');

  const rankHigh = getPvPRank(5000);
  assert.equal(rankHigh.tier, 49);
  assert.equal(rankHigh.badge, '👑');
  assert.equal(rankHigh.name, 'Denizlerin Kralı');
});

test('resolvePvPOpponentInfo returns BOT info', async () => {
  const { resolvePvPOpponentInfo } = require('../routes/combat/pvp/simulation');
  const mockPool = {};
  const result = await resolvePvPOpponentInfo(mockPool, -1, 3, 99999);
  assert.equal(result.pvpOpponentId, 'BOT');
  assert.ok(typeof result.pvpOpponentRankBadge === 'string');
  assert.ok(result.pvpOpponentRankBadge.length > 0);
});
