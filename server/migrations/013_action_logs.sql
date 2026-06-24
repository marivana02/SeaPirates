-- Up
CREATE TABLE IF NOT EXISTS action_logs (
    id SERIAL PRIMARY KEY,
    player_id INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL,
    details JSONB DEFAULT '{}',
    ip VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_action_logs_player ON action_logs(player_id);
CREATE INDEX IF NOT EXISTS idx_action_logs_type ON action_logs(action_type);

-- Down
DROP INDEX IF EXISTS idx_action_logs_type;
DROP INDEX IF EXISTS idx_action_logs_player;
DROP TABLE IF EXISTS action_logs;
