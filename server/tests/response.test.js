const test = require('node:test');
const assert = require('node:assert/strict');
const response = require('../helpers/response');

function createMockRes() {
  return {
    _status: null,
    _json: null,
    status(v) { this._status = v; return this; },
    json(v) { this._json = v; return this; }
  };
}

test('response.success returns data with default 200 status', () => {
  const res = createMockRes();
  const result = response.success(res, { hello: 'world' });
  assert.equal(res._status, 200);
  assert.deepEqual(res._json, { hello: 'world' });
});

test('response.success returns data with custom status', () => {
  const res = createMockRes();
  response.success(res, { id: 1 }, 201);
  assert.equal(res._status, 201);
  assert.deepEqual(res._json, { id: 1 });
});

test('response.success returns null data with 204', () => {
  const res = createMockRes();
  response.success(res, null, 204);
  assert.equal(res._status, 204);
  assert.equal(res._json, null);
});

test('response.error returns error with default 500', () => {
  const res = createMockRes();
  response.error(res, 'Server error');
  assert.equal(res._status, 500);
  assert.deepEqual(res._json, { error: 'Server error' });
});

test('response.error returns error with custom status and details', () => {
  const res = createMockRes();
  response.error(res, 'Not found', 404, 'details here');
  assert.equal(res._status, 404);
  assert.deepEqual(res._json, { error: 'Not found', details: 'details here' });
});

test('response.badRequest returns 400', () => {
  const res = createMockRes();
  response.badRequest(res, 'Invalid input');
  assert.equal(res._status, 400);
  assert.deepEqual(res._json, { error: 'Invalid input' });
});

test('response.unauthorized returns 401', () => {
  const res = createMockRes();
  response.unauthorized(res);
  assert.equal(res._status, 401);
  assert.deepEqual(res._json, { error: 'Unauthorized' });
});

test('response.unauthorized returns custom 401 message', () => {
  const res = createMockRes();
  response.unauthorized(res, 'Token expired');
  assert.equal(res._status, 401);
  assert.deepEqual(res._json, { error: 'Token expired' });
});

test('response.notFound returns 404', () => {
  const res = createMockRes();
  response.notFound(res);
  assert.equal(res._status, 404);
  assert.deepEqual(res._json, { error: 'Not found' });
});

test('response.tooMany returns 429 with retryAfter', () => {
  const res = createMockRes();
  response.tooMany(res, 'Too fast', 60);
  assert.equal(res._status, 429);
  assert.deepEqual(res._json, { error: 'Too fast', retryAfter: 60 });
});

test('response.tooMany returns 429 without retryAfter', () => {
  const res = createMockRes();
  response.tooMany(res, 'Rate limited');
  assert.equal(res._status, 429);
  assert.deepEqual(res._json, { error: 'Rate limited' });
});
