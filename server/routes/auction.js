const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth');

const TUR_SURE = 3600; // 1 saat
const ROTATION = ['barut','zirh','gul3','top2','elit_kiris','gemi1'];

const ITEMS_INFO = {
  barut:      { name: 'Barut x100',          type: 'sarf',     qty: 100, startPrice: 1 },
  zirh:       { name: 'Zırh x100',           type: 'sarf',     qty: 100, startPrice: 1 },
  gul3:       { name: 'Patlayan Gülle x2000', type: 'gulle',   qty: 2000, startPrice: 1 },
  top2:       { name: '55 Pounder',          type: 'top',      qty: 1,   startPrice: 1 },
  top3:       { name: '60 Ponder',           type: 'top',      qty: 1,   startPrice: 1 },
  elit_kiris: { name: 'Elit Kiriş',          type: 'plank',    qty: 1,   startPrice: 1 },
  gemi1:      { name: 'Elit I Gemi',         type: 'ship',     qty: 1,   startPrice: 1 },
  kristal_queen_design: { name: 'Kristal Queen Tasarımı', type: 'design', qty: 1, startPrice: 1 }
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
          const ammoType = 3; // gul3 -> Patlayan Gülle
          await client.query(
            `INSERT INTO player_ammo (player_id, ammo_type, quantity)
             VALUES ($1, $2, $3)
             ON CONFLICT (player_id, ammo_type) DO UPDATE SET quantity = player_ammo.quantity + EXCLUDED.quantity`,
            [winnerId, ammoType, info.qty]
          );
        } 
        else if (info.type === 'top') {
          const cannonType = key === 'top3' ? 3 : 2;
          await client.query(
            `INSERT INTO player_cannons (player_id, cannon_type, quantity)
             VALUES ($1, $2, $3)
             ON CONFLICT (player_id, cannon_type) DO UPDATE SET quantity = player_cannons.quantity + EXCLUDED.quantity`,
            [winnerId, cannonType, item.quantity]
          );
        }
        else if (info.type === 'plank') {
          await client.query(
            `INSERT INTO player_planks (player_id, plank_type, quantity)
             VALUES ($1, 'elit', $2)
             ON CONFLICT (player_id, plank_type) DO UPDATE SET quantity = player_planks.quantity + EXCLUDED.quantity`,
            [winnerId, info.qty]
          );
        }
        else if (info.type === 'ship') {
          await client.query(
            `UPDATE players SET has_elite_ship = true WHERE id = $1 AND NOT has_elite_ship`,
            [winnerId]
          );
        }
        else if (info.type === 'design') {
          const designKey = 'kristal_queen';
          await client.query(
            `INSERT INTO player_designs (player_id, design_key)
             VALUES ($1, $2) ON CONFLICT (player_id, design_key) DO NOTHING`,
            [winnerId, designKey]
          );
        }
      }
    }

    // Eski süresi dolan tüm açık artırmaları sil
    await client.query('DELETE FROM auctions WHERE expires_at <= $1', [now]);

    // Yeni tur açık artırmalarını ekle (Her saat başında senkronize sıfırlanması için sonraki saat başına ayarla)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1, 0, 0, 0);
    const newItems = [];

    // Kristal Queen tasarımı her 5 turda 1 kez açık artırmaya çıksın
    const roundNum = Math.floor(Date.now() / 3600000);
    const showDesign = (roundNum % 5 === 0);
    const rotation = showDesign ? [...ROTATION, 'kristal_queen_design'] : [...ROTATION];

    // 60 Ponder rastgele çıksın (5-10 turda 1 civarı)
    const show60Ponder = Math.random() < 0.15;
    if (show60Ponder) {
      rotation.push('top3');
    }

    for (const key of rotation) {
      const info = ITEMS_INFO[key];
      const qty = info.qty;
      const res = await client.query(
        `INSERT INTO auctions (item_type, quantity, currency, starting_price, current_price, expires_at)
         VALUES ($1, $2, 'gold', $3, $3, $4)
         RETURNING *`,
        [key, qty, info.startPrice, expiresAt]
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
    
    // Oyuncunun elit gemisi varsa gemi1'i gösterme
    const pRes = await pool.query('SELECT has_elite_ship FROM players WHERE id = $1', [req.player.id]);
    const hasEliteShip = pRes.rows.length > 0 && pRes.rows[0].has_elite_ship === true;
    
    // Tek sorguda tüm teklif verenlerin kullanıcı adlarını çek
    const bidderIds = [...new Set(list.map(i => i.highest_bidder_id).filter(Boolean))];
    const bidderMap = {};
    if (bidderIds.length > 0) {
      const uRes = await pool.query(
        `SELECT id, COALESCE(display_name, username) AS name FROM players WHERE id = ANY($1)`,
        [bidderIds]
      );
      uRes.rows.forEach(r => { bidderMap[r.id] = r.name; });
    }
    
    const formattedList = [];
    for (const item of list) {
      // Elit gemisi olan oyuncuya gemi1 görünmesin
      if (hasEliteShip && item.item_type === 'gemi1') continue;
      
      formattedList.push({
        id: item.id,
        key: item.item_type,
        en_yuksek: item.current_price,
        teklif_eden: bidderMap[item.highest_bidder_id] || null,
        expires_at: item.expires_at
      });
    }

    res.json({
      bitis: formattedList.length > 0 ? Math.floor(new Date(formattedList[0].expires_at).getTime() / 1000) : Math.floor(Date.now() / 1000) + 3600,
      serverNow: Math.floor(Date.now() / 1000),
      liste: formattedList
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// BID ON AN AUCTION ITEM
router.post('/bid', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  const { auctionId, amount } = req.body;

  const bidAmount = parseInt(amount);
  if (isNaN(bidAmount) || bidAmount < 1) {
    return res.status(400).json({ error: 'Invalid bid amount' });
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
      return res.status(404).json({ error: 'Player not found' });
    }
    const player = pRes.rows[0];

    // 2. Lock the specific auction row for update to serialize check and update logic
    const aRes = await client.query(
      'SELECT * FROM auctions WHERE id = $1 AND expires_at > NOW() FOR UPDATE',
      [auctionId]
    );
    if (aRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Auction has expired or item not found!' });
    }
    const auction = aRes.rows[0];

    if (player.gold < bidAmount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Insufficient gold! Balance: ${player.gold.toLocaleString('en-US')} Gold` });
    }

    const isOwner = auction.highest_bidder_id === playerId;

    if (bidAmount > auction.current_price) {
      // Lideri geçiyor
      const cost = isOwner ? bidAmount - auction.current_price : bidAmount;
      await client.query('UPDATE players SET gold = gold - $1 WHERE id = $2', [cost, playerId]);
      // Eski lidere iade (farklı oyuncuysa)
      if (!isOwner && auction.highest_bidder_id) {
        await client.query(
          'UPDATE players SET gold = gold + $1 WHERE id = $2',
          [auction.current_price, auction.highest_bidder_id]
        );
      }
      await client.query(
        'UPDATE auctions SET current_price = $1, highest_bidder_id = $2 WHERE id = $3',
        [bidAmount, playerId, auctionId]
      );
    } else {
      // Geçemezse: altın yandı (korsan riski), hata mesajı yok
      await client.query('UPDATE players SET gold = gold - $1 WHERE id = $2', [bidAmount, playerId]);
    }

    const updatedGoldRes = await client.query('SELECT gold FROM players WHERE id = $1', [playerId]);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `${bidAmount.toLocaleString('en-US')} Gold bid placed on ${ITEMS_INFO[auction.item_type].name}!`,
      gold: updatedGoldRes.rows[0].gold,
      teklif_eden: player.username
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Teklif verilirken hata oluştu:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

module.exports = router;
