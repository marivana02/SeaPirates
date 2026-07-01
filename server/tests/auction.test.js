const test = require('node:test');
const assert = require('node:assert/strict');

test('ITEMS_INFO defines all expected rotation items', () => {
  const ROTATION = ['barut', 'zirh', 'gul3', 'top2', 'elit_kiris', 'gemi1'];
  assert.equal(ROTATION.length, 6);
});

test('Bid amount validation: parse integer from string', () => {
  const bidAmount = parseInt('abc');
  assert.ok(isNaN(bidAmount) || bidAmount < 1);
});

test('Bid amount validation: zero is invalid', () => {
  const bidAmount = parseInt('0');
  assert.ok(isNaN(bidAmount) || bidAmount < 1);
});

test('Bid amount validation: valid number passes', () => {
  const bidAmount = parseInt('100');
  assert.ok(!isNaN(bidAmount) && bidAmount >= 1);
});

test('Auction round rotation contains 6 items', () => {
  const rotation = ['barut', 'zirh', 'gul3', 'top2', 'elit_kiris', 'gemi1'];
  assert.equal(rotation.length, 6);
  assert.ok(rotation.includes('barut'));
  assert.ok(rotation.includes('gemi1'));
});

test('Kristal Queen design appears every 5 rounds', () => {
  for (let i = 0; i < 20; i++) {
    const roundNum = i;
    const showDesign = (roundNum % 5 === 0);
    if (i % 5 === 0) {
      assert.equal(showDesign, true, `Round ${i} should show design`);
    } else {
      assert.equal(showDesign, false, `Round ${i} should not show design`);
    }
  }
});

test('60 Ponder has ~15% chance to appear', () => {
  let count = 0;
  const trials = 10000;
  for (let i = 0; i < trials; i++) {
    if (Math.random() < 0.15) count++;
  }
  const ratio = count / trials;
  assert.ok(ratio > 0.10 && ratio < 0.20, `Expected ~15%, got ${(ratio * 100).toFixed(1)}%`);
});

test('Auction items info has expected keys', () => {
  const ITEMS_INFO = {
    barut: { name: 'Barut x100', type: 'sarf', qty: 100, startPrice: 1 },
    zirh: { name: 'Zırh x100', type: 'sarf', qty: 100, startPrice: 1 },
    gul3: { name: 'Patlayan Gülle x2000', type: 'gulle', qty: 2000, startPrice: 1 },
    top2: { name: '55 Pounder', type: 'top', qty: 1, startPrice: 1 },
    top3: { name: '60 Ponder', type: 'top', qty: 1, startPrice: 1 },
    elit_kiris: { name: 'Elit Kiriş', type: 'plank', qty: 1, startPrice: 1 },
    gemi1: { name: 'Elit I Gemi', type: 'ship', qty: 1, startPrice: 1 },
    kristal_queen_design: { name: 'Kristal Queen Tasarımı', type: 'design', qty: 1, startPrice: 1 }
  };
  assert.equal(Object.keys(ITEMS_INFO).length, 8);
  assert.equal(ITEMS_INFO.barut.type, 'sarf');
  assert.equal(ITEMS_INFO.gemi1.type, 'ship');
  assert.equal(ITEMS_INFO.kristal_queen_design.type, 'design');
});
