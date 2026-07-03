const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const { broadcastBossHp } = require('../helpers/socket');
const BOT_CONFIG = require('../config/botConfig');

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

function isMapActive(mapLevel) {
  if (!BOT_CONFIG.enabled) return false;
  if (BOT_CONFIG.activeMaps.length === 0) return true;
  return BOT_CONFIG.activeMaps.includes(mapLevel);
}

const botHpState = new Map();
const MAX_BOTS_PER_MAP = [0, 2, 2, 3, 4, 5, 6, 6, 7, 8, 10];
const JOIN_WINDOW = 6;
const botJoinState = new Map();
const botRecentAuctionBidders = new Set();

let lastAuctionBidClearTick = 0;

function getActivityFactor(realPlayerCount) {
  if (realPlayerCount === 0) return 1.0;
  if (realPlayerCount === 1) return 0.60;
  if (realPlayerCount === 2) return 0.40;
  if (realPlayerCount <= 5)  return 0.25;
  if (realPlayerCount <= 10) return 0.15;
  return 0.08;
}

let globalTick = 0;

function scheduleBotJoin(botId) {
  const delay = rand(1, JOIN_WINDOW);
  botJoinState.set(botId, globalTick + delay);
}

function isBotJoined(botId) {
  const joinTick = botJoinState.get(botId);
  return joinTick !== undefined && globalTick >= joinTick;
}

async function ensureTestAccounts() {
  if (!BOT_CONFIG.testMode) return;
  const client = await pool.connect();
  try {
    const hashedPassword = await bcrypt.hash('test_account_2026', 10);
    let created = 0;
    for (let mapLevel = 1; mapLevel <= 10; mapLevel++) {
      const nick = BOT_CONFIG.testAccountNames[mapLevel - 1];
      const shipLevel = Math.min(mapLevel, 10);
      const maxHp = SHIP_HP[shipLevel] || 10000;
      const gold = rand(100000, 300000);
      const pearl = rand(2000, 8000);
      const xp = LEVEL_XP[mapLevel] || 0;
      const dmgPve = rand(200000, mapLevel * 300000);
      const elitePoints = rand(10000, mapLevel * 20000);
      const pvpPoints = rand(10, mapLevel * 40);

      const result = await client.query(
        `INSERT INTO players (
          username, display_name, email, password,
          gold, pearl, xp, level,
          elite_points, ship_level, hp, max_hp,
          dmg_pve, has_elite_ship, is_bot, bot_map_level,
          current_map_level, pvp_points
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,true,$15,$16,$17)
        ON CONFLICT (username) DO NOTHING
        RETURNING id`,
        [
          nick, nick, `test_map${mapLevel}@test.bot`, hashedPassword,
          gold, pearl, xp, mapLevel,
          elitePoints, shipLevel, maxHp, maxHp,
          dmgPve, shipLevel >= 1, mapLevel, mapLevel,
          pvpPoints
        ]
      );
      if (result.rowCount > 0) created++;

      const botId = result.rows[0]?.id;
      if (!botId) continue;

      await client.query(
        `INSERT INTO player_cannons (player_id, cannon_type, quantity, equipped)
         VALUES ($1, 1, $2, $3)
         ON CONFLICT (player_id, cannon_type) DO UPDATE SET quantity = EXCLUDED.quantity, equipped = EXCLUDED.equipped`,
        [botId, rand(8, 20), rand(5, 15)]
      );
      if (shipLevel >= 3) {
        await client.query(
          `INSERT INTO player_cannons (player_id, cannon_type, quantity, equipped)
           VALUES ($1, 2, $2, $3)
           ON CONFLICT (player_id, cannon_type) DO UPDATE SET quantity = EXCLUDED.quantity, equipped = EXCLUDED.equipped`,
          [botId, rand(5, 15), rand(3, 10)]
        );
      }
      if (shipLevel >= 6) {
        await client.query(
          `INSERT INTO player_cannons (player_id, cannon_type, quantity, equipped)
           VALUES ($1, 3, $2, $3)
           ON CONFLICT (player_id, cannon_type) DO UPDATE SET quantity = EXCLUDED.quantity, equipped = EXCLUDED.equipped`,
          [botId, rand(3, 10), rand(2, 8)]
        );
      }
      await client.query(
        `INSERT INTO player_ammo (player_id, ammo_type, quantity)
         VALUES ($1, 1, $2), ($1, 2, $3), ($1, 3, $4)
         ON CONFLICT (player_id, ammo_type) DO UPDATE SET quantity = EXCLUDED.quantity`,
        [botId, rand(1000, 8000), rand(500, 5000), rand(200, 3000)]
      );
      await client.query(
        `INSERT INTO player_items (player_id, item_type, quantity)
         VALUES ($1, 'barut', $2), ($1, 'zirh', $3)
         ON CONFLICT (player_id, item_type) DO UPDATE SET quantity = EXCLUDED.quantity`,
        [botId, rand(100, 800), rand(100, 800)]
      );
      await client.query(
        `INSERT INTO player_planks (player_id, plank_type, quantity, equipped)
         VALUES ($1, 'tahta', $2, $3)
         ON CONFLICT (player_id, plank_type) DO UPDATE SET quantity = EXCLUDED.quantity, equipped = EXCLUDED.equipped`,
        [botId, rand(10, 50), rand(3, 15)]
      );
      console.log(`[TEST] Test hesap oluşturuldu: ${nick} (map ${mapLevel}, id=${botId})`);
    }
    console.log(`[TEST] ${created} yeni test hesabı oluşturuldu`);
  } catch (err) {
    console.error('[TEST] Test hesap oluşturma hatası:', err.message);
  } finally {
    client.release();
  }
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
      if (!isMapActive(mapLevel)) continue;
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

        await client.query(
          `INSERT INTO player_ammo (player_id, ammo_type, quantity)
           VALUES ($1, 1, $2), ($1, 2, $3), ($1, 3, $4)
           ON CONFLICT (player_id, ammo_type) DO UPDATE SET quantity = EXCLUDED.quantity`,
          [botId, rand(500, 5000), rand(200, 3000), rand(0, 1500)]
        );

        await client.query(
          `INSERT INTO player_items (player_id, item_type, quantity)
           VALUES ($1, 'barut', $2), ($1, 'zirh', $3)
           ON CONFLICT (player_id, item_type) DO UPDATE SET quantity = EXCLUDED.quantity`,
          [botId, rand(50, 500), rand(50, 500)]
        );

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
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[BOT] Error creating bot accounts:', err.message, err.stack ? err.stack.split('\n')[0] : '');
  } finally {
    client.release();
  }
}

async function simulateBotActivity() {
  if (!BOT_CONFIG.enabled) return;
  try {
    const activeMapsClause = BOT_CONFIG.activeMaps.length > 0
      ? `AND bot_map_level = ANY($1::int[])`
      : ``;
    const params = BOT_CONFIG.activeMaps.length > 0
      ? [BOT_CONFIG.activeMaps]
      : [];
    const whereClause = `WHERE is_bot = TRUE AND (bot_map_level IS NOT NULL)`;
    const mapsFilter = BOT_CONFIG.activeMaps.length > 0
      ? `AND bot_map_level = ANY($1::int[])`
      : ``;

    const botRes = await pool.query(
      `SELECT id, username, gold, pearl, xp, dmg_pve, pvp_points, elite_points, bot_map_level, level
       FROM players WHERE is_bot = TRUE AND bot_map_level IS NOT NULL ${mapsFilter}`,
      params
    );

    if (botRes.rows.length === 0) return;

    let updated = 0;
    for (const bot of botRes.rows) {
      if (Math.random() > BOT_CONFIG.updatePercentPerCycle) continue;
      const ml = bot.bot_map_level;
      const goldInc = rand(100, ml * 200);
      const pearlInc = rand(5, ml * 5);
      const xpInc = rand(50, ml * 100);
      const dmgInc = rand(500, ml * 1500);
      const epInc = rand(20, ml * 50);
      const pvpInc = Math.random() < 0.10 ? rand(1, 3) : 0;

      await pool.query(
        `UPDATE players SET
          gold = gold + $1, pearl = pearl + $2, xp = xp + $3,
          dmg_pve = dmg_pve + $4, elite_points = elite_points + $5,
          pvp_points = pvp_points + $6
         WHERE id = $7`,
        [goldInc, pearlInc, xpInc, dmgInc, epInc, pvpInc, bot.id]
      );
      updated++;

      if (bot.username.startsWith('[Test]')) {
        console.log(`[TEST] Stat güncelleme ${bot.username}: +${goldInc} altın, +${pearlInc} inci, +${xpInc} XP, +${dmgInc} PvE, +${epInc} EP (toplam: altın=${bot.gold + goldInc}, inci=${bot.pearl + pearlInc}, XP=${bot.xp + xpInc})`);
      }
    }

    if (updated > 0) {
      const testBots = botRes.rows.filter(b => b.username.startsWith('[Test]'));
      if (testBots.length > 0) console.log(`[BOT] ${updated}/${botRes.rows.length} bot istatistik güncellendi (${testBots.length} test hesabı dahil)`);
    }
  } catch (err) {
    console.error('[BOT] Stat güncelleme hatası:', err.message);
  }
}

const ITEM_WEIGHTS = {
  barut: 25,
  zirh: 25,
  gul3: 20,
  top2: 12,
  top3: 5,
  elit_kiris: 8,
  gemi1: 3,
  kristal_queen_design: 2
};

function pickWeightedAuctionItem(items) {
  const totalWeight = items.reduce((sum, i) => sum + (ITEM_WEIGHTS[i.item_type] || 5), 0);
  let roll = rand(1, totalWeight);
  for (const item of items) {
    roll -= ITEM_WEIGHTS[item.item_type] || 5;
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

async function simulateAuctionBidding() {
  if (!BOT_CONFIG.enabled) return;
  try {
    const auctions = await pool.query(
      `SELECT id, item_type, current_price, starting_price, highest_bidder_id
       FROM auctions WHERE expires_at > NOW()`
    );
    if (auctions.rows.length === 0) return;

    const excludeIds = botRecentAuctionBidders.size > 0
      ? Array.from(botRecentAuctionBidders).slice(0, 50)
      : [];

    let eligibleBots;
    if (excludeIds.length > 0) {
      eligibleBots = await pool.query(
        `SELECT id, username, gold, bot_map_level FROM players
         WHERE is_bot = TRUE AND bot_map_level IS NOT NULL AND gold > 500
         AND id != ALL($1::int[])
         ORDER BY RANDOM() LIMIT $2`,
        [excludeIds, BOT_CONFIG.maxAuctionBidsPerCycle + 2]
      );
    } else {
      eligibleBots = await pool.query(
        `SELECT id, username, gold, bot_map_level FROM players
         WHERE is_bot = TRUE AND bot_map_level IS NOT NULL AND gold > 500
         ORDER BY RANDOM() LIMIT $1`,
        [BOT_CONFIG.maxAuctionBidsPerCycle + 2]
      );
    }

    if (eligibleBots.rows.length === 0) return;

    const selectedBots = eligibleBots.rows.sort(() => Math.random() - 0.5).slice(0, rand(2, BOT_CONFIG.maxAuctionBidsPerCycle));

    let totalBids = 0;
    for (const bot of selectedBots) {
      const item = pickWeightedAuctionItem(auctions.rows);
      if (!item) continue;

      const maxBid = Math.floor(bot.gold * 0.25);
      const increment = rand(1, Math.max(5, Math.floor(item.current_price * 0.15)));
      let bidAmount = item.current_price + increment;
      bidAmount = Math.min(bidAmount, maxBid);

      if (bidAmount <= item.current_price) continue;

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const pLock = await client.query(
          'SELECT gold FROM players WHERE id = $1 FOR UPDATE', [bot.id]
        );
        if (!pLock.rows.length || pLock.rows[0].gold < bidAmount) {
          await client.query('ROLLBACK');
          continue;
        }

        const aLock = await client.query(
          'SELECT * FROM auctions WHERE id = $1 AND expires_at > NOW() FOR UPDATE', [item.id]
        );
        if (!aLock.rows.length) {
          await client.query('ROLLBACK');
          continue;
        }

        const auction = aLock.rows[0];
        const isOwner = auction.highest_bidder_id === bot.id;

        if (bidAmount > auction.current_price) {
          const cost = isOwner ? bidAmount - auction.current_price : bidAmount;
          await client.query('UPDATE players SET gold = gold - $1 WHERE id = $2', [cost, bot.id]);
          if (!isOwner && auction.highest_bidder_id) {
            const prevOwner = auction.highest_bidder_id;
            await client.query(
              'UPDATE players SET gold = gold + $1 WHERE id = $2',
              [auction.current_price, prevOwner]
            );
            if (prevOwner !== bot.id) {
              const isPrevBot = await pool.query('SELECT is_bot, username FROM players WHERE id = $1', [prevOwner]);
              if (isPrevBot.rows.length > 0 && isPrevBot.rows[0].is_bot) {
                console.log(`[BOT] ${bot.username} teklif geçildi: ${isPrevBot.rows[0].username} (${auction.current_price} altın iade)`);
              }
            }
          }
          await client.query(
            'UPDATE auctions SET current_price = $1, highest_bidder_id = $2 WHERE id = $3',
            [bidAmount, bot.id, item.id]
          );
          totalBids++;

          const isTest = bot.username.startsWith('[Test]');
          if (isTest || Math.random() < 0.10) {
            console.log(`${isTest ? '[TEST]' : '[BOT]'} ${bot.username} → ${item.item_type}: ${bidAmount} altın teklif (güncel fiyat: ${bidAmount})`);
          }
        }

        await client.query('COMMIT');
        botRecentAuctionBidders.add(bot.id);
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
      } finally {
        client.release();
      }
    }

    const now = Date.now();
    if (now - lastAuctionBidClearTick > 3600000 || botRecentAuctionBidders.size > 60) {
      const prevSize = botRecentAuctionBidders.size;
      botRecentAuctionBidders.clear();
      lastAuctionBidClearTick = now;
      console.log(`[BOT] Açık artırma teklif rotasyonu temizlendi (${prevSize} kayıt → 0)`);
    }

    if (totalBids > 0) {
      console.log(`[BOT] ${totalBids} açık artırma teklifi verildi (${selectedBots.length} bot)`);
    }
  } catch (err) {
    console.error('[BOT] Açık artırma teklif hatası:', err.message);
  }
}

async function botTick() {
  try {
    globalTick++;

    const mapsFilter = BOT_CONFIG.activeMaps.length > 0
      ? `AND map_level = ANY(${BOT_CONFIG.activeMaps.join(',')})`
      : ``;

    const spawned = await pool.query(
      `SELECT map_level, boss_current_hp, boss_max_hp
       FROM npc3_kill_counter
       WHERE is_spawned = TRUE AND boss_current_hp > 0 ${mapsFilter}`
    );

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

        for (const bot of botRows.rows) {
          if (!botJoinState.has(bot.id)) {
            scheduleBotJoin(bot.id);
          }
        }

        let activeBots = botRows.rows.filter(b => isBotJoined(b.id));

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

        const shuffled = [...activeBots].sort(() => Math.random() - 0.5);
        const maxJoin = Math.max(1, Math.floor(MAX_BOTS_PER_MAP[mapLevel] || 5));
        const maxActive = Math.max(1, Math.floor(maxJoin * factor));
        const attackingBots = shuffled.slice(0, maxActive);

        if (attackingBots.length === 0) continue;

        const dmgFactor = Math.max(0.3, Math.min(1.0, maxActive / (botRows.rows.length || 1)));

        for (const bot of attackingBots) {
          try {
            let state = botHpState.get(bot.id);
            if (!state) {
              state = { currentHp: bot.max_hp, maxHp: bot.max_hp, lastAttackTick: 0, dead: false, respawnTick: 0 };
              botHpState.set(bot.id, state);
            }

            if (state.dead) continue;
            if (state.lastAttackTick > globalTick) continue;

            const reloadMs = bot.reload_ms || 2500;
            const tickMs = 10000;
            const elapsedMs = (globalTick - state.lastAttackTick) * tickMs;
            const attacksPerTick = Math.max(1, Math.floor(tickMs / reloadMs));

            if (state.lastAttackTick > 0 && elapsedMs < reloadMs) continue;

            const admiralDmg = rand(Math.floor(bot.max_hp * 0.02), Math.floor(bot.max_hp * 0.08));
            state.currentHp -= admiralDmg;

            if (state.currentHp <= 0) {
              state.dead = true;
              state.respawnTick = globalTick + rand(4, 10);
              state.currentHp = 0;
              continue;
            }

            state.currentHp = Math.min(state.maxHp, state.currentHp + Math.floor(state.maxHp * 0.02));

            const basePerLevel = bot.ship_level * 2500 + mapLevel * 1500;
            const burst = Math.random() < 0.30 ? rand(2, 4) : 1;
            const singleShot = Math.floor(basePerLevel * (0.5 + Math.random() * 1.5) * burst * dmgFactor);
            const damage = singleShot * attacksPerTick;

            if (damage <= 0) continue;

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
            console.error(`[BOT] Bot ${bot.id} damage error map ${mapLevel}:`, e.message);
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

let tickInterval = null;
let statInterval = null;
let auctionInterval = null;

function startBotTicks() {
  if (!BOT_CONFIG.enabled) {
    console.log('[BOT] Bot sistemi KAPALI (botConfig.js\'den aktifleştirin)');
    console.log(`[BOT]   enabled: ${BOT_CONFIG.enabled}, activeMaps: ${BOT_CONFIG.activeMaps.length > 0 ? BOT_CONFIG.activeMaps.join(',') : 'tümü'}, testMode: ${BOT_CONFIG.testMode}`);
    if (BOT_CONFIG.testMode) {
      ensureTestAccounts().then(() => {
        console.log('[BOT] Test hesapları oluşturuldu, botTick çalışmıyor (enabled=false)');
      });
    }
    return;
  }

  console.log('[BOT] Bot sistemi AKTİF');
  console.log(`[BOT]   activeMaps: ${BOT_CONFIG.activeMaps.length > 0 ? BOT_CONFIG.activeMaps.join(',') : 'tümü'}, testMode: ${BOT_CONFIG.testMode}`);

  ensureBotAccounts().then(() => {
    if (BOT_CONFIG.testMode) {
      return ensureTestAccounts();
    }
  }).then(() => {
    console.log('[BOT] Admiral bot sistemi başlatıldı (10sn interval)');
    tickInterval = setInterval(botTick, 10000);
    startSimulationIntervals();
  }).catch(err => {
    console.error('[BOT] ensureBotAccounts failed:', err.message);
  });
}

function startSimulationIntervals() {
  const firstStatDelay = rand(300000, 600000);
  const firstAuctionDelay = rand(300000, 600000);

  setTimeout(() => {
    simulateBotActivity();
    statInterval = setInterval(simulateBotActivity, BOT_CONFIG.statSimIntervalMs);
    console.log(`[BOT] Stat güncelleme başlatıldı (her ${BOT_CONFIG.statSimIntervalMs / 60000} dk)`);
  }, firstStatDelay);

  setTimeout(() => {
    simulateAuctionBidding();
    auctionInterval = setInterval(simulateAuctionBidding, BOT_CONFIG.auctionBidIntervalMs);
    console.log(`[BOT] Açık artırma teklif sistemi başlatıldı (her ${BOT_CONFIG.auctionBidIntervalMs / 60000} dk)`);
  }, firstAuctionDelay);
}

function stopBotTicks() {
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
  if (statInterval) {
    clearInterval(statInterval);
    statInterval = null;
  }
  if (auctionInterval) {
    clearInterval(auctionInterval);
    auctionInterval = null;
  }
  console.log('[BOT] Bot sistemi durduruldu');
}

module.exports = { startBotTicks, stopBotTicks };