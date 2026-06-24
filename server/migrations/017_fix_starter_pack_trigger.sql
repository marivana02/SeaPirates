-- Up
-- Recreate give_starter_pack() after all dependent tables exist (created in 014)
DROP TRIGGER IF EXISTS trigger_starter_pack ON players;
DROP FUNCTION IF EXISTS give_starter_pack();

CREATE OR REPLACE FUNCTION give_starter_pack()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO player_cannons (player_id, cannon_type, quantity, equipped) VALUES
        (NEW.id, 1, 5, 5),
        (NEW.id, 2, 1, 1);
    INSERT INTO player_ammo (player_id, ammo_type, quantity) VALUES
        (NEW.id, 1, 2000),
        (NEW.id, 2, 1000),
        (NEW.id, 3, 500);
    INSERT INTO player_items (player_id, item_type, quantity) VALUES
        (NEW.id, 'barut', 100),
        (NEW.id, 'zirh', 100);
    INSERT INTO player_planks (player_id, plank_type, quantity, equipped) VALUES
        (NEW.id, 'tahta', 10, 5);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_starter_pack ON players;
CREATE TRIGGER trigger_starter_pack
AFTER INSERT ON players
FOR EACH ROW EXECUTE FUNCTION give_starter_pack();

-- Down
DROP TRIGGER IF EXISTS trigger_starter_pack ON players;
DROP FUNCTION IF EXISTS give_starter_pack();
