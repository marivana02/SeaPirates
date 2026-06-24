const test = require('node:test');
const assert = require('node:assert/strict');
const { VIP_PRICES, CURRENCIES, COUNTRY_TO_CURRENCY } = require('../config/vipPrices');
const { detectCurrency } = require('../routes/vip');

test('VIP_PRICES has correct structure', () => {
  assert.ok(VIP_PRICES[7]);
  assert.ok(VIP_PRICES[30]);
  assert.ok(VIP_PRICES[90]);

  assert.equal(VIP_PRICES[7].TRY, 99);
  assert.equal(VIP_PRICES[7].USD, 3);
  assert.equal(VIP_PRICES[7].EUR, 2.5);

  assert.equal(VIP_PRICES[30].TRY, 249);
  assert.equal(VIP_PRICES[30].USD, 8);
  assert.equal(VIP_PRICES[30].EUR, 7);

  assert.equal(VIP_PRICES[90].TRY, 599);
  assert.equal(VIP_PRICES[90].USD, 18);
  assert.equal(VIP_PRICES[90].EUR, 15);
});

test('CURRENCIES has symbols and locales for all currencies', () => {
  for (const c of ['TRY', 'USD', 'EUR']) {
    assert.ok(CURRENCIES.symbols[c], `Missing symbol for ${c}`);
    assert.ok(CURRENCIES.locales[c], `Missing locale for ${c}`);
  }
});

test('COUNTRY_TO_CURRENCY maps known countries', () => {
  assert.equal(COUNTRY_TO_CURRENCY.TR, 'TRY');
  assert.equal(COUNTRY_TO_CURRENCY.DE, 'EUR');
  assert.equal(COUNTRY_TO_CURRENCY.FR, 'EUR');
  assert.equal(COUNTRY_TO_CURRENCY.US, undefined);
  assert.equal(COUNTRY_TO_CURRENCY.DEFAULT, 'USD');
});

test('detectCurrency returns TRY for Turkish IP', () => {
  assert.equal(detectCurrency('188.57.82.0'), 'TRY');
});

test('detectCurrency returns EUR for German IP', () => {
  assert.equal(detectCurrency('85.214.132.117'), 'EUR');
});

test('detectCurrency returns USD for US IP', () => {
  assert.equal(detectCurrency('8.8.8.8'), 'USD');
});

test('detectCurrency returns USD for null/empty IP', () => {
  assert.equal(detectCurrency(null), 'USD');
  assert.equal(detectCurrency(''), 'USD');
});

test('detectCurrency returns USD for localhost IP', () => {
  assert.equal(detectCurrency('127.0.0.1'), 'USD');
  assert.equal(detectCurrency('::1'), 'USD');
});

test('detectCurrency returns USD for unknown country IP', () => {
  assert.equal(detectCurrency('10.0.0.1'), 'USD');
});

const pool = require('../config/db');
test.after(() => pool.end().catch(() => {}));
