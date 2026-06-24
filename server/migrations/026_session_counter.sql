-- Up
ALTER TABLE players ADD COLUMN IF NOT EXISTS session_counter INTEGER DEFAULT 0;

-- Down
ALTER TABLE players DROP COLUMN IF EXISTS session_counter;
