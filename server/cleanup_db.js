const pool = require('./config/db');

async function cleanupDuplicates() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        console.log("=== VERİTABANI MÜKERRER KAYIT TEMİZLEME BAŞLADI ===");

        // 1. player_cannons
        console.log("1. player_cannons tablosu temizleniyor...");
        const pcRes = await client.query(`
            WITH merged AS (
                SELECT player_id, cannon_type, SUM(quantity) as total_qty, SUM(equipped) as total_eq
                FROM player_cannons
                GROUP BY player_id, cannon_type
            )
            SELECT * FROM merged
        `);
        await client.query('DELETE FROM player_cannons');
        for (const row of pcRes.rows) {
            await client.query(
                'INSERT INTO player_cannons (player_id, cannon_type, quantity, equipped) VALUES ($1, $2, $3, $4)',
                [row.player_id, row.cannon_type, row.total_qty, row.total_eq]
            );
        }

        // 2. player_planks
        console.log("2. player_planks tablosu temizleniyor...");
        const ppRes = await client.query(`
            WITH merged AS (
                SELECT player_id, plank_type, SUM(quantity) as total_qty, SUM(equipped) as total_eq
                FROM player_planks
                GROUP BY player_id, plank_type
            )
            SELECT * FROM merged
        `);
        await client.query('DELETE FROM player_planks');
        for (const row of ppRes.rows) {
            await client.query(
                'INSERT INTO player_planks (player_id, plank_type, quantity, equipped) VALUES ($1, $2, $3, $4)',
                [row.player_id, row.plank_type, row.total_qty, row.total_eq]
            );
        }

        // 3. player_items
        console.log("3. player_items tablosu temizleniyor...");
        const piRes = await client.query(`
            WITH merged AS (
                SELECT player_id, item_type, SUM(quantity) as total_qty
                FROM player_items
                GROUP BY player_id, item_type
            )
            SELECT * FROM merged
        `);
        await client.query('DELETE FROM player_items');
        for (const row of piRes.rows) {
            await client.query(
                'INSERT INTO player_items (player_id, item_type, quantity) VALUES ($1, $2, $3)',
                [row.player_id, row.item_type, row.total_qty]
            );
        }

        // 4. player_ammo
        console.log("4. player_ammo tablosu temizleniyor...");
        const paRes = await client.query(`
            WITH merged AS (
                SELECT player_id, ammo_type, SUM(quantity) as total_qty
                FROM player_ammo
                GROUP BY player_id, ammo_type
            )
            SELECT * FROM merged
        `);
        await client.query('DELETE FROM player_ammo');
        for (const row of paRes.rows) {
            await client.query(
                'INSERT INTO player_ammo (player_id, ammo_type, quantity) VALUES ($1, $2, $3)',
                [row.player_id, row.ammo_type, row.total_qty]
            );
        }

        await client.query('COMMIT');
        console.log("=== MÜKERRER KAYIT TEMİZLEME TAMAMLANDI! ===");
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Temizleme sırasında hata:", err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

cleanupDuplicates();
