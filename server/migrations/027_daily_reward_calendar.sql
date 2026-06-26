-- Up
ALTER TABLE players ADD COLUMN IF NOT EXISTS claimed_daily_days INT[] DEFAULT '{}';
ALTER TABLE players ADD COLUMN IF NOT EXISTS claimed_vip_days INT[] DEFAULT '{}';
ALTER TABLE players ADD COLUMN IF NOT EXISTS daily_reward_month VARCHAR(7) DEFAULT '';

-- Down
ALTER TABLE players DROP COLUMN IF EXISTS claimed_daily_days;
ALTER TABLE players DROP COLUMN IF EXISTS claimed_vip_days;
ALTER TABLE players DROP COLUMN IF EXISTS daily_reward_month;
