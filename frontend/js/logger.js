(function () {
  'use strict';

  var _queue = [];
  var _lastSend = 0;
  var _dedupCache = {};
  var _MIN_INTERVAL = 10000;
  var _DEDUP_TTL = 300000;

  function getBaseUrl() {
    return (window.__API_URL__ || window.location.origin) + '/api';
  }

  function dedupKey(context, message) {
    return context + '::' + (message || '');
  }

  window.logError = function (context, error) {
    var message = error && error.message ? error.message : String(error || 'unknown');
    var stack = error && error.stack ? error.stack : '';
    var dkey = dedupKey(context, message);
    if (_dedupCache[dkey] && Date.now() - _dedupCache[dkey] < _DEDUP_TTL) return;
    _dedupCache[dkey] = Date.now();

    _queue.push({
      context: context,
      message: message,
      stack: stack,
      url: window.location.href,
      ts: new Date().toISOString()
    });

    if (_queue.length >= 10) {
      flush();
    } else if (Date.now() - _lastSend >= _MIN_INTERVAL) {
      flush();
    }
  };

  function flush() {
    if (_queue.length === 0) return;
    var batch = _queue.splice(0, _queue.length);
    _lastSend = Date.now();

    var payload = new Blob([JSON.stringify({ errors: batch })], { type: 'application/json' });
    var url = getBaseUrl() + '/client/log';

    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(url, payload);
      } else {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', url, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
        var token = localStorage.getItem('sp_token');
        if (token) xhr.setRequestHeader('Authorization', 'Bearer ' + token);
        xhr.send(payload);
      }
    } catch (e) {}
  }

  window._logErrorFlush = flush;
})();
