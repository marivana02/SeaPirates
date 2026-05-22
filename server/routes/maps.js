const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authenticateToken = require('../middleware/auth');

// Harita bilgisini ve oyuncunun aktif olduğu haritayı getir
router.get('/', authenticateToken, async (req, res) => {
    try {
        const playerRes = await pool.query(
            'SELECT level, current_map_level, current_map_sub FROM players WHERE id = $1',
            [req.player.id]
        );
        if (playerRes.rows.length === 0) return res.status(404).json({ error: 'Player not found' });
        
        const p = playerRes.rows[0];
        
        // Eğer oyuncuda current_map_level yoksa varsayılan 1 yap
        const currentLevel = p.current_map_level || 1;
        const currentSub = p.current_map_sub || 1;

        // Check if there is an active spawned boss for this map level
        const bossCounterRes = await pool.query(
            'SELECT kill_count, is_spawned, spawned_sub_map FROM npc3_kill_counter WHERE map_level = $1',
            [currentLevel]
        );
        
        let bossSpawned = false;
        let bossSubMap = null;
        let bossName = '';
        let bossKillsLeft = 40;
        
        const bossInfoRes = await pool.query(
            'SELECT name, required_kills FROM bosses WHERE map_level = $1',
            [currentLevel]
        );
        
        const bossInfo = bossInfoRes.rows[0] || { name: 'Amiral', required_kills: 40 };
        bossName = bossInfo.name;
        
        if (bossCounterRes.rows.length > 0) {
            const bc = bossCounterRes.rows[0];
            bossSpawned = bc.is_spawned || false;
            bossSubMap = bc.spawned_sub_map;
            bossKillsLeft = Math.max(0, bossInfo.required_kills - bc.kill_count);
        }

        res.json({
            playerLevel: p.level,
            currentMapLevel: currentLevel,
            currentMapSub: currentSub,
            bossSpawned,
            bossSubMap,
            bossName,
            bossKillsLeft
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Harita Değiştir (Sadece oyuncunun leveli yetiyorsa izin ver)
router.post('/change', authenticateToken, async (req, res) => {
    const { targetLevel, targetSub } = req.body;

    if (!targetLevel || !targetSub) {
        return res.status(400).json({ error: 'Target map level and sub are required' });
    }

    try {
        const playerRes = await pool.query('SELECT level FROM players WHERE id = $1', [req.player.id]);
        if (playerRes.rows.length === 0) return res.status(404).json({ error: 'Player not found' });
        
        const playerLevel = playerRes.rows[0].level;

        if (targetLevel > playerLevel) {
            return res.status(403).json({ error: 'Bu haritaya girmek için seviyen yetersiz!' });
        }

        // Sub map validation (Level 1-4 var 2 sub maps, Level 5+ var 1 sub map)
        if (targetLevel <= 4 && (targetSub < 1 || targetSub > 2)) {
            return res.status(400).json({ error: 'Geçersiz alt harita' });
        }
        if (targetLevel >= 5 && targetSub !== 1) {
            return res.status(400).json({ error: 'Geçersiz alt harita' });
        }

        // Harita konumunu güncelle
        await pool.query(
            'UPDATE players SET current_map_level = $1, current_map_sub = $2 WHERE id = $3',
            [targetLevel, targetSub, req.player.id]
        );

        res.json({ success: true, currentMapLevel: targetLevel, currentMapSub: targetSub });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET NPCS ON CURRENT MAP
router.get('/npcs', authenticateToken, async (req, res) => {
    try {
        const playerRes = await pool.query(
            'SELECT current_map_level, current_map_sub FROM players WHERE id = $1',
            [req.player.id]
        );
        if (playerRes.rows.length === 0) return res.status(404).json({ error: 'Oyuncu bulunamadı' });
        
        const mapLevel = playerRes.rows[0].current_map_level || 1;
        const mapSub = playerRes.rows[0].current_map_sub || 1;
        
        // Fetch NPCs for this map level from the database
        const npcsRes = await pool.query(
            'SELECT npc_tier, name, hp, damage, gold, pearl, xp FROM npcs WHERE map_level = $1 ORDER BY npc_tier ASC',
            [mapLevel]
        );
        
        // Convert to frontend friendly key-value map
        const npcsMap = {};
        npcsRes.rows.forEach(npc => {
            let frontKey = 'tier' + npc.npc_tier;
            // Map the frontKey specifically to lower case names or standard key names used by assets
            if (npc.npc_tier === 1) {
                if (mapLevel === 1) frontKey = 'blackpearl';
                else if (mapLevel === 2) frontKey = 'wild13';
                else if (mapLevel === 3) frontKey = 'sinclaresmen';
                else if (mapLevel === 4) frontKey = 'ratpack';
                else if (mapLevel === 5) frontKey = 'wild13';
                else if (mapLevel === 6) frontKey = 'tortugagang';
                else if (mapLevel === 7) frontKey = 'morgansbuccaneers';
                else if (mapLevel === 8) frontKey = 'kiliwallis';
                else if (mapLevel === 9) frontKey = 'kokelua';
                else if (mapLevel === 10) frontKey = 'kilimatu';
            } else if (npc.npc_tier === 2) {
                if (mapLevel === 1) frontKey = 'rackham';
                else if (mapLevel === 2) frontKey = 'red korsar';
                else if (mapLevel === 3) frontKey = 'tortugagang';
                else if (mapLevel === 4) frontKey = 'sinclaresmen';
                else if (mapLevel === 5) frontKey = 'losrenegados';
                else if (mapLevel === 6) frontKey = 'calocosmen';
                else if (mapLevel === 7) frontKey = 'sinclaresmen';
                else if (mapLevel === 8) frontKey = 'flyingdutchman';
                else if (mapLevel === 9) frontKey = 'morgansbuccaneers';
                else if (mapLevel === 10) frontKey = 'kiribati';
            } else if (npc.npc_tier === 3) {
                if (mapLevel === 1) frontKey = 'calicosJack';
                else if (mapLevel === 2) frontKey = 'ratpack';
                else if (mapLevel === 3) frontKey = 'losrenegados';
                else if (mapLevel === 4) frontKey = 'calocosmen';
                else if (mapLevel === 5) frontKey = 'morgansbuccaneers';
                else if (mapLevel === 6) frontKey = 'sinclaresmen';
                else if (mapLevel === 7) frontKey = 'flyingdutchman';
                else if (mapLevel === 8) frontKey = 'kilimatu';
                else if (mapLevel === 9) frontKey = 'kiribati';
                else if (mapLevel === 10) frontKey = 'flyingdutchman';
            }
            npcsMap[frontKey] = {
                name: npc.name,
                hp: parseInt(npc.hp),
                damage: parseInt(npc.damage),
                gold: parseInt(npc.gold),
                pearl: parseInt(npc.pearl),
                xp: parseInt(npc.xp)
            };
        });
        
        // Check if boss is spawned in this map level and sub map
        const bossCounterRes = await pool.query(
            'SELECT is_spawned, spawned_sub_map FROM npc3_kill_counter WHERE map_level = $1',
            [mapLevel]
        );
        
        let bossData = null;
        if (bossCounterRes.rows.length > 0 && bossCounterRes.rows[0].is_spawned && bossCounterRes.rows[0].spawned_sub_map === mapSub) {
            const bossRes = await pool.query(
                'SELECT name, hp, damage, pearl, xp FROM bosses WHERE map_level = $1',
                [mapLevel]
            );
            if (bossRes.rows.length > 0) {
                const b = bossRes.rows[0];
                
                // Haritaya özel amiral (boss) görselini ata
                let bossImg = `assets/npcc/map1/calicosJack.swf/images/amiraljack.png`;
                if (mapLevel === 2) {
                    bossImg = `assets/npcc/map2/ratpack.swf/images/amiralratpack.png`;
                } else if (mapLevel === 3) {
                    bossImg = `assets/npcc/map3/losrenegados.swf/images/amiralrenegados.png`;
                } else if (mapLevel === 4) {
                    bossImg = `assets/npcc/map4/calocosmen.swf/images/amiralcalcos.png`;
                } else if (mapLevel === 5) {
                    bossImg = `assets/npcc/map5/morgansbuccaneers.swf/images/amiralmorgan.png`;
                } else if (mapLevel === 6) {
                    bossImg = `assets/npcc/map6/sinclaresmen.swf/images/amiralsiclares.png`;
                } else if (mapLevel === 7) {
                    bossImg = `assets/npcc/map7/flyingdutchman.swf/images/amiralflying.png`;
                } else if (mapLevel === 8) {
                    bossImg = `assets/npcc/map8/kilimatu.swf/images/amiralkilimatu.png`;
                } else if (mapLevel === 9) {
                    bossImg = `assets/npcc/map9/kiribati.swf/images/amiralkiribati.png`;
                } else if (mapLevel === 10) {
                    bossImg = `assets/npcc/map10/flyingdutchman.swf/images/amiralflying.png`;
                }

                bossData = {
                    name: b.name,
                    hp: parseInt(b.hp),
                    damage: parseInt(b.damage),
                    gold: 0,
                    pearl: parseInt(b.pearl),
                    xp: parseInt(b.xp),
                    img: bossImg,
                    isAdmiral: true
                };
            }
        }
        
        res.json({
            mapLevel,
            npcs: npcsMap,
            bossData
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
