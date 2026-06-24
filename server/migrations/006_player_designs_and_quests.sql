-- Up
CREATE TABLE IF NOT EXISTS player_designs (
    id SERIAL PRIMARY KEY,
    player_id INT REFERENCES players(id) ON DELETE CASCADE,
    design_key VARCHAR(50) NOT NULL,
    UNIQUE(player_id, design_key)
);
ALTER TABLE players ADD COLUMN IF NOT EXISTS active_design VARCHAR(50) DEFAULT NULL;
ALTER TABLE players ADD COLUMN IF NOT EXISTS bonus_quest_id INT DEFAULT NULL;
ALTER TABLE players ADD COLUMN IF NOT EXISTS bonus_quest_expires_at TIMESTAMP DEFAULT NULL;
ALTER TABLE players ADD COLUMN IF NOT EXISTS quest_progress JSON DEFAULT '[]'::json;

-- Down
ALTER TABLE players DROP COLUMN IF EXISTS quest_progress;
ALTER TABLE players DROP COLUMN IF EXISTS bonus_quest_expires_at;
ALTER TABLE players DROP COLUMN IF EXISTS bonus_quest_id;
ALTER TABLE players DROP COLUMN IF EXISTS active_design;
DROP TABLE IF EXISTS player_designs;
