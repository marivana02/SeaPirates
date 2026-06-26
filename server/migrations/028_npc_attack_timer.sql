-- Up
ALTER TABLE active_fights ADD COLUMN IF NOT EXISTS last_npc_attack TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Down
ALTER TABLE active_fights DROP COLUMN IF EXISTS last_npc_attack;
