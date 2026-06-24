const test = require('node:test');
const assert = require('node:assert/strict');
const gameData = require('../config/gameData');

test('SHIPS has 11 levels (0-10)', () => {
  assert.equal(gameData.SHIPS.length, 11);
});

test('SHIPS are ordered by level ascending', () => {
  for (let i = 0; i < gameData.SHIPS.length; i++) {
    assert.equal(gameData.SHIPS[i].level, i);
  }
});

test('each SHIP has required fields', () => {
  for (const ship of gameData.SHIPS) {
    assert.ok(typeof ship.level === 'number', `Ship level ${ship.level} missing level`);
    assert.ok(typeof ship.name === 'string', `Ship ${ship.level} missing name`);
    assert.ok(typeof ship.baseHp === 'number' && ship.baseHp > 0, `Ship ${ship.level} invalid baseHp`);
    assert.ok(typeof ship.cannonSlots === 'number' && ship.cannonSlots > 0, `Ship ${ship.level} invalid cannonSlots`);
    assert.ok(typeof ship.plankSlots === 'number' && ship.plankSlots > 0, `Ship ${ship.level} invalid plankSlots`);
    assert.ok(typeof ship.requiredElp === 'number' && ship.requiredElp >= 0, `Ship ${ship.level} invalid requiredElp`);
  }
});

test('SHIPS progression increases stats', () => {
  for (let i = 1; i < gameData.SHIPS.length; i++) {
    const prev = gameData.SHIPS[i - 1];
    const curr = gameData.SHIPS[i];
    assert.ok(curr.baseHp > prev.baseHp, `Ship ${i} HP not > ship ${i - 1}`);
    assert.ok(curr.cannonSlots >= prev.cannonSlots, `Ship ${i} cannon slots not >= ship ${i - 1}`);
    assert.ok(curr.plankSlots >= prev.plankSlots, `Ship ${i} plank slots not >= ship ${i - 1}`);
    assert.ok(curr.requiredElp > prev.requiredElp, `Ship ${i} ELP not > ship ${i - 1}`);
  }
});

test('starter ship has 0 required ELP', () => {
  const starter = gameData.SHIPS[0];
  assert.equal(starter.requiredElp, 0);
  assert.equal(starter.baseHp, 10000);
  assert.equal(starter.cannonSlots, 15);
  assert.equal(starter.plankSlots, 5);
});

test('max ship (Elite X) has correct values', () => {
  const max = gameData.SHIPS[10];
  assert.equal(max.baseHp, 190000);
  assert.equal(max.cannonSlots, 60);
  assert.equal(max.plankSlots, 25);
  assert.equal(max.requiredElp, 4500000);
});
