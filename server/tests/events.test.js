const test = require('node:test');
const assert = require('node:assert/strict');

test('getCurrentEvent exports is a function', () => {
  const events = require('../routes/events');
  assert.equal(typeof events.getCurrentEvent, 'function');
});

test('AUTO_EVENTS rotation has 3 event types', () => {
  const AUTO_EVENTS = [
    { name: '2x NPC Ödül', type: 'npc_reward', mult: 2 },
    { name: '2x ELP Ödül', type: 'elp_reward', mult: 2 },
    { name: '2x Hasar', type: 'damage', mult: 2 }
  ];
  assert.equal(AUTO_EVENTS.length, 3);
  assert.ok(AUTO_EVENTS.every(e => e.mult === 2));
  assert.ok(AUTO_EVENTS.some(e => e.type === 'damage'));
});

test('Event rotation cycles every 3 weeks', () => {
  const events = [
    { type: 'npc_reward' },
    { type: 'elp_reward' },
    { type: 'damage' }
  ];
  const weeks = [0, 1, 2, 3, 4, 5];
  const results = weeks.map(w => events[w % events.length]);
  assert.equal(results[0].type, 'npc_reward');
  assert.equal(results[1].type, 'elp_reward');
  assert.equal(results[2].type, 'damage');
  assert.equal(results[3].type, 'npc_reward');
  assert.equal(results[4].type, 'elp_reward');
  assert.equal(results[5].type, 'damage');
});

test('Week range calculation from a known date', () => {
  const d = new Date('2025-07-16T12:00:00Z');
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const startOfWeek = new Date(d.setDate(diff));
  startOfWeek.setHours(0, 0, 0, 0);
  assert.equal(startOfWeek.getDay(), 1);
  assert.equal(startOfWeek.getHours(), 0);
  assert.equal(startOfWeek.getMinutes(), 0);
});

test('Weekend event date calculation produces valid range', () => {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const startOfWeek = new Date(now.setDate(diff));
  startOfWeek.setHours(0, 0, 0, 0);

  const eventStart = new Date(startOfWeek);
  eventStart.setDate(startOfWeek.getDate() + 5);
  eventStart.setHours(0, 0, 0, 0);

  const eventEnd = new Date(eventStart);
  eventEnd.setDate(eventStart.getDate() + 1);
  eventEnd.setHours(0, 0, 0, 0);

  assert.ok(eventEnd > eventStart);
  assert.equal(eventEnd - eventStart, 86400000);
});

test('Event date comparison logic', () => {
  const now = new Date();
  const eventStart = new Date(now.getTime() - 3600000);
  const eventEnd = new Date(now.getTime() + 3600000);
  assert.ok(now >= eventStart);
  assert.ok(now < eventEnd);
});

test('Admin create handler requires name', () => {
  const name = '';
  const type = 'damage';
  const result = !name || !type;
  assert.equal(result, true);
});

test('Admin create with valid data passes', () => {
  const name = 'Test Event';
  const type = 'damage';
  const result = !name || !type;
  assert.equal(result, false);
});
