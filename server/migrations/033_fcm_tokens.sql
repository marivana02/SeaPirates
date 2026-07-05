-- Up
CREATE TABLE IF NOT EXISTS fcm_tokens (
  id SERIAL PRIMARY KEY,
  player_id INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(player_id, token)
);

CREATE INDEX IF NOT EXISTS idx_fcm_tokens_player ON fcm_tokens (player_id);
-- Down
DROP TABLE IF EXISTS fcm_tokens;
