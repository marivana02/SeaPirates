const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth');

// Helper to calculate all player ranks based on GDD formula
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
      xpPart,
      epPart,
      dmgPart,
      levelPart,
      daysPart,
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

// Oyuncu bilgilerini getir
router.get('/me', authMiddleware, async (req, res) => {
  try {
    // 1. Kule Tablosu/Gereksinimi Kolonu ekle

    const result = await pool.query(
      `SELECT id, username, email, gold, pearl, xp, level, 
              elite_points, ship_level, hp, max_hp, vip_until, created_at, last_tower_attack, tower_level
       FROM players WHERE id = $1`,
      [req.player.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Oyuncu bulunamadı' });
    }

    let p = result.rows[0];

    // ── OTOMATİK CAN YENİLEME / BATIŞTAN KALKMA MEKANİĞİ ──
    // Eğer canı 0 veya daha düşükse otomatik olarak kaldırıyoruz:
    // VIP varsa: max_hp'nin %10'u kadar canla doğar (min 1.000).
    // VIP yoksa: 1.000 canla doğar.
    if (parseInt(p.hp) <= 0) {
      const isVip = p.vip_until && new Date(p.vip_until) > new Date();
      let respawnHp = 1000;
      if (isVip) {
        respawnHp = Math.max(1000, Math.floor(parseInt(p.max_hp) * 0.10));
      }
      respawnHp = Math.min(parseInt(p.max_hp), respawnHp); // Max HP sınırını aşmasın
      
      p.hp = respawnHp;
      await pool.query('UPDATE players SET hp = $1 WHERE id = $2', [respawnHp, req.player.id]);
    }

    // ── OTOMATİK LEVEL-UP KONTROLÜ ──
    let levelChanged = false;
    while (true) {
        const checkLvl = await pool.query('SELECT required_xp FROM level_requirements WHERE level = $1', [p.level + 1]);
        if (checkLvl.rows.length > 0) {
            const reqXp = checkLvl.rows[0].required_xp;
            if (parseInt(p.xp) >= parseInt(reqXp)) {
                p.level += 1;
                levelChanged = true;
            } else {
                break;
            }
        } else {
            break; // Max level
        }
    }

    if (levelChanged) {
        await pool.query('UPDATE players SET level = $1 WHERE id = $2', [p.level, req.player.id]);
    }

    // Güncel level için bir sonraki levelin xp gereksinimi
    const nextLvlRes = await pool.query('SELECT required_xp FROM level_requirements WHERE level = $1', [p.level + 1]);
    let xpNext = 999999999;
    if (nextLvlRes.rows.length > 0) {
        xpNext = nextLvlRes.rows[0].required_xp;
    }

    // Gülleler
    const ammoRes = await pool.query('SELECT ammo_type, quantity FROM player_ammo WHERE player_id = $1', [req.player.id]);
    
    // Eşyalar
    const itemRes = await pool.query('SELECT item_type, quantity FROM player_items WHERE player_id = $1', [req.player.id]);

    // Kuşanılmış top sayısı
    const cannonsRes = await pool.query('SELECT COALESCE(SUM(equipped), 0) as total FROM player_cannons WHERE player_id = $1', [req.player.id]);
    const equippedCannons = parseInt(cannonsRes.rows[0].total);

    // Dynamic Rank Info
    const allRanks = await calculateAllPlayerRanks(pool);
    const myRankInfo = allRanks.find(r => r.id === req.player.id) || { rankBadge: 13, rankName: "Kara Adamı", score: 0 };

    res.json({
        ...p,
        xpNext,
        equipped_cannons: equippedCannons,
        ammo: ammoRes.rows,
        items: itemRes.rows,
        rankBadge: myRankInfo.rankBadge,
        rankName: myRankInfo.rankName,
        score: myRankInfo.score
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Tamir — her 5sn'de frontend çağırır, max_hp'nin %2'sini ekler
router.post('/repair', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE players
       SET hp = LEAST(max_hp, hp + FLOOR(max_hp * 0.05))
       WHERE id = $1
       RETURNING hp, max_hp`,
      [req.player.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Oyuncu bulunamadı' });
    }

    const { hp, max_hp } = result.rows[0];
    res.json({ hp: parseInt(hp), max_hp: parseInt(max_hp), full: parseInt(hp) >= parseInt(max_hp) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const allRanks = await calculateAllPlayerRanks(pool);
    const top100 = allRanks.slice(0, 100).map(r => ({
      id: r.id,
      username: r.username,
      level: r.level,
      elite_points: r.elite_points,
      score: r.score,
      rankBadge: r.rankBadge,
      rankName: r.rankName
    }));
    res.json(top100);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Şeref Salonu (Hall of Fame)
router.get('/hall-of-fame', authMiddleware, async (req, res) => {
  const category = req.query.category || 'xp';
  const playerId = req.player.id;

  let column = 'xp';
  if (category === 'ep') column = 'elite_points';
  else if (category === 'dmg_pve') column = 'dmg_pve';
  else if (category === 'dmg_pvp') column = 'dmg_pvp';
  else if (category === 'kill_npc') column = 'kill_npc';
  else if (category === 'kill_pvp') column = 'kill_pvp';
  else if (category === 'dmg_amiral') column = 'dmg_amiral';
  else if (category === 'playtime') column = 'playtime';

  try {
    const listRes = await pool.query(
      `SELECT id, username, ${column} AS score,
              ROW_NUMBER() OVER (ORDER BY ${column} DESC, id ASC) as rank
       FROM players
       ORDER BY score DESC, id ASC`
    );

    const allRanks = await calculateAllPlayerRanks(pool);
    const rankMap = {};
    allRanks.forEach(r => {
      rankMap[r.id] = { badge: r.rankBadge, name: r.rankName };
    });

    const players = listRes.rows.map(row => ({
      rank: parseInt(row.rank),
      name: row.username,
      score: parseInt(row.score),
      isMe: row.id === playerId,
      rankBadge: rankMap[row.id] ? rankMap[row.id].badge : 13,
      rankName: rankMap[row.id] ? rankMap[row.id].name : "Kara Adamı"
    }));

    const myData = players.find(p => p.isMe);
    const myRank = myData ? myData.rank : 0;

    res.json({
      players,
      myRank
    });

  } catch (err) {
    console.error("Şeref Salonu Hatası:", err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Oyuncu aktiflik pingleme ve oyun süresi arttırma
router.post('/ping', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  try {
    const result = await pool.query(
      `UPDATE players SET playtime = playtime + 1 WHERE id = $1 RETURNING playtime`,
      [playerId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Oyuncu bulunamadı" });
    }
    res.json({ success: true, playtime: parseInt(result.rows[0].playtime) });
  } catch (err) {
    console.error("Ping Hatası:", err);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// Bugünkü Rütbem (Şeref Salonum)
router.get('/my-rank', authMiddleware, async (req, res) => {
  const playerId = req.player.id;

  try {
    const players = await calculateAllPlayerRanks(pool);
    const total = players.length;

    // Giriş yapan oyuncunun kendi rütbe kartını al
    const myIndex = players.findIndex(p => p.id === playerId);
    if (myIndex === -1) {
      return res.status(404).json({ error: "Oyuncu bulunamadı" });
    }

    const me = players[myIndex];

    // Üst rütbe hedefi (bir üstündeki oyuncu)
    let target = null;
    if (myIndex > 0) {
      const t = players[myIndex - 1];
      target = {
        score: t.score,
        username: t.username,
        rankName: t.rankName,
        rankBadge: t.rankBadge,
        neededPoints: t.score - me.score
      };
    }

    // Alt rütbe (bir altındaki oyuncu)
    let lower = null;
    if (myIndex < total - 1) {
      const l = players[myIndex + 1];
      lower = {
        score: l.score,
        username: l.username,
        rankName: l.rankName,
        rankBadge: l.rankBadge
      };
    }

    res.json({
      me,
      target,
      lower,
      totalPlayers: total
    });

  } catch (err) {
    console.error("Bugünkü Rütbe Hatası:", err);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// Kullanıcı adı değiştirme — Haftada 1 kez sınırı
router.post('/settings/change-username', authMiddleware, async (req, res) => {
  const { newUsername } = req.body;
  const playerId = req.player.id;

  if (!newUsername || newUsername.trim().length < 3 || newUsername.trim().length > 30) {
    return res.status(400).json({ error: 'Kullanıcı adı en az 3, en fazla 30 karakter olmalıdır.' });
  }

  try {
    // Sütunun varlığını doğrula / ekle (on-the-fly migration)

    // Oyuncunun son isim değiştirme tarihini al
    const pRes = await pool.query('SELECT username, last_username_change FROM players WHERE id = $1', [playerId]);
    if (pRes.rows.length === 0) return res.status(404).json({ error: 'Oyuncu bulunamadı.' });

    const player = pRes.rows[0];

    // Haftalık süre kontrolü (7 gün)
    if (player.last_username_change) {
      const diffMs = Date.now() - new Date(player.last_username_change).getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      if (diffDays < 7) {
        const remainingDays = Math.ceil(7 - diffDays);
        return res.status(400).json({ error: `Kullanıcı adınızı haftada sadece 1 kez değiştirebilirsiniz. Kalan süre: ${remainingDays} gün.` });
      }
    }

    // Benzersizlik doğrulaması
    const uniqueRes = await pool.query('SELECT id FROM players WHERE username = $1 AND id <> $2', [newUsername.trim(), playerId]);
    if (uniqueRes.rows.length > 0) {
      return res.status(400).json({ error: 'Bu kullanıcı adı zaten başka bir oyuncu tarafından kullanılıyor.' });
    }

    // Güncelle
    await pool.query(
      'UPDATE players SET username = $1, last_username_change = CURRENT_TIMESTAMP WHERE id = $2',
      [newUsername.trim(), playerId]
    );

    res.json({ message: 'Kullanıcı adınız başarıyla değiştirildi!', username: newUsername.trim() });
  } catch (err) {
    console.error("Kullanıcı Adı Değiştirme Hatası:", err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Pırıltı Toplama API'si — Sunucu Yetkili & Weighted Single-Reward RNG
router.post('/glitter/collect', authMiddleware, async (req, res) => {
  const playerId = req.player.id;

  try {
    // Weighted RNG: Toplam 100
    // XP: 35% (0-34)
    // Gold: 35% (35-69)
    // Hollow Ammo (Oyuk Gülle): 18% (70-87)
    // Pearl (İnci): 8% (88-95)
    // Elite Ammo (Elit Gülle): 4% (96-99)
    const roll = Math.floor(Math.random() * 100);

    let xpReward = 0;
    let goldReward = 0;
    let pearlReward = 0;
    let ammoReward = null;

    if (roll < 35) {
      // Tecrübe (XP) - %35 Şans
      xpReward = Math.floor(Math.random() * 5) + 1; // 1 - 5 XP
    } else if (roll < 70) {
      // Altın - %35 Şans
      goldReward = Math.floor(Math.random() * 101) + 100; // 100 - 200 Altın
    } else if (roll < 88) {
      // Oyuk Gülle - %18 Şans
      const qty = Math.floor(Math.random() * 51) + 100; // 100 - 150 adet
      ammoReward = { type: 2, name: 'Oyuk Gülle', qty };
    } else if (roll < 96) {
      // İnci - %8 Şans (Değerli!)
      pearlReward = Math.floor(Math.random() * 3) + 3; // 3 - 5 İnci
    } else {
      // Elit Gülle - %4 Şans (Çok Değerli!)
      const qty = Math.floor(Math.random() * 41) + 10; // 10 - 50 adet
      ammoReward = { type: 3, name: 'Elit Gülle', qty };
    }

    // 2. Oyuncu veritabanı kaydını güncelle (quest_glitters'ı arttır)
    await pool.query(
      `UPDATE players 
       SET gold = gold + $1, 
           pearl = pearl + $2, 
           xp = xp + $3,
           quest_glitters = CASE WHEN active_quest_id IS NOT NULL THEN COALESCE(quest_glitters, 0) + 1 ELSE COALESCE(quest_glitters, 0) END
       WHERE id = $4`,
      [goldReward, pearlReward, xpReward, playerId]
    );

    // 3. Gülle ödülünü ekle
    if (ammoReward) {
      const exists = await pool.query(
        'SELECT id, quantity FROM player_ammo WHERE player_id = $1 AND ammo_type = $2',
        [playerId, ammoReward.type]
      );
      if (exists.rows.length > 0) {
        await pool.query(
          'UPDATE player_ammo SET quantity = quantity + $1 WHERE id = $2',
          [ammoReward.qty, exists.rows[0].id]
        );
      } else {
        await pool.query(
          'INSERT INTO player_ammo (player_id, ammo_type, quantity) VALUES ($1, $2, $3)',
          [playerId, ammoReward.type, ammoReward.qty]
        );
      }
    }

    // 4. Güncel oyuncu verilerini al
    const updatedRes = await pool.query(
      'SELECT gold, pearl, xp, level FROM players WHERE id = $1',
      [playerId]
    );
    const p = updatedRes.rows[0];

    // 5. Seviye atlama kontrolü
    let leveledUp = false;
    let newLevel = p.level;
    while (true) {
      const checkLvl = await pool.query('SELECT required_xp FROM level_requirements WHERE level = $1', [newLevel + 1]);
      if (checkLvl.rows.length > 0) {
        const reqXp = checkLvl.rows[0].required_xp;
        if (parseInt(p.xp) >= parseInt(reqXp)) {
          newLevel += 1;
          leveledUp = true;
        } else {
          break;
        }
      } else {
        break; // Max level
      }
    }

    if (leveledUp) {
      await pool.query('UPDATE players SET level = $1 WHERE id = $2', [newLevel, playerId]);
      p.level = newLevel;
    }

    // Bir sonraki seviyenin tecrübe gereksinimi
    const nextLvlRes = await pool.query('SELECT required_xp FROM level_requirements WHERE level = $1', [newLevel + 1]);
    let xpNext = 999999999;
    if (nextLvlRes.rows.length > 0) {
      xpNext = nextLvlRes.rows[0].required_xp;
    }

    res.json({
      message: 'Pırıltı başarıyla toplandı!',
      rewards: {
        gold: goldReward,
        xp: xpReward,
        pearl: pearlReward,
        ammo: ammoReward
      },
      player: {
        gold: parseInt(p.gold),
        pearl: parseInt(p.pearl),
        xp: parseInt(p.xp),
        level: p.level,
        xpNext: xpNext
      },
      leveledUp,
      newLevel
    });

  } catch (err) {
    console.error("Pırıltı Toplama Hatası:", err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Günlük Ödül Durumunu Getir
router.get('/daily-reward/status', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  try {


    const pRes = await pool.query('SELECT daily_streak, last_daily_claim, last_vip_claim, vip_until FROM players WHERE id = $1', [playerId]);
    if (pRes.rows.length === 0) return res.status(404).json({ error: 'Oyuncu bulunamadı.' });

    const p = pRes.rows[0];
    let streak = p.daily_streak || 0;
    let lastClaim = p.last_daily_claim;
    let lastVipClaim = p.last_vip_claim;
    const isVip = p.vip_until && new Date(p.vip_until) > new Date();

    let canClaimNormal = false;
    let canClaimVip = false;

    // Normal ödül alım kontrolü
    if (!lastClaim) {
      canClaimNormal = true;
    } else {
      const today = new Date();
      today.setHours(0,0,0,0);
      const last = new Date(lastClaim);
      last.setHours(0,0,0,0);
      
      const diffMs = today.getTime() - last.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        canClaimNormal = true;
      } else if (diffDays > 1) {
        streak = 0; // reset streak
        canClaimNormal = true;
      }
    }

    // VIP ödül alım kontrolü (Eğer VIP aktifse)
    if (isVip) {
      if (!lastVipClaim) {
        canClaimVip = true;
      } else {
        const today = new Date();
        today.setHours(0,0,0,0);
        const lastV = new Date(lastVipClaim);
        lastV.setHours(0,0,0,0);
        if (today.getTime() - lastV.getTime() >= 1000 * 60 * 60 * 24) {
          canClaimVip = true;
        }
      }
    }

    res.json({
      streak,
      lastClaim,
      lastVipClaim,
      isVip,
      canClaimNormal,
      canClaimVip
    });
  } catch (err) {
    console.error("Günlük Ödül Durum Hatası:", err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Günlük Ödülü Al
router.post('/daily-reward/claim', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  const { type } = req.body; // 'normal' veya 'vip'
  
  try {


    const pRes = await pool.query('SELECT daily_streak, last_daily_claim, last_vip_claim, vip_until FROM players WHERE id = $1', [playerId]);
    if (pRes.rows.length === 0) return res.status(404).json({ error: 'Oyuncu bulunamadı.' });

    const p = pRes.rows[0];
    let streak = p.daily_streak || 0;
    let lastClaim = p.last_daily_claim;
    let lastVipClaim = p.last_vip_claim;
    const isVip = p.vip_until && new Date(p.vip_until) > new Date();

    const today = new Date();
    today.setHours(0,0,0,0);

    let canClaimNormal = false;
    if (!lastClaim) {
      canClaimNormal = true;
    } else {
      const last = new Date(lastClaim);
      last.setHours(0,0,0,0);
      const diffMs = today.getTime() - last.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        canClaimNormal = true;
      } else if (diffDays > 1) {
        streak = 0;
        canClaimNormal = true;
      }
    }

    let canClaimVip = false;
    if (isVip) {
      if (!lastVipClaim) {
        canClaimVip = true;
      } else {
        const lastV = new Date(lastVipClaim);
        lastV.setHours(0,0,0,0);
        if (today.getTime() - lastV.getTime() >= 1000 * 60 * 60 * 24) {
          canClaimVip = true;
        }
      }
    }

    let claimNormalAction = false;
    let claimVipAction = false;

    if (type === 'vip') {
      if (!canClaimVip) {
        return res.status(400).json({ error: 'Bugün için VIP ödülü alamazsınız veya VIP değilsiniz.' });
      }
      claimVipAction = true;
    } else {
      // Normal ödül istendiğinde (veya varsayılan olarak ikisi birden)
      if (!canClaimNormal) {
        return res.status(400).json({ error: 'Bugünkü normal ödülünüzü zaten aldınız.' });
      }
      claimNormalAction = true;
      if (canClaimVip) {
        claimVipAction = true;
      }
    }

    let goldReward = 0;
    let pearlReward = 0;
    let ammos = [];
    let items = [];
    let rewardsList = [];

    // Normal Ödül Tanımları
    const normalRewards = {
      1: { gold: 500, name: '500 Altın' },
      2: { pearl: 20, name: '20 İnci' },
      3: { ammo: { type: 2, qty: 200 }, name: '200 Oyuk Gülle' },
      4: { gold: 1200, name: '1.200 Altın' },
      5: { pearl: 50, name: '50 İnci' },
      6: { items: [{ type: 'barut', qty: 3 }, { type: 'zirh', qty: 3 }], name: '3x Barut & Zırh' },
      7: { pearl: 80, ammo: { type: 3, qty: 80 }, name: '80 İnci & 80 Patlayan Gülle' }
    };

    // VIP Ödül Tanımları
    const vipRewards = {
      1: { gold: 2000, name: '2.000 Altın (VIP)' },
      2: { pearl: 80, name: '80 İnci (VIP)' },
      3: { ammo: { type: 2, qty: 800 }, name: '800 Oyuk Gülle (VIP)' },
      4: { gold: 5000, name: '5.000 Altın (VIP)' },
      5: { pearl: 200, name: '200 İnci (VIP)' },
      6: { items: [{ type: 'barut', qty: 12 }, { type: 'zirh', qty: 12 }], name: '12x Barut & Zırh (VIP)' },
      7: { pearl: 320, ammo: { type: 3, qty: 320 }, name: '320 İnci & 320 Patlayan Gülle (VIP)' }
    };

    let newStreak = streak;

    if (claimNormalAction) {
      newStreak = streak + 1;
      if (newStreak > 7) {
        newStreak = 1;
      }
      const r = normalRewards[newStreak];
      if (r.gold) goldReward += r.gold;
      if (r.pearl) pearlReward += r.pearl;
      if (r.ammo) ammos.push(r.ammo);
      if (r.items) items.push(...r.items);
      rewardsList.push(r.name);
    }

    if (claimVipAction) {
      const vipDay = claimNormalAction ? newStreak : streak;
      if (vipDay >= 1 && vipDay <= 7) {
        const r = vipRewards[vipDay];
        if (r.gold) goldReward += r.gold;
        if (r.pearl) pearlReward += r.pearl;
        if (r.ammo) ammos.push(r.ammo);
        if (r.items) items.push(...r.items);
        rewardsList.push(r.name);
      }
    }

    // DB Güncelleme
    if (goldReward > 0 || pearlReward > 0) {
      await pool.query(
        'UPDATE players SET gold = gold + $1, pearl = pearl + $2 WHERE id = $3',
        [goldReward, pearlReward, playerId]
      );
    }

    for (const am of ammos) {
      const exists = await pool.query(
        'SELECT id FROM player_ammo WHERE player_id = $1 AND ammo_type = $2',
        [playerId, am.type]
      );
      if (exists.rows.length > 0) {
        await pool.query(
          'UPDATE player_ammo SET quantity = quantity + $1 WHERE player_id = $2 AND ammo_type = $3',
          [am.qty, playerId, am.type]
        );
      } else {
        await pool.query(
          'INSERT INTO player_ammo (player_id, ammo_type, quantity) VALUES ($1, $2, $3)',
          [playerId, am.type, am.qty]
        );
      }
    }

    for (const it of items) {
      const exists = await pool.query(
        'SELECT id FROM player_items WHERE player_id = $1 AND item_type = $2',
        [playerId, it.type]
      );
      if (exists.rows.length > 0) {
        await pool.query(
          'UPDATE player_items SET quantity = quantity + $1 WHERE player_id = $2 AND item_type = $3',
          [it.qty, playerId, it.type]
        );
      } else {
        await pool.query(
          'INSERT INTO player_items (player_id, item_type, quantity) VALUES ($1, $2, $3)',
          [playerId, it.type, it.qty]
        );
      }
    }

    if (claimNormalAction) {
      await pool.query(
        'UPDATE players SET daily_streak = $1, last_daily_claim = CURRENT_TIMESTAMP WHERE id = $2',
        [newStreak, playerId]
      );
    }
    if (claimVipAction) {
      await pool.query(
        'UPDATE players SET last_vip_claim = CURRENT_TIMESTAMP WHERE id = $2',
        [playerId]
      );
    }

    res.json({
      success: true,
      message: `${rewardsList.join(' ve ')} başarıyla hesabınıza eklendi!`,
      streak: newStreak,
      reward: {
        name: rewardsList.join(' ve '),
        gold: goldReward,
        pearl: pearlReward
      }
    });

  } catch (err) {
    console.error("Günlük Ödül Alma Hatası:", err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Seviye Ödülü Durumunu Getir
router.get('/level-bonus/status', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  try {


    const pRes = await pool.query('SELECT level, claimed_normal_levels, claimed_vip_levels, vip_until FROM players WHERE id = $1', [playerId]);
    if (pRes.rows.length === 0) return res.status(404).json({ error: 'Oyuncu bulunamadı.' });

    const p = pRes.rows[0];
    const claimedNormal = p.claimed_normal_levels || [];
    const claimedVip = p.claimed_vip_levels || [];
    const isVip = p.vip_until && new Date(p.vip_until) > new Date();

    res.json({
      playerLevel: p.level,
      claimedNormal,
      claimedVip,
      isVip
    });
  } catch (err) {
    console.error("Seviye Ödül Durum Hatası:", err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Seviye Ödülünü Al
router.post('/level-bonus/claim', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  const { type, level } = req.body; // type: 'normal' veya 'vip', level: 1..10
  
  const lvlNum = parseInt(level);
  if (!type || isNaN(lvlNum) || lvlNum < 1 || lvlNum > 10) {
    return res.status(400).json({ error: 'Geçersiz istek parametreleri.' });
  }

  try {


    const pRes = await pool.query('SELECT level, claimed_normal_levels, claimed_vip_levels, vip_until FROM players WHERE id = $1', [playerId]);
    if (pRes.rows.length === 0) return res.status(404).json({ error: 'Oyuncu bulunamadı.' });

    const p = pRes.rows[0];
    const playerLevel = p.level;
    const claimedNormal = p.claimed_normal_levels || [];
    const claimedVip = p.claimed_vip_levels || [];
    const isVip = p.vip_until && new Date(p.vip_until) > new Date();

    if (lvlNum > playerLevel) {
      return res.status(400).json({ error: `Seviye ${lvlNum} ödülünü alabilmek için bu seviyeye ulaşmalısınız.` });
    }

    if (type === 'vip') {
      if (!isVip) {
        return res.status(400).json({ error: 'VIP seviye ödülü alabilmek için VIP üyeliğiniz aktif olmalıdır.' });
      }
      if (claimedVip.includes(lvlNum)) {
        return res.status(400).json({ error: 'Bu VIP seviye ödülünü zaten aldınız.' });
      }
    } else {
      if (claimedNormal.includes(lvlNum)) {
        return res.status(400).json({ error: 'Bu normal seviye ödülünü zaten aldınız.' });
      }
    }

    // Ödülleri Tanımla
    const normalRewards = {
      1: { gold: 2000, name: '2.000 Altın' },
      2: { pearl: 80, name: '80 İnci' },
      3: { ammo: { type: 2, qty: 500 }, name: '500 Oyuk Gülle' },
      4: { gold: 5000, name: '5.000 Altın' },
      5: { pearl: 200, name: '200 İnci' },
      6: { items: [{ type: 'barut', qty: 10 }, { type: 'zirh', qty: 10 }], name: '10x Barut & Zırh' },
      7: { ammo: { type: 3, qty: 400 }, name: '400 Patlayan Gülle' },
      8: { gold: 10000, name: '10.000 Altın' },
      9: { pearl: 300, name: '300 İnci' },
      10: { pearl: 600, ammo: { type: 3, qty: 600 }, name: '600 İnci & 600 Patlayan Gülle' }
    };

    const vipRewards = {
      1: { gold: 8000, name: '8.000 Altın (VIP)' },
      2: { pearl: 320, name: '320 İnci (VIP)' },
      3: { ammo: { type: 2, qty: 2000 }, name: '2.000 Oyuk Gülle (VIP)' },
      4: { gold: 20000, name: '20.000 Altın (VIP)' },
      5: { pearl: 800, name: '800 İnci (VIP)' },
      6: { items: [{ type: 'barut', qty: 40 }, { type: 'zirh', qty: 40 }], name: '40x Barut & Zırh (VIP)' },
      7: { ammo: { type: 3, qty: 1600 }, name: '1.600 Patlayan Gülle (VIP)' },
      8: { gold: 40000, name: '40.000 Altın (VIP)' },
      9: { pearl: 1200, name: '1.200 İnci (VIP)' },
      10: { pearl: 2500, ammo: { type: 3, qty: 2500 }, name: '2.500 İnci & 2.500 Patlayan Gülle (VIP)' }
    };

    const reward = type === 'vip' ? vipRewards[lvlNum] : normalRewards[lvlNum];
    let goldReward = reward.gold || 0;
    let pearlReward = reward.pearl || 0;
    let ammos = [];
    let items = [];

    if (reward.ammo) ammos.push(reward.ammo);
    if (reward.items) items.push(...reward.items);

    // DB Güncelleme
    if (goldReward > 0 || pearlReward > 0) {
      await pool.query(
        'UPDATE players SET gold = gold + $1, pearl = pearl + $2 WHERE id = $3',
        [goldReward, pearlReward, playerId]
      );
    }

    for (const am of ammos) {
      const exists = await pool.query(
        'SELECT id FROM player_ammo WHERE player_id = $1 AND ammo_type = $2',
        [playerId, am.type]
      );
      if (exists.rows.length > 0) {
        await pool.query(
          'UPDATE player_ammo SET quantity = quantity + $1 WHERE player_id = $2 AND ammo_type = $3',
          [am.qty, playerId, am.type]
        );
      } else {
        await pool.query(
          'INSERT INTO player_ammo (player_id, ammo_type, quantity) VALUES ($1, $2, $3)',
          [playerId, am.type, am.qty]
        );
      }
    }

    for (const it of items) {
      const exists = await pool.query(
        'SELECT id FROM player_items WHERE player_id = $1 AND item_type = $2',
        [playerId, it.type]
      );
      if (exists.rows.length > 0) {
        await pool.query(
          'UPDATE player_items SET quantity = quantity + $1 WHERE player_id = $2 AND item_type = $3',
          [it.qty, playerId, it.type]
        );
      } else {
        await pool.query(
          'INSERT INTO player_items (player_id, item_type, quantity) VALUES ($1, $2, $3)',
          [playerId, it.type, it.qty]
        );
      }
    }

    if (type === 'vip') {
      await pool.query(
        'UPDATE players SET claimed_vip_levels = array_append(claimed_vip_levels, $1) WHERE id = $2',
        [lvlNum, playerId]
      );
    } else {
      await pool.query(
        'UPDATE players SET claimed_normal_levels = array_append(claimed_normal_levels, $1) WHERE id = $2',
        [lvlNum, playerId]
      );
    }

    res.json({
      success: true,
      message: `${reward.name} ödülü başarıyla hesabınıza eklendi!`,
      reward
    });

  } catch (err) {
    console.error("Seviye Ödül Alma Hatası:", err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

module.exports = router;