const pool = require('../server/config/db');

async function migrate() {
    try {
        console.log("Starting Admiral Shared DB migration...");

        // 1. Add boss shared HP columns to npc3_kill_counter table if not exists
        await pool.query(`
            ALTER TABLE npc3_kill_counter
            ADD COLUMN IF NOT EXISTS boss_current_hp INT DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS boss_max_hp INT DEFAULT NULL;
        `);
        console.log("npc3_kill_counter columns updated.");

        // 2. Create admiral_damage table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS admiral_damage (
                id SERIAL PRIMARY KEY,
                map_level INT NOT NULL,
                player_id INT NOT NULL,
                username VARCHAR(100) NOT NULL,
                ship_level INT DEFAULT 0,
                damage_dealt INT DEFAULT 0,
                current_hp INT DEFAULT 1000,
                max_hp INT DEFAULT 1000,
                last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(map_level, player_id)
            );
        `);
        console.log("admiral_damage table created.");

        console.log("Admiral DB migration completed successfully!");
    } catch (err) {
        console.error("Migration error:", err);
    } finally {
        await pool.end();
    }
}

migrate();
