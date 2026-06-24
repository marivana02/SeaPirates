-- Up
CREATE TABLE IF NOT EXISTS boss_damage_log (
    id SERIAL PRIMARY KEY,
    boss_session_id UUID,
    player_id INT REFERENCES players(id) ON DELETE CASCADE,
    damage_dealt BIGINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Down
DROP TABLE IF EXISTS boss_damage_log;
