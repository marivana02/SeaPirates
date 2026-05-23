const pool = require('./config/db');

// ─────────────────────────────────────────────
// 1. TABLO OLUŞTURMA (Eksik olanları ekle)
// ─────────────────────────────────────────────
const createTables = `
CREATE TABLE IF NOT EXISTS players (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(50) DEFAULT '',
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    gold BIGINT DEFAULT 5000,
    pearl BIGINT DEFAULT 0,
    xp BIGINT DEFAULT 0,
    level INT DEFAULT 1,
    elite_points BIGINT DEFAULT 0,
    ship_level INT DEFAULT 0,
    hp INT DEFAULT 10000,
    max_hp INT DEFAULT 10000,
    vip_until TIMESTAMP,
    last_username_change TIMESTAMP DEFAULT NULL,
    last_boss_attack DATE DEFAULT NULL,
    weekly_boss_damage BIGINT DEFAULT 0,
    weekly_boss_week VARCHAR(10) DEFAULT '',
    last_tower_attack DATE DEFAULT NULL,
    tower_level INT DEFAULT 1,
    active_quest_id INT DEFAULT NULL,
    quest_kills INT DEFAULT 0,
    quest_damage BIGINT DEFAULT 0,
    quest_glitters INT DEFAULT 0,
    completed_quests INT[] DEFAULT '{}',
    last_quest_reset_date VARCHAR(20) DEFAULT '',
    daily_streak INT DEFAULT 0,
    last_daily_claim TIMESTAMP DEFAULT NULL,
    last_vip_claim TIMESTAMP DEFAULT NULL,
    claimed_normal_levels INT[] DEFAULT '{}',
    claimed_vip_levels INT[] DEFAULT '{}',
    current_map_level INT DEFAULT 1,
    current_map_sub INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS player_cannons (
    id SERIAL PRIMARY KEY,
    player_id INT REFERENCES players(id) ON DELETE CASCADE,
    cannon_type INT,
    quantity INT DEFAULT 0,
    equipped INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS player_ammo (
    id SERIAL PRIMARY KEY,
    player_id INT REFERENCES players(id) ON DELETE CASCADE,
    ammo_type INT,
    quantity INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS player_items (
    id SERIAL PRIMARY KEY,
    player_id INT REFERENCES players(id) ON DELETE CASCADE,
    item_type VARCHAR(50),
    quantity INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS player_planks (
    id SERIAL PRIMARY KEY,
    player_id INT REFERENCES players(id) ON DELETE CASCADE,
    plank_type VARCHAR(50),
    quantity INT DEFAULT 0,
    equipped INT DEFAULT 0
);

-- Gemi tipleri referans tablosu
CREATE TABLE IF NOT EXISTS ships (
    level INT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    base_hp INT NOT NULL,
    cannon_slots INT NOT NULL,
    plank_slots INT NOT NULL,
    required_elp BIGINT DEFAULT 0,
    pearl_cost INT DEFAULT 0  -- sadece Elit I için 10.000 inci
);

-- Toplar (Cannon)
CREATE TABLE IF NOT EXISTS cannons (
    id INT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    damage INT NOT NULL,
    reload_time_ms INT NOT NULL,
    price INT NOT NULL,
    currency VARCHAR(10) NOT NULL  -- 'gold' veya 'pearl'
);

-- Gülleler (Ammo)
CREATE TABLE IF NOT EXISTS ammo (
    id INT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    damage_bonus INT NOT NULL,
    elp_per_shot NUMERIC(4,2) DEFAULT 0,
    pack_size INT DEFAULT 100,
    price INT NOT NULL,
    currency VARCHAR(10) NOT NULL
);

-- Direkler (Planks / Beams)
CREATE TABLE IF NOT EXISTS planks (
    id SERIAL PRIMARY KEY,
    type_key VARCHAR(30) UNIQUE NOT NULL,
    name VARCHAR(50) NOT NULL,
    hp_bonus INT NOT NULL,
    break_chance VARCHAR(20),  -- 'Yüksek', 'Düşük'
    price INT NOT NULL,
    currency VARCHAR(10) NOT NULL
);

-- Sarf malzemeleri (Barut, Zırh)
CREATE TABLE IF NOT EXISTS items (
    id SERIAL PRIMARY KEY,
    type_key VARCHAR(30) UNIQUE NOT NULL,
    name VARCHAR(50) NOT NULL,
    effect_pct NUMERIC(4,2) NOT NULL,  -- 0.10 = %10
    description VARCHAR(200),
    pack_size INT DEFAULT 100,
    price INT NOT NULL,
    currency VARCHAR(10) NOT NULL
);

-- NPC tablosu
CREATE TABLE IF NOT EXISTS npcs (
    id SERIAL PRIMARY KEY,
    map_level INT NOT NULL,
    npc_tier INT NOT NULL,   -- 1=Zayıf, 2=Orta, 3=Güçlü
    name VARCHAR(100) NOT NULL,
    hp BIGINT NOT NULL,
    damage INT NOT NULL,
    gold INT DEFAULT 0,
    pearl INT DEFAULT 0,
    xp INT NOT NULL,
    UNIQUE(map_level, npc_tier)
);

-- Boss tablosu
CREATE TABLE IF NOT EXISTS bosses (
    id SERIAL PRIMARY KEY,
    map_level INT UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    hp BIGINT NOT NULL,
    damage INT NOT NULL,
    pearl INT NOT NULL,
    xp INT NOT NULL,
    required_kills INT NOT NULL  -- spawn için gereken NPC3 öldürme sayısı
);

-- Tiamat (özel boss - harita 10)
CREATE TABLE IF NOT EXISTS tiamat (
    id INT PRIMARY KEY DEFAULT 1,
    hp BIGINT NOT NULL,
    damage INT NOT NULL,
    pearl INT NOT NULL,
    xp INT NOT NULL,
    spawn_min_min INT DEFAULT 60,   -- dakika
    spawn_max_min INT DEFAULT 180   -- dakika
);

-- NPC3 kill counter (boss spawn için)
CREATE TABLE IF NOT EXISTS npc3_kill_counter (
    map_level INT PRIMARY KEY,
    kill_count INT DEFAULT 0,
    last_reset TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Boss hasar logu (ödül dağıtımı için)
CREATE TABLE IF NOT EXISTS boss_damage_log (
    id SERIAL PRIMARY KEY,
    boss_session_id UUID,
    player_id INT REFERENCES players(id) ON DELETE CASCADE,
    damage_dealt BIGINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Açık artırma tablosu
CREATE TABLE IF NOT EXISTS auctions (
    id SERIAL PRIMARY KEY,
    seller_id INT REFERENCES players(id) ON DELETE CASCADE,
    item_type VARCHAR(30) NOT NULL,  -- 'barut', 'zirh'
    quantity INT NOT NULL,
    currency VARCHAR(10) NOT NULL,   -- 'gold' veya 'pearl'
    starting_price INT NOT NULL,
    current_price INT NOT NULL,
    highest_bidder_id INT REFERENCES players(id) ON DELETE SET NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- XP / Level tablosu
CREATE TABLE IF NOT EXISTS level_requirements (
    level INT PRIMARY KEY,
    required_xp BIGINT NOT NULL,
    unlocks_map VARCHAR(30)
);

-- Yeni Oyuncu Başlangıç Paketi Trigger'ı
CREATE OR REPLACE FUNCTION give_starter_pack()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO player_cannons (player_id, cannon_type, quantity) VALUES (NEW.id, 1, 5);
    INSERT INTO player_cannons (player_id, cannon_type, quantity) VALUES (NEW.id, 2, 1);

    INSERT INTO player_ammo (player_id, ammo_type, quantity) VALUES (NEW.id, 1, 2000);
    INSERT INTO player_ammo (player_id, ammo_type, quantity) VALUES (NEW.id, 2, 1000);
    INSERT INTO player_ammo (player_id, ammo_type, quantity) VALUES (NEW.id, 3, 500);

    INSERT INTO player_items (player_id, item_type, quantity) VALUES (NEW.id, 'barut', 100);
    INSERT INTO player_items (player_id, item_type, quantity) VALUES (NEW.id, 'zirh', 100);

    INSERT INTO player_planks (player_id, plank_type, quantity) VALUES (NEW.id, 'tahta', 10);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_starter_pack ON players;
CREATE TRIGGER trigger_starter_pack
AFTER INSERT ON players
FOR EACH ROW
EXECUTE FUNCTION give_starter_pack();
`;

// ─────────────────────────────────────────────
// 2. VERİ SEED FONKSİYONLARI
// ─────────────────────────────────────────────

async function seedShips(client) {
    console.log('  → Gemiler ekleniyor...');
    const ships = [
        [0,  'Başlangıç', 10000, 15, 5,  0,       0],
        [1,  'Elit I',    25000, 30, 10, 35000,   10000],
        [2,  'Elit II',   36000, 35, 12, 90000,   0],
        [3,  'Elit III',  48000, 39, 14, 200000,  0],
        [4,  'Elit IV',   62000, 43, 16, 380000,  0],
        [5,  'Elit V',    78000, 46, 18, 650000,  0],
        [6,  'Elit VI',   96000, 49, 20, 1050000, 0],
        [7,  'Elit VII',  116000,52, 21, 1600000, 0],
        [8,  'Elit VIII', 138000,55, 23, 2300000, 0],
        [9,  'Elit IX',   162000,57, 24, 3200000, 0],
        [10, 'Elit X',    190000,60, 25, 4500000, 0],
    ];
    for (const [level, name, base_hp, cannon_slots, plank_slots, required_elp, pearl_cost] of ships) {
        await client.query(
            `INSERT INTO ships (level, name, base_hp, cannon_slots, plank_slots, required_elp, pearl_cost)
             VALUES ($1,$2,$3,$4,$5,$6,$7)
             ON CONFLICT (level) DO UPDATE SET
               name=EXCLUDED.name, base_hp=EXCLUDED.base_hp,
               cannon_slots=EXCLUDED.cannon_slots, plank_slots=EXCLUDED.plank_slots,
               required_elp=EXCLUDED.required_elp, pearl_cost=EXCLUDED.pearl_cost`,
            [level, name, base_hp, cannon_slots, plank_slots, required_elp, pearl_cost]
        );
    }
    console.log(`     ✔ ${ships.length} gemi eklendi.`);
}

async function seedCannons(client) {
    console.log('  → Toplar ekleniyor...');
    const cannons = [
        [1, '30 Pounder', 120, 4000, 3500, 'gold'],
        [2, '55 Pounder', 185, 3000, 1200, 'pearl'],
        [3, '60 Pounder', 260, 2000, 3500, 'pearl'],
    ];
    for (const [id, name, damage, reload_time_ms, price, currency] of cannons) {
        await client.query(
            `INSERT INTO cannons (id, name, damage, reload_time_ms, price, currency)
             VALUES ($1,$2,$3,$4,$5,$6)
             ON CONFLICT (id) DO UPDATE SET
               name=EXCLUDED.name, damage=EXCLUDED.damage,
               reload_time_ms=EXCLUDED.reload_time_ms, price=EXCLUDED.price, currency=EXCLUDED.currency`,
            [id, name, damage, reload_time_ms, price, currency]
        );
    }
    console.log(`     ✔ ${cannons.length} top eklendi.`);
}

async function seedAmmo(client) {
    console.log('  → Gülleler ekleniyor...');
    const ammo = [
        [1, 'Misket Gülle',   30,  0.00, 100, 3000, 'gold'],
        [2, 'Oyuk Gülle',     75,  0.00, 100, 6000, 'gold'],
        [3, 'Patlayan Gülle', 130, 1.00, 100, 280,  'pearl'],
    ];
    for (const [id, name, damage_bonus, elp_per_shot, pack_size, price, currency] of ammo) {
        await client.query(
            `INSERT INTO ammo (id, name, damage_bonus, elp_per_shot, pack_size, price, currency)
             VALUES ($1,$2,$3,$4,$5,$6,$7)
             ON CONFLICT (id) DO UPDATE SET
               name=EXCLUDED.name, damage_bonus=EXCLUDED.damage_bonus,
               elp_per_shot=EXCLUDED.elp_per_shot, pack_size=EXCLUDED.pack_size,
               price=EXCLUDED.price, currency=EXCLUDED.currency`,
            [id, name, damage_bonus, elp_per_shot, pack_size, price, currency]
        );
    }
    console.log(`     ✔ ${ammo.length} gülle tipi eklendi.`);
}

async function seedPlanks(client) {
    console.log('  → Direkler (Kirişler) ekleniyor...');
    await client.query(
        `INSERT INTO planks (type_key, name, hp_bonus, break_chance, price, currency)
         VALUES ('tahta', 'Tahta Kiriş', 500,  'Yüksek', 25000, 'gold')
         ON CONFLICT (type_key) DO UPDATE SET
           name=EXCLUDED.name, hp_bonus=EXCLUDED.hp_bonus, break_chance=EXCLUDED.break_chance,
           price=EXCLUDED.price, currency=EXCLUDED.currency`
    );
    await client.query(
        `INSERT INTO planks (type_key, name, hp_bonus, break_chance, price, currency)
         VALUES ('elit', 'Elit Kiriş', 1200, 'Düşük', 800, 'pearl')
         ON CONFLICT (type_key) DO UPDATE SET
           name=EXCLUDED.name, hp_bonus=EXCLUDED.hp_bonus, break_chance=EXCLUDED.break_chance,
           price=EXCLUDED.price, currency=EXCLUDED.currency`
    );
    console.log(`     ✔ 2 kiriş tipi eklendi.`);
}

async function seedItems(client) {
    console.log('  → Sarf malzemeleri ekleniyor...');
    await client.query(
        `INSERT INTO items (type_key, name, effect_pct, description, pack_size, price, currency)
         VALUES ('barut', 'Barut', 0.10, '+%10 saldırı hasarı, her atışta harcanır', 100, 80, 'pearl')
         ON CONFLICT (type_key) DO UPDATE SET
           name=EXCLUDED.name, effect_pct=EXCLUDED.effect_pct, description=EXCLUDED.description,
           pack_size=EXCLUDED.pack_size, price=EXCLUDED.price, currency=EXCLUDED.currency`
    );
    await client.query(
        `INSERT INTO items (type_key, name, effect_pct, description, pack_size, price, currency)
         VALUES ('zirh', 'Zırh', 0.10, '-%10 alınan hasar, her atışta harcanır', 100, 80, 'pearl')
         ON CONFLICT (type_key) DO UPDATE SET
           name=EXCLUDED.name, effect_pct=EXCLUDED.effect_pct, description=EXCLUDED.description,
           pack_size=EXCLUDED.pack_size, price=EXCLUDED.price, currency=EXCLUDED.currency`
    );
    console.log(`     ✔ 2 sarf malzemesi eklendi.`);
}

async function seedNPCs(client) {
    console.log('  → NPC\'ler ekleniyor...');
    // GDD Bölüm 6.3 — Tam NPC detay tablosu
    const npcs = [
        // [map, tier, name,                   hp,       damage, gold,  pearl, xp]
        [1,  1, 'Blackpearl',        6000,     90,    180,   0,   35],
        [1,  2, 'Rackham',           12000,    150,   320,   0,   65],
        [1,  3, 'Calicos Jack',      25000,    250,   550,   0,  120],
        [2,  1, 'Wild 13',           12000,    160,   280,   0,   55],
        [2,  2, 'Red Korsar',        22000,    260,   500,   0,  100],
        [2,  3, 'Ratpack',           45000,    400,   850,   0,  185],
        [3,  1, 'Sinclares Men',     20000,    250,   400,   0,   80],
        [3,  2, 'Tortuga Gang',      38000,    420,   720,   0,  145],
        [3,  3, 'Los Renegados',     80000,    600,  1200,   0,  260],
        [4,  1, 'Ratpack',           32000,    360,   620,   0,  120],
        [4,  2, 'Sinclares Men',     60000,    620,  1100,   0,  220],
        [4,  3, 'Calocosmen',       120000,    900,     0,  55,  380],
        [5,  1, 'Wild 13',           45000,    500,   920,   0,  180],
        [5,  2, 'Los Renegados',     90000,    800,  1650,   0,  330],
        [5,  3, 'Morgansbuccaneers',180000,   1200,     0,  85,  560],
        [6,  1, 'Tortuga Gang',      60000,    650,  1150,   0,  225],
        [6,  2, 'Calocosmen',       110000,   1000,  2050,   0,  415],
        [6,  3, 'Sinclares Men',    220000,   1500,     0, 110,  700],
        [7,  1, 'Morgansbuccaneers', 80000,    850,  1600,   0,  310],
        [7,  2, 'Sinclares Men',    150000,   1300,  2850,   0,  580],
        [7,  3, 'Flyingdutchman',   300000,   1900,     0, 155,  980],
        [8,  1, 'Kiliwallis',       100000,   1050,  2000,   0,  390],
        [8,  2, 'Flyingdutchman',   190000,   1650,  3600,   0,  720],
        [8,  3, 'Kilimatu',         380000,   2400,     0, 195, 1220],
        [9,  1, 'Kokelua',          120000,   1300,  2450,   0,  475],
        [9,  2, 'Morgansbuccaneers',230000,   2100,  4350,   0,  870],
        [9,  3, 'Kiribati',         460000,   3000,     0, 235, 1480],
        [10, 1, 'Kilimatu',         150000,   1750,  3000,   0,  580],
        [10, 2, 'Kiribati',         280000,   2700,  5300,   0, 1060],
        [10, 3, 'Flyingdutchman',   560000,   3900,     0, 285, 1800],
    ];
    for (const [map_level, npc_tier, name, hp, damage, gold, pearl, xp] of npcs) {
        await client.query(
            `INSERT INTO npcs (map_level, npc_tier, name, hp, damage, gold, pearl, xp)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
             ON CONFLICT (map_level, npc_tier) DO UPDATE SET
               name=EXCLUDED.name, hp=EXCLUDED.hp, damage=EXCLUDED.damage,
               gold=EXCLUDED.gold, pearl=EXCLUDED.pearl, xp=EXCLUDED.xp`,
            [map_level, npc_tier, name, hp, damage, gold, pearl, xp]
        );
    }
    console.log(`     ✔ ${npcs.length} NPC eklendi.`);
}

async function seedBosses(client) {
    console.log('  → Admiral Boss\'lar ekleniyor...');
    // GDD Bölüm 7.3 — Admiral Boss Tablosu
    const bosses = [
        // [map, name,                 hp,        damage,  pearl,  xp,      kills]
        [1,  'Admiral Jack',      150000,    300,    180,    3500,    40],
        [2,  'Admiral Ratpack',   280000,    450,    320,    5500,    45],
        [3,  'Admiral Renegado',  450000,    650,    520,    8500,    50],
        [4,  'Admiral Calico',    750000,    900,   1260,   13000,    55],
        [5,  'Admiral Morgan',   1100000,   1350,   2140,   20000,    60],
        [6,  'Admiral Sinclare', 1600000,   1800,   3010,   28000,    65],
        [7,  'Admiral Dutchman', 2200000,   2200,   4560,   40000,    70],
        [8,  'Admiral Kilimatu', 2800000,   2900,   6430,   55000,    75],
        [9,  'Admiral Kiribati', 3300000,   3600,   8860,   72000,    80],
        [10, 'Admiral Dutchman', 4000000,   4500,  13950,  110000,    90],
    ];
    for (const [map_level, name, hp, damage, pearl, xp, required_kills] of bosses) {
        await client.query(
            `INSERT INTO bosses (map_level, name, hp, damage, pearl, xp, required_kills)
             VALUES ($1,$2,$3,$4,$5,$6,$7)
             ON CONFLICT (map_level) DO UPDATE SET
               name=EXCLUDED.name, hp=EXCLUDED.hp, damage=EXCLUDED.damage,
               pearl=EXCLUDED.pearl, xp=EXCLUDED.xp, required_kills=EXCLUDED.required_kills`,
            [map_level, name, hp, damage, pearl, xp, required_kills]
        );
    }
    console.log(`     ✔ ${bosses.length} admiral boss eklendi.`);
}

async function seedTiamat(client) {
    console.log('  → Tiamat ekleniyor...');
    await client.query(
        `INSERT INTO tiamat (id, hp, damage, pearl, xp, spawn_min_min, spawn_max_min)
         VALUES (1, 12000000, 3800, 38000, 280000, 60, 180)
         ON CONFLICT (id) DO UPDATE SET
           hp=EXCLUDED.hp, damage=EXCLUDED.damage, pearl=EXCLUDED.pearl,
           xp=EXCLUDED.xp, spawn_min_min=EXCLUDED.spawn_min_min, spawn_max_min=EXCLUDED.spawn_max_min`
    );
    console.log(`     ✔ Tiamat eklendi.`);
}

async function seedNPC3KillCounters(client) {
    console.log('  → NPC3 öldürme sayaçları başlatılıyor...');
    for (let map = 1; map <= 10; map++) {
        await client.query(
            `INSERT INTO npc3_kill_counter (map_level, kill_count)
             VALUES ($1, 0)
             ON CONFLICT (map_level) DO NOTHING`,
            [map]
        );
    }
    console.log(`     ✔ 10 harita için sayaç başlatıldı.`);
}

async function seedLevelRequirements(client) {
    console.log('  → Level XP gereksinimleri ekleniyor...');
    // GDD Bölüm 5.4
    const levels = [
        [1,  0,       '1/1, 1/2'],
        [2,  3000,    '2/1, 2/2'],
        [3,  8000,    '3/1, 3/2'],
        [4,  18000,   '4/1, 4/2'],
        [5,  38000,   '5/1'],
        [6,  75000,   '6/1'],
        [7,  140000,  '7/1'],
        [8,  260000,  '8/1'],
        [9,  480000,  '9/1'],
        [10, 900000,  '10/1'],
    ];
    for (const [level, required_xp, unlocks_map] of levels) {
        await client.query(
            `INSERT INTO level_requirements (level, required_xp, unlocks_map)
             VALUES ($1,$2,$3)
             ON CONFLICT (level) DO UPDATE SET
               required_xp=EXCLUDED.required_xp, unlocks_map=EXCLUDED.unlocks_map`,
            [level, required_xp, unlocks_map]
        );
    }
    console.log(`     ✔ ${levels.length} level gereksinimleri eklendi.`);
}

async function seedStarterPacksForExistingPlayers(client) {
    console.log('  → Eski oyunculara başlangıç paketi uygulanıyor...');
    
    // Check players who don't have any cannons in player_cannons
    const playersRes = await client.query(`
        SELECT p.id FROM players p 
        LEFT JOIN player_cannons pc ON p.id = pc.player_id 
        WHERE pc.id IS NULL
    `);
    
    for (const row of playersRes.rows) {
        const pid = row.id;
        await client.query('INSERT INTO player_cannons (player_id, cannon_type, quantity) VALUES ($1, 1, 5), ($1, 2, 1)', [pid]);
        await client.query('INSERT INTO player_ammo (player_id, ammo_type, quantity) VALUES ($1, 1, 2000), ($1, 2, 1000), ($1, 3, 500)', [pid]);
        await client.query(`INSERT INTO player_items (player_id, item_type, quantity) VALUES ($1, 'barut', 100), ($1, 'zirh', 100)`, [pid]);
        await client.query(`INSERT INTO player_planks (player_id, plank_type, quantity) VALUES ($1, 'tahta', 5)`, [pid]);
    }
    
    console.log(`     ✔ ${playersRes.rows.length} eski oyuncuya başlangıç paketi verildi.`);
}

// ─────────────────────────────────────────────
// 3. ANA FONKSİYON
// ─────────────────────────────────────────────
async function main() {
    const client = await pool.connect();
    try {
        console.log('\n🏴‍☠️  SeaPirates Veritabanı Kurulumu Başlıyor...\n');
        console.log('📋 Tablolar oluşturuluyor...');
        await client.query(createTables);
        console.log('   ✔ Tüm tablolar hazır.\n');

        console.log('🌊 Oyun verileri işleniyor...');
        await client.query('BEGIN');
        await seedShips(client);
        await seedCannons(client);
        await seedAmmo(client);
        await seedPlanks(client);
        await seedItems(client);
        await seedNPCs(client);
        await seedBosses(client);
        await seedTiamat(client);
        await seedNPC3KillCounters(client);
        await seedLevelRequirements(client);
        await seedStarterPacksForExistingPlayers(client);
        await client.query('COMMIT');

        console.log('\n✅ Tüm veriler başarıyla veritabanına işlendi!');
        console.log('   → Sunucuyu başlatmak için: node index.js\n');
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
