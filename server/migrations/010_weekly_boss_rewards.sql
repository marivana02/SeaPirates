-- Up
CREATE TABLE IF NOT EXISTS weekly_boss_rewards (
    rank INT PRIMARY KEY,
    pearls INT NOT NULL DEFAULT 0,
    ammo INT NOT NULL DEFAULT 0
);
INSERT INTO weekly_boss_rewards (rank, pearls, ammo) VALUES
    (1, 2500, 3500), (2, 1800, 2500), (3, 1300, 2000),
    (4, 1000, 1600), (5, 800, 1300),  (6, 600, 1000),
    (7, 500, 800),   (8, 400, 600),   (9, 300, 500),
    (10, 200, 350)
ON CONFLICT (rank) DO NOTHING;

-- Down
DROP TABLE IF EXISTS weekly_boss_rewards;
