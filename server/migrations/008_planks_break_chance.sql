-- Up
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'planks' AND column_name = 'break_chance' AND data_type = 'character varying'
    ) THEN
        ALTER TABLE planks ALTER COLUMN break_chance TYPE INT USING CASE
            WHEN break_chance = 'Yüksek' THEN 50
            WHEN break_chance = 'Düşük' THEN 15
            ELSE 50 END;
    END IF;
END $$;
UPDATE planks SET break_chance = 50 WHERE type_key = 'tahta' AND break_chance IS DISTINCT FROM 50;
UPDATE planks SET break_chance = 15 WHERE type_key = 'elit' AND break_chance IS DISTINCT FROM 15;

-- Down
-- Note: INT to VARCHAR conversion requires manual intervention
