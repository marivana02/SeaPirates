const pool = require('../config/db');

const SHIP_HP = [10000, 25000, 36000, 48000, 62000, 78000, 96000, 116000, 138000, 162000, 190000];
const BOT_MAP_LEVEL = 10;

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const botHpState = new Map();
let activeBotIds = null; // kalıcı max 3 bot ID'si — her tick'te farklı bot seçilmez

function getActivityFactor(realPlayerCount) {
  if (realPlayerCount === 0) return 1.0;
  if (realPlayerCount === 1) return 0.75;
  if (realPlayerCount === 2) return 0.60;
  if (realPlayerCount <= 5)  return 0.40;
  if (realPlayerCount <= 10) return 0.20;
  return 0.10;
}

const BOT_ENABLED = false; // DEBUG: botlar devre dışı

async function botTick() {
  if (!BOT_ENABLED) return;
  try {
    const tiamatRes = await pool.query(
      `SELECT hp, current_hp FROM tiamat WHERE id = 1`
    );
    if (tiamatRes.rows.length === 0) return;
    const tiamat = tiamatRes.rows[0];
    const maxHp = parseInt(tiamat.hp) || 12000000;
    const currentHp = tiamat.current_hp !== null ? parseInt(tiamat.current_hp) : null;
    if (!currentHp || currentHp <= 0) return;

    const realCount = await pool.query(
      `SELECT COUNT(*) as c FROM players
       WHERE current_map_level = $1 AND (is_bot = FALSE OR is_bot IS NULL)`,
      [BOT_MAP_LEVEL]
    );
    const realPlayers = parseInt(realCount.rows[0].c);
    const factor = getActivityFactor(realPlayers);

    const botRows = await pool.query(
      `SELECT id, username, max_hp, ship_level FROM players
       WHERE bot_map_level = $1 AND is_bot = TRUE`,
      [BOT_MAP_LEVEL]
    );

    if (botRows.rows.length === 0) return;

    // Kalıcı max 3 bot seç — sadece ilk tick'te shuffle yap, sonra hep aynı botları kullan
    if (!activeBotIds) {
      const allShuffled = [...botRows.rows].sort(() => Math.random() - 0.5);
      const count = Math.max(1, Math.min(3, Math.ceil(botRows.rows.length * factor)));
      activeBotIds = new Set(allShuffled.slice(0, count).map(r => r.id));
    }
    const selected = botRows.rows.filter(r => activeBotIds.has(r.id));
    if (selected.length === 0) return;

    let totalBotDamage = 0;
    const damageRecords = [];

    for (const bot of selected) {
      let state = botHpState.get(bot.id);
      if (!state) {
        state = { currentHp: bot.max_hp, maxHp: bot.max_hp };
        botHpState.set(bot.id, state);
      }
      state.currentHp = Math.min(state.maxHp, state.currentHp + Math.floor(state.maxHp * 0.03));

      const tiamatDmgBack = rand(Math.floor(bot.max_hp * 0.02), Math.floor(bot.max_hp * 0.06));
      state.currentHp = Math.max(Math.floor(bot.max_hp * 0.01), state.currentHp - tiamatDmgBack);

      const basePerLevel = bot.ship_level * 2000 + 5000;
      const burst = Math.random() < 0.25 ? rand(2, 3) : 1;
      const damage = Math.floor(basePerLevel * (0.7 + Math.random() * 1.3) * burst);
      if (damage <= 0) continue;

      totalBotDamage += damage;
      damageRecords.push({
        id: bot.id,
        username: bot.username,
        shipLevel: bot.ship_level,
        damage,
        currentHp: state.currentHp,
        maxHp: bot.max_hp
      });
    }

    if (damageRecords.length === 0 || totalBotDamage <= 0) return;

    const tiamatClient = await pool.connect();
    try {
      await tiamatClient.query('BEGIN');
      const lockRes = await tiamatClient.query(
        'SELECT current_hp FROM tiamat WHERE id = 1 FOR UPDATE'
      );
      let lockedHp = lockRes.rows[0].current_hp !== null ? parseInt(lockRes.rows[0].current_hp) : 0;
      if (lockedHp <= 0) {
        await tiamatClient.query('ROLLBACK');
        return;
      }
      const newHp = Math.max(0, lockedHp - totalBotDamage);
      await tiamatClient.query(
        'UPDATE tiamat SET current_hp = $1 WHERE id = 1',
        [newHp]
      );

      for (const rec of damageRecords) {
        await tiamatClient.query(
          `INSERT INTO tiamat_damage (player_id, username, ship_level, damage_dealt, current_hp, max_hp, spawn_generation)
           SELECT $1,$2,$3,$4,$5,$6, spawn_generation FROM tiamat WHERE id = 1
           ON CONFLICT (player_id) DO UPDATE SET
             damage_dealt = tiamat_damage.damage_dealt + $4,
             current_hp = $5,
             max_hp = $6,
             ship_level = $3,
             spawn_generation = (SELECT spawn_generation FROM tiamat WHERE id = 1),
             last_active = CURRENT_TIMESTAMP`,
          [rec.id, rec.username, rec.shipLevel, rec.damage, rec.currentHp, rec.maxHp]
        );
      }
      await tiamatClient.query('COMMIT');
    } catch (err) {
      await tiamatClient.query('ROLLBACK');
      console.error('[BOT TIAMAT] Lock error:', err.message);
      return;
    } finally {
      tiamatClient.release();
    }

    const after = await pool.query(
      'SELECT current_hp FROM tiamat WHERE id = 1'
    );
    if (after.rows.length > 0 && after.rows[0].current_hp !== null && parseInt(after.rows[0].current_hp) <= 0) {
      activeBotIds = null; // yeni spawn için yeni botlar seçilebilir
      const { distributeTiamatRewards } = require('../helpers/combat');

      // Gerçek oyuncu hasar kaydı var mı kontrol et — varsa bot dağıtmasın, oyuncu dağıtsın
      const realCount = await pool.query(
        `SELECT COUNT(*) as c FROM tiamat_damage td
         JOIN players p ON p.id = td.player_id
         WHERE (p.is_bot = FALSE OR p.is_bot IS NULL) AND td.damage_dealt > 0
           AND td.spawn_generation = (SELECT spawn_generation FROM tiamat WHERE id = 1)`
      );
      if (parseInt(realCount.rows[0].c) > 0) {
        console.log('[BOT TIAMAT] Real players participated — bot skipping reward distribution');
      } else {
        distributeTiamatRewards(null)
          .then(() => console.log(`[BOT TIAMAT] Tiamat killed by bots only — rewards distributed`))
          .catch(err => console.error(`[BOT TIAMAT] Reward error:`, err.message));
      }
    }
  } catch (err) {
    console.error('[BOT TIAMAT] Tick error:', err.message);
  } finally {
    // setInterval yerine recursive setTimeout — tick birikmesini önler
    tickTimer = setTimeout(botTick, TICK_INTERVAL_MS);
  }
}

const TICK_INTERVAL_MS = 10000;
let tickTimer = null;

function startTiamatBotTicks() {
  console.log(`[BOT TIAMAT] System DISABLED — botlar Tiamat'a saldırmıyor`);
  // Botlar şu an devre dışı — hata ayıklama tamamlanınca aktif edilecek
  // tickTimer = setTimeout(botTick, TICK_INTERVAL_MS);
}

function stopTiamatBotTicks() {
  if (tickTimer) {
    clearTimeout(tickTimer);
    tickTimer = null;
    activeBotIds = null;
    console.log('[BOT TIAMAT] System stopped');
  }
}

module.exports = { startTiamatBotTicks, stopTiamatBotTicks };
