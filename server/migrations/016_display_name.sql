-- Up
ALTER TABLE players ADD COLUMN IF NOT EXISTS display_name VARCHAR(50) DEFAULT '';
UPDATE players SET display_name = username WHERE username != 'admin' AND display_name IS NULL;

-- Down
ALTER TABLE players DROP COLUMN IF EXISTS display_name;
