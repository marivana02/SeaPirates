(function () {
  'use strict';

  var TOKEN_KEY = 'sp_fcm_token';

  async function registerFCM() {
    if (typeof Capacitor === 'undefined' || !Capacitor.Plugins || !Capacitor.Plugins.PushNotifications) {
      return;
    }

    try {
      await Capacitor.Plugins.PushNotifications.requestPermissions();
      await Capacitor.Plugins.PushNotifications.register();
    } catch (e) {
      /* permission denied or unsupported */
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

  async function sendTokenToServer(fcmToken) {
    var token = localStorage.getItem('sp_token');
    if (!token) return;
    try {
      await fetch((window.__API_URL__ || window.location.origin) + '/api/notifications/register-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ token: fcmToken })
      });
      localStorage.setItem(TOKEN_KEY, fcmToken);
    } catch (e) { /* ignore */ }
  }

  /* Listen for FCM token */
  if (typeof Capacitor !== 'undefined' && Capacitor.Plugins && Capacitor.Plugins.PushNotifications) {
    try {
      Capacitor.Plugins.PushNotifications.addListener('registration', function (result) {
        if (result.value) {
          sendTokenToServer(result.value);
        }
      });

      /* Foreground notification received — show localized via LocalNotifications */
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
              sound: 'default',
              smallIcon: 'ic_stat_pearl',
              iconColor: '#f0c040'
            }]
          });
        } catch (e) { /* ignore */ }
      });
    } catch (e) { /* ignore */ }
  }

  window.registerFCM = registerFCM;
  window.unregisterFCM = unregisterFCM;
})();
