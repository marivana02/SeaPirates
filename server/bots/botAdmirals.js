const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const { broadcastBossHp } = require('../helpers/socket');

const BOT_NAMES = {
  1:  ['LoneWolf','Sapphire','Crimson','IronWill','SwiftWind','RedTide','Stormy','CopperBeard','SaltyDog','BraveHeart','GoldenHawk','SilverFox','DarkOmen','FirstMate','OldSalt'],
  2:  ['SailorBlue','NorthStar','Ironclad','WaveBreaker','SeaSerpent','CoralReef','DeepSix','Barnacle','Anchor','MastMaker','Rigger','Buccaneer','Privateer','Marooner','Freebooter'],
  3:  ['GhostRider','Phantom','Stormborn','Thunder','Lightning','StormSurge','Typhoon','Monsoon','Tornado','Whirlwind','GaleForce','Tempest','Squall','Cyclone','Zephyr'],
  4:  ['Knightfall','Reaper','Corsair','Huntsman','Ravager','Plunderer','Marauder','Raider','Pillager','Looter','Sacker','Despoiler','Forager','Vulture','Jackal'],
  5:  ['Shadowfax','Dragonsoul','Blackhawk','WhiteFalcon','RedTalon','IronEagle','StormCrow','ThunderBird','FireHawk','GoldenEagle','SilverHawk','DarkRaven','BlueJay','ScarletMacaw','BaldEagle'],
  6:  ['DeadEye','CaptainSparrow','Nighthawk','StormReaper','Bloodstorm','RedBeard','BlackPearl','SilverFish','GoldenAge','IronSide','CoastGuard','DeepWater','HighTide','LowTide','Riptide'],
  7:  ['ThunderLord','Stormweaver','DarkMagic','IronSword','ScorpionKing','Sidewinder','Cobra','Anaconda','Python','Boa','Rattler','Mamba','Asp','Serpent','Dragon'],
  8:  ['Praetorian','DemonHunter','Kingslayer','Vikingr','Bladestorm','Barbarian','Berserker','Warlock','Paladin','Crusader','Sentinel','Guardian','Champion','Warden','Templar'],
  9:  ['Immortal','Shadowalker','Darkness','Nightmare','Zealot','MadDog','WildHog','IronBoar','ThunderHorn','StormHoof','SilverStag','GoldenRam','DarkWolf','RedFox','MountainLion'],
  10: ['HighKing','Deathbringer','Copperhead','BlackArrow','Eternal','Warlord','Nemesis','IronReign','StormKing','FireLord','IceQueen','ShadowQueen','DarkEmperor','CrimsonKing','SilverPrince','GoldenEmpress','BronzeTitan','Obsidian','Ruby','Emerald']
};

const SHIP_HP = [10000, 25000, 36000, 48000, 62000, 78000, 96000, 116000, 138000, 162000, 190000];
const LEVEL_XP = [0, 0, 3000, 8000, 18000, 38000, 75000, 140000, 260000, 480000, 900000];
const DESIGNS = ['kristal_queen', 'seahawk'];

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const botHpState = new Map(); // botId → { currentHp, maxHp, cooldown: 0, dead: false, respawnTick: 0 }

// Her harita için maksimum bot sayısı
const MAX_BOTS_PER_MAP = [0, 2, 2, 3, 4, 5, 6, 6, 7, 8, 10]; // index = map level
// Botların oyuna katılma süresi (tick cinsinden, 1 tick = 10sn)
const JOIN_WINDOW = 6; // botlar 60sn içinde kademeli katılır

const botJoinState = new Map(); // botId → joinTick (hangi tick'te katılacağı)

function getActivityFactor(realPlayerCount) {
  if (realPlayerCount === 0) return 1.0;
  if (realPlayerCount === 1) return 0.60;
  if (realPlayerCount === 2) return 0.40;
  if (realPlayerCount <= 5)  return 0.25;
  if (realPlayerCount <= 10) return 0.15;
  return 0.08;
}

// Global tick sayacı — bot katılımını zamanla yaymak için
let globalTick = 0;

function scheduleBotJoin(botId) {
  const delay = rand(1, JOIN_WINDOW);
  botJoinState.set(botId, globalTick + delay);
}

function isBotJoined(botId) {
  const joinTick = botJoinState.get(botId);
  return joinTick !== undefined && globalTick >= joinTick;
}

async function ensureBotAccounts() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM tiamat_damage WHERE player_id IN (SELECT id FROM players WHERE is_bot = TRUE OR bot_map_level IS NOT NULL)`);
    await client.query(`DELETE FROM admiral_damage WHERE player_id IN (SELECT id FROM players WHERE is_bot = TRUE OR bot_map_level IS NOT NULL)`);
    await client.query(`DELETE FROM active_fights WHERE player_id IN (SELECT id FROM players WHERE is_bot = TRUE OR bot_map_level IS NOT NULL)`);

    const hashedPassword = await bcrypt.hash('bot_admiral_2026', 10);
    let total = 0;
    let created = 0;
    let skipped = 0;

    for (let mapLevel = 1; mapLevel <= 10; mapLevel++) {
      const names = BOT_NAMES[mapLevel];
      if (!names) continue;
      const maxCount = MAX_BOTS_PER_MAP[mapLevel] || 5;
      const chosenNames = names.slice(0, maxCount);
      total += chosenNames.length;

      for (let idx = 0; idx < chosenNames.length; idx++) {
        const nick = chosenNames[idx];
        const baseLevel = Math.max(0, mapLevel - 1);
        const minLvl = Math.max(0, baseLevel - 2);
        const maxLvl = Math.min(10, baseLevel + 2);
        const shipLevel = rand(minLvl, maxLvl);
        const maxHp = SHIP_HP[shipLevel] || 10000;
        const xp = LEVEL_XP[mapLevel] || 0;
        const gold = rand(50000, 500000);
        const pearl = rand(500, 5000);
        const elitePoints = rand(5000, mapLevel * 15000);
        const dmgPve = rand(100000, mapLevel * 200000);

        const designRoll = Math.random();
        const hasDesign = designRoll < 0.6;
        const activeDesign = hasDesign ? DESIGNS[designRoll < 0.3 ? 0 : 1] : null;

        const pvpPoints = rand(0, mapLevel * 30);

        const result = await client.query(
          `INSERT INTO players (
            username, display_name, email, password,
            gold, pearl, xp, level,
            elite_points, ship_level, hp, max_hp,
            dmg_pve, has_elite_ship, is_bot, bot_map_level,
            current_map_level, active_design, pvp_points
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,true,$15,$16,$17,$18)
          ON CONFLICT (username) DO NOTHING
          RETURNING id`,
          [
            nick, nick, `bot_map${mapLevel}_${idx}@bot.sea`, hashedPassword,
            gold, pearl, xp, mapLevel,
            elitePoints, shipLevel, maxHp, maxHp,
            dmgPve, shipLevel >= 1, mapLevel, mapLevel,
            activeDesign, pvpPoints
          ]
        );

        const isNew = result.rowCount > 0;
        if (isNew) created++;

        const botId = result.rows[0]?.id;
        if (!botId) { skipped++; continue; }

        if (activeDesign) {
          await client.query(
            `INSERT INTO player_designs (player_id, design_key)
             VALUES ($1, $2)
             ON CONFLICT (player_id, design_key) DO NOTHING`,
            [botId, activeDesign]
          );
        }

        // PvP ekipmanı: toplar
        const cannonQty = rand(5, 15);
        const cannonEq = Math.min(cannonQty, 10 + shipLevel * 2);
        await client.query(
          `INSERT INTO player_cannons (player_id, cannon_type, quantity, equipped)
           VALUES ($1, 1, $2, $3)
           ON CONFLICT (player_id, cannon_type) DO UPDATE SET quantity = EXCLUDED.quantity, equipped = EXCLUDED.equipped`,
          [botId, cannonQty, cannonEq]
        );

        if (shipLevel >= 2) {
          await client.query(
            `INSERT INTO player_cannons (player_id, cannon_type, quantity, equipped)
             VALUES ($1, 2, $2, $3)
             ON CONFLICT (player_id, cannon_type) DO UPDATE SET quantity = EXCLUDED.quantity, equipped = EXCLUDED.equipped`,
            [botId, rand(5, 12), rand(3, 10)]
          );
        }

        if (shipLevel >= 5) {
          await client.query(
            `INSERT INTO player_cannons (player_id, cannon_type, quantity, equipped)
             VALUES ($1, 3, $2, $3)
             ON CONFLICT (player_id, cannon_type) DO UPDATE SET quantity = EXCLUDED.quantity, equipped = EXCLUDED.equipped`,
            [botId, rand(3, 10), rand(2, 8)]
          );
        }

        // Gülle
        await client.query(
          `INSERT INTO player_ammo (player_id, ammo_type, quantity)
           VALUES ($1, 1, $2), ($1, 2, $3), ($1, 3, $4)
           ON CONFLICT (player_id, ammo_type) DO UPDATE SET quantity = EXCLUDED.quantity`,
          [botId, rand(500, 5000), rand(200, 3000), rand(0, 1500)]
        );

        // Barut & zırh
        await client.query(
          `INSERT INTO player_items (player_id, item_type, quantity)
           VALUES ($1, 'barut', $2), ($1, 'zirh', $3)
           ON CONFLICT (player_id, item_type) DO UPDATE SET quantity = EXCLUDED.quantity`,
          [botId, rand(50, 500), rand(50, 500)]
        );

        // Tahta
        await client.query(
          `INSERT INTO player_planks (player_id, plank_type, quantity, equipped)
           VALUES ($1, 'tahta', $2, $3)
           ON CONFLICT (player_id, plank_type) DO UPDATE SET quantity = EXCLUDED.quantity, equipped = EXCLUDED.equipped`,
          [botId, rand(5, 30), rand(2, 10)]
        );
      }
    }

    await client.query('COMMIT');
    const botCount = await pool.query("SELECT COUNT(*) as c FROM players WHERE is_bot = TRUE");
    console.log(`[BOT] ${total} bot accounts wanted, ${created} new created, ${total - created} already existed (total bot accounts: ${botCount.rows[0].c})`);
    const sample = await pool.query("SELECT username FROM players WHERE is_bot = TRUE LIMIT 3");
    if (sample.rows.length > 0) {
      console.log('[BOT] Sample:', sample.rows.map(r => r.username).join(', '));
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[BOT] Error creating bot accounts:', err.message, err.stack ? err.stack.split('\n')[0] : '');
  } finally {
    client.release();
  }
}

async function botTick() {
  try {
    globalTick++;

    const spawned = await pool.query(
      `SELECT map_level, boss_current_hp, boss_max_hp
       FROM npc3_kill_counter
       WHERE is_spawned = TRUE AND boss_current_hp > 0`
    );
    if (spawned.rows.length > 0) {
      console.log(`[BOT] Tick ${globalTick} — ${spawned.rows.length} active admirals:`, spawned.rows.map(r => `map${r.map_level}=${r.boss_current_hp}`).join(', '));
    }

    for (const map of spawned.rows) {
      try {
        const mapLevel = map.map_level;
        const bossHp = parseInt(map.boss_current_hp);

        if (!bossHp || bossHp <= 0) continue;

        const realCount = await pool.query(
          `SELECT COUNT(*) as c FROM players
           WHERE current_map_level = $1 AND (is_bot = FALSE OR is_bot IS NULL)`,
          [mapLevel]
        );
        const realPlayers = parseInt(realCount.rows[0].c);
        const factor = getActivityFactor(realPlayers);

        const botRows = await pool.query(
          `SELECT p.id, p.username, p.max_hp, p.ship_level, p.active_design,
                  COALESCE(
                    (SELECT ROUND(SUM(pc.equipped * c.reload_time_ms)::decimal / NULLIF(SUM(pc.equipped), 0))
                     FROM player_cannons pc
                     JOIN cannons c ON c.id = pc.cannon_type
                     WHERE pc.player_id = p.id AND pc.equipped > 0),
                    2500
                  ) as reload_ms
           FROM players p
           WHERE p.bot_map_level = $1 AND p.is_bot = TRUE`,
          [mapLevel]
        );

        // Bot katılımını zamanla yay
        for (const bot of botRows.rows) {
          if (!botJoinState.has(bot.id)) {
            scheduleBotJoin(bot.id);
          }
        }

        // Sadece katılmış ve ölmemiş botları kullan
        let activeBots = botRows.rows.filter(b => isBotJoined(b.id));

        // Ölü botları çıkar, respawn süresi dolanları geri getir
        activeBots = activeBots.filter(b => {
          const s = botHpState.get(b.id);
          if (!s) return true;
          if (s.dead) {
            if (globalTick >= s.respawnTick) {
              s.dead = false;
              s.currentHp = b.max_hp;
              s.lastAttackTick = globalTick + rand(1, 3);
              pool.query(
                `UPDATE admiral_damage SET current_hp = $1, max_hp = $2 WHERE map_level = $3 AND player_id = $4`,
                [b.max_hp, b.max_hp, mapLevel, b.id]
              ).catch(() => {});
              return true;
            }
            return false;
          }
          return true;
        });
        // Ölü bot sayısını logla
        const deadCount = botRows.rows.filter(b => {
          const s = botHpState.get(b.id);
          return s && s.dead;
        }).length;

        // Her tick farklı botlar seçilsin diye karıştır
        const shuffled = [...activeBots].sort(() => Math.random() - 0.5);
        const maxJoin = Math.max(1, Math.floor(MAX_BOTS_PER_MAP[mapLevel] || 5));
        const maxActive = Math.max(1, Math.floor(maxJoin * factor));
        const attackingBots = shuffled.slice(0, maxActive);

        console.log(`[BOT] Map ${mapLevel}: ${realPlayers} real, ${botRows.rows.length} total, ${activeBots.length} alive, ${deadCount} dead, ${attackingBots.length} attacking, factor=${factor}`);

        if (attackingBots.length === 0) continue;

        const dmgFactor = Math.max(0.3, Math.min(1.0, maxActive / (botRows.rows.length || 1)));

        for (const bot of attackingBots) {
          try {
            let state = botHpState.get(bot.id);
            if (!state) {
              state = { currentHp: bot.max_hp, maxHp: bot.max_hp, lastAttackTick: 0, dead: false, respawnTick: 0 };
              botHpState.set(bot.id, state);
            }

            // Ölü bot atlar
            if (state.dead) continue;

            // Respawn beklemesi (lastAttackTick gelecekteyse henüz hazır değil)
            if (state.lastAttackTick > globalTick) continue;

            // Reload süresine göre saldırı
            const reloadMs = bot.reload_ms || 2500;
            const tickMs = 10000;
            const elapsedMs = (globalTick - state.lastAttackTick) * tickMs;
            const attacksPerTick = Math.max(1, Math.floor(tickMs / reloadMs));

            // İlk saldırı veya reload süresi dolduysa
            if (state.lastAttackTick > 0 && elapsedMs < reloadMs) continue;

            // Admiral hasarı: bot can kaybeder
            const admiralDmg = rand(Math.floor(bot.max_hp * 0.02), Math.floor(bot.max_hp * 0.08));
            state.currentHp -= admiralDmg;

            // Bot öldü mü?
            if (state.currentHp <= 0) {
              state.dead = true;
              state.respawnTick = globalTick + rand(4, 10); // 40-100sn sonra geri gel
              state.currentHp = 0;
              continue;
            }

            // Hafif can yenileme
            state.currentHp = Math.min(state.maxHp, state.currentHp + Math.floor(state.maxHp * 0.02));

            // Hasar: reload hızına göre tick başına atış sayısı kadar vur
            const basePerLevel = bot.ship_level * 2500 + mapLevel * 1500;
            const burst = Math.random() < 0.30 ? rand(2, 4) : 1;
            const singleShot = Math.floor(basePerLevel * (0.5 + Math.random() * 1.5) * burst * dmgFactor);
            const damage = singleShot * attacksPerTick;

            if (damage <= 0) continue;

            // Saldırı zamanını kaydet
            state.lastAttackTick = globalTick;

            const txBot = await pool.connect();
            try {
              await txBot.query('BEGIN');
              await txBot.query(
                `UPDATE npc3_kill_counter
                 SET boss_current_hp = GREATEST(0, boss_current_hp - $1)
                 WHERE map_level = $2 AND is_spawned = TRUE`,
                [damage, mapLevel]
              );
              await txBot.query(
                `INSERT INTO admiral_damage (map_level, player_id, username, ship_level, damage_dealt, current_hp, max_hp)
                 VALUES ($1,$2,$3,$4,$5,$6,$7)
                 ON CONFLICT (map_level, player_id) DO UPDATE SET
                   damage_dealt = admiral_damage.damage_dealt + $5,
                   current_hp = $6,
                   max_hp = $7,
                   ship_level = $4,
                   last_active = CURRENT_TIMESTAMP`,
                [mapLevel, bot.id, bot.username, bot.ship_level, damage, state.currentHp, bot.max_hp]
              );
              await txBot.query('COMMIT');
            } catch (txErr) {
              await txBot.query('ROLLBACK');
              throw txErr;
            } finally {
              txBot.release();
            }
            } catch (e) {
            console.error(`[BOT] Bot ${bot.id} damage error map ${mapLevel}:`, e.message, e.stack ? e.stack.split('\n')[0] : '');
          }
        }

        const lbRes = await pool.query(
          `SELECT a.player_id, a.username, a.ship_level, a.damage_dealt, a.current_hp, a.max_hp, p.active_design
           FROM admiral_damage a
           JOIN players p ON p.id = a.player_id
           WHERE a.map_level = $1 AND a.player_id > 0
           ORDER BY a.damage_dealt DESC LIMIT 30`,
          [mapLevel]
        );
        console.log(`[BOT] Map ${mapLevel} leaderboard: ${lbRes.rows.length} entries`, lbRes.rows.map(r => `${r.username}=${r.damage_dealt}`).join(', '));
        const hpRes = await pool.query(
          `SELECT boss_current_hp FROM npc3_kill_counter WHERE map_level = $1`,
          [mapLevel]
        );
        const currentHp = hpRes.rows.length > 0 ? parseInt(hpRes.rows[0].boss_current_hp) : 0;
        broadcastBossHp(mapLevel, {
          bossHp: currentHp,
          bossMaxHp: parseInt(map.boss_max_hp),
          leaderboard: lbRes.rows
        });

        const after = await pool.query(
          `SELECT boss_current_hp FROM npc3_kill_counter WHERE map_level = $1`,
          [mapLevel]
        );
        if (after.rows.length > 0 && after.rows[0].boss_current_hp !== null && parseInt(after.rows[0].boss_current_hp) <= 0) {
          const { distributeAdmiralRewards } = require('../helpers/combat');
          distributeAdmiralRewards(mapLevel)
            .then(() => console.log(`[BOT] Admiral killed on map ${mapLevel} — rewards distributed`))
            .catch(err => console.error(`[BOT] Reward error map ${mapLevel}:`, err.message));
        }
      } catch (e) {
        console.error(`[BOT] Map ${map.map_level} tick error:`, e.message);
      }
    }
  } catch (err) {
    console.error('[BOT] Tick error:', err.message);
  }
}

let intervalHandle = null;

function startBotTicks() {
  console.log('[BOT] startBotTicks called — creating bot accounts...');
  ensureBotAccounts().then(() => {
    console.log('[BOT] Admiral bot system started (10s interval)');
    intervalHandle = setInterval(botTick, 10000);
  }).catch(err => {
    console.error('[BOT] ensureBotAccounts failed:', err.message, err.stack ? err.stack.split('\n')[0] : '');
  });
}

function stopBotTicks() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log('[BOT] Admiral bot system stopped');
  }
}

module.exports = { startBotTicks, stopBotTicks };
