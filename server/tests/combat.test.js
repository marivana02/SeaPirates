const test = require('node:test');
const assert = require('node:assert/strict');

// ─━━━━━━━━━━━━━━━━━━━━━━━
//  CONSTANTS
// ─━━━━━━━━━━━━━━━━━━━━━━━

test('constants exports all expected values', () => {
  const c = require('../routes/combat/constants');
  assert.equal(c.FIGHT_TIMEOUT_MS, 300000);
  assert.equal(c.DEFAULT_PLAYER_COOLDOWN_MS, 4000);
  assert.equal(c.TOWER_COOLDOWN_MS, 3000);
  assert.equal(c.BARUT_MULTIPLIER, 1.10);
  assert.equal(c.ZIRH_MULTIPLIER, 0.90);
  assert.equal(c.BOT_BASE_DAMAGE, 155);
  assert.equal(c.PVP_CANNON_DAMAGE, 185);
  assert.equal(c.WEEKLY_BOSS_HP, 100000000);
  assert.equal(c.TIAMAT_HP, 12000000);
  assert.equal(c.TOWER_MIN_LEVEL, 5);
  assert.equal(c.TOWER_MAX_LEVEL, 100);
  assert.equal(c.CLEANUP_INTERVAL_MS, 60000);
});

test('BOT_AMMO_DAMAGE has correct values', () => {
  const c = require('../routes/combat/constants');
  assert.equal(c.BOT_AMMO_DAMAGE[1], 30);
  assert.equal(c.BOT_AMMO_DAMAGE[2], 75);
  assert.equal(c.BOT_AMMO_DAMAGE[3], 130);
});

// ─━━━━━━━━━━━━━━━━━━━━━━━
//  LOCKS
// ─━━━━━━━━━━━━━━━━━━━━━━━

test('acquireAttackLock acquires when free', () => {
  const { acquireAttackLock, releaseAttackLock } = require('../routes/combat/locks');
  releaseAttackLock(999); // cleanup
  const result = acquireAttackLock(999);
  assert.equal(result, true);
  releaseAttackLock(999);
});

test('acquireAttackLock rejects when already locked', () => {
  const { acquireAttackLock, releaseAttackLock } = require('../routes/combat/locks');
  releaseAttackLock(111); // cleanup
  acquireAttackLock(111);
  const second = acquireAttackLock(111);
  assert.equal(second, false);
  releaseAttackLock(111);
});

test('releaseAttackLock allows re-acquire', () => {
  const { acquireAttackLock, releaseAttackLock } = require('../routes/combat/locks');
  releaseAttackLock(222);
  acquireAttackLock(222);
  releaseAttackLock(222);
  const result = acquireAttackLock(222);
  assert.equal(result, true);
  releaseAttackLock(222);
});

test('different player IDs do not block each other', () => {
  const { acquireAttackLock, releaseAttackLock } = require('../routes/combat/locks');
  releaseAttackLock(100);
  releaseAttackLock(200);
  acquireAttackLock(100);
  const result = acquireAttackLock(200);
  assert.equal(result, true);
  releaseAttackLock(100);
  releaseAttackLock(200);
});

// ─━━━━━━━━━━━━━━━━━━━━━━━
//  DAMAGE MODIFIERS
// ─━━━━━━━━━━━━━━━━━━━━━━━

test('applyDamageModifiers calculates basic damage', async () => {
  const { applyDamageModifiers } = require('../routes/combat/damageModifiers');
  const mockPool = { async query() { return { rowCount: 0 }; } };

  const result = await applyDamageModifiers(mockPool, 1, {
    totalCannonDamage: 900, actualCannonsFired: 5, ammoDamage: 30,
    givesElp: false, gainedElp: 0
  }, {
    npcUseBarut: false, npcUseZirh: false, npcCannons: 0, npcAmmoId: 1, opponentId: null
  }, { npc: { damage: 200 } }, { useBarut: false, useZirh: false, currentEvent: { type: 'none' }, ammoId: 1 });

  assert.equal(result.finalDamage, 900 + 5 * 30);
  assert.equal(result.finalNpcDamage, 200);
});

test('applyDamageModifiers applies ZIRH multiplier to player damage', async () => {
  const { applyDamageModifiers } = require('../routes/combat/damageModifiers');
  const mockPool = { async query() { return { rowCount: 0 }; } };

  const result = await applyDamageModifiers(mockPool, 1, {
    totalCannonDamage: 1000, actualCannonsFired: 5, ammoDamage: 30,
    givesElp: false, gainedElp: 0
  }, {
    npcUseBarut: false, npcUseZirh: true, npcCannons: 0, npcAmmoId: 1, opponentId: null
  }, { npc: { damage: 200 } }, { useBarut: false, useZirh: false, currentEvent: { type: 'none' }, ammoId: 1 });

  assert.equal(result.finalDamage, Math.floor((1000 + 5 * 30) * 0.90));
});

test('applyPvPDamageModifiers passes through simResult NPC damage', async () => {
  const { applyPvPDamageModifiers } = require('../routes/combat/pvp/damage');
  const mockPool = { async query() { return { rowCount: 0 }; } };

  const simResult = {
    npcDamage: Math.floor(10 * (150 + 75) * 1.10),
    npcUseBarut: true, npcUseZirh: false, npcCannons: 10, npcAmmoId: 2
  };
  const result = await applyPvPDamageModifiers(mockPool, 1, {
    totalCannonDamage: 500, actualCannonsFired: 3, ammoDamage: 75,
    givesElp: true, gainedElp: 0
  }, simResult, { useBarut: false, useZirh: false, currentEvent: { type: 'none' }, ammoId: 2 });

  assert.equal(result.finalNpcDamage, simResult.npcDamage);
});

// ─━━━━━━━━━━━━━━━━━━━━━━━
//  QUEST TRACKING
// ─━━━━━━━━━━━━━━━━━━━━━━━

test('updateQuestProgress skips when no active quest', async () => {
  const { updateQuestProgress } = require('../routes/combat/questTracking');
  let called = false;
  const mockPool = {
    async query() {
      return { rows: [{ active_quest_id: null, active_quest_id2: null, quest_progress: [], quest_progress2: [] }] };
    }
  };

  await updateQuestProgress(mockPool, 1, { type: 'kill', npcNameStr: 'Test', amount: 1 });
  assert.equal(called, false);
});

test('updateQuestProgress increments progress for slot1 matching objective', async () => {
  const { updateQuestProgress } = require('../routes/combat/questTracking');
  const calls = [];
  const mockPool = {
    async query(sql, params) {
      if (sql.includes('SELECT active_quest_id')) {
        return { rows: [{ active_quest_id: 1, active_quest_id2: null, quest_progress: [0, 0], quest_progress2: [] }] };
      }
      calls.push({ sql, params });
      return { rows: [] };
    }
  };

  await updateQuestProgress(mockPool, 1, { type: 'kill', npcNameStr: 'Blackpearl', amount: 1 });
  assert.equal(calls.length, 1);
  assert.ok(calls[0].sql.includes('quest_progress'));
  assert.ok(calls[0].sql.includes('quest_kills'));
});

test('updateQuestProgress increments slot2 progress for VIP quest', async () => {
  const { updateQuestProgress } = require('../routes/combat/questTracking');
  const calls = [];
  const mockPool = {
    async query(sql, params) {
      if (sql.includes('SELECT active_quest_id')) {
        return { rows: [{ active_quest_id: null, active_quest_id2: 1, quest_progress: [], quest_progress2: [0, 0] }] };
      }
      calls.push({ sql, params });
      return { rows: [] };
    }
  };

  await updateQuestProgress(mockPool, 1, { type: 'kill', npcNameStr: 'Blackpearl', amount: 1 });
  assert.equal(calls.length, 1);
  assert.ok(calls[0].sql.includes('quest_progress2'));
  assert.ok(calls[0].sql.includes('quest_kills2'));
});

// ─━━━━━━━━━━━━━━━━━━━━━━━
//  PLAYER DAMAGE
// ─━━━━━━━━━━━━━━━━━━━━━━━

test('calculatePlayerCooldownMs returns weighted average', async () => {
  const { calculatePlayerCooldownMs } = require('../routes/combat/playerDamage');
  const mockPool = {
    async query() {
      return { rows: [{ equipped: 2, reload_time_ms: 4000 }, { equipped: 1, reload_time_ms: 2000 }] };
    }
  };

  const result = await calculatePlayerCooldownMs(mockPool, 1, false);
  assert.equal(result, 3333);
});

test('calculatePlayerCooldownMs returns default when no cannons', async () => {
  const { calculatePlayerCooldownMs } = require('../routes/combat/playerDamage');
  const mockPool = { async query() { return { rows: [] }; } };
  const result = await calculatePlayerCooldownMs(mockPool, 1, false);
  assert.equal(result, 4000);
});

test('calculatePlayerCooldownMs returns tower cooldown in tower mode', async () => {
  const { calculatePlayerCooldownMs } = require('../routes/combat/playerDamage');
  const mockPool = { async query() { return { rows: [] }; } };
  const result = await calculatePlayerCooldownMs(mockPool, 1, true);
  assert.equal(result, 3000);
});

// ─━━━━━━━━━━━━━━━━━━━━━━━
//  NPC SIMULATION
// ─━━━━━━━━━━━━━━━━━━━━━━━

test('simulatePvPOpponent for BOT (-1) uses level-based cannons', async () => {
  const { simulatePvPOpponent, clearBotLoadout } = require('../routes/combat/pvp/simulation');
  const mockPool = {};
  const playerId = 99991;
  clearBotLoadout(playerId);
  const result = await simulatePvPOpponent(mockPool, -1, 5, null, playerId);
  assert.equal(result.opponentId, -1);
  assert.equal(result.npcCannons, 20);
  assert.ok([1, 2, 3].includes(result.npcAmmoId));
  assert.equal(typeof result.npcUseBarut, 'boolean');
  assert.equal(typeof result.npcUseZirh, 'boolean');
  assert.ok(result.npcDamage > 0);
  assert.ok(result.npcReloadMs >= 1500 && result.npcReloadMs <= 4000);
});

test('simulatePvPOpponent for real opponent queries DB', async () => {
  const { simulatePvPOpponent } = require('../routes/combat/pvp/simulation');
  let callCount = 0;
  const mockPool = {
    async query(sql, params) {
      callCount++;
      if (sql.includes('SELECT ship_level')) return { rows: [{ ship_level: 5 }] };
      if (sql.includes('player_cannons pc')) return { rows: [{ equipped: 5, damage: 200 }, { equipped: 3, damage: 150 }] };
      if (sql.includes("item_type = 'barut'")) return { rows: [{ quantity: 1 }] };
      if (sql.includes("item_type = 'zirh'")) return { rows: [] };
      if (sql.includes('player_ammo pa')) {
        const ammoType = params ? params[1] : 1;
        if (ammoType === 3) return { rows: [{ quantity: 100, damage: 130 }] };
        if (ammoType === 2) return { rows: [{ quantity: 100, damage: 75 }] };
        return { rows: [{ quantity: 100, damage: 30 }] };
      }
      return { rows: [] };
    }
  };

  const result = await simulatePvPOpponent(mockPool, 42, 3, null, 99992);
  assert.equal(result.npcCannons, 8); // 5 + 3 (ship level 5, 8 slots)
  assert.equal(result.npcUseBarut, true);
  assert.equal(result.npcUseZirh, false);
  assert.equal(result.npcAmmoId, 3); // explosive priority
  assert.ok(result.npcDamage > 0);
  assert(callCount >= 4);
});

test('resolvePvPOpponentInfo returns BOT info for targetId -1', async () => {
  const { resolvePvPOpponentInfo } = require('../routes/combat/pvp/simulation');
  const mockPool = {};
  const result = await resolvePvPOpponentInfo(mockPool, -1, 3, 99993);
  assert.equal(result.pvpOpponentId, 'BOT');
  assert.ok(typeof result.pvpOpponentRankBadge === 'string');
  assert.ok(result.pvpOpponentRankBadge.length > 0);
  assert.ok(result.opponentReloadMs >= 1500 && result.opponentReloadMs <= 4000);
  assert.equal(typeof result.opponentReloadMs, 'number');
});
