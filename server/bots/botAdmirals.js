const pool = require('../config/db');
const bcrypt = require('bcryptjs');

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

const botHpState = new Map(); // botId → { currentHp, maxHp }

function getActivityFactor(realPlayerCount) {
  if (realPlayerCount === 0) return 1.0;
  if (realPlayerCount === 1) return 0.75;
  if (realPlayerCount === 2) return 0.60;
  if (realPlayerCount <= 5)  return 0.40;
  if (realPlayerCount <= 10) return 0.20;
  return 0.10;
}

async function ensureBotAccounts() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM players WHERE is_bot = TRUE`);

    const hashedPassword = await bcrypt.hash('bot_admiral_2026', 10);
    let total = 0;

    for (let mapLevel = 1; mapLevel <= 10; mapLevel++) {
      const names = BOT_NAMES[mapLevel];
      if (!names) continue;
      total += names.length;

      for (let idx = 0; idx < names.length; idx++) {
        const nick = names[idx];
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

        if (result.rows.length === 0) continue;
        const botId = result.rows[0].id;

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
    console.log(`[BOT] ${total} admiral bot accounts ready`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[BOT] Error creating bot accounts:', err.message);
  } finally {
    client.release();
  }
}

async function botTick() {
  try {
    const spawned = await pool.query(
      `SELECT map_level, boss_current_hp, boss_max_hp
       FROM npc3_kill_counter
       WHERE is_spawned = TRUE AND boss_current_hp > 0`
    );

    for (const map of spawned.rows) {
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
        `SELECT id, username, max_hp, ship_level, active_design FROM players
         WHERE bot_map_level = $1 AND is_bot = TRUE`,
        [mapLevel]
      );

      if (botRows.rows.length === 0) continue;

      const count = Math.max(1, Math.floor(botRows.rows.length * factor));
      const dmgFactor = count / botRows.rows.length;

      for (const bot of botRows.rows) {
        let state = botHpState.get(bot.id);
        if (!state) {
          state = { currentHp: bot.max_hp, maxHp: bot.max_hp };
          botHpState.set(bot.id, state);
        }

        // Heal 3% per tick
        state.currentHp = Math.min(state.maxHp, state.currentHp + Math.floor(state.maxHp * 0.03));

        // Admiral deals damage back
        const admiralDmg = rand(Math.floor(bot.max_hp * 0.02), Math.floor(bot.max_hp * 0.08));
        state.currentHp = Math.max(Math.floor(bot.max_hp * 0.01), state.currentHp - admiralDmg);

        const basePerLevel = bot.ship_level * 2500 + mapLevel * 1500;
        const burst = Math.random() < 0.30 ? rand(2, 4) : 1;
        const damage = Math.floor(basePerLevel * (0.5 + Math.random() * 1.5) * burst * dmgFactor);
        if (damage <= 0) continue;

        const updates = [
          pool.query(
            `UPDATE npc3_kill_counter
             SET boss_current_hp = GREATEST(0, boss_current_hp - $1)
             WHERE map_level = $2 AND is_spawned = TRUE`,
            [damage, mapLevel]
          ),
          pool.query(
            `INSERT INTO admiral_damage (map_level, player_id, username, ship_level, damage_dealt, current_hp, max_hp)
             VALUES ($1,$2,$3,$4,$5,$6,$7)
             ON CONFLICT (map_level, player_id) DO UPDATE SET
               damage_dealt = admiral_damage.damage_dealt + $5,
               current_hp = $6,
               max_hp = $7,
               ship_level = $4,
               last_active = CURRENT_TIMESTAMP`,
            [mapLevel, bot.id, bot.username, bot.ship_level, damage, state.currentHp, bot.max_hp]
          )
        ];
        await Promise.all(updates);
      }

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
    }
  } catch (err) {
    console.error('[BOT] Tick error:', err.message);
  }
}

let intervalHandle = null;

function startBotTicks() {
  ensureBotAccounts().then(() => {
    console.log('[BOT] Admiral bot system started (10s interval)');
    intervalHandle = setInterval(botTick, 10000);
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
