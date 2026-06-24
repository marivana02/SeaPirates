-- Up
ALTER TABLE planks ADD COLUMN IF NOT EXISTS repair_bonus INT DEFAULT 0;
UPDATE planks SET repair_bonus = 8 WHERE type_key = 'tahta' AND repair_bonus = 0;
UPDATE planks SET repair_bonus = 20 WHERE type_key = 'elit' AND repair_bonus = 0;

-- Down
ALTER TABLE planks DROP COLUMN IF EXISTS repair_bonus;
