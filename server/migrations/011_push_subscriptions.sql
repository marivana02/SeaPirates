-- Up
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id SERIAL PRIMARY KEY,
    player_id INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    auth VARCHAR(255) NOT NULL,
    p256dh VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(player_id, endpoint)
);

-- Down
DROP TABLE IF EXISTS push_subscriptions;
