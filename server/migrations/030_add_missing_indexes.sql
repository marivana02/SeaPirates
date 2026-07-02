-- Up
CREATE INDEX IF NOT EXISTS idx_players_xp ON players(xp);
CREATE INDEX IF NOT EXISTS idx_players_level ON players(level);
CREATE INDEX IF NOT EXISTS idx_players_gold ON players(gold);
CREATE INDEX IF NOT EXISTS idx_players_pearl ON players(pearl);
CREATE INDEX IF NOT EXISTS idx_players_last_daily_claim ON players(last_daily_claim);
CREATE INDEX IF NOT EXISTS idx_players_is_banned ON players(is_banned);
CREATE INDEX IF NOT EXISTS idx_players_pvp_points ON players(pvp_points);
CREATE INDEX IF NOT EXISTS idx_players_current_map_level ON players(current_map_level);
CREATE INDEX IF NOT EXISTS idx_players_weekly_boss_damage ON players(weekly_boss_damage);
CREATE INDEX IF NOT EXISTS idx_players_created_at ON players(created_at);
CREATE INDEX IF NOT EXISTS idx_active_fights_last_activity ON active_fights(last_activity);
CREATE INDEX IF NOT EXISTS idx_auctions_seller ON auctions(seller_id);
CREATE INDEX IF NOT EXISTS idx_auctions_bidder ON auctions(highest_bidder_id);
CREATE INDEX IF NOT EXISTS idx_boss_damage_log_player ON boss_damage_log(player_id);

-- Down
DROP INDEX IF EXISTS idx_players_xp;
DROP INDEX IF EXISTS idx_players_level;
DROP INDEX IF EXISTS idx_players_gold;
DROP INDEX IF EXISTS idx_players_pearl;
DROP INDEX IF EXISTS idx_players_last_daily_claim;
DROP INDEX IF EXISTS idx_players_is_banned;
DROP INDEX IF EXISTS idx_players_pvp_points;
DROP INDEX IF EXISTS idx_players_current_map_level;
DROP INDEX IF EXISTS idx_players_weekly_boss_damage;
DROP INDEX IF EXISTS idx_players_created_at;
DROP INDEX IF EXISTS idx_active_fights_last_activity;
DROP INDEX IF EXISTS idx_auctions_seller;
DROP INDEX IF EXISTS idx_auctions_bidder;
DROP INDEX IF EXISTS idx_boss_damage_log_player;
