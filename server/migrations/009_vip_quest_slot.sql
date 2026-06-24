-- Up
ALTER TABLE players ADD COLUMN IF NOT EXISTS active_quest_id2 INT DEFAULT NULL;

-- Down
ALTER TABLE players DROP COLUMN IF EXISTS active_quest_id2;
