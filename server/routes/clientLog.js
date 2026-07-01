const express = require('express');
const router = express.Router();
const logger = require('../helpers/logger');

var _ipLogs = {};

setInterval(function () {
  var now = Date.now();
  for (var ip in _ipLogs) {
    if (now - _ipLogs[ip].resetAt > 3600000) {
      delete _ipLogs[ip];
    }
  }
}, 900000);

router.post('/log', function (req, res) {
  var ip = req.ip;
  var now = Date.now();

  if (!_ipLogs[ip]) {
    _ipLogs[ip] = { count: 0, resetAt: now + 3600000 };
  }
  var record = _ipLogs[ip];
  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + 3600000;
  }
  record.count += 1;
  if (record.count > 60) {
    return res.json({ ok: true });
  }

  var body = req.body;
  var errors = body && body.errors;
  if (!Array.isArray(errors)) {
    return res.json({ ok: true });
  }

  for (var i = 0; i < errors.length; i++) {
    var e = errors[i];
    logger.always.warn('[CLIENT][' + ip + '] ' + (e.context || '?') + ': ' + (e.message || ''));
  }

  res.json({ ok: true });
});

module.exports = router;
