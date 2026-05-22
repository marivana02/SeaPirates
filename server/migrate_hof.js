const pool = require('./config/db');

const alterQuery = `
ALTER TABLE players ADD COLUMN IF NOT EXISTS dmg_pve BIGINT DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS dmg_pvp BIGINT DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS kill_npc INT DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS kill_pvp INT DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS dmg_amiral BIGINT DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS playtime INT DEFAULT 0;
`;

const PIRATE_NAMES = [
  "KaraSakal", "KaptanJack", "Barbaros", "DenizKurdu", "PiriReis", "Gölge", "KorsanBey", "Fırtına",
  "Okyanus", "Lodos", "Poyraz", "Kanca", "Megalodon", "Kraken", "Tayfun", "Vurgun", "Bela", "Kıyamet",
  "Yakamoz", "Reis", "SessizKaptan", "TuzluSu", "DemirYumruk", "KanlıGemi", "Hayalet", "Derinlik", "KorsanKral",
  "KızılSakal", "Rüzgar", "KorsanAna", "KaptanKusto", "Poseidon", "Aşil", "Truva", "Alesta", "Borda",
  "Vira", "Manevra", "Sancak", "İskele", "Yelken", "Pusula", "Harita", "Dürbün", "Siren", "Mercan",
  "Sedef", "DenizYıldızı", "Fener", "Martı", "Albatros", "FırtınaKuşu", "Barakuda", "Balina", "Ahtapot"
];

async function run() {
  try {
    console.log("1. Veritabanı sütunları ekleniyor/güncelleniyor...");
    await pool.query(alterQuery);
    console.log("Veritabanı sütunları başarıyla güncellendi!");

    console.log("2. Mevcut oyuncu sayısı kontrol ediliyor...");
    const checkRes = await pool.query("SELECT COUNT(*) FROM players");
    const count = parseInt(checkRes.rows[0].count);
    console.log(`Veritabanında şu an ${count} oyuncu bulunuyor.`);

    // Bizimle beraber toplamda en az 60 oyuncu olmasını sağlayalım
    if (count < 60) {
      console.log(`Ekstra oyuncular (seed data) oluşturuluyor...`);
      const needed = 60 - count;
      
      for (let i = 0; i < needed; i++) {
        const username = PIRATE_NAMES[i % PIRATE_NAMES.length] + Math.floor(Math.random() * 999);
        const email = `${username.toLowerCase()}@seapirates.com`;
        const password = 'hashedpassword123'; // seed placeholder
        
        const level = Math.floor(Math.random() * 9) + 1; // Level 1-10
        const xp = Math.floor(Math.random() * 800000);
        const gold = Math.floor(Math.random() * 5000000) + 10000;
        const pearl = Math.floor(Math.random() * 100000) + 500;
        const elitePoints = Math.floor(Math.random() * 3000000);
        const shipLevel = Math.floor(Math.random() * 6); // Ship level 0-5
        const hp = 10000 + (shipLevel * 15000);
        const maxHp = hp;

        // İstatistikler
        const dmgPve = Math.floor(Math.random() * 80000000) + 50000;
        const dmgPvp = Math.floor(Math.random() * 15000000) + 10000;
        const killNpc = Math.floor(Math.random() * 8000) + 50;
        const killPvp = Math.floor(Math.random() * 500) + 2;
        const dmgAmiral = Math.floor(Math.random() * 25000000) + 20000;
        const playtime = Math.floor(Math.random() * 40000) + 120; // dakikalar cinsinden

        await pool.query(
          `INSERT INTO players 
           (username, email, password, gold, pearl, xp, level, elite_points, ship_level, hp, max_hp, dmg_pve, dmg_pvp, kill_npc, kill_pvp, dmg_amiral, playtime)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
           ON CONFLICT (username) DO NOTHING`,
          [username, email, password, gold, pearl, xp, level, elitePoints, shipLevel, hp, maxHp, dmgPve, dmgPvp, killNpc, killPvp, dmgAmiral, playtime]
        );
      }
      console.log(`${needed} adet örnek korsan başarıyla veritabanına eklendi!`);
    } else {
      console.log("Yeterli miktarda oyuncu verisi mevcut, seed işlemi atlandı.");
    }
  } catch (err) {
    console.error("Göç ve Seed Hatası:", err);
  } finally {
    await pool.end();
  }
}

run();
