/**
 * Weekly Boss Rewards Güncelleme Scripti
 * 
 * Kullanım:
 *   node update_boss_rewards.js          (mevcut ödülleri gösterir)
 *   node update_boss_rewards.js 1 3000 4000    (1. rank: 3000 inci, 4000 patlayan)
 *   node update_boss_rewards.js 5 1000 1500    (5. rank: 1000 inci, 1500 patlayan)
 *   node update_boss_rewards.js --reset         (fabrika ayarlarına döndürür)
 */
const pool = require('./config/db');

const DEFAULT = {
  1: [2500, 3500], 2: [1800, 2500], 3: [1300, 2000],
  4: [1000, 1600], 5: [800, 1300],  6: [600, 1000],
  7: [500, 800],   8: [400, 600],   9: [300, 500],
  10: [200, 350]
};

(async () => {
  const args = process.argv.slice(2);

  if (args.length === 1 && args[0] === '--reset') {
    for (const [r, [p, a]] of Object.entries(DEFAULT)) {
      await pool.query('UPDATE weekly_boss_rewards SET pearls = $1, ammo = $2 WHERE rank = $3', [p, a, r]);
    }
    console.log('✓ Tüm ödüller fabrika ayarlarına döndürüldü.');
  } else if (args.length === 3) {
    const rank = parseInt(args[0]);
    const pearls = parseInt(args[1]);
    const ammo = parseInt(args[2]);
    if (rank < 1 || rank > 10) { console.error('Rank 1-10 arası olmalıdır.'); process.exit(1); }
    if (pearls < 0 || ammo < 0) { console.error('Değerler negatif olamaz.'); process.exit(1); }
    await pool.query(
      'INSERT INTO weekly_boss_rewards (rank, pearls, ammo) VALUES ($1, $2, $3) ON CONFLICT (rank) DO UPDATE SET pearls = $2, ammo = $3',
      [rank, pearls, ammo]
    );
    console.log(`✓ Rank ${rank} güncellendi: ${pearls} İnci, ${ammo} Patlayan`);
  } else {
    // Göster
    const res = await pool.query('SELECT rank, pearls, ammo FROM weekly_boss_rewards ORDER BY rank');
    console.log('\nMevcut Haftalık Boss Ödülleri:');
    console.log('─────────────────────────────────────');
    for (const row of res.rows) {
      console.log(`  Rank ${String(row.rank).padEnd(2)}: ${String(row.pearls).padStart(5)} İnci, ${String(row.ammo).padStart(5)} Patlayan`);
    }
    console.log('\nKullanım:');
    console.log('  node update_boss_rewards.js <rank> <inci> <patlayan>');
    console.log('  node update_boss_rewards.js --reset\n');
  }

  await pool.end();
})();
