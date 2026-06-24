-- Up
ALTER TABLE players ADD COLUMN IF NOT EXISTS visual_ship_level INTEGER DEFAULT NULL;

-- Down
ALTER TABLE players DROP COLUMN IF EXISTS visual_ship_level;
