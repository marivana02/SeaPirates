let cachedRanks = null;
let cachedAt = 0;
const CACHE_TTL_MS = 30000;

const rankNames = {
  1: { tr: "Denizlerin Hükümdarı", en: "Ruler of the Seas", key: "rank_1" },
  2: { tr: "Korsan Kralı", en: "Pirate King", key: "rank_2" },
  3: { tr: "Korsan Prensi", en: "Pirate Prince", key: "rank_3" },
  4: { tr: "Korsan Baronu", en: "Ruler of the Seven Seas", key: "rank_4" },
  5: { tr: "Yağmacı", en: "Pirate King", key: "rank_5" },
  6: { tr: "Deniz Haydudu", en: "Prince of Pirates", key: "rank_6" },
  7: { tr: "Korsar", en: "Baron of the Seas", key: "rank_7" },
  8: { tr: "Korsan Adayı", en: "Buccaneer", key: "rank_8" },
  9: { tr: "Denizci", en: "Swashbuckler", key: "rank_9" },
  10: { tr: "Gemi Çaylağı", en: "Corsair", key: "rank_10" },
  11: { tr: "Tahta Fırçacısı", en: "Coastal Raider", key: "rank_11" },
  12: { tr: "Deniz Tutkunu", en: "Rookie Pirate", key: "rank_12" },
  13: { tr: "Kara Adamı", en: "Sailor", key: "rank_13" }
};

const TOTAL_SLOTS = 1726; // 1+3+6+10+16+25+40+65+100+160+250+400+650
const BASE_SLOTS = [0, 1, 3, 6, 10, 16, 25, 40, 65, 100, 160, 250, 400, 650];

function allocateSlots(totalCount) {
  var slots = [0];
  // İlk 4 rank sabit: 1, 3, 6, 10
  var fixed = [1, 3, 6, 10];
  for (var i = 0; i < 4 && i < totalCount; i++) {
    slots[i + 1] = Math.min(fixed[i], totalCount - slots.reduce(function(a, b) { return a + b; }));
    if (slots[i + 1] < 0) slots[i + 1] = 0;
  }
  // Kalan rankları orantılı dağıt
  var used = slots.reduce(function(a, b) { return a + b; });
  var remaining = totalCount - used;
  if (remaining > 0) {
    var ratioSum = 0;
    for (var i = 5; i <= 13; i++) ratioSum += BASE_SLOTS[i];
    if (ratioSum > 0) {
      var remainders = [];
      var floorSum = 0;
      for (var i = 5; i <= 13; i++) {
        var exact = BASE_SLOTS[i] * remaining / ratioSum;
        slots[i] = Math.floor(exact);
        remainders[i] = exact - slots[i];
        floorSum += slots[i];
      }
      var extra = remaining - floorSum;
      while (extra > 0) {
        var bestIdx = 5;
        for (var i = 6; i <= 13; i++) {
          if (remainders[i] > remainders[bestIdx]) bestIdx = i;
        }
        if (remainders[bestIdx] < 0) break;
        slots[bestIdx]++;
        remainders[bestIdx] = -1;
        extra--;
      }
    }
  }
  // Kalan her şey rank 13'e
  var assigned = 0; for (var i = 1; i <= 13; i++) assigned += slots[i] || 0;
  slots[13] = (slots[13] || 0) + totalCount - assigned;
  return slots;
}

function getRankBadge(pos, totalCount) {
  if (pos <= 0) return 13;
  var slots = totalCount < TOTAL_SLOTS ? allocateSlots(totalCount) : BASE_SLOTS;
  var cumulative = 0;
  for (var badge = 1; badge <= 13; badge++) {
    cumulative += slots[badge];
    if (pos <= cumulative) return badge;
  }
  return 13;
}

async function calculateAllPlayerRanks(pool) {
  const now = Date.now();
  if (cachedRanks && (now - cachedAt) < CACHE_TTL_MS) {
    return cachedRanks;
  }

  const result = await pool.query(
    `SELECT id, username, display_name, xp, elite_points, dmg_pve, level, created_at FROM players WHERE (is_admin = false OR is_admin IS NULL) AND (is_banned = false OR is_banned IS NULL)`
  );

  const players = result.rows.map(p => {
    const days = Math.max(1, Math.floor((Date.now() - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24)));
    const xpPart = Math.floor(parseInt(p.xp) / 1500);
    const epPart = Math.floor(parseInt(p.elite_points) / 5000);
    const dmgPart = Math.floor(parseInt(p.dmg_pve) / 200000);
    const levelPart = Math.max(0, (parseInt(p.level) - 1)) * 100;
    const daysPart = days * 5;
    const score = xpPart + epPart + dmgPart + levelPart + daysPart;

    return {
      id: p.id,
      username: p.display_name || p.username,
      login_username: p.username,
      xp: parseInt(p.xp),
      elite_points: parseInt(p.elite_points),
      dmg_pve: parseInt(p.dmg_pve),
      level: parseInt(p.level),
      days, xpPart, epPart, dmgPart, levelPart, daysPart, score
    };
  });

  players.sort((a, b) => b.score - a.score);
  const total = players.length;

  let currentPos = 0;
  let lastScore = null;
  players.forEach((p, idx) => {
    if (p.score !== lastScore) {
      currentPos = idx + 1;
      lastScore = p.score;
    }
    p.position = currentPos;
    p.rankBadge = getRankBadge(p.position, total);
    p.rankName = rankNames[p.rankBadge].tr;
    p.rankKey = rankNames[p.rankBadge].key;
  });

  cachedRanks = players;
  cachedAt = Date.now();
  return players;
}

async function getPlayerMainRankById(pool, playerId) {
  const all = await calculateAllPlayerRanks(pool);
  const found = all.find(r => r.id === playerId);
  if (found) {
    return { badge: found.rankBadge, name: found.rankName, position: found.position, score: found.score, rankKey: found.rankKey };
  }
  return { badge: 13, name: rankNames[13].tr, position: 999, score: 0, rankKey: rankNames[13].key };
}

module.exports = { calculateAllPlayerRanks, rankNames, getRankBadge, getPlayerMainRankById };
