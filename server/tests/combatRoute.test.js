const test = require('node:test');
const assert = require('node:assert/strict');

const { mapDbFightRowToFightState, getOpponentReloadMs } = require('../helpers/combatRoute');

test('mapDbFightRowToFightState maps db row into fight state safely', () => {
  const state = mapDbFightRowToFightState({
    npc_name: 'Test NPC',
    npc_hp: '1200',
    npc_max_hp: '2000',
    npc_damage: '90',
    npc_gold: '450',
    npc_pearl: '12',
    npc_xp: '70',
    player_hp: '800',
    player_max_hp: '1500',
    weekly_boss_damage_dealt: '333',
    map_level: 3,
    is_admiral: false,
    is_tiamat: false,
    is_tower: true,
    is_pvp: false,
    tower_id: 5,
    full_img: 'full.png',
    damaged_img: 'damaged.png',
    is_weekly_boss: false
  });

  assert.equal(state.npc.name, 'Test NPC');
  assert.equal(state.npcHp, 1200);
  assert.equal(state.npcMaxHp, 2000);
  assert.equal(state.playerHp, 800);
  assert.equal(state.playerMaxHp, 1500);
  assert.equal(state.weeklyBossDamageDealt, 333);
  assert.equal(state.npc.towerId, 5);
  assert.equal(state.isTower, true);
});

test('getOpponentReloadMs returns weighted average reload', async () => {
  const mockPool = {
    async query() {
      return {
        rows: [
          { equipped: 2, reload_time_ms: 4000 },
          { equipped: 1, reload_time_ms: 2000 }
        ]
      };
    }
  };

  const result = await getOpponentReloadMs(mockPool, 7);
  assert.equal(result, 3333);
});

test('getOpponentReloadMs returns default when no cannons', async () => {
  const mockPool = {
    async query() {
      return { rows: [] };
    }
  };

  const result = await getOpponentReloadMs(mockPool, 9);
  assert.equal(result, 3000);
});

test('getOpponentReloadMs returns default on query error', async () => {
  const mockPool = {
    async query() {
      throw new Error('db down');
    }
  };
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    const result = await getOpponentReloadMs(mockPool, 9);
    assert.equal(result, 3000);
  } finally {
    console.error = originalConsoleError;
  }
});
