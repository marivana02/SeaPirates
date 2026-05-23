const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth');
const gameData = require('../config/gameData');
const QUESTS = require('../config/questsData');
const { getCurrentEvent } = require('./events');

// Basit RAM tabanlı aktif savaş yönetimi
const activeFights = {};

function getCurrentWeekString() {
    const d = new Date();
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const year = d.getUTCFullYear();
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${year}-W${weekNo < 10 ? '0' + weekNo : weekNo}`;
}



// Boss Durumunu ve Liderlik Tablosunu Getir
router.get('/boss/status', authMiddleware, async (req, res) => {
    const playerId = req.player.id;
    try {
        const currentWeek = getCurrentWeekString();
        
        // 1. Oyuncu verilerini çek ve hafta kontrolü yap
        const pRes = await pool.query(
            'SELECT last_boss_attack, weekly_boss_damage, weekly_boss_week FROM players WHERE id = $1',
            [playerId]
        );
        
        if (pRes.rows.length === 0) return res.status(404).json({ error: 'Oyuncu bulunamadı' });
        
        let pData = pRes.rows[0];
        
        // Eğer hafta değişmişse sıfırla
        if (pData.weekly_boss_week !== currentWeek) {
            await pool.query(
                'UPDATE players SET weekly_boss_damage = 0, weekly_boss_week = $1 WHERE id = $2',
                [currentWeek, playerId]
            );
            pData.weekly_boss_damage = 0;
            pData.weekly_boss_week = currentWeek;
        }
        
        // Bugün saldırdı mı? (TEST İÇİN GEÇİCİ OLARAK HER ZAMAN TRUE YAPILDI)
        let canAttack = true;
        /*
        if (pData.last_boss_attack) {
            const lastAttack = new Date(pData.last_boss_attack).toISOString().split('T')[0];
            const today = new Date().toISOString().split('T')[0];
            if (lastAttack === today) {
                canAttack = false;
            }
        }
        */
        
        // 2. Liderlik tablosunu çek (Sadece bu haftanın hasarı olanlar)
        const leaderboardRes = await pool.query(
            `SELECT COALESCE(display_name, username) AS username, weekly_boss_damage 
             FROM players 
             WHERE weekly_boss_week = $1 AND weekly_boss_damage > 0 
             ORDER BY weekly_boss_damage DESC`,
            [currentWeek]
        );
        
        // 3. Sıfırlanmaya kalan süreyi hesapla (Bir sonraki Pazartesi 00:00 UTC)
        const now = new Date();
        const nextMonday = new Date();
        nextMonday.setUTCDate(now.getUTCDate() + (8 - (now.getUTCDay() || 7)));
        nextMonday.setUTCHours(0, 0, 0, 0);
        const msDiff = nextMonday - now;
        const days = Math.floor(msDiff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((msDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        
        res.json({
            canAttack,
            weeklyDamage: parseInt(pData.weekly_boss_damage || 0),
            leaderboard: leaderboardRes.rows,
            countdown: `${days} gün ${hours} saat`
        });
    } catch(err) {
        console.error(err);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// Savaş Başlat
router.post('/start', authMiddleware, async (req, res) => {
  const { mapLevel, npcName, isTower, towerId, isWeeklyBoss } = req.body;
  const playerId = req.player.id;

  try {
    const pRes = await pool.query('SELECT hp, max_hp, level, username, display_name, ship_level FROM players WHERE id = $1', [playerId]);
    if (pRes.rows.length === 0) return res.status(404).json({ error: 'Oyuncu bulunamadı' });

    let playerHp = pRes.rows[0].hp;
    // Eğer oyuncu batıksa savaşa giremez ama şimdilik test için canını fulleyelim
    if (playerHp <= 0) {
      playerHp = pRes.rows[0].max_hp;
      await pool.query('UPDATE players SET hp = $1 WHERE id = $2', [playerHp, playerId]);
    }

    let targetNpc = null;

    if (isTower) {
      // 1. Kule Tablosu/Gereksinimi Kolonu ekle

      // 2. Seviye Kontrolü (Minimum Lvl 5)
      const pLvl = pRes.rows[0].level || 1;
      if (pLvl < 5) {
        return res.status(400).json({ error: 'Kule Savaşlarına katılabilmek için en az 5. seviye olmalısınız!' });
      }

      // 3. Günlük Limit Kontrolü
      const checkLock = await pool.query('SELECT last_tower_attack FROM players WHERE id = $1', [playerId]);
      if (checkLock.rows.length > 0 && checkLock.rows[0].last_tower_attack) {
        const lastAttack = new Date(checkLock.rows[0].last_tower_attack).toISOString().split('T')[0];
        const today = new Date().toISOString().split('T')[0];
        if (lastAttack === today) {
          return res.status(400).json({ error: 'Bugün zaten bir kuleye saldırdınız. Yarın tekrar deneyin!' });
        }
      }

      // 4. Oyuncu kule seviyesini al (Günlük saldırdıkça/kazandıkça artan lvl)
      const pRes2 = await pool.query('SELECT tower_level FROM players WHERE id = $1', [playerId]);
      const towerLvl = (pRes2.rows[0] && pRes2.rows[0].tower_level) || 1;

      // 5. Kule Görseli Seçimi (Level Aralığına Göre)
      let name = '';
      let fullImg = '';
      let damagedImg = '';
      let calculatedTowerId = 1;

      if (towerLvl <= 25) {
        name = `Tower (Lvl ${towerLvl})`;
        fullImg = 'assets/tower/low1.png';
        damagedImg = 'assets/tower/low2.png';
        calculatedTowerId = 1;
      } else if (towerLvl <= 50) {
        name = `Tower (Lvl ${towerLvl})`;
        fullImg = 'assets/tower/low3.png';
        damagedImg = 'assets/tower/low4.png';
        calculatedTowerId = 2;
      } else if (towerLvl <= 75) {
        name = `Tower (Lvl ${towerLvl})`;
        fullImg = 'assets/tower/middle1.png';
        damagedImg = 'assets/tower/middle2.png';
        calculatedTowerId = 3;
      } else if (towerLvl <= 100) {
        name = `Tower (Lvl ${towerLvl})`;
        fullImg = 'assets/tower/middle3.png';
        damagedImg = 'assets/tower/middle4.png';
        calculatedTowerId = 4;
      } else {
        name = `Tower (Lvl ${towerLvl})`;
        fullImg = 'assets/tower/hard1.png';
        damagedImg = 'assets/tower/hard2.png';
        calculatedTowerId = 5;
      }

      // Dengeli Güç ve Ödül Formülleri
      const hp = 20000 + ((towerLvl - 1) * 8000);
      const damage = 400 + ((towerLvl - 1) * 120);
      const pearl = 150 + (towerLvl * 50);

      // Günlük limiti kilitle
      await pool.query('UPDATE players SET last_tower_attack = CURRENT_DATE WHERE id = $1', [playerId]);

      targetNpc = {
        name: name,
        hp: hp,
        damage: damage,
        gold: 0,
        xp: 0,
        pearl: pearl,
        isTower: true,
        towerId: calculatedTowerId,
        fullImg: fullImg,
        damagedImg: damagedImg
      };
    } else if (isWeeklyBoss) {
      // 1. Günlük Limit Kontrolü (TEST İÇİN GEÇİCİ OLARAK DEVRE DIŞI)
      /*
      const checkLock = await pool.query('SELECT last_boss_attack FROM players WHERE id = $1', [playerId]);
      if (checkLock.rows.length > 0 && checkLock.rows[0].last_boss_attack) {
        const lastAttack = new Date(checkLock.rows[0].last_boss_attack).toISOString().split('T')[0];
        const today = new Date().toISOString().split('T')[0];
        if (lastAttack === today) {
          return res.status(400).json({ error: 'Bugün zaten Boss saldırısı yaptınız! Yarın tekrar deneyebilirsiniz.' });
        }
      }

      // Günlük limiti kilitle
      await pool.query('UPDATE players SET last_boss_attack = CURRENT_DATE WHERE id = $1', [playerId]);
      */

      targetNpc = {
        name: 'Efsanevi Leviathan',
        hp: 100000000, // 100 Milyon HP
        damage: 500,  // Dengeli vuruş (oyuncunun hayatta kalması için)
        gold: 0,
        xp: 0,
        pearl: 0,
        isWeeklyBoss: true,
        fullImg: 'assets/weekly_boss.png',
        damagedImg: 'assets/weekly_boss.png'
      };
    } else {
      // Check if it's an Admiral Boss
      if (npcName && npcName.startsWith('Admiral')) {
        const bossDbRes = await pool.query(
          'SELECT name, hp, damage, pearl, xp FROM bosses WHERE map_level = $1 AND name = $2 LIMIT 1',
          [mapLevel || 1, npcName]
        );
        if (bossDbRes.rows.length > 0) {
          const dbBoss = bossDbRes.rows[0];
          let bossImg = `assets/npcc/map${mapLevel || 1}/calicosJack.swf/images/amiraljack.png`;
          if (mapLevel === 2) {
            bossImg = `assets/npcc/map2/ratpack.swf/images/amiralratpack.png`;
          } else if (mapLevel === 3) {
            bossImg = `assets/npcc/map3/losrenegados.swf/images/amiralrenegado.png`;
          } else if (mapLevel !== 1) {
            bossImg = `assets/npcc/map${mapLevel}/calicosJack.swf/images/amiraljack.png`; // safe fallback
          }
          
          targetNpc = {
            name: dbBoss.name,
            hp: parseInt(dbBoss.hp),
            damage: parseInt(dbBoss.damage),
            gold: 0,
            pearl: parseInt(dbBoss.pearl),
            xp: parseInt(dbBoss.xp),
            isAdmiral: true,
            fullImg: bossImg,
            damagedImg: bossImg
          };
        }
      }

      // If targetNpc was not found as a boss, search in npcs table
      if (!targetNpc) {
        const npcDbRes = await pool.query(
          'SELECT name, hp, damage, gold, pearl, xp FROM npcs WHERE map_level = $1 AND name = $2 LIMIT 1',
          [mapLevel || 1, npcName]
        );
        
        if (npcDbRes.rows.length > 0) {
          const dbNpc = npcDbRes.rows[0];
          targetNpc = {
            name: dbNpc.name,
            hp: parseInt(dbNpc.hp),
            damage: parseInt(dbNpc.damage),
            gold: parseInt(dbNpc.gold),
            pearl: parseInt(dbNpc.pearl),
            xp: parseInt(dbNpc.xp)
          };
        } else {
          // Fallback (eğer veritabanında bulunamazsa)
          targetNpc = { name: npcName, hp: 10000, damage: 200, gold: 300, xp: 50, pearl: 0 };
        }
      }
    }

    const pInfo = pRes.rows[0];
    let isAdmiral = false;
    let bossCurrentHp = targetNpc.hp;

    if (targetNpc && targetNpc.isAdmiral) {
      isAdmiral = true;
      const fightMapLvl = mapLevel || 1;
      
      // Register or update player in admiral_damage
      await pool.query(
        `INSERT INTO admiral_damage (map_level, player_id, username, ship_level, current_hp, max_hp)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (map_level, player_id) 
         DO UPDATE SET current_hp = $5, max_hp = $6, last_active = CURRENT_TIMESTAMP`,
        [fightMapLvl, playerId, pInfo.display_name || pInfo.username, pInfo.ship_level, playerHp, pInfo.max_hp]
      );

      // Initialize/fetch shared boss HP from npc3_kill_counter
      const bcRes = await pool.query(
        'SELECT boss_current_hp FROM npc3_kill_counter WHERE map_level = $1',
        [fightMapLvl]
      );
      if (bcRes.rows.length > 0) {
        const row = bcRes.rows[0];
        if (row.boss_current_hp !== null && row.boss_current_hp > 0) {
          bossCurrentHp = parseInt(row.boss_current_hp);
        } else {
          await pool.query(
            'UPDATE npc3_kill_counter SET boss_current_hp = $1, boss_max_hp = $2 WHERE map_level = $3',
            [targetNpc.hp, targetNpc.hp, fightMapLvl]
          );
          bossCurrentHp = targetNpc.hp;
        }
      } else {
        await pool.query(
          'INSERT INTO npc3_kill_counter (map_level, kill_count, is_spawned, boss_current_hp, boss_max_hp) VALUES ($1, 0, TRUE, $2, $2)',
          [fightMapLvl, targetNpc.hp]
        );
        bossCurrentHp = targetNpc.hp;
      }
    }

    activeFights[playerId] = {
      npc: targetNpc,
      npcHp: isAdmiral ? bossCurrentHp : targetNpc.hp,
      npcMaxHp: targetNpc.hp,
      playerHp: playerHp,
      playerMaxHp: pInfo.max_hp,
      weeklyBossDamageDealt: 0,
      mapLevel: mapLevel || 1,
      isAdmiral: isAdmiral
    };

    res.json({
      message: 'Savaş başladı',
      npcName: targetNpc.name,
      npcHp: isAdmiral ? bossCurrentHp : targetNpc.hp,
      npcMaxHp: targetNpc.hp,
      playerHp: playerHp,
      playerMaxHp: pInfo.max_hp,
      isTower: !!isTower,
      fullImg: targetNpc.fullImg || null,
      damagedImg: targetNpc.damagedImg || null,
      isAdmiral: isAdmiral
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Gerçek Hasar Hesaplama
router.post('/attack', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  const { ammoId, useBarut, useZirh } = req.body;
  const fight = activeFights[playerId];

  if (!fight) {
    return res.status(400).json({ error: 'Aktif bir savaş yok' });
  }

  try {
    // 1. Topları getir (geminin slot limiti ile kısıtla)
    const playerDbRes = await pool.query('SELECT username, display_name, ship_level, max_hp, hp FROM players WHERE id = $1', [playerId]);
    const pDbInfo = playerDbRes.rows[0];
    const shipLevel = pDbInfo?.ship_level || 0;
    const activeShip = gameData.SHIPS.find(s => s.level === shipLevel) || gameData.SHIPS[0];

    const eqCannons = await pool.query(`
      SELECT pc.equipped as equipped, c.damage 
      FROM player_cannons pc
      JOIN cannons c ON pc.cannon_type = c.id
      WHERE pc.player_id = $1 AND pc.equipped > 0
      ORDER BY c.damage DESC
    `, [playerId]);

    let totalCannons = 0;
    let totalCannonDamage = 0;
    let remainingSlots = activeShip.cannonSlots; // Geminin top slot limiti

    for (const row of eqCannons.rows) {
      if (remainingSlots <= 0) break;
      const usable = Math.min(row.equipped, remainingSlots);
      totalCannons += usable;
      totalCannonDamage += usable * row.damage;
      remainingSlots -= usable;
    }

    if (totalCannons === 0) {
        totalCannons = 1;
        totalCannonDamage = 20; 
    }


    // 2. Gülleleri getir ve düş
    let ammoDamage = 0;
    let actualCannonsFired = totalCannons;
    let givesElp = false;

    if (ammoId) {
        const ammoRes = await pool.query(`
            SELECT pa.quantity, a.damage_bonus as damage
            FROM player_ammo pa
            JOIN ammo a ON pa.ammo_type = a.id
            WHERE pa.player_id = $1 AND pa.ammo_type = $2
        `, [playerId, ammoId]);

        if (ammoRes.rows.length > 0) {
            let availableAmmo = ammoRes.rows[0].quantity;
            if (availableAmmo < totalCannons) {
                actualCannonsFired = availableAmmo; 
            }
            if (actualCannonsFired > 0) {
                ammoDamage = ammoRes.rows[0].damage;
                if (ammoId === 3) givesElp = true; // patlayan gülle id'si
                await pool.query('UPDATE player_ammo SET quantity = quantity - $1 WHERE player_id = $2 AND ammo_type = $3', [actualCannonsFired, playerId, ammoId]);
            }
        } else {
            actualCannonsFired = 0;
        }
    } else {
        actualCannonsFired = 0;
    }

    // Eğer oyuncunun seçili güllesi kalmadıysa hasarı 0 olur
    let finalDamage = 0;
    if (actualCannonsFired > 0) {
        finalDamage = totalCannonDamage + (actualCannonsFired * ammoDamage);
    }
    let finalNpcDamage = fight.npc.damage;

    // 3. Barut ve Zırh
    if (useBarut) {
        const bRes = await pool.query(`SELECT quantity FROM player_items WHERE player_id = $1 AND item_type = 'barut'`, [playerId]);
        if (bRes.rows.length > 0 && bRes.rows[0].quantity > 0) {
            await pool.query(`UPDATE player_items SET quantity = quantity - 1 WHERE player_id = $1 AND item_type = 'barut'`, [playerId]);
            finalDamage = Math.floor(finalDamage * 1.10);
        }
    }

    if (useZirh) {
        const zRes = await pool.query(`SELECT quantity FROM player_items WHERE player_id = $1 AND item_type = 'zirh'`, [playerId]);
        if (zRes.rows.length > 0 && zRes.rows[0].quantity > 0) {
            await pool.query(`UPDATE player_items SET quantity = quantity - 1 WHERE player_id = $1 AND item_type = 'zirh'`, [playerId]);
            finalNpcDamage = Math.floor(finalNpcDamage * 0.90);
        }
    }

    // Etkinlik çarpanı: Hasar (sadece patlayan gülle ile)
    const ev = await getCurrentEvent();
    if (ev.type === 'damage' && ammoId == 3) {
      finalDamage = Math.floor(finalDamage * ev.mult);
    }

    // ELP ekle
    let gainedElp = 0;
    if (givesElp && actualCannonsFired > 0) {
        gainedElp = actualCannonsFired;
        if (ev.type === 'elp_reward') gainedElp *= ev.mult;
        await pool.query('UPDATE players SET elite_points = elite_points + $1 WHERE id = $2', [gainedElp, playerId]);
    }

    const playerDamage = finalDamage;
    const npcDamage = finalNpcDamage;
    const npcObj = fight.npc || {};
    const npcNameStr = npcObj.name || '';
    const isBoss = npcNameStr.includes('Admiral') || npcNameStr === 'Tiamat';

    // NPC hasar alır
    if (fight.isAdmiral) {
        // Vurulan hasarı admiral_damage tablosuna işle
        await pool.query(
            `INSERT INTO admiral_damage (map_level, player_id, username, ship_level, damage_dealt, current_hp, max_hp)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (map_level, player_id) 
             DO UPDATE SET damage_dealt = admiral_damage.damage_dealt + $5`,
            [fight.mapLevel, playerId, pDbInfo.display_name || pDbInfo.username, pDbInfo.ship_level, playerDamage, fight.playerHp, fight.playerMaxHp]
        );

        // Ortak amiral canını veritabanından çek ve düş
        const bcRes = await pool.query(
            'SELECT boss_current_hp, is_spawned FROM npc3_kill_counter WHERE map_level = $1',
            [fight.mapLevel]
        );
        let sharedHp = fight.npcHp;
        let isSpawned = true;
        if (bcRes.rows.length > 0) {
            isSpawned = bcRes.rows[0].is_spawned;
            if (bcRes.rows[0].boss_current_hp !== null) {
                sharedHp = parseInt(bcRes.rows[0].boss_current_hp);
            } else if (!isSpawned) {
                sharedHp = 0; // Amiral başka biri tarafından zaten kesilmiş!
            }
        } else {
            sharedHp = 0; // Kayıt yoksa zaten kesilmiştir
        }
        
        const newHp = Math.max(0, sharedHp - playerDamage);
        fight.npcHp = newHp;

        if (isSpawned) {
            await pool.query(
                'UPDATE npc3_kill_counter SET boss_current_hp = $1 WHERE map_level = $2',
                [newHp, fight.mapLevel]
            );
        }
    } else {
        fight.npcHp -= playerDamage;
        if (fight.npcHp < 0) fight.npcHp = 0;
    }

    // Eğer oyuncunun aktif görevi varsa quest_damage'ı arttır (Sadece hasar gerektiren aktif görevlerde)
    if (playerDamage > 0) {
        try {
            const pQuestRes = await pool.query('SELECT active_quest_id FROM players WHERE id = $1', [playerId]);
            if (pQuestRes.rows.length > 0 && pQuestRes.rows[0].active_quest_id !== null) {
                const activeQuestId = pQuestRes.rows[0].active_quest_id;
                const activeQuest = QUESTS[activeQuestId];
                if (activeQuest && activeQuest.requiredDamage > 0) {
                    await pool.query(
                        'UPDATE players SET quest_damage = quest_damage + $1 WHERE id = $2',
                        [playerDamage, playerId]
                    );
                }
            }
        } catch (qErr) {
            console.error('Quest damage update error in combat:', qErr);
        }
    }

    if (npcObj.isWeeklyBoss) {
        fight.npcHp = fight.npcMaxHp; // Boss canı sınırsız olacak yani boss batmaz!
        fight.weeklyBossDamageDealt = (fight.weeklyBossDamageDealt || 0) + playerDamage;
        const currentWeekStr = getCurrentWeekString();
        await pool.query(
            `UPDATE players 
             SET weekly_boss_damage = CASE 
                 WHEN weekly_boss_week = $1 THEN GREATEST(weekly_boss_damage, $2)
                 ELSE $2
             END,
             weekly_boss_week = $1
             WHERE id = $3`,
            [currentWeekStr, fight.weeklyBossDamageDealt, playerId]
        );
    }

    if (fight.npcHp === 0) {
        // Görev İlerlemesini Güncelle (Sadece canavar öldürme bazlı görevler)
        try {
            const pQuestRes = await pool.query('SELECT active_quest_id FROM players WHERE id = $1', [playerId]);
            if (pQuestRes.rows.length > 0 && pQuestRes.rows[0].active_quest_id !== null) {
                const activeQuestId = pQuestRes.rows[0].active_quest_id;
                const activeQuest = QUESTS[activeQuestId];
                if (activeQuest && activeQuest.requiredKills > 0) {
                    let match = false;
                    if (activeQuest.targetNpc) {
                        if (npcObj.name === activeQuest.targetNpc) match = true;
                        else if (activeQuest.targetNpc === 'Admiral Jack' && npcNameStr.includes('Jack')) match = true;
                    }
                    if (match) {
                        await pool.query(
                            'UPDATE players SET quest_kills = quest_kills + 1 WHERE id = $1',
                            [playerId]
                        );
                    }
                }
            }
        } catch (qErr) {
            console.error('Quest update error in combat:', qErr);
        }

        // Check VIP status for rewards (+10%)
        let vipMult = 1.0;
        try {
            const vipRes = await pool.query('SELECT vip_until FROM players WHERE id = $1', [playerId]);
            if (vipRes.rows.length > 0 && vipRes.rows[0].vip_until && new Date(vipRes.rows[0].vip_until) > new Date()) {
                vipMult = 1.10;
            }
        } catch (vipErr) {
            console.error('VIP check error in combat:', vipErr);
        }

        const ev = await getCurrentEvent();
        const evMult = ev.type === 'npc_reward' ? ev.mult : 1;

        // Gold, pearl, xp çarpan (vipMult SQL içinde $6 olarak uygulanacak)
        const rewGold = Math.floor((npcObj.gold || 0) * evMult);
        const rewPearl = Math.floor((npcObj.pearl || 0) * evMult);
        const rewXp = Math.floor((npcObj.xp || 0) * evMult);

        // Ödülleri ver + İstatistikleri arttır
        if (npcObj.isTower) {
            await pool.query(
                `UPDATE players 
                 SET pearl = pearl + FLOOR($1::numeric * $4::numeric),
                     hp = $2,
                     tower_level = COALESCE(tower_level, 1) + 1
                 WHERE id = $3`,
                [npcObj.pearl || 0, fight.playerHp, playerId, vipMult]
            );
        } else if (fight.isAdmiral) {
            // Admiral için oyuncunun hasarına göre ödül hesapla
            let admRewardPearl = 0, admRewardXp = 0;
            try {
                const bRes = await pool.query('SELECT hp, pearl, xp FROM bosses WHERE map_level = $1 LIMIT 1', [fight.mapLevel]);
                if (bRes.rows.length > 0) {
                    const b = bRes.rows[0];
                    const bossMaxHp = parseInt(b.hp) || 150000;
                    const totalPearls = parseInt(b.pearl) || 15000;
                    const totalXp = parseInt(b.xp) || 1000;
                    const admDmgRes = await pool.query('SELECT damage_dealt FROM admiral_damage WHERE map_level = $1 AND player_id = $2', [fight.mapLevel, playerId]);
                    const playerAdmDmg = admDmgRes.rows.length > 0 ? parseInt(admDmgRes.rows[0].damage_dealt) : playerDamage;
                    const pct = Math.min(1.0, playerAdmDmg / bossMaxHp);
                    admRewardPearl = Math.floor(totalPearls * pct);
                    admRewardXp = Math.floor(totalXp * pct);
                }
            } catch (e) { console.error('Admiral reward calc error:', e); }

            await pool.query(
                `UPDATE players 
                 SET dmg_amiral = dmg_amiral + $1
                 WHERE id = $2`,
                [playerDamage, playerId]
            );
            await distributeAdmiralRewards(fight.mapLevel);
            npcObj.gold = 0;
            npcObj.pearl = admRewardPearl;
            npcObj.xp = admRewardXp;
        } else if (isBoss) {
            await pool.query(
                `UPDATE players 
                 SET gold = gold + FLOOR($1::numeric * $6::numeric), 
                     pearl = pearl + FLOOR($2::numeric * $6::numeric), 
                     xp = xp + $3,
                     dmg_amiral = dmg_amiral + $4
                 WHERE id = $5`,
                [rewGold, rewPearl, rewXp, playerDamage, playerId, vipMult]
            );
        } else {
            await pool.query(
                `UPDATE players 
                 SET gold = gold + FLOOR($1::numeric * $6::numeric), 
                     pearl = pearl + FLOOR($2::numeric * $6::numeric), 
                     xp = xp + $3,
                     dmg_pve = dmg_pve + $4,
                     kill_npc = kill_npc + 1
                 WHERE id = $5`,
                [rewGold, rewPearl, rewXp, playerDamage, playerId, vipMult]
            );

            // Standart NPC batırılınca sayaç artır ve spawn kontrolü yap
            if (!npcObj.isTower && !npcObj.isWeeklyBoss) {
                try {
                    const fightMapLvl = fight.mapLevel || 1;
                    await pool.query(
                        `INSERT INTO npc3_kill_counter (map_level, kill_count)
                         VALUES ($1, 1)
                         ON CONFLICT (map_level)
                         DO UPDATE SET kill_count = npc3_kill_counter.kill_count + 1`,
                        [fightMapLvl]
                    );

                    // Sayaç ve Boss bilgilerini çek
                    const bcRes = await pool.query(
                        'SELECT kill_count, is_spawned FROM npc3_kill_counter WHERE map_level = $1',
                        [fightMapLvl]
                    );
                    const bossRes = await pool.query(
                        'SELECT required_kills, name FROM bosses WHERE map_level = $1',
                        [fightMapLvl]
                    );

                    if (bcRes.rows.length > 0 && bossRes.rows.length > 0) {
                        const bc = bcRes.rows[0];
                        const bossInfo = bossRes.rows[0];

                        if (!bc.is_spawned && bc.kill_count >= bossInfo.required_kills) {
                            const maxSubs = fightMapLvl <= 4 ? 2 : 1;
                            const randomSubMap = Math.floor(Math.random() * maxSubs) + 1;

                            await pool.query(
                                `UPDATE npc3_kill_counter 
                                 SET is_spawned = TRUE, 
                                     spawned_sub_map = $1, 
                                     kill_count = 0 
                                 WHERE map_level = $2`,
                                [randomSubMap, fightMapLvl]
                            );
                            console.log(`[BOSS SPAWN] ${bossInfo.name} spawned in Map ${fightMapLvl}-${randomSubMap}!`);
                        }
                    }
                } catch (counterErr) {
                    console.error('NPC3 kill counter increment error:', counterErr);
                }
            }
        }

        // ── LEVEL-UP KONTROLÜ ──
        let leveledUp = false;
        let newLevel = null;

        const lvlRes = await pool.query(
            `SELECT p.level, p.xp, lr.required_xp
             FROM players p
             LEFT JOIN level_requirements lr ON lr.level = p.level + 1
             WHERE p.id = $1`,
            [playerId]
        );

        if (lvlRes.rows.length > 0) {
            const row = lvlRes.rows[0];
            if (row.required_xp !== null && parseInt(row.xp) >= parseInt(row.required_xp)) {
                await pool.query('UPDATE players SET level = level + 1 WHERE id = $1', [playerId]);
                leveledUp = true;
                newLevel = parseInt(row.level) + 1;
            }
        }

        delete activeFights[playerId];
        return res.json({
            state: 'won', npcHp: 0, playerHp: fight.playerHp, playerDamage, npcDamage: 0,
            rewards: { gold: rewGold, xp: rewXp, pearl: rewPearl, elp: gainedElp },
            consumed: { ammo: actualCannonsFired, barut: useBarut ? 1 : 0, zirh: useZirh ? 1 : 0 },
            leveledUp,
            newLevel,
            isAdmiral: fight.isAdmiral
        });
    }

    // Oyuncu veya diğeri hasar alır (Admiral rastgele hedef belirler)
    let targetHitUsername = pDbInfo.display_name || pDbInfo.username;
    let targetHitId = playerId;
    let actualNpcDamage = npcDamage;

    if (fight.isAdmiral) {
        // Canı 0'dan büyük katılanlar arasından rastgele hedef seç
        const partRes = await pool.query(
            'SELECT player_id, username, current_hp FROM admiral_damage WHERE map_level = $1 AND current_hp > 0',
            [fight.mapLevel]
        );
        
        if (partRes.rows.length > 0) {
            const targetRow = partRes.rows[Math.floor(Math.random() * partRes.rows.length)];
            targetHitId = parseInt(targetRow.player_id);
            targetHitUsername = targetRow.username;
        }

        // Seçilen hedefin canını düşür
        await pool.query(
            'UPDATE admiral_damage SET current_hp = GREATEST(0, current_hp - $1) WHERE map_level = $2 AND player_id = $3',
            [npcDamage, fight.mapLevel, targetHitId]
        );

        if (targetHitId === playerId) {
            fight.playerHp -= npcDamage;
            if (fight.playerHp < 0) fight.playerHp = 0;
        } else {
            // Başka biri veya bot hasar aldı! Aktif oyuncuya hasar vurulmaz.
            actualNpcDamage = 0;
            
            if (targetHitId > 0) {
                // Diğer gerçek oyuncunun canını veritabanında düşür
                await pool.query(
                    'UPDATE players SET hp = GREATEST(0, hp - $1) WHERE id = $2',
                    [npcDamage, targetHitId]
                );
                if (activeFights[targetHitId]) {
                    activeFights[targetHitId].playerHp = Math.max(0, activeFights[targetHitId].playerHp - npcDamage);
                }
            }
        }
    } else {
        fight.playerHp -= npcDamage;
        if (fight.playerHp < 0) fight.playerHp = 0;
    }

    if (fight.playerHp === 0) {
        if (npcObj.isWeeklyBoss) {
            const totalSessionDmg = fight.weeklyBossDamageDealt || 0;
            await pool.query(
                `UPDATE players SET hp = max_hp WHERE id = $1`,
                [playerId]
            );
            
            delete activeFights[playerId];
            return res.json({ 
                state: 'lost', npcHp: fight.npcHp, playerHp: 0, playerDamage, npcDamage: actualNpcDamage,
                isWeeklyBoss: true,
                weeklyBossDamageDealt: totalSessionDmg,
                rewards: { gold: 0, xp: 0, pearl: 0, elp: gainedElp },
                consumed: { ammo: actualCannonsFired, barut: useBarut ? 1 : 0, zirh: useZirh ? 1 : 0 }
            });
        }

        if (fight.isAdmiral) {
            await pool.query(
                `UPDATE players SET hp = 0, dmg_amiral = dmg_amiral + $1 WHERE id = $2`,
                [playerDamage, playerId]
            );
        } else if (isBoss) {
            await pool.query(
                `UPDATE players SET hp = 0, dmg_amiral = dmg_amiral + $1 WHERE id = $2`,
                [playerDamage, playerId]
            );
        } else {
            await pool.query(
                `UPDATE players SET hp = 0, dmg_pve = dmg_pve + $1 WHERE id = $2`,
                [playerDamage, playerId]
            );
        }
        delete activeFights[playerId];
        return res.json({ 
            state: 'lost', npcHp: fight.npcHp, playerHp: 0, playerDamage, npcDamage: actualNpcDamage,
            consumed: { ammo: actualCannonsFired, barut: useBarut ? 1 : 0, zirh: useZirh ? 1 : 0 },
            targetHit: targetHitUsername
        });
    }

    if (npcObj.isTower) {
        await pool.query(
            `UPDATE players SET hp = $1 WHERE id = $2`,
            [fight.playerHp, playerId]
        );
    } else if (fight.isAdmiral) {
        await pool.query(
            `UPDATE players SET hp = $1, dmg_amiral = dmg_amiral + $2 WHERE id = $3`,
            [fight.playerHp, playerDamage, playerId]
        );
    } else if (isBoss) {
        await pool.query(
            `UPDATE players SET hp = $1, dmg_amiral = dmg_amiral + $2 WHERE id = $3`,
            [fight.playerHp, playerDamage, playerId]
        );
    } else {
        await pool.query(
            `UPDATE players SET hp = $1, dmg_pve = dmg_pve + $2 WHERE id = $3`,
            [fight.playerHp, playerDamage, playerId]
        );
    }

    res.json({ 
        state: 'ongoing', npcHp: fight.npcHp, playerHp: fight.playerHp, playerDamage, npcDamage: actualNpcDamage, elpGained: gainedElp,
        weeklyBossDamageDealt: fight.weeklyBossDamageDealt || 0,
        consumed: { ammo: actualCannonsFired, barut: useBarut ? 1 : 0, zirh: useZirh ? 1 : 0 },
        targetHit: targetHitUsername,
        isAdmiral: fight.isAdmiral
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Savaş sırasında sunucu hatası' });
  }
});

// GET LIVE ADMIRAL STATUS & LEADERBOARD (WITH ACTIVE BOT SIMULATION)
router.get('/admiral-status', authMiddleware, async (req, res) => {
    try {
        const playerId = req.player.id;
        const playerRes = await pool.query(
            'SELECT current_map_level FROM players WHERE id = $1',
            [playerId]
        );
        if (playerRes.rows.length === 0) return res.status(404).json({ error: 'Player not found' });
        
        const mapLevel = playerRes.rows[0].current_map_level || 1;

        // Fetch shared boss status
        const bcRes = await pool.query(
            'SELECT boss_current_hp, boss_max_hp, is_spawned FROM npc3_kill_counter WHERE map_level = $1',
            [mapLevel]
        );
        
        if (bcRes.rows.length === 0 || !bcRes.rows[0].is_spawned || bcRes.rows[0].boss_current_hp === null) {
            return res.json({ spawned: false });
        }

        let bossHp = parseInt(bcRes.rows[0].boss_current_hp);
        const bossMaxHp = parseInt(bcRes.rows[0].boss_max_hp);

        // ── BOT SALDIRISI KALDIRILDI (mock yapay oyuncular) ──

        // Fetch active damage list (only real players, no bots)
        const dmgRes = await pool.query(
            `SELECT player_id, username, ship_level, damage_dealt, current_hp, max_hp 
             FROM admiral_damage 
             WHERE map_level = $1 AND player_id > 0
             ORDER BY damage_dealt DESC`,
            [mapLevel]
        );

        res.json({
            spawned: true,
            bossHp,
            bossMaxHp,
            leaderboard: dmgRes.rows
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

async function distributeAdmiralRewards(mapLevel) {
    try {
        // 0. Reset spawning state atomically first to prevent concurrent double-rewards
        const resetRes = await pool.query(
            `UPDATE npc3_kill_counter 
             SET is_spawned = FALSE, 
                 boss_current_hp = NULL, 
                 boss_max_hp = NULL, 
                 kill_count = 0 
             WHERE map_level = $1 AND is_spawned = TRUE`,
            [mapLevel]
        );
        
        if (resetRes.rowCount === 0) {
            console.log(`[REWARD DISTRIBUTION] Already run or not spawned for Map Level ${mapLevel}. Skipping.`);
            return;
        }

        console.log(`[REWARD DISTRIBUTION] Distributing rewards for Map Level ${mapLevel}...`);
        
        // 1. Fetch boss max HP and reward details
        const bossInfoRes = await pool.query(
            'SELECT hp, pearl, xp FROM bosses WHERE map_level = $1 LIMIT 1',
            [mapLevel]
        );
        if (bossInfoRes.rows.length === 0) return;
        
        const b = bossInfoRes.rows[0];
        const bossMaxHp = parseInt(b.hp) || 150000;
        const totalPearls = parseInt(b.pearl) || 15000;
        const totalXp = parseInt(b.xp) || 1000;

        // 2. Fetch all contributors
        const partsRes = await pool.query(
            'SELECT player_id, username, damage_dealt FROM admiral_damage WHERE map_level = $1 AND damage_dealt > 0',
            [mapLevel]
        );

        for (const row of partsRes.rows) {
            const pId = parseInt(row.player_id);
            const dmg = parseInt(row.damage_dealt);
            
            const pct = Math.min(1.0, dmg / bossMaxHp);
            const rewardPearls = Math.floor(totalPearls * pct);
            const rewardXp = Math.floor(totalXp * pct);

            if (pId > 0 && rewardPearls > 0) {
                await pool.query(
                    'UPDATE players SET pearl = pearl + $1, xp = xp + $2 WHERE id = $3',
                    [rewardPearls, rewardXp, pId]
                );
                console.log(`[REWARD] Sent ${rewardPearls} Pearls and ${rewardXp} XP to player ID ${pId} (${row.username})`);
            }
        }

        // 4. Clear participant damage details for this map
        await pool.query(
            'DELETE FROM admiral_damage WHERE map_level = $1',
            [mapLevel]
        );
        console.log(`[REWARD DISTRIBUTION] Completed for Map Level ${mapLevel}.`);
    } catch (err) {
        console.error('Reward distribution error:', err);
    }
}

module.exports = router;
