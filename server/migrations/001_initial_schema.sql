-- Up
CREATE TABLE IF NOT EXISTS players (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(50) DEFAULT '',
    email VARCHAR(100) UNIQUE DEFAULT NULL,
    password VARCHAR(255) NOT NULL,
    gold BIGINT DEFAULT 1000,
    pearl INT DEFAULT 0,
    xp BIGINT DEFAULT 0,
    elite_points BIGINT DEFAULT 0,
    level INT DEFAULT 1,
    ship_level INT DEFAULT 0,
    hp INT DEFAULT 12500,
    max_hp INT DEFAULT 12500,
    vip_until TIMESTAMP DEFAULT NULL,
    current_map_level INT DEFAULT 1,
    current_map_sub INT DEFAULT 1,
    tower_level INT DEFAULT 1,
    last_tower_attack DATE DEFAULT NULL,
    last_boss_attack DATE DEFAULT NULL,
    weekly_boss_damage BIGINT DEFAULT 0,
    weekly_boss_week VARCHAR(10) DEFAULT '',
    active_quest_id INT DEFAULT NULL,
    quest_kills INT DEFAULT 0,
    quest_damage BIGINT DEFAULT 0,
    quest_glitters INT DEFAULT 0,
    completed_quests INT[] DEFAULT '{}',
    last_quest_reset_date DATE DEFAULT NULL,
    daily_streak INT DEFAULT 0,
    last_daily_claim TIMESTAMP DEFAULT NULL,
    last_vip_claim TIMESTAMP DEFAULT NULL,
    claimed_normal_levels INT[] DEFAULT '{}',
    claimed_vip_levels INT[] DEFAULT '{}',
    last_username_change TIMESTAMP DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    has_elite_ship BOOLEAN DEFAULT false,
    dmg_pve BIGINT DEFAULT 0,
    dmg_pvp BIGINT DEFAULT 0,
    kill_npc INT DEFAULT 0,
    kill_pvp INT DEFAULT 0,
    dmg_amiral BIGINT DEFAULT 0,
    playtime INT DEFAULT 0,
    pvp_points INT DEFAULT 0,
    pvp_target_id INT DEFAULT NULL,
    pvp_changes_left INT DEFAULT 10,
    last_pvp_reset DATE DEFAULT CURRENT_DATE,
    active_design VARCHAR(50) DEFAULT NULL,
    bonus_quest_id INT DEFAULT NULL,
    bonus_quest_expires_at TIMESTAMP DEFAULT NULL,
    quest_progress JSON DEFAULT '[]'::json,
    active_quest_id2 INT DEFAULT NULL,
    is_admin BOOLEAN DEFAULT false,
    is_banned BOOLEAN DEFAULT false,
    ban_reason TEXT DEFAULT NULL,
    banned_at TIMESTAMP DEFAULT NULL,
    ban_expires_at TIMESTAMP DEFAULT NULL,
    device_id VARCHAR(255) DEFAULT NULL,
    banned_devices TEXT[] DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS player_cannons (
    id SERIAL PRIMARY KEY,
    player_id INT REFERENCES players(id) ON DELETE CASCADE,
    cannon_type INT,
    quantity INT DEFAULT 0,
    equipped INT DEFAULT 0,
    UNIQUE(player_id, cannon_type)
);

CREATE TABLE IF NOT EXISTS player_ammo (
    id SERIAL PRIMARY KEY,
    player_id INT REFERENCES players(id) ON DELETE CASCADE,
    ammo_type INT,
    quantity INT DEFAULT 0,
    UNIQUE(player_id, ammo_type)
);

CREATE TABLE IF NOT EXISTS player_items (
    id SERIAL PRIMARY KEY,
    player_id INT REFERENCES players(id) ON DELETE CASCADE,
    item_type VARCHAR(50),
    quantity INT DEFAULT 0,
    UNIQUE(player_id, item_type)
);

CREATE TABLE IF NOT EXISTS player_planks (
    id SERIAL PRIMARY KEY,
    player_id INT REFERENCES players(id) ON DELETE CASCADE,
    plank_type VARCHAR(50),
    quantity INT DEFAULT 0,
    equipped INT DEFAULT 0,
    UNIQUE(player_id, plank_type)
);

CREATE TABLE IF NOT EXISTS ships (
    level INT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    base_hp INT NOT NULL,
    cannon_slots INT NOT NULL,
    plank_slots INT NOT NULL,
    required_elp BIGINT DEFAULT 0,
    pearl_cost INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS cannons (
    id INT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    damage INT NOT NULL,
    reload_time_ms INT NOT NULL,
    price INT NOT NULL,
    currency VARCHAR(10) NOT NULL
);

CREATE TABLE IF NOT EXISTS ammo (
    id INT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    damage_bonus INT NOT NULL,
    elp_per_shot NUMERIC(4,2) DEFAULT 0,
    pack_size INT DEFAULT 100,
    price INT NOT NULL,
    currency VARCHAR(10) NOT NULL
);

CREATE TABLE IF NOT EXISTS planks (
    id SERIAL PRIMARY KEY,
    type_key VARCHAR(30) UNIQUE NOT NULL,
    name VARCHAR(50) NOT NULL,
    hp_bonus INT NOT NULL,
    repair_bonus INT DEFAULT 0,
    break_chance INT DEFAULT 50,
    price INT NOT NULL,
    currency VARCHAR(10) NOT NULL
);

CREATE TABLE IF NOT EXISTS items (
    id SERIAL PRIMARY KEY,
    type_key VARCHAR(30) UNIQUE NOT NULL,
    name VARCHAR(50) NOT NULL,
    effect_pct NUMERIC(4,2) NOT NULL,
    description VARCHAR(200),
    pack_size INT DEFAULT 100,
    price INT NOT NULL,
    currency VARCHAR(10) NOT NULL
);

CREATE TABLE IF NOT EXISTS npcs (
    id SERIAL PRIMARY KEY,
    map_level INT NOT NULL,
    npc_tier INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    hp BIGINT NOT NULL,
    damage INT NOT NULL,
    gold INT DEFAULT 0,
    pearl INT DEFAULT 0,
    xp INT NOT NULL,
    UNIQUE(map_level, npc_tier)
);

CREATE TABLE IF NOT EXISTS bosses (
    id SERIAL PRIMARY KEY,
    map_level INT UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    hp BIGINT NOT NULL,
    damage INT NOT NULL,
    pearl INT NOT NULL,
    xp INT NOT NULL,
    required_kills INT NOT NULL
);

CREATE TABLE IF NOT EXISTS tiamat (
    id INT PRIMARY KEY DEFAULT 1,
    hp BIGINT NOT NULL,
    damage INT NOT NULL,
    pearl INT NOT NULL,
    xp INT NOT NULL,
    spawn_min_min INT DEFAULT 60,
    spawn_max_min INT DEFAULT 180,
    current_hp BIGINT DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS tiamat_damage (
    id SERIAL PRIMARY KEY,
    player_id INT REFERENCES players(id) ON DELETE CASCADE,
    username VARCHAR(100) NOT NULL,
    ship_level INT DEFAULT 0,
    damage_dealt BIGINT DEFAULT 0,
    current_hp INT DEFAULT 1000,
    max_hp INT DEFAULT 1000,
    last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(player_id)
);

CREATE TABLE IF NOT EXISTS admiral_damage (
    id SERIAL PRIMARY KEY,
    map_level INT NOT NULL,
    player_id INT REFERENCES players(id) ON DELETE CASCADE,
    username VARCHAR(100) NOT NULL,
    ship_level INT DEFAULT 0,
    damage_dealt BIGINT DEFAULT 0,
    current_hp INT DEFAULT 1000,
    max_hp INT DEFAULT 1000,
    last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(map_level, player_id)
);

CREATE TABLE IF NOT EXISTS npc3_kill_counter (
    map_level INT PRIMARY KEY,
    kill_count INT DEFAULT 0,
    is_spawned BOOLEAN DEFAULT FALSE,
    spawned_sub_map INT DEFAULT 1,
    boss_current_hp BIGINT DEFAULT NULL,
    boss_max_hp BIGINT DEFAULT NULL,
    last_reset TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS level_requirements (
    level INT PRIMARY KEY,
    required_xp BIGINT NOT NULL,
    unlocks_map VARCHAR(30)
);

CREATE TABLE IF NOT EXISTS auctions (
    id SERIAL PRIMARY KEY,
    seller_id INT REFERENCES players(id) ON DELETE CASCADE,
    item_type VARCHAR(30) NOT NULL,
    quantity INT NOT NULL,
    currency VARCHAR(10) NOT NULL,
    starting_price INT NOT NULL,
    current_price INT NOT NULL,
    highest_bidder_id INT REFERENCES players(id) ON DELETE SET NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE OR REPLACE FUNCTION give_starter_pack()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO player_cannons (player_id, cannon_type, quantity, equipped) VALUES
        (NEW.id, 1, 5, 5),
        (NEW.id, 2, 1, 1);
    INSERT INTO player_ammo (player_id, ammo_type, quantity) VALUES
        (NEW.id, 1, 2000),
        (NEW.id, 2, 1000),
        (NEW.id, 3, 500);
    INSERT INTO player_items (player_id, item_type, quantity) VALUES
        (NEW.id, 'barut', 100),
        (NEW.id, 'zirh', 100);
    INSERT INTO player_planks (player_id, plank_type, quantity, equipped) VALUES
        (NEW.id, 'tahta', 10, 5);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_starter_pack ON players;
CREATE TRIGGER trigger_starter_pack
AFTER INSERT ON players
FOR EACH ROW EXECUTE FUNCTION give_starter_pack();

-- Down
DROP TRIGGER IF EXISTS trigger_starter_pack ON players;
DROP FUNCTION IF EXISTS give_starter_pack();
DROP TABLE IF EXISTS auctions;
DROP TABLE IF EXISTS level_requirements;
DROP TABLE IF EXISTS npc3_kill_counter;
DROP TABLE IF EXISTS admiral_damage;
DROP TABLE IF EXISTS tiamat_damage;
DROP TABLE IF EXISTS tiamat;
DROP TABLE IF EXISTS bosses;
DROP TABLE IF EXISTS npcs;
DROP TABLE IF EXISTS items;
DROP TABLE IF EXISTS planks;
DROP TABLE IF EXISTS ammo;
DROP TABLE IF EXISTS cannons;
DROP TABLE IF EXISTS ships;
DROP TABLE IF EXISTS player_planks;
DROP TABLE IF EXISTS player_items;
DROP TABLE IF EXISTS player_ammo;
DROP TABLE IF EXISTS player_cannons;
DROP TABLE IF EXISTS players;
