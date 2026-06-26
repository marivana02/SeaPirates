const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth');
const { STARTER_PACKS } = require('../config/starterPacks');

router.post('/buy', authMiddleware, async (req, res) => {
  const { packId } = req.body;
  const playerId = req.player.id;

  const pack = STARTER_PACKS[packId];
  if (!pack) {
    return res.status(400).json({ error: 'Invalid pack ID' });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const pRes = await client.query(
      'SELECT id, gold, pearl FROM players WHERE id = $1 FOR UPDATE',
      [playerId]
    );
    if (pRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Player not found' });
    }

    const stampKey = 'starter_' + packId;
    const stampRes = await client.query(
      `INSERT INTO player_items (player_id, item_type, quantity)
       VALUES ($1, $2, 1)
       ON CONFLICT (player_id, item_type) DO NOTHING
       RETURNING id`,
      [playerId, stampKey]
    );
    if (stampRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'You have already purchased this pack!' });
    }

    const items = pack.items;

    await client.query('UPDATE players SET gold = gold + $1, pearl = pearl + $2 WHERE id = $3', [
      items.gold, items.pearl, playerId
    ]);

    if (items.ammo) {
      for (const [ammoType, qty] of Object.entries(items.ammo)) {
        await client.query(
          `INSERT INTO player_ammo (player_id, ammo_type, quantity)
           VALUES ($1, $2, $3)
           ON CONFLICT (player_id, ammo_type)
           DO UPDATE SET quantity = player_ammo.quantity + $3`,
          [playerId, parseInt(ammoType), qty]
        );
      }
    }

    if (items.items) {
      for (const [itemType, qty] of Object.entries(items.items)) {
        await client.query(
          `INSERT INTO player_items (player_id, item_type, quantity)
           VALUES ($1, $2, $3)
           ON CONFLICT (player_id, item_type)
           DO UPDATE SET quantity = player_items.quantity + $3`,
          [playerId, itemType, qty]
        );
      }
    }

    if (items.cannons) {
      for (const [cannonType, qty] of Object.entries(items.cannons)) {
        await client.query(
          `INSERT INTO player_cannons (player_id, cannon_type, quantity)
           VALUES ($1, $2, $3)
           ON CONFLICT (player_id, cannon_type)
           DO UPDATE SET quantity = player_cannons.quantity + $3`,
          [playerId, parseInt(cannonType), qty]
        );
      }
    }

    if (pack.design) {
      await client.query(
        `INSERT INTO player_designs (player_id, design_key)
         VALUES ($1, $2)
         ON CONFLICT (player_id, design_key) DO NOTHING`,
        [playerId, pack.design]
      );
    }

    await client.query('COMMIT');

    const updatedRes = await client.query(
      'SELECT gold, pearl FROM players WHERE id = $1',
      [playerId]
    );

    res.json({
      message: `${pack.name} başarıyla satın alındı!`,
      gold: parseInt(updatedRes.rows[0].gold),
      pearl: parseInt(updatedRes.rows[0].pearl)
    });

  } catch (err) {
    if (client) await client.query('ROLLBACK').catch(e => {});
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    if (client) client.release();
  }
});

router.get('/packs', (req, res) => {
  res.json({ packs: STARTER_PACKS });
});

module.exports = router;
