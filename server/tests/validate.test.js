const test = require('node:test');
const assert = require('node:assert/strict');
const { validate, VALIDATORS } = require('../middleware/validate');

test('VALIDATORS.username accepts valid names', () => {
  assert.ok(VALIDATORS.username('player1'));
  assert.ok(VALIDATORS.username('test_user'));
  assert.ok(VALIDATORS.username('abcde'));
  assert.ok(VALIDATORS.username('x'.repeat(12)));
});

test('VALIDATORS.username rejects invalid names', () => {
  assert.equal(VALIDATORS.username('ab'), false);  // too short
  assert.equal(VALIDATORS.username('x'.repeat(13)), false);  // too long
  assert.equal(VALIDATORS.username('user name'), false);  // space
  assert.equal(VALIDATORS.username('user-name'), false);  // hyphen
  assert.equal(VALIDATORS.username(''), false);  // empty
  assert.equal(VALIDATORS.username(null), false);
  assert.equal(VALIDATORS.username(123), false);
});

test('VALIDATORS.password accepts valid passwords', () => {
  assert.ok(VALIDATORS.password('abcdefgh'));
  assert.ok(VALIDATORS.password('test1234'));
  assert.ok(VALIDATORS.password('x'.repeat(100)));
});

test('VALIDATORS.password rejects invalid passwords', () => {
  assert.equal(VALIDATORS.password('ab'), false);  // too short
  assert.equal(VALIDATORS.password('x'.repeat(101)), false);  // too long
  assert.equal(VALIDATORS.password(''), false);
  assert.equal(VALIDATORS.password(null), false);
});

test('VALIDATORS.email accepts valid emails', () => {
  assert.ok(VALIDATORS.email('test@example.com'));
  assert.ok(VALIDATORS.email('user.name@sub.domain.com'));
  assert.ok(VALIDATORS.email('a@b.co'));
});

test('VALIDATORS.email rejects invalid emails', () => {
  assert.equal(VALIDATORS.email('notanemail'), false);
  assert.equal(VALIDATORS.email('@domain.com'), false);
  assert.equal(VALIDATORS.email('user@'), false);
  assert.equal(VALIDATORS.email(''), false);
});

test('VALIDATORS.positiveInt accepts valid values', () => {
  assert.ok(VALIDATORS.positiveInt('0'));
  assert.ok(VALIDATORS.positiveInt('100'));
  assert.ok(VALIDATORS.positiveInt(0));
  assert.ok(VALIDATORS.positiveInt(999));
});

test('VALIDATORS.positiveInt rejects invalid values', () => {
  assert.equal(VALIDATORS.positiveInt('-1'), false);
  assert.equal(VALIDATORS.positiveInt('abc'), false);
});

test('VALIDATORS.inRange validates correctly', () => {
  assert.ok(VALIDATORS.inRange('5', 1, 10));
  assert.ok(VALIDATORS.inRange('1', 1, 10));
  assert.ok(VALIDATORS.inRange('10', 1, 10));
  assert.equal(VALIDATORS.inRange('0', 1, 10), false);
  assert.equal(VALIDATORS.inRange('11', 1, 10), false);
  assert.equal(VALIDATORS.inRange('abc', 1, 10), false);
});

test('VALIDATORS.boolean accepts valid boolean values', () => {
  assert.ok(VALIDATORS.boolean(true));
  assert.ok(VALIDATORS.boolean(false));
  assert.ok(VALIDATORS.boolean('true'));
  assert.ok(VALIDATORS.boolean('false'));
});

test('VALIDATORS.boolean rejects invalid boolean values', () => {
  assert.equal(VALIDATORS.boolean('yes'), false);
  assert.equal(VALIDATORS.boolean(1), false);
  assert.equal(VALIDATORS.boolean(null), false);
});

test('validate middleware returns errors for missing fields', () => {
  const rules = {
    username: [(v) => VALIDATORS.username(v) || 'invalid username'],
    password: [(v) => VALIDATORS.password(v) || 'invalid password']
  };

  const middleware = validate(rules);
  const req = { body: {} };
  const res = {
    status(v) { this._status = v; return this; },
    json(v) { this._json = v; return this; }
  };

  let calledNext = false;
  middleware(req, res, () => { calledNext = true; });

  assert.equal(calledNext, false);
  assert.equal(res._status, 400);
  assert.ok(res._json.error.includes('username'));
});

test('validate middleware passes for valid fields', () => {
  const rules = {
    username: [(v) => VALIDATORS.username(v) || 'invalid username'],
    password: [(v) => VALIDATORS.password(v) || 'invalid password']
  };

  const middleware = validate(rules);
  const req = { body: { username: 'testuser', password: 'test1234' } };
  const res = { status() { return this; }, json() { return this; } };

  let calledNext = false;
  middleware(req, res, () => { calledNext = true; });

  assert.ok(calledNext);
});

test('validate middleware passes with no rules', () => {
  const middleware = validate({});
  const req = { body: {} };
  const res = { status() { return this; }, json() { return this; } };

  let calledNext = false;
  middleware(req, res, () => { calledNext = true; });

  assert.ok(calledNext);
});
