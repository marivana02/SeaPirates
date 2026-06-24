const webpush = require('web-push');
const pool = require('../config/db');

const vapidPublic = process.env.VAPID_PUBLIC_KEY;
const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@seapirates.com';

if (vapidPublic && vapidPrivate) {
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
} else {
  console.warn('⚠️ VAPID keys not configured — push notifications disabled');
}

async function sendPushToAll(title, body, icon = '/assets/ui/pearl.png') {
  if (!vapidPublic || !vapidPrivate) return;

  try {
    const subs = await pool.query('SELECT endpoint, auth, p256dh FROM push_subscriptions');
    if (subs.rows.length === 0) return;

    const payload = JSON.stringify({ title, body, icon, badge: '/assets/ui/pearl.png' });

    for (const sub of subs.rows) {
      const subscription = {
        endpoint: sub.endpoint,
        keys: { auth: sub.auth, p256dh: sub.p256dh }
      };
      try {
        await webpush.sendNotification(subscription, payload);
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Subscription expired or invalid — remove it
          await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [sub.endpoint]);
        } else {
          console.error('Push send error:', err.message);
        }
      }
    }
  } catch (err) {
    console.error('Push notification broadcast error:', err);
  }
}

module.exports = { sendPushToAll };
