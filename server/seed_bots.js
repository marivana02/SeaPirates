const pool = require('./config/db');
const bcrypt = require('bcryptjs');

// ─────────────────────────────────────────────────────────
// 🏴‍☠️ 100 Bot Hesap Oluşturucu — Gerçekçi Oyuncu Nickli
// ─────────────────────────────────────────────────────────

// Gerçekçi oyuncu nickleri — popüler oyunlardaki tarzda
const NICKNAMES = [
  'xDarkSea', 'StormBlade', 'NightHawk', 'CptMorgan', 'ShadowFury',
  'IronWave', 'SkullKraken', 'BlazePirate', 'NoMercy', 'PhantomShip',
  'DeadEyeJack', 'SeaWolfTR', 'AquaReaper', 'Blackbeard42', 'OceanKing',
  'xVenomx', 'ThunderSail', 'GhostShark', 'PirateKhan', 'WaveBreaker',
  'DarkTide', 'SilverStorm', 'KrakenSlayer', 'VortexX', 'NeptuneFury',
  'RedSkull', 'ToxicWind', 'DragonSea', 'MysticPirate', 'BlazeStorm',
  'CyberWolf', 'SaltKing', 'NightFury', 'OceanHunter', 'SharkBait',
  'IceBreaker', 'CannonKing', 'StealthShip', 'ReaperX', 'DoomSailor',
  'AceOfSeas', 'RogueWave', 'DarkVoyage', 'StormRider', 'SavageSea',
  'xPredator', 'AbyssWalker', 'TitanWave', 'BoneShip', 'CrimsonTide',
  'SkyPirate', 'VenomShark', 'WildSeas', 'GhostCaptain', 'RazorFin',
  'WarShipX', 'NeonPirate', 'OmegaSea', 'DarkCorsair', 'FrostBite',
  'BulletStorm', 'KingCobra', 'DeathSail', 'ShadowFleet', 'TurboShip',
  'ZeroMercy', 'BloodTide', 'StormChaser', 'NightCrawler', 'TheSiren',
  'xHavocx', 'SeaSerpent', 'PirateAce', 'BraveSoul', 'ThunderBolt',
  'EliteHunter', 'WolfOfSea', 'SteelWave', 'DarkPhoenix', 'ViperShip',
  'CaptainX', 'MadPirate', 'AnchorFury', 'OceanBeast', 'SilentDeath',
  'xSpartan', 'BlitzKrieg', 'DeepBlue', 'InfernoSea', 'TridentKing',
  'AlphaShark', 'PirateNova', 'AxeBeard', 'SwiftSail', 'DarkMatter',
  'RavenSea', 'HellTide', 'FlameShip', 'Corsair99', 'LegendaryJoe'
];

// Gemi seviyeleri ve karşılık gelen HP değerleri
const SHIPS = [
  { level: 0, name: 'Başlangıç', baseHp: 10000 },
  { level: 1, name: 'Elit I', baseHp: 25000 },
  { level: 2, name: 'Elit II', baseHp: 36000 },
  { level: 3, name: 'Elit III', baseHp: 48000 },
  { level: 4, name: 'Elit IV', baseHp: 62000 },
  { level: 5, name: 'Elit V', baseHp: 78000 },
  { level: 6, name: 'Elit VI', baseHp: 96000 },
  { level: 7, name: 'Elit VII', baseHp: 116000 },
  { level: 8, name: 'Elit VIII', baseHp: 138000 },
  { level: 9, name: 'Elit IX', baseHp: 162000 },
  { level: 10, name: 'Elit X', baseHp: 190000 },
];

// Rastgele sayı üretici (min-max arası, dahil)
function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Ağırlıklı rastgele ship_level seçimi (düşük seviyeler daha yaygın)
function randomShipLevel() {
  const r = Math.random();
  if (r < 0.25) return 0;   // %25 — Başlangıç
  if (r < 0.45) return 1;   // %20 — Elit I
  if (r < 0.60) return 2;   // %15 — Elit II
  if (r < 0.72) return 3;   // %12 — Elit III
  if (r < 0.82) return 4;   // %10 — Elit IV
  if (r < 0.88) return 5;   // %6  — Elit V
  if (r < 0.93) return 6;   // %5  — Elit VI
  if (r < 0.96) return 7;   // %3  — Elit VII
  if (r < 0.98) return 8;   // %2  — Elit VIII
  if (r < 0.99) return 9;   // %1  — Elit IX
  return 10;                 // %1  — Elit X
}

// Seviyeye göre harita ve PvP puan aralığı
function statsForLevel(playerLevel, shipLevel) {
  return {
    gold: rand(5000, 500000 + playerLevel * 10000),
    pearl: rand(0, 2000 + playerLevel * 100),
    xp: rand(playerLevel * 500, playerLevel * 5000),
    elite_points: shipLevel === 0 ? rand(0, 30000) : rand(35000, 35000 + shipLevel * 300000),
    pvp_points: rand(0, Math.min(playerLevel * 30, 2000)),
    current_map_level: Math.min(10, Math.max(1, Math.ceil(playerLevel / 5))),
    tower_level: rand(1, Math.min(20, playerLevel)),
  };
}

async function main() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    console.log('\n🏴‍☠️ Bot Hesaplar Oluşturuluyor...\n');

    const hashedPassword = await bcrypt.hash('bot_account_2026', 10);
    let created = 0;

    for (let i = 0; i < NICKNAMES.length; i++) {
      const nick = NICKNAMES[i];
      const email = `${nick.toLowerCase().replace(/[^a-z0-9]/g, '')}@bot.sea`;
      const shipLevel = randomShipLevel();
      const ship = SHIPS[shipLevel];
      const playerLevel = Math.max(1, shipLevel * 5 + rand(1, 10));
      const stats = statsForLevel(playerLevel, shipLevel);
      const hasEliteShip = shipLevel >= 1;

      // Oyuncuyu oluştur
      const res = await client.query(
        `INSERT INTO players (
          username, display_name, email, password,
          gold, pearl, xp, level,
          elite_points, ship_level, hp, max_hp,
          has_elite_ship, pvp_points,
          current_map_level, tower_level,
          pvp_changes_left
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
        ON CONFLICT (username) DO NOTHING
        RETURNING id`,
        [
          nick, nick, email, hashedPassword,
          stats.gold, stats.pearl, stats.xp, playerLevel,
          stats.elite_points, shipLevel, ship.baseHp, ship.baseHp,
          hasEliteShip, stats.pvp_points,
          stats.current_map_level, stats.tower_level,
          10
        ]
      );

      if (res.rows.length === 0) {
        console.log(`  ⚠ ${nick} zaten mevcut, atlanıyor...`);
        continue;
      }

      const playerId = res.rows[0].id;

      // Top ekle — seviyeye göre top tipi ve miktarı
      const cannonConfigs = [];
      if (shipLevel <= 2) {
        // Düşük seviye: sadece 30 Pounder
        cannonConfigs.push({ type: 1, qty: rand(5, 15), equipped: rand(3, 10) });
      } else if (shipLevel <= 5) {
        // Orta seviye: 30 + 55 Pounder
        cannonConfigs.push({ type: 1, qty: rand(10, 20), equipped: rand(5, 10) });
        cannonConfigs.push({ type: 2, qty: rand(5, 15), equipped: rand(3, 10) });
      } else {
        // Yüksek seviye: hepsi
        cannonConfigs.push({ type: 1, qty: rand(10, 25), equipped: rand(0, 5) });
        cannonConfigs.push({ type: 2, qty: rand(10, 20), equipped: rand(5, 15) });
        cannonConfigs.push({ type: 3, qty: rand(5, 15), equipped: rand(5, 15) });
      }

      for (const c of cannonConfigs) {
        const eq = Math.min(c.equipped, c.qty);
        await client.query(
          `INSERT INTO player_cannons (player_id, cannon_type, quantity, equipped)
           VALUES ($1,$2,$3,$4)
           ON CONFLICT (player_id, cannon_type) DO UPDATE SET
             quantity = EXCLUDED.quantity, equipped = EXCLUDED.equipped`,
          [playerId, c.type, c.qty, eq]
        );
      }

      // Gülle ekle
      await client.query(
        `INSERT INTO player_ammo (player_id, ammo_type, quantity)
         VALUES ($1, 1, $2), ($1, 2, $3), ($1, 3, $4)
         ON CONFLICT (player_id, ammo_type) DO UPDATE SET quantity = EXCLUDED.quantity`,
        [playerId, rand(500, 5000), rand(200, 3000), rand(0, 1500)]
      );

      // Direk ekle
      await client.query(
        `INSERT INTO player_planks (player_id, plank_type, quantity, equipped)
         VALUES ($1, 'tahta', $2, $3)
         ON CONFLICT (player_id, plank_type) DO UPDATE SET
           quantity = EXCLUDED.quantity, equipped = EXCLUDED.equipped`,
        [playerId, rand(5, 30), rand(2, 10)]
      );

      if (shipLevel >= 3) {
        await client.query(
          `INSERT INTO player_planks (player_id, plank_type, quantity, equipped)
           VALUES ($1, 'elit', $2, $3)
           ON CONFLICT (player_id, plank_type) DO UPDATE SET
             quantity = EXCLUDED.quantity, equipped = EXCLUDED.equipped`,
          [playerId, rand(3, 15), rand(1, 8)]
        );
      }

      // Item ekle (barut/zırh)
      await client.query(
        `INSERT INTO player_items (player_id, item_type, quantity)
         VALUES ($1, 'barut', $2), ($1, 'zirh', $3)
         ON CONFLICT (player_id, item_type) DO UPDATE SET quantity = EXCLUDED.quantity`,
        [playerId, rand(50, 500), rand(50, 500)]
      );

      created++;
      const shipTag = shipLevel === 0 ? '⛵' : `🚀 ${ship.name}`;
      console.log(`  ✔ [${String(created).padStart(3)}] ${nick.padEnd(18)} Lv.${String(playerLevel).padStart(2)} | ${shipTag.padEnd(12)} | PvP: ${String(stats.pvp_points).padStart(4)} BP | Map: ${stats.current_map_level}`);
    }

    await client.query('COMMIT');
    console.log(`\n✅ ${created} bot hesap başarıyla oluşturuldu!\n`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ HATA — Değişiklikler geri alındı:', err.message);
    console.error(err.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
