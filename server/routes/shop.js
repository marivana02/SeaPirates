const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth');

// Dükkan Katalogu
const SHOP_ITEMS = {
  1:  { type: 'top',    name: '30 Pounder',             price: 10000, currency: 'gold',  qty: 1 },
  2:  { type: 'top',    name: '55 Pounder',             price: 2000,  currency: 'pearl', qty: 1 },
  3:  { type: 'top',    name: '60 Pounder',             price: 6000,  currency: 'pearl', qty: 1 },
  10: { type: 'gulle',  name: 'Misket Gülle (x100)',    price: 4000,  currency: 'gold',  qty: 100 },
  11: { type: 'gulle',  name: 'Oyuk Gülle (x100)',      price: 8000,  currency: 'gold',  qty: 100 },
  12: { type: 'gulle',  name: 'Patlayan Gülle (x100)',  price: 400,   currency: 'pearl', qty: 100 },
  20: { type: 'direk',  name: 'Tahta Kiriş',            price: 35000, currency: 'gold',  qty: 1 },
  21: { type: 'direk',  name: 'Elit Kiriş',             price: 1200,  currency: 'pearl', qty: 1 },
  30: { type: 'sarf',   name: 'Barut (x100)',           price: 120,   currency: 'pearl', qty: 100 },
  31: { type: 'sarf',   name: 'Zırh (x100)',            price: 120,   currency: 'pearl', qty: 100 },
  40: { type: 'gemi',   name: 'Elit Gemi I',            price: 10000, currency: 'pearl', qty: 1 }
};

// SATIN AL
router.post('/buy', authMiddleware, async (req, res) => {
  const { itemId, quantity } = req.body;
  const playerId = req.player.id;
  const qty = quantity !== undefined ? parseInt(quantity) : 1;

  const item = SHOP_ITEMS[itemId];
  if (!item) {
    return res.status(400).json({ error: 'Geçersiz ürün ID\'si' });
  }

  if (isNaN(qty) || qty < 1) {
    return res.status(400).json({ error: 'Geçersiz miktar' });
  }

  const totalCost = item.price * qty;

  try {
    // Oyuncu bakiyesini kontrol et
    const pRes = await pool.query('SELECT gold, pearl, level, elite_points, ship_level FROM players WHERE id = $1', [playerId]);
    if (pRes.rows.length === 0) {
      return res.status(404).json({ error: 'Oyuncu bulunamadı' });
    }

    const player = pRes.rows[0];
    const currentBalance = item.currency === 'gold' ? player.gold : player.pearl;

    if (currentBalance < totalCost) {
      return res.status(400).json({ error: `Yetersiz bakiye! Gereken: ${totalCost} ${item.currency === 'gold' ? 'Altın' : 'İnci'}` });
    }

    // Gemi seviyesi özel kontrolü
    if (item.type === 'gemi') {
      if (player.ship_level >= 1) {
        return res.status(400).json({ error: 'Zaten en az Elit Gemi I veya daha üstüne sahipsiniz.' });
      }
    }

    // Bakiyeyi düşür
    if (item.currency === 'gold') {
      await pool.query('UPDATE players SET gold = gold - $1 WHERE id = $2', [totalCost, playerId]);
    } else {
      await pool.query('UPDATE players SET pearl = pearl - $1 WHERE id = $2', [totalCost, playerId]);
    }

    // Envantere ekle
    const addedQty = item.qty * qty;

    if (item.type === 'top') {
      const exists = await pool.query('SELECT id, quantity FROM player_cannons WHERE player_id = $1 AND cannon_type = $2', [playerId, itemId]);
      if (exists.rows.length > 0) {
        await pool.query('UPDATE player_cannons SET quantity = quantity + $1 WHERE id = $2', [addedQty, exists.rows[0].id]);
      } else {
        await pool.query('INSERT INTO player_cannons (player_id, cannon_type, quantity) VALUES ($1, $2, $3)', [playerId, itemId, addedQty]);
      }
    } 
    else if (item.type === 'gulle') {
      // 10 -> Misket (1), 11 -> Oyuk (2), 12 -> Patlayan (3)
      const ammoType = itemId === 10 ? 1 : itemId === 11 ? 2 : 3;
      const exists = await pool.query('SELECT id, quantity FROM player_ammo WHERE player_id = $1 AND ammo_type = $2', [playerId, ammoType]);
      if (exists.rows.length > 0) {
        await pool.query('UPDATE player_ammo SET quantity = quantity + $1 WHERE id = $2', [addedQty, exists.rows[0].id]);
      } else {
        await pool.query('INSERT INTO player_ammo (player_id, ammo_type, quantity) VALUES ($1, $2, $3)', [playerId, ammoType, addedQty]);
      }
    } 
    else if (item.type === 'direk') {
      const plankType = itemId === 20 ? 'tahta' : 'elit';
      const exists = await pool.query('SELECT id, quantity FROM player_planks WHERE player_id = $1 AND plank_type = $2', [playerId, plankType]);
      if (exists.rows.length > 0) {
        await pool.query('UPDATE player_planks SET quantity = quantity + $1 WHERE id = $2', [addedQty, exists.rows[0].id]);
      } else {
        await pool.query('INSERT INTO player_planks (player_id, plank_type, quantity) VALUES ($1, $2, $3)', [playerId, plankType, addedQty]);
      }
    } 
    else if (item.type === 'sarf') {
      const itemType = itemId === 30 ? 'barut' : 'zirh';
      const exists = await pool.query('SELECT id, quantity FROM player_items WHERE player_id = $1 AND item_type = $2', [playerId, itemType]);
      if (exists.rows.length > 0) {
        await pool.query('UPDATE player_items SET quantity = quantity + $1 WHERE id = $2', [addedQty, exists.rows[0].id]);
      } else {
        await pool.query('INSERT INTO player_items (player_id, item_type, quantity) VALUES ($1, $2, $3)', [playerId, itemType, addedQty]);
      }
    } 
    else if (item.type === 'gemi') {
      // Elit Gemi I'e yükselt
      await pool.query('UPDATE players SET ship_level = 1 WHERE id = $1', [playerId]);
    }

    // Güncel bakiye bilgisini getir
    const updatedRes = await pool.query('SELECT gold, pearl, ship_level FROM players WHERE id = $1', [playerId]);
    const updatedPlayer = updatedRes.rows[0];

    res.json({
      message: `"${item.name}" x${qty} başarıyla satın alındı!`,
      gold: updatedPlayer.gold,
      pearl: updatedPlayer.pearl,
      ship_level: updatedPlayer.ship_level
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

module.exports = router;
