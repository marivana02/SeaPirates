const test = require('node:test');
const assert = require('node:assert/strict');

const ORIGINAL_JWT_SECRET = process.env.JWT_SECRET;
process.env.JWT_SECRET = 'test_secret_key_for_testing';

const pool = require('../config/db');
test.after(() => pool.end().catch(() => {}));

test('auth middleware returns 401 when no token provided', async () => {
  const authMiddleware = require('../middleware/auth');
  const req = { headers: {} };
  let statusCode, jsonBody;
  const res = {
    status(code) { statusCode = code; return this; },
    json(body) { jsonBody = body; }
  };

  await authMiddleware(req, res, () => {});
  assert.equal(statusCode, 401);
  assert.equal(jsonBody.error, 'Token bulunamadı');
});

test('auth middleware returns 401 with invalid token', async () => {
  const authMiddleware = require('../middleware/auth');
  const req = { headers: { authorization: 'Bearer invalid_token_here' } };
  let statusCode, jsonBody;
  const res = {
    status(code) { statusCode = code; return this; },
    json(body) { jsonBody = body; }
  };

  await authMiddleware(req, res, () => {});
  assert.equal(statusCode, 401);
  assert.equal(jsonBody.error, 'Geçersiz token');
});

test('auth middleware calls next with valid token and no ban', async () => {
  const jwt = require('jsonwebtoken');
  const token = jwt.sign({ id: 1, username: 'testuser', isAdmin: false }, process.env.JWT_SECRET, { expiresIn: '1h' });

  const authMiddleware = require('../middleware/auth');
  const req = { headers: { authorization: `Bearer ${token}` } };
  let nextCalled = false;
  const res = {
    status() { return this; },
    json() { return this; }
  };

  await authMiddleware(req, res, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
  assert.equal(req.player.id, 1);
  assert.equal(req.player.username, 'testuser');
});

test('auth middleware skips ban check for admin', async () => {
  const jwt = require('jsonwebtoken');
  const token = jwt.sign({ id: 1, username: 'admin', isAdmin: true }, process.env.JWT_SECRET, { expiresIn: '1h' });

  const authMiddleware = require('../middleware/auth');
  const req = { headers: { authorization: `Bearer ${token}` } };
  let nextCalled = false;

  await authMiddleware(req, { status() { return this; }, json() { return this; } }, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});

process.env.JWT_SECRET = ORIGINAL_JWT_SECRET;
