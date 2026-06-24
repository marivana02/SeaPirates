-- Up
CREATE TABLE IF NOT EXISTS player_cannons (
    id SERIAL PRIMARY KEY,
    player_id INT REFERENCES players(id) ON DELETE CASCADE,
    cannon_type INT NOT NULL,
    quantity INT DEFAULT 0,
    equipped INT DEFAULT 0,
    UNIQUE(player_id, cannon_type)
);

CREATE TABLE IF NOT EXISTS player_ammo (
    id SERIAL PRIMARY KEY,
    player_id INT REFERENCES players(id) ON DELETE CASCADE,
    ammo_type INT NOT NULL,
    quantity INT DEFAULT 0,
    UNIQUE(player_id, ammo_type)
);

CREATE TABLE IF NOT EXISTS player_items (
    id SERIAL PRIMARY KEY,
    player_id INT REFERENCES players(id) ON DELETE CASCADE,
    item_type VARCHAR(50) NOT NULL,
    quantity INT DEFAULT 0,
    UNIQUE(player_id, item_type)
);

CREATE TABLE IF NOT EXISTS player_planks (
    id SERIAL PRIMARY KEY,
    player_id INT REFERENCES players(id) ON DELETE CASCADE,
    plank_type VARCHAR(50) NOT NULL,
    quantity INT DEFAULT 0,
    equipped INT DEFAULT 0,
    UNIQUE(player_id, plank_type)
);

-- Down
DROP TABLE IF EXISTS player_cannons;
DROP TABLE IF EXISTS player_ammo;
DROP TABLE IF EXISTS player_items;
DROP TABLE IF EXISTS player_planks;
