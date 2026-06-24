const pool = require('./config/db');

async function fixDisplayNames() {
  try {
    console.log('🔧 Admin dışındaki oyuncuların display_name\'leri düzeltiliyor...');

    const result = await pool.query(
      `UPDATE players 
       SET display_name = username 
       WHERE username != 'admin' 
         AND (display_name IS NULL OR display_name = '' OR display_name != username)
       RETURNING id, username, display_name`
    );

    console.log(`   ✔ ${result.rowCount} oyuncunun display_name'i username'e eşitlendi.`);
    result.rows.forEach(r => {
      console.log(`     - #${r.id}: ${r.username} → ${r.display_name}`);
    });

    const adminCheck = await pool.query(
      "SELECT id, username, display_name FROM players WHERE username = 'admin'"
    );
    if (adminCheck.rows.length > 0) {
      console.log(`   ✔ Admin hesabı korundu: ${adminCheck.rows[0].username} (display_name: ${adminCheck.rows[0].display_name})`);
    }

    console.log('✅ İşlem tamamlandı.');
  } catch (err) {
    console.error('❌ Hata:', err.message);
  } finally {
    await pool.end();
  }
}

fixDisplayNames();
