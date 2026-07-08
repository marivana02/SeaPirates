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

function buildMessage(token, type, params, title, body) {
  return {
    token,
    notification: {
      title,
      body
    },
    android: {
      priority: 'high',
      notification: {
        channelId: 'Push Notifications',
        priority: 'high',
        sound: 'default',
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

function getNotificationText(type, params) {
  switch (type) {
    case 'tiamat_spawn':
      return { title: '🏴‍☠️ TİAMAT UYANDI!', body: 'Kaptan! Tiamat yeniden doğdu. Denizlerin en korkunç canavarı seni bekliyor!' };
    case 'admiral_spawn':
      const aName = params.name || 'Amiral';
      return { title: `⚓ ${aName} GÖRÜLDÜ!`, body: `${aName} Harita ${params.map || '?'}-${params.sub || '?'}'de göründü, hemen saldır!` };
    case 'inactive_reminder':
      return { title: '🏴‍☠️ RÜZGAR ELVERİŞLİ!', body: 'Kaptan! Tiamat ve Admiral denizlerde. Yelkenleri fora, savaş seni bekliyor!' };
    default:
      return { title: 'SeaPirates', body: '' };
  }
}

async function sendPush(playerId, type, params = {}) {
  if (!initFirebase()) return;
  try {
    const res = await pool.query('SELECT token FROM fcm_tokens WHERE player_id = $1', [playerId]);
    if (res.rows.length === 0) return;

    const tr = getNotificationText(type, params);
    for (const row of res.rows) {
      try {
        await admin.messaging().send(buildMessage(row.token, type, params, tr.title, tr.body));
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

async function sendPushToAll(type, params = {}, mapLevel, subMap) {
  if (!initFirebase()) return;
  try {
    let query = 'SELECT token FROM fcm_tokens';
    let queryParams = [];
    if (mapLevel != null) {
      query = `SELECT ft.token FROM fcm_tokens ft JOIN players p ON p.id = ft.player_id WHERE ABS(p.current_map_level - $1) <= 1`;
      queryParams = [mapLevel];
      if (subMap != null && mapLevel <= 4) {
        query += ` AND p.current_map_sub = $${queryParams.length + 1}`;
        queryParams.push(subMap);
      }
    }
    const res = await pool.query(query, queryParams);
    if (res.rows.length === 0) return;

    const tr = getNotificationText(type, params);
    for (const row of res.rows) {
      try {
        await admin.messaging().send(buildMessage(row.token, type, params, tr.title, tr.body));
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

async function sendPushToAllCustom(title, body, type = 'custom', params = {}) {
  if (!initFirebase()) return;
  try {
    const res = await pool.query('SELECT token FROM fcm_tokens');
    if (res.rows.length === 0) return;
    for (const row of res.rows) {
      try {
        await admin.messaging().send(buildMessage(row.token, type, params, title, body));
      } catch (err) {
        if (err.code === 'messaging/invalid-registration-token' || err.code === 'messaging/registration-token-not-registered') {
          await pool.query('DELETE FROM fcm_tokens WHERE token = $1', [row.token]);
        }
      }
    }
  } catch (err) {
    console.error('[FCM] sendPushToAllCustom error:', err.message);
  }
}

module.exports = { sendPush, sendPushToAll, sendPushToAllCustom };
