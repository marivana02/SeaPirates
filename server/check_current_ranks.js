const pool = require('./config/db');

async function calculateAllPlayerRanks(pool) {
  const result = await pool.query(
    `SELECT id, username, xp, elite_points, dmg_pve, level, created_at FROM players`
  );

  const rankNames = {
    1: "Denizlerin Hükümdarı",
    2: "Korsan Kralı",
    3: "Korsan Prensi",
    4: "Korsan Baronu",
    5: "Yağmacı",
    6: "Deniz Haydudu",
    7: "Korsar",
    8: "Korsan Adayı",
    9: "Denizci",
    10: "Gemi Çaylağı",
    11: "Tahta Fırçacısı",
    12: "Deniz Tutkunu",
    13: "Kara Adamı"
  };

  const players = result.rows.map(p => {
    const days = Math.max(1, Math.floor((Date.now() - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24)));
    const xpPart = Math.floor(parseInt(p.xp) / 1500);
    const epPart = Math.floor(parseInt(p.elite_points) / 5000);
    const dmgPart = Math.floor(parseInt(p.dmg_pve) / 200000);
    const levelPart = parseInt(p.level) * 100;
    const daysPart = days * 5;
    const score = xpPart + epPart + dmgPart + levelPart + daysPart;

    return {
      id: p.id,
      username: p.username,
      xp: parseInt(p.xp),
      elite_points: parseInt(p.elite_points),
      dmg_pve: parseInt(p.dmg_pve),
      level: parseInt(p.level),
      days,
      score
    };
  });

  // Sort descending by score
  players.sort((a, b) => b.score - a.score);

  const total = players.length;

  const getRankBadge = (pos, totalCount) => {
    // Testler ve küçük sunucular için: Oyuncu sayısı 50'den azsa doğrudan sıralamaya göre dağıt
    if (totalCount < 50) {
      if (pos === 1) return 1;  // Denizlerin Hükümdarı
      if (pos === 2) return 2;  // Korsan Kralı
      if (pos === 3) return 3;  // Korsan Prensi
      if (pos === 4) return 4;  // Korsan Baronu
      if (pos === 5) return 5;  // Yağmacı
      if (pos === 6) return 6;  // Deniz Haydudu
      if (pos === 7) return 7;  // Korsar
      if (pos === 8) return 8;  // Korsan Adayı
      if (pos === 9) return 9;  // Denizci
      if (pos === 10) return 10; // Gemi Çaylağı
      if (pos === 11) return 11; // Tahta Fırçacısı
      if (pos === 12) return 12; // Deniz Tutkunu
      return 13;                 // Kara Adamı
    }

    // Oyuncu sayısı 50 veya daha fazlaysa orijinal GDD yüzdelik sistemini kullan
    if (pos === 1) return 1;
    const pct = (pos / totalCount) * 100;
    if (pct <= 1.5) return 2;
    if (pct <= 3.0 + 1.5) return 3;
    if (pct <= 4.0 + 4.5) return 4;
    if (pct <= 5.0 + 8.5) return 5;
    if (pct <= 6.0 + 13.5) return 6;
    if (pct <= 7.0 + 19.5) return 7;
    if (pct <= 8.0 + 26.5) return 8;
    if (pct <= 9.0 + 34.5) return 9;
    if (pct <= 10.0 + 43.5) return 10;
    if (pct <= 12.0 + 53.5) return 11;
    if (pct <= 15.0 + 65.5) return 12;
    return 13;
  };

  players.forEach((p, idx) => {
    p.position = idx + 1;
    p.rankBadge = getRankBadge(p.position, total);
    p.rankName = rankNames[p.rankBadge];
  });

  return players;
}

async function checkRanks() {
  try {
    const players = await calculateAllPlayerRanks(pool);
    console.log("=== OYUNCU RÜTBE SIRALAMASI ===");
    console.table(players.map(p => ({
      Sıra: p.position,
      Oyuncu: p.username,
      Level: p.level,
      Score: p.score,
      'Rütbe ID': p.rankBadge,
      'Rütbe Adı': p.rankName
    })));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkRanks();
