-- Up
CREATE TABLE IF NOT EXISTS notification_queue (
  id SERIAL PRIMARY KEY,
  player_id INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  params JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  delivered BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_notification_queue_undelivered
  ON notification_queue (player_id, delivered)
  WHERE delivered = FALSE;
-- Down
DROP TABLE IF EXISTS notification_queue;
