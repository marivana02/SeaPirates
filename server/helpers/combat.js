const pool = require('../config/db');

async function getWeeklyBossRewards() {
    try {
        const res = await pool.query('SELECT rank, pearls, ammo FROM weekly_boss_rewards ORDER BY rank');
        const rewards = {};
        for (const row of res.rows) {
            rewards[row.rank] = { pearls: parseInt(row.pearls), ammo: parseInt(row.ammo) };
        }
        return rewards;
    } catch (err) {
        console.error('getWeeklyBossRewards error:', err.message);
        // fallback
        return {
            1: { pearls: 2500, ammo: 3500 }, 2: { pearls: 1800, ammo: 2500 },
            3: { pearls: 1300, ammo: 2000 }, 4: { pearls: 1000, ammo: 1600 },
            5: { pearls: 800, ammo: 1300 },  6: { pearls: 600, ammo: 1000 },
            7: { pearls: 500, ammo: 800 },   8: { pearls: 400, ammo: 600 },
            9: { pearls: 300, ammo: 500 },   10: { pearls: 200, ammo: 350 }
        };
    }
}

async function distributeAdmiralRewards(mapLevel) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query("SELECT pg_advisory_xact_lock($1)", [70000 + mapLevel]);

        const resetRes = await client.query(
            `UPDATE npc3_kill_counter 
             SET is_spawned = FALSE, 
                 boss_current_hp = NULL, 
                 boss_max_hp = NULL, 
                 kill_count = 0 
             WHERE map_level = $1 AND is_spawned = TRUE`,
            [mapLevel]
        );

        if (resetRes.rowCount === 0) {
            await client.query('ROLLBACK');
            console.log(`[REWARD] Already run or not spawned for Map Level ${mapLevel}. Skipping.`);
            return { rewardsGiven: false };
        }

        console.log(`[REWARD] Distributing rewards for Map Level ${mapLevel}...`);

        const bossInfoRes = await client.query(
            'SELECT hp, pearl, xp FROM bosses WHERE map_level = $1 LIMIT 1',
            [mapLevel]
        );
        if (bossInfoRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return { rewardsGiven: false };
        }

        const b = bossInfoRes.rows[0];
        const bossMaxHp = parseInt(b.hp) || 150000;
        const totalPearls = parseInt(b.pearl) || 15000;
        const totalXp = parseInt(b.xp) || 250;

        const partsRes = await client.query(
            'SELECT player_id, username, damage_dealt FROM admiral_damage WHERE map_level = $1 AND damage_dealt > 0',
            [mapLevel]
        );

        let skipReason = null;

        for (const row of partsRes.rows) {
            const pId = parseInt(row.player_id);
            const dmg = parseInt(row.damage_dealt);

            const pRes = await client.query('SELECT level, is_bot FROM players WHERE id = $1', [pId]);
            if (pRes.rows.length === 0) continue;
            const playerLevel = parseInt(pRes.rows[0].level);
            const isBot = pRes.rows[0].is_bot;

            if (!isBot && playerLevel >= 10 && mapLevel <= 5) {
                console.log(`[REWARD] Player ${pId} (lvl ${playerLevel}) skipped — map ${mapLevel} too low`);
                if (pId > 0) skipReason = 'level_too_high_for_map';
                continue;
            }

            const pct = Math.min(1.0, dmg / bossMaxHp);
            const rewardPearls = Math.floor(totalPearls * pct);
            const rewardXp = Math.floor(totalXp * pct);
            const rewardElite = Math.floor(rewardXp * 0.5);

            if (pId > 0) {
                await client.query(
                    'UPDATE players SET pearl = pearl + $1, xp = xp + $2, elite_points = elite_points + $3 WHERE id = $4',
                    [rewardPearls, rewardXp, rewardElite, pId]
                );
                console.log(`[REWARD] Sent ${rewardPearls} Pearls, ${rewardXp} XP and ${rewardElite} ELP to player ID ${pId} (${row.username})`);
            }
        }

        await client.query(
            'DELETE FROM admiral_damage WHERE map_level = $1',
            [mapLevel]
        );

        await client.query('COMMIT');
        console.log(`[REWARD] Completed for Map Level ${mapLevel}.`);
        return { rewardsGiven: true, skipReason };
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Reward distribution error:', err);
        return { rewardsGiven: false };
    } finally {
        client.release();
    }
}

async function distributeTiamatRewards(playerId) {
    const client = await pool.connect();
    let myRewards = { pearl: 0, xp: 0 };
    try {
        console.log(`[TIAMAT REWARD] Distributing rewards...`);
        await client.query('BEGIN');

        const tiamatRes = await client.query(
            'SELECT hp, pearl, xp FROM tiamat WHERE id = 1 LIMIT 1'
        );
        if (tiamatRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return myRewards;
        }

        const t = tiamatRes.rows[0];
        const bossMaxHp = parseInt(t.hp) || 12000000;
        const totalPearls = parseInt(t.pearl) || 38000;
        const totalXp = parseInt(t.xp) || 280000;

        const partsRes = await client.query(
            'SELECT player_id, username, damage_dealt FROM tiamat_damage WHERE damage_dealt > 0'
        );

        for (const row of partsRes.rows) {
            const pId = parseInt(row.player_id);
            const dmg = parseInt(row.damage_dealt);

            const isBot = await client.query(
                'SELECT is_bot FROM players WHERE id = $1',
                [pId]
            );
            if (isBot.rows.length > 0 && isBot.rows[0].is_bot) continue;

            const pct = Math.min(1.0, dmg / bossMaxHp);
            const rewardPearls = Math.floor(totalPearls * pct);
            const rewardXp = Math.floor(totalXp * pct);

            if (pId > 0) {
                await client.query(
                    'UPDATE players SET pearl = pearl + $1, xp = xp + $2 WHERE id = $3',
                    [rewardPearls, rewardXp, pId]
                );
                console.log(`[TIAMAT REWARD] Sent ${rewardPearls} Pearls and ${rewardXp} XP to player ID ${pId} (${row.username})`);
                if (pId === playerId) {
                    myRewards = { pearl: rewardPearls, xp: rewardXp };
                }
            }
        }

        const minMin = 60, maxMin = 180;
        const respawnMin = Math.floor(Math.random() * (maxMin - minMin + 1)) + minMin;
        const respawnAt = new Date(Date.now() + respawnMin * 60 * 1000);
        await client.query(
            'UPDATE tiamat SET current_hp = NULL, respawn_at = $1 WHERE id = 1',
            [respawnAt]
        );
        await client.query(
            'DELETE FROM tiamat_damage'
        );

        await client.query('COMMIT');
        console.log(`[TIAMAT REWARD] Completed successfully.`);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Tiamat reward distribution error:', err);
    } finally {
        client.release();
    }
    return myRewards;
}

module.exports = { getWeeklyBossRewards, distributeAdmiralRewards, distributeTiamatRewards };
