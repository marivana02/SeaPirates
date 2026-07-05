const admin = require('firebase-admin');
const path = require('path');
const pool = require('../config/db');

let initialized = false;

function initFirebase() {
  if (initialized) return true;
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (!serviceAccountPath) {
    console.warn('[FCM] FIREBASE_SERVICE_ACCOUNT_PATH not set — push disabled');
    return false;
  }
  try {
    const saPath = path.resolve(serviceAccountPath);
    const serviceAccount = require(saPath);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    initialized = true;
    console.log('[FCM] Firebase initialized');
    return true;
  } catch (err) {
    console.error('[FCM] Init error:', err.message);
    return false;
  }
}

function buildMessage(token, type, params, titleEn, bodyEn) {
  return {
    token,
    notification: {
      title: titleEn,
      body: bodyEn
    },
    android: {
      priority: 'high',
      notification: {
        channelId: 'Push Notifications',
        priority: 'high',
        sound: 'default',
        icon: 'ic_stat_pearl',
        color: '#f0c040',
        tag: type + '_' + Date.now()
      }
    },
    data: {
      type: type,
      params: JSON.stringify(params)
    }
  };
}

function getEnglishText(type, params) {
  switch (type) {
    case 'tiamat_spawn':
      return { title: '🏴‍☠️ Tiamat Awakened!', body: 'Captain! Tiamat has risen. The most fearsome sea monster awaits you!' };
    case 'admiral_spawn':
      return { title: '⚓ Admiral Spotted!', body: 'Admiral spotted at Map ' + (params.map || '?') + '-' + (params.sub || '?') + '! Attack now!' };
    case 'inactive_reminder':
      return { title: '🏴‍☠️ Fair Winds!', body: 'Captain! Tiamat and Admiral roam the seas. Set sail, battle awaits!' };
    default:
      return { title: 'SeaPirates', body: '' };
  }
}

async function sendPush(playerId, type, params = {}) {
  if (!initFirebase()) return;
  try {
    const res = await pool.query('SELECT token FROM fcm_tokens WHERE player_id = $1', [playerId]);
    if (res.rows.length === 0) return;

    const en = getEnglishText(type, params);
    for (const row of res.rows) {
      try {
        await admin.messaging().send(buildMessage(row.token, type, params, en.title, en.body));
      } catch (err) {
        if (err.code === 'messaging/invalid-registration-token' || err.code === 'messaging/registration-token-not-registered') {
          await pool.query('DELETE FROM fcm_tokens WHERE token = $1', [row.token]);
        }
      }
    }
  } catch (err) {
    console.error('[FCM] sendPush error:', err.message);
  }
}

async function sendPushToAll(type, params = {}) {
  if (!initFirebase()) return;
  try {
    const res = await pool.query('SELECT token FROM fcm_tokens');
    if (res.rows.length === 0) return;

    const en = getEnglishText(type, params);
    for (const row of res.rows) {
      try {
        await admin.messaging().send(buildMessage(row.token, type, params, en.title, en.body));
      } catch (err) {
        if (err.code === 'messaging/invalid-registration-token' || err.code === 'messaging/registration-token-not-registered') {
          await pool.query('DELETE FROM fcm_tokens WHERE token = $1', [row.token]);
        }
      }
    }
  } catch (err) {
    console.error('[FCM] sendPushToAll error:', err.message);
  }
}

module.exports = { sendPush, sendPushToAll };
