-- Up
ALTER TABLE tiamat ADD COLUMN IF NOT EXISTS spawn_generation INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tiamat_damage ADD COLUMN IF NOT EXISTS spawn_generation INTEGER NOT NULL DEFAULT 0;

-- Down
ALTER TABLE tiamat DROP COLUMN IF EXISTS spawn_generation;
ALTER TABLE tiamat_damage DROP COLUMN IF EXISTS spawn_generation;
