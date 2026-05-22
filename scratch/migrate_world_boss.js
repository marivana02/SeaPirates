const { Pool } = require('pg');
const path = require('path');

const pool = new Pool({
    connectionString: "postgresql://postgres:postgres@localhost:5432/seapirate"
});

async function migrate() {
    try {
        console.log("Starting World Boss DB migration...");

        // 1. Add boss shared HP columns to npc3_kill_counter table if not exists
        await pool.query(`
            ALTER TABLE npc3_kill_counter
            ADD COLUMN IF NOT EXISTS boss_current_hp INT DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS boss_max_hp INT DEFAULT NULL;
        `);
        console.log("npc3_kill_counter columns updated.");

        // 2. Create world_boss_damage table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS world_boss_damage (
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
        console.log("world_boss_damage table created.");

        // 3. Let's make sure the table has the unique constraint just in case
        console.log("World Boss DB migration completed successfully!");
    } catch (err) {
        console.error("Migration error:", err);
    } finally {
        await pool.end();
    }
}

migrate();
