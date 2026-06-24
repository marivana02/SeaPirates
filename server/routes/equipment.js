const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth');
const gameData = require('../config/gameData');

// GET PLAYER EQUIPMENT & STORAGE
router.get('/my-items', authMiddleware, async (req, res) => {
  const playerId = req.player.id;

  try {
    // Oyuncunun aktif gemi seviyesini al
    const pRes = await pool.query('SELECT ship_level FROM players WHERE id = $1', [playerId]);
    if (pRes.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }
    const shipLevel = pRes.rows[0].ship_level;
    const activeShip = gameData.SHIPS.find(s => s.level === shipLevel) || gameData.SHIPS[0];

    // Topları al
    const cannonsRes = await pool.query(
      'SELECT cannon_type, quantity, equipped FROM player_cannons WHERE player_id = $1',
      [playerId]
    );

    // Direkleri al
    const planksRes = await pool.query(
      'SELECT plank_type, quantity, equipped FROM player_planks WHERE player_id = $1',
      [playerId]
    );

    // Client'ın beklediği formatta State nesnesi oluştur
    // Depo (storage): Toplam owned - Equipped
    const state = {
      storage: {
        top1: 0, top2: 0, top3: 0,
        mast1: 0, mast2: 0
      },
      equipped: {
        top1: 0, top2: 0, top3: 0
      },
      equippedMasts: {
        mast1: 0, mast2: 0
      },
      maxCannons: activeShip.cannonSlots,
      maxMasts: activeShip.plankSlots,
      baseHp: activeShip.baseHp
    };

    // Top verilerini eşle
    cannonsRes.rows.forEach(row => {
      const idKey = 'top' + row.cannon_type; // top1, top2, top3
      const totalOwned = row.quantity || 0;
      const equipped = row.equipped || 0;
      const storage = Math.max(0, totalOwned - equipped);

      if (state.storage.hasOwnProperty(idKey)) {
        state.storage[idKey] = storage;
      }
      if (state.equipped.hasOwnProperty(idKey)) {
        state.equipped[idKey] = equipped;
      }
    });

    // Direk verilerini eşle
    planksRes.rows.forEach(row => {
      const idKey = row.plank_type === 'tahta' ? 'mast1' : 'mast2'; // mast1 (tahta), mast2 (elit)
      const totalOwned = row.quantity || 0;
      const equipped = row.equipped || 0;
      const storage = Math.max(0, totalOwned - equipped);

      if (state.storage.hasOwnProperty(idKey)) {
        state.storage[idKey] = storage;
      }
      if (state.equippedMasts.hasOwnProperty(idKey)) {
        state.equippedMasts[idKey] = equipped;
      }
    });

    res.json(state);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// EQUIP AN ITEM
router.post('/equip', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  const { itemId, isCannon } = req.body;

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const pRes = await client.query('SELECT ship_level, max_hp FROM players WHERE id = $1 FOR UPDATE', [playerId]);
    if (pRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Player not found' });
    }

    const player = pRes.rows[0];
    const activeShip = gameData.SHIPS.find(s => s.level === player.ship_level) || gameData.SHIPS[0];

    if (isCannon) {
      const cannonType = parseInt(itemId.replace('top', ''));
      if (isNaN(cannonType)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Invalid cannon ID' });
      }

      const equippedCountRes = await client.query(
        'SELECT COALESCE(SUM(equipped), 0) as total FROM player_cannons WHERE player_id = $1',
        [playerId]
      );
      const equippedCount = parseInt(equippedCountRes.rows[0].total);

      if (equippedCount >= activeShip.cannonSlots) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `All cannon slots are full! Max: ${activeShip.cannonSlots}` });
      }

      const itemRes = await client.query(
        'SELECT id, quantity, equipped FROM player_cannons WHERE player_id = $1 AND cannon_type = $2 FOR UPDATE',
        [playerId, cannonType]
      );

      if (itemRes.rows.length === 0 || (itemRes.rows[0].quantity - itemRes.rows[0].equipped) <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'No cannons of this type left in storage!' });
      }

      await client.query(
        'UPDATE player_cannons SET equipped = equipped + 1 WHERE id = $1',
        [itemRes.rows[0].id]
      );

    } else {
      const plankType = itemId === 'mast1' ? 'tahta' : 'elit';

      const equippedCountRes = await client.query(
        'SELECT COALESCE(SUM(equipped), 0) as total FROM player_planks WHERE player_id = $1',
        [playerId]
      );
      const equippedCount = parseInt(equippedCountRes.rows[0].total);

      if (equippedCount >= activeShip.plankSlots) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `All plank slots are full! Max: ${activeShip.plankSlots}` });
      }

      const itemRes = await client.query(
        'SELECT id, quantity, equipped FROM player_planks WHERE player_id = $1 AND plank_type = $2 FOR UPDATE',
        [playerId, plankType]
      );

      if (itemRes.rows.length === 0 || (itemRes.rows[0].quantity - itemRes.rows[0].equipped) <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'No planks of this type left in storage!' });
      }

      await client.query(
        'UPDATE player_planks SET equipped = equipped + 1 WHERE id = $1',
        [itemRes.rows[0].id]
      );

      await updatePlayerMaxHp(playerId, activeShip.baseHp, client);
    }

    await client.query('COMMIT');
    res.json({ message: 'Equipped successfully' });

  } catch (err) {
    if (client) await client.query('ROLLBACK').catch(e => {});
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    if (client) client.release();
  }
});

// UNEQUIP AN ITEM
router.post('/unequip', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  const { itemId, isCannon } = req.body;

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const pRes = await client.query('SELECT ship_level FROM players WHERE id = $1 FOR UPDATE', [playerId]);
    if (pRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Player not found' });
    }
    const shipLevel = pRes.rows[0].ship_level;
    const activeShip = gameData.SHIPS.find(s => s.level === shipLevel) || gameData.SHIPS[0];

    if (isCannon) {
      const cannonType = parseInt(itemId.replace('top', ''));

      const itemRes = await client.query(
        'SELECT id, equipped FROM player_cannons WHERE player_id = $1 AND cannon_type = $2 FOR UPDATE',
        [playerId, cannonType]
      );

      if (itemRes.rows.length === 0 || itemRes.rows[0].equipped <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'No equipped cannons of this type found!' });
      }

      await client.query(
        'UPDATE player_cannons SET equipped = equipped - 1 WHERE id = $1',
        [itemRes.rows[0].id]
      );

    } else {
      const plankType = itemId === 'mast1' ? 'tahta' : 'elit';

      const itemRes = await client.query(
        'SELECT id, equipped FROM player_planks WHERE player_id = $1 AND plank_type = $2 FOR UPDATE',
        [playerId, plankType]
      );

      if (itemRes.rows.length === 0 || itemRes.rows[0].equipped <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'No equipped planks of this type found!' });
      }

      await client.query(
        'UPDATE player_planks SET equipped = equipped - 1 WHERE id = $1',
        [itemRes.rows[0].id]
      );

      await updatePlayerMaxHp(playerId, activeShip.baseHp, client);
    }

    await client.query('COMMIT');
    res.json({ message: 'Unequipped successfully' });

  } catch (err) {
    if (client) await client.query('ROLLBACK').catch(e => {});
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    if (client) client.release();
  }
});

// EQUIP ALL ITEMS (Cannons sorted by best first, planks sorted by elit first)
router.post('/equip-all', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  const { isCannon } = req.body;

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const pRes = await client.query('SELECT ship_level, max_hp FROM players WHERE id = $1 FOR UPDATE', [playerId]);
    if (pRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Player not found' });
    }

    const player = pRes.rows[0];
    const activeShip = gameData.SHIPS.find(s => s.level === player.ship_level) || gameData.SHIPS[0];

    if (isCannon) {
      const equippedCountRes = await client.query(
        'SELECT COALESCE(SUM(equipped), 0) as total FROM player_cannons WHERE player_id = $1',
        [playerId]
      );
      const equippedCount = parseInt(equippedCountRes.rows[0].total);
      let remainingSlots = activeShip.cannonSlots - equippedCount;

      if (remainingSlots <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'All cannon slots are already full!' });
      }

      const itemsRes = await client.query(
        'SELECT id, cannon_type, quantity, equipped FROM player_cannons WHERE player_id = $1 ORDER BY cannon_type DESC',
        [playerId]
      );

      let equippedAny = false;
      for (const row of itemsRes.rows) {
        if (remainingSlots <= 0) break;
        const available = row.quantity - row.equipped;
        if (available > 0) {
          const toEquip = Math.min(available, remainingSlots);
          await client.query(
            'UPDATE player_cannons SET equipped = equipped + $1 WHERE id = $2',
            [toEquip, row.id]
          );
          remainingSlots -= toEquip;
          equippedAny = true;
        }
      }

      if (!equippedAny) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'No cannons available to equip in storage!' });
      }

    } else {
      const equippedCountRes = await client.query(
        'SELECT COALESCE(SUM(equipped), 0) as total FROM player_planks WHERE player_id = $1',
        [playerId]
      );
      const equippedCount = parseInt(equippedCountRes.rows[0].total);
      let remainingSlots = activeShip.plankSlots - equippedCount;

      if (remainingSlots <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'All plank slots are already full!' });
      }

      const itemsRes = await client.query(
        `SELECT id, plank_type, quantity, equipped FROM player_planks 
         WHERE player_id = $1 
         ORDER BY (CASE WHEN plank_type = 'elit' THEN 2 ELSE 1 END) DESC`,
        [playerId]
      );

      let equippedAny = false;
      for (const row of itemsRes.rows) {
        if (remainingSlots <= 0) break;
        const available = row.quantity - row.equipped;
        if (available > 0) {
          const toEquip = Math.min(available, remainingSlots);
          await client.query(
            'UPDATE player_planks SET equipped = equipped + $1 WHERE id = $2',
            [toEquip, row.id]
          );
          remainingSlots -= toEquip;
          equippedAny = true;
        }
      }

      if (!equippedAny) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'No planks available to equip in storage!' });
      }

      await updatePlayerMaxHp(playerId, activeShip.baseHp, client);
    }

    await client.query('COMMIT');
    res.json({ message: 'Bulk equip completed successfully' });

  } catch (err) {
    if (client) await client.query('ROLLBACK').catch(e => {});
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    if (client) client.release();
  }
});

// UNEQUIP ALL ITEMS
router.post('/unequip-all', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  const { isCannon } = req.body;

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const pRes = await client.query('SELECT ship_level FROM players WHERE id = $1 FOR UPDATE', [playerId]);
    if (pRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Player not found' });
    }
    const shipLevel = pRes.rows[0].ship_level;
    const activeShip = gameData.SHIPS.find(s => s.level === shipLevel) || gameData.SHIPS[0];

    if (isCannon) {
      await client.query(
        'UPDATE player_cannons SET equipped = 0 WHERE player_id = $1',
        [playerId]
      );
    } else {
      await client.query(
        'UPDATE player_planks SET equipped = 0 WHERE player_id = $1',
        [playerId]
      );
      await updatePlayerMaxHp(playerId, activeShip.baseHp, client);
    }

    await client.query('COMMIT');
    res.json({ message: 'All equipment unequipped successfully' });

  } catch (err) {
    if (client) await client.query('ROLLBACK').catch(e => {});
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    if (client) client.release();
  }
});

// Helper to update player's max HP and current HP based on equipped planks
// client opsiyonel: transaction içinden çağrıldığında aynı client'ı kullan (deadlock önler)
async function updatePlayerMaxHp(playerId, baseHp, client) {
  const queryFn = client ? client.query.bind(client) : pool.query.bind(pool);

  const planksRes = await queryFn(`
    SELECT pp.equipped, p.hp_bonus
    FROM player_planks pp
    JOIN planks p ON pp.plank_type = p.type_key
    WHERE pp.player_id = $1
  `, [playerId]);

  let hpBonus = 0;
  planksRes.rows.forEach(row => {
    hpBonus += parseInt(row.hp_bonus || 0) * (row.equipped || 0);
  });

  const newMaxHp = baseHp + hpBonus;
  
  await queryFn(
    `UPDATE players 
     SET max_hp = $1, 
         hp = LEAST(hp, $1) 
     WHERE id = $2`,
    [newMaxHp, playerId]
  );
}

module.exports = router;
