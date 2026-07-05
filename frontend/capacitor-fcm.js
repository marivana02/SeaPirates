(function () {
  'use strict';

  var TOKEN_KEY = 'sp_fcm_token';

  async function registerFCM() {
    if (typeof Capacitor === 'undefined' || !Capacitor.Plugins || !Capacitor.Plugins.PushNotifications) {
      return;
    }
    try {
      var permResult = await Capacitor.Plugins.PushNotifications.requestPermissions();
      if (permResult && permResult.receive === 'granted') {
        await Capacitor.Plugins.PushNotifications.register();
      }
    } catch (e) {
      logError('registerFCM', e);
    }
  }

  async function unregisterFCM() {
    if (typeof Capacitor === 'undefined' || !Capacitor.Plugins || !Capacitor.Plugins.PushNotifications) {
      return;
    }
    try {
      var oldToken = localStorage.getItem(TOKEN_KEY);
      if (oldToken) {
        var token = localStorage.getItem('sp_token');
        await fetch((window.__API_URL__ || window.location.origin) + '/api/notifications/unregister-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
          body: JSON.stringify({ token: oldToken })
        });
      }
    } catch (e) { /* ignore */ }
    localStorage.removeItem(TOKEN_KEY);
  }

  function sendTokenToServer(fcmToken) {
    var token = localStorage.getItem('sp_token');
    if (!token) return;
    fetch((window.__API_URL__ || window.location.origin) + '/api/notifications/register-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ token: fcmToken })
    }).then(function () {
      localStorage.setItem(TOKEN_KEY, fcmToken);
    }).catch(function () {});
  }

  /* Listen for FCM token + foreground notifications */
  if (typeof Capacitor !== 'undefined' && Capacitor.Plugins && Capacitor.Plugins.PushNotifications) {
    try {
      Capacitor.Plugins.PushNotifications.addListener('registration', function (result) {
        if (result.value) {
          sendTokenToServer(result.value);
        }
      });

      Capacitor.Plugins.PushNotifications.addListener('pushNotificationReceived', function (n) {
        if (typeof Capacitor === 'undefined' || !Capacitor.Plugins || !Capacitor.Plugins.LocalNotifications) return;
        var data = n.data || {};
        var notifType = data.type;
        var params = {};
        try { params = JSON.parse(data.params || '{}'); } catch (e) {}

        var title = notifType && typeof t === 'function'
          ? (t('notif_' + notifType + '_title') || n.title)
          : n.title;
        var body = notifType && typeof t === 'function'
          ? (t('notif_' + notifType + '_body', params) || n.body)
          : n.body;

        try {
          Capacitor.Plugins.LocalNotifications.schedule({
            notifications: [{
              title: title,
              body: body,
              id: Date.now(),
              sound: 'default'
            }]
          });
        } catch (e) { /* ignore */ }
      });
    } catch (e) { /* ignore */ }
  }

  window.registerFCM = registerFCM;
  window.unregisterFCM = unregisterFCM;

  /* Auto-register if preference is on */
  if (localStorage.getItem('sp_notif_enabled') === 'true') {
    registerFCM();
  }
})();
