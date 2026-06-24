-- Up
ALTER TABLE players ADD COLUMN IF NOT EXISTS bonus_quest_progress JSON DEFAULT '[]'::json;

-- Down
ALTER TABLE players DROP COLUMN IF EXISTS bonus_quest_progress;
