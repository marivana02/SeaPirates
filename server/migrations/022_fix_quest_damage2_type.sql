-- Up
ALTER TABLE players ALTER COLUMN quest_damage2 TYPE BIGINT;

-- Down
ALTER TABLE players ALTER COLUMN quest_damage2 TYPE INT;
