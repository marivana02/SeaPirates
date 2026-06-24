-- Up
CREATE TABLE IF NOT EXISTS active_fights (
    player_id INT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
    npc_name VARCHAR(100) NOT NULL,
    npc_hp BIGINT NOT NULL,
    npc_max_hp BIGINT NOT NULL,
    npc_damage INT NOT NULL,
    npc_gold INT DEFAULT 0,
    npc_pearl INT DEFAULT 0,
    npc_xp INT DEFAULT 0,
    player_hp INT NOT NULL,
    player_max_hp INT NOT NULL,
    weekly_boss_damage_dealt BIGINT DEFAULT 0,
    map_level INT NOT NULL,
    is_admiral BOOLEAN DEFAULT FALSE,
    is_tiamat BOOLEAN DEFAULT FALSE,
    is_tower BOOLEAN DEFAULT FALSE,
    tower_id INT,
    full_img VARCHAR(255),
    damaged_img VARCHAR(255),
    is_weekly_boss BOOLEAN DEFAULT FALSE,
    is_pvp BOOLEAN DEFAULT FALSE,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Down
DROP TABLE IF EXISTS active_fights;
