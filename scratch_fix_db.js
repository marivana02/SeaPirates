const pool = require('./server/config/db');

async function fixDb() {
    try {
        await pool.query('ALTER TABLE player_cannons ADD COLUMN IF NOT EXISTS equipped INT DEFAULT 0;');
        await pool.query('ALTER TABLE player_planks ADD COLUMN IF NOT EXISTS equipped INT DEFAULT 0;');
        await pool.query('ALTER TABLE players ADD COLUMN IF NOT EXISTS tower_level INT DEFAULT 1;');
        await pool.query('ALTER TABLE npc3_kill_counter ADD COLUMN IF NOT EXISTS is_spawned BOOLEAN DEFAULT FALSE;');
        await pool.query('ALTER TABLE npc3_kill_counter ADD COLUMN IF NOT EXISTS spawned_sub_map INT DEFAULT 1;');
        
        // Let's also fix seed_db.js for future uses
        console.log('DB Fixed!');
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

fixDb();
