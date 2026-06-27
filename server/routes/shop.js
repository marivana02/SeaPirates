const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth');

// Shop Catalog
const SHOP_ITEMS = {
  1:  { type: 'top',    name: '30 Pounder',             price: 10000, currency: 'gold',  qty: 1 },
  2:  { type: 'top',    name: '55 Pounder',             price: 2000,  currency: 'pearl', qty: 1 },
  3:  { type: 'top',    name: '60 Pounder',             price: 6000,  currency: 'pearl', qty: 1 },
   10: { type: 'gulle',  name: 'Grapeshot (x100)',       price: 3000,  currency: 'gold',  qty: 100 },
   11: { type: 'gulle',  name: 'Hollow Shot (x100)',     price: 6000,  currency: 'gold',  qty: 100 },
   12: { type: 'gulle',  name: 'Explosive Shot (x100)',  price: 280,   currency: 'pearl', qty: 100 },
  20: { type: 'direk',  name: 'Wooden Beam',            price: 35000, currency: 'gold',  qty: 1 },
  21: { type: 'direk',  name: 'Elite Beam',             price: 1200,  currency: 'pearl', qty: 1 },
  30: { type: 'sarf',   name: 'Gunpowder (x100)',       price: 120,   currency: 'pearl', qty: 100 },
  31: { type: 'sarf',   name: 'Armor (x100)',           price: 120,   currency: 'pearl', qty: 100 },
  40: { type: 'gemi',   name: 'Elite Ship I',           price: 10000, currency: 'pearl', qty: 1 },
  41: { type: 'tasarim', name: 'Crystal Queen',         price: 5000,  currency: 'pearl', qty: 1 }
};

// SATIN AL
router.post('/buy', authMiddleware, async (req, res) => {
  const { itemId, quantity } = req.body;
  const playerId = req.player.id;
  const qty = quantity !== undefined ? parseInt(quantity) : 1;

  const item = SHOP_ITEMS[itemId];
  if (!item) {
    return res.status(400).json({ error: 'Invalid item ID' });
  }

  if (isNaN(qty) || qty < 1 || qty > 9999) {
    return res.status(400).json({ error: 'Invalid quantity' });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const pRes = await client.query('SELECT gold, pearl, level, elite_points, ship_level, has_elite_ship, vip_until FROM players WHERE id = $1 FOR UPDATE', [playerId]);
    if (pRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Player not found' });
    }

    const player = pRes.rows[0];
    
    // 10% VIP Discount
    const isVip = !!(player.vip_until && new Date(player.vip_until) > new Date());
    const discount = isVip ? 0.10 : 0.0;
    const totalCost = Math.round(item.price * qty * (1 - discount));

    if (!isFinite(totalCost) || totalCost < 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid total cost' });
    }

    const currentBalance = item.currency === 'gold' ? player.gold : player.pearl;

    if (currentBalance < totalCost) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Insufficient balance! Required: ${totalCost} ${item.currency === 'gold' ? 'Gold' : 'Pearl'}` });
    }

    if (item.type === 'gemi') {
      if (qty > 1) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Ship cannot be purchased more than once.' });
      }
      if (player.has_elite_ship) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'You already own an elite ship.' });
      }
    }

    if (item.currency === 'gold') {
      await client.query('UPDATE players SET gold = gold - $1 WHERE id = $2', [totalCost, playerId]);
    } else {
      await client.query('UPDATE players SET pearl = pearl - $1 WHERE id = $2', [totalCost, playerId]);
    }

    const addedQty = item.qty * qty;

    if (item.type === 'top') {
      const exists = await client.query('SELECT id FROM player_cannons WHERE player_id = $1 AND cannon_type = $2', [playerId, itemId]);
      if (exists.rows.length > 0) {
        await client.query('UPDATE player_cannons SET quantity = quantity + $1 WHERE id = $2', [addedQty, exists.rows[0].id]);
      } else {
        await client.query('INSERT INTO player_cannons (player_id, cannon_type, quantity) VALUES ($1, $2, $3)', [playerId, itemId, addedQty]);
      }
    }
    else if (item.type === 'gulle') {
      const ammoType = itemId === 10 ? 1 : itemId === 11 ? 2 : 3;
      const exists = await client.query('SELECT id FROM player_ammo WHERE player_id = $1 AND ammo_type = $2', [playerId, ammoType]);
      if (exists.rows.length > 0) {
        await client.query('UPDATE player_ammo SET quantity = quantity + $1 WHERE id = $2', [addedQty, exists.rows[0].id]);
      } else {
        await client.query('INSERT INTO player_ammo (player_id, ammo_type, quantity) VALUES ($1, $2, $3)', [playerId, ammoType, addedQty]);
      }
    }
    else if (item.type === 'direk') {
      const plankType = itemId === 20 ? 'tahta' : 'elit';
      const exists = await client.query('SELECT id FROM player_planks WHERE player_id = $1 AND plank_type = $2', [playerId, plankType]);
      if (exists.rows.length > 0) {
        await client.query('UPDATE player_planks SET quantity = quantity + $1 WHERE id = $2', [addedQty, exists.rows[0].id]);
      } else {
        await client.query('INSERT INTO player_planks (player_id, plank_type, quantity) VALUES ($1, $2, $3)', [playerId, plankType, addedQty]);
      }
    }
    else if (item.type === 'sarf') {
      const itemType = itemId === 30 ? 'barut' : 'zirh';
      const exists = await client.query('SELECT id FROM player_items WHERE player_id = $1 AND item_type = $2', [playerId, itemType]);
      if (exists.rows.length > 0) {
        await client.query('UPDATE player_items SET quantity = quantity + $1 WHERE id = $2', [addedQty, exists.rows[0].id]);
      } else {
        await client.query('INSERT INTO player_items (player_id, item_type, quantity) VALUES ($1, $2, $3)', [playerId, itemType, addedQty]);
      }
    }
    else if (item.type === 'gemi') {
      await client.query('UPDATE players SET has_elite_ship = true WHERE id = $1', [playerId]);
    }
    else if (item.type === 'tasarim') {
      if (qty > 1) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Design cannot be purchased more than once.' });
      }
      const designKey = 'kristal_queen';
      const exists = await client.query('SELECT id FROM player_designs WHERE player_id = $1 AND design_key = $2', [playerId, designKey]);
      if (exists.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'You already own this design!' });
      }
      await client.query('INSERT INTO player_designs (player_id, design_key) VALUES ($1, $2)', [playerId, designKey]);
    }

    let ownedDesigns = [];
    if (item.type === 'tasarim') {
      const dRes = await client.query('SELECT design_key FROM player_designs WHERE player_id = $1', [playerId]);
      ownedDesigns = dRes.rows.map(r => r.design_key);
    }

    const updatedRes = await client.query('SELECT gold, pearl, ship_level, has_elite_ship FROM players WHERE id = $1', [playerId]);
    const updatedPlayer = updatedRes.rows[0];

    await client.query('COMMIT');

    const resp = {
      message: `Successfully purchased "${item.name}" x${qty}!`,
      gold: updatedPlayer.gold,
      pearl: updatedPlayer.pearl,
      ship_level: updatedPlayer.ship_level,
      has_elite_ship: updatedPlayer.has_elite_ship
    };
    if (item.type === 'tasarim') resp.ownedDesigns = ownedDesigns;
    res.json(resp);

  } catch (err) {
    if (client) await client.query('ROLLBACK').catch(e => {});
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    if (client) client.release();
  }
});

module.exports = router;
