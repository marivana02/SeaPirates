-- Up
ALTER TABLE players ADD COLUMN IF NOT EXISTS has_elite_ship BOOLEAN DEFAULT false;
UPDATE players SET has_elite_ship = true WHERE ship_level >= 1 AND NOT has_elite_ship;

-- Down
ALTER TABLE players DROP COLUMN IF EXISTS has_elite_ship;
