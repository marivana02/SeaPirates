const pool = require('./config/db');

async function checkDatabase() {
    try {
        console.log("=== SEAPIRATE VERİTABANI ÖZETİ ===");
        
        // Tablo kayıt sayıları
        const counts = await Promise.all([
            pool.query('SELECT COUNT(*) FROM players'),
            pool.query('SELECT COUNT(*) FROM ships'),
            pool.query('SELECT COUNT(*) FROM cannons'),
            pool.query('SELECT COUNT(*) FROM ammo'),
            pool.query('SELECT COUNT(*) FROM planks'),
            pool.query('SELECT COUNT(*) FROM items'),
            pool.query('SELECT COUNT(*) FROM npcs'),
            pool.query('SELECT COUNT(*) FROM bosses'),
            pool.query('SELECT COUNT(*) FROM auctions'),
        ]);

        console.log("\n📊 KAYIT SAYILARI:");
        console.log(`- Oyuncular (players): ${counts[0].rows[0].count}`);
        console.log(`- Gemiler (ships): ${counts[1].rows[0].count}`);
        console.log(`- Toplar (cannons): ${counts[2].rows[0].count}`);
        console.log(`- Gülleler (ammo): ${counts[3].rows[0].count}`);
        console.log(`- Direkler (planks): ${counts[4].rows[0].count}`);
        console.log(`- Eşyalar (items): ${counts[5].rows[0].count}`);
        console.log(`- NPC'ler (npcs): ${counts[6].rows[0].count}`);
        console.log(`- Boss'lar (bosses): ${counts[7].rows[0].count}`);
        console.log(`- Açık Artırmalar (auctions): ${counts[8].rows[0].count}`);

        // Örnek Oyuncu
        if (counts[0].rows[0].count > 0) {
            const players = await pool.query('SELECT username, gold, pearl, level, ship_level, elite_points FROM players LIMIT 3');
            console.log("\n🧑 ÖRNEK OYUNCULAR:");
            console.table(players.rows);
        }

        // Örnek Gemi
        const ships = await pool.query('SELECT level, name, base_hp, cannon_slots, plank_slots FROM ships LIMIT 3');
        console.log("\n🚢 GEMİLER (İlk 3):");
        console.table(ships.rows);

        // Örnek NPC
        const npcs = await pool.query('SELECT name, map_level, hp, damage, gold, pearl FROM npcs LIMIT 3');
        console.log("\n👾 NPC'LER (İlk 3):");
        console.table(npcs.rows);

        // Örnek Açık Artırma
        if (counts[8].rows[0].count > 0) {
            const auctions = await pool.query('SELECT item_type, current_price, highest_bidder_id, expires_at FROM auctions LIMIT 3');
            console.log("\n⚖️ AKTİF AÇIK ARTIRMALAR:");
            console.table(auctions.rows);
        }

    } catch (err) {
        console.error("Hata:", err.message);
    } finally {
        await pool.end();
    }
}

checkDatabase();
