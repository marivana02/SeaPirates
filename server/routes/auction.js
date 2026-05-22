const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth');

const TUR_SURE = 3600; // 1 saat
const ROTATION = ['barut','zirh','gul2','gul3','top2','barut','zirh','gul3','gul2','top3'];

const ITEMS_INFO = {
  barut: { name: 'Barut x100',          type: 'sarf',   qty: 100 },
  zirh:  { name: 'Zırh x100',           type: 'sarf',   qty: 100 },
  gul2:  { name: 'Oyuk Gülle x100',      type: 'gulle',  qty: 100 },
  gul3:  { name: 'Patlayan Gülle x100',  type: 'gulle',  qty: 100 },
  top2:  { name: '55 Pounder',          type: 'top',    qty: 1 },
  top3:  { name: '60 Pounder',          type: 'top',    qty: 1 }
};

// Açık artırmaları kontrol et, süresi bitenleri sonuçlandır ve yeni tur başlat
async function getOrUpdateAuctionRound() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Lock the auctions table in exclusive mode to serialize round updates across concurrent requests
    await client.query('LOCK TABLE auctions IN EXCLUSIVE MODE');

    const now = new Date();
    
    // Aktif açık artırmaları bul
    const activeRes = await client.query(
      'SELECT * FROM auctions WHERE expires_at > $1 ORDER BY id ASC',
      [now]
    );

    if (activeRes.rows.length > 0) {
      await client.query('COMMIT');
      return activeRes.rows;
    }

    // Eğer aktif yoksa ama geçmişte varsa, süresi dolanları sonuçlandır ve ödülleri dağıt
    const expiredRes = await client.query(
      'SELECT * FROM auctions WHERE expires_at <= $1 AND highest_bidder_id IS NOT NULL',
      [now]
    );

    for (const item of expiredRes.rows) {
      const winnerId = item.highest_bidder_id;
      const key = item.item_type;
      const info = ITEMS_INFO[key];

      if (info) {
        if (info.type === 'sarf') {
          const typeKey = key === 'barut' ? 'barut' : 'zirh';
          await client.query(
            `INSERT INTO player_items (player_id, item_type, quantity)
             VALUES ($1, $2, $3)
             ON CONFLICT (player_id, item_type) DO UPDATE SET quantity = player_items.quantity + EXCLUDED.quantity`,
            [winnerId, typeKey, info.qty]
          );
        } 
        else if (info.type === 'gulle') {
          const ammoType = key === 'gul2' ? 2 : 3; // gul2 -> Oyuk, gul3 -> Patlayan
          await client.query(
            `INSERT INTO player_ammo (player_id, ammo_type, quantity)
             VALUES ($1, $2, $3)
             ON CONFLICT (player_id, ammo_type) DO UPDATE SET quantity = player_ammo.quantity + EXCLUDED.quantity`,
            [winnerId, ammoType, info.qty]
          );
        } 
        else if (info.type === 'top') {
          const cannonType = key === 'top2' ? 2 : 3; // top2 -> 55, top3 -> 60
          await client.query(
            `INSERT INTO player_cannons (player_id, cannon_type, quantity)
             VALUES ($1, $2, $3)
             ON CONFLICT (player_id, cannon_type) DO UPDATE SET quantity = player_cannons.quantity + EXCLUDED.quantity`,
            [winnerId, cannonType, info.qty]
          );
        }
      }
    }

    // Eski süresi dolan tüm açık artırmaları sil
    await client.query('DELETE FROM auctions WHERE expires_at <= $1', [now]);

    // Yeni tur açık artırmalarını ekle
    const expiresAt = new Date(Date.now() + TUR_SURE * 1000);
    const newItems = [];

    for (const key of ROTATION) {
      const res = await client.query(
        `INSERT INTO auctions (item_type, quantity, currency, starting_price, current_price, expires_at)
         VALUES ($1, $2, 'gold', 0, 0, $3)
         RETURNING *`,
        [key, ITEMS_INFO[key].qty, expiresAt]
      );
      newItems.push(res.rows[0]);
    }

    await client.query('COMMIT');
    return newItems;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Açık artırma turu güncellenirken hata oluştu:', err);
    throw err;
  } finally {
    client.release();
  }
}

// GET AUCTIONS
router.get('/', authMiddleware, async (req, res) => {
  try {
    const list = await getOrUpdateAuctionRound();
    
    // Her kalemin en yüksek teklif verenin kullanıcı adını çekelim
    const formattedList = [];
    for (const item of list) {
      let bidderUsername = null;
      if (item.highest_bidder_id) {
        const uRes = await pool.query('SELECT username FROM players WHERE id = $1', [item.highest_bidder_id]);
        if (uRes.rows.length > 0) {
          bidderUsername = uRes.rows[0].username;
        }
      }
      
      formattedList.push({
        id: item.id,
        key: item.item_type,
        en_yuksek: item.current_price,
        teklif_eden: bidderUsername,
        expires_at: item.expires_at
      });
    }

    res.json({
      bitis: Math.floor(new Date(list[0].expires_at).getTime() / 1000),
      liste: formattedList
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// BID ON AN AUCTION ITEM
router.post('/bid', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  const { auctionId, amount } = req.body;

  const bidAmount = parseInt(amount);
  if (isNaN(bidAmount) || bidAmount < 1) {
    return res.status(400).json({ error: 'Geçersiz teklif miktarı' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Lock the player row to prevent concurrent gold updates/spend race conditions
    const pRes = await client.query(
      'SELECT gold, username FROM players WHERE id = $1 FOR UPDATE',
      [playerId]
    );
    if (pRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Oyuncu bulunamadı' });
    }
    const player = pRes.rows[0];

    if (player.gold < bidAmount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Yeterli altınınız yok! Bakiye: ${player.gold.toLocaleString('tr-TR')} Altın` });
    }

    // 2. Lock the specific auction row for update to serialize check and update logic
    const aRes = await client.query(
      'SELECT * FROM auctions WHERE id = $1 AND expires_at > NOW() FOR UPDATE',
      [auctionId]
    );
    if (aRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Açık artırma süresi dolmuş veya ürün bulunamadı!' });
    }
    const auction = aRes.rows[0];

    // Teklif kontrolü
    if (bidAmount <= auction.current_price) {
      // Düşük teklif: Altın yanar!
      await client.query('UPDATE players SET gold = gold - $1 WHERE id = $2', [bidAmount, playerId]);
      const updatedGoldRes = await client.query('SELECT gold FROM players WHERE id = $1', [playerId]);

      await client.query('COMMIT');

      return res.json({
        burned: true,
        message: `${bidAmount.toLocaleString('tr-TR')} Altın yandı! Daha yüksek teklif vermelisin.`,
        gold: updatedGoldRes.rows[0].gold
      });
    }

    // Geçerli teklif: Altını düş ve teklifi güncelle
    await client.query('UPDATE players SET gold = gold - $1 WHERE id = $2', [bidAmount, playerId]);
    await client.query(
      'UPDATE auctions SET current_price = $1, highest_bidder_id = $2 WHERE id = $3',
      [bidAmount, playerId, auctionId]
    );

    const updatedGoldRes = await client.query('SELECT gold FROM players WHERE id = $1', [playerId]);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `${ITEMS_INFO[auction.item_type].name} için ${bidAmount.toLocaleString('tr-TR')} Altın teklif verildi!`,
      gold: updatedGoldRes.rows[0].gold,
      teklif_eden: player.username
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Teklif verilirken hata oluştu:', err);
    res.status(500).json({ error: 'Sunucu hatası' });
  } finally {
    client.release();
  }
});

module.exports = router;
