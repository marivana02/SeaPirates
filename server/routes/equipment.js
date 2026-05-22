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
      return res.status(404).json({ error: 'Oyuncu bulunamadı' });
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
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// EQUIP AN ITEM
router.post('/equip', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  const { itemId, isCannon } = req.body; // itemId: 'top1', 'top2', 'mast1' vb.

  try {
    // Oyuncunun aktif gemisini bul ve kapasitesini çek
    const pRes = await pool.query('SELECT ship_level, max_hp FROM players WHERE id = $1', [playerId]);
    if (pRes.rows.length === 0) {
      return res.status(404).json({ error: 'Oyuncu bulunamadı' });
    }
    
    const player = pRes.rows[0];
    const activeShip = gameData.SHIPS.find(s => s.level === player.ship_level) || gameData.SHIPS[0];

    if (isCannon) {
      const cannonType = parseInt(itemId.replace('top', ''));
      if (isNaN(cannonType)) return res.status(400).json({ error: 'Geçersiz top ID' });

      // Toplam takılı top sayısını kontrol et
      const equippedCountRes = await pool.query(
        'SELECT COALESCE(SUM(equipped), 0) as total FROM player_cannons WHERE player_id = $1',
        [playerId]
      );
      const equippedCount = parseInt(equippedCountRes.rows[0].total);

      if (equippedCount >= activeShip.cannonSlots) {
        return res.status(400).json({ error: `Tüm top slotları dolu! Max: ${activeShip.cannonSlots}` });
      }

      // Depoda var mı kontrol et
      const itemRes = await pool.query(
        'SELECT id, quantity, equipped FROM player_cannons WHERE player_id = $1 AND cannon_type = $2',
        [playerId, cannonType]
      );

      if (itemRes.rows.length === 0 || (itemRes.rows[0].quantity - itemRes.rows[0].equipped) <= 0) {
        return res.status(400).json({ error: 'Depoda bu toptan kalmadı!' });
      }

      // Kuşan
      await pool.query(
        'UPDATE player_cannons SET equipped = equipped + 1 WHERE id = $1',
        [itemRes.rows[0].id]
      );

    } else {
      // Direk (Mast)
      const plankType = itemId === 'mast1' ? 'tahta' : 'elit';

      // Toplam takılı direk sayısını kontrol et
      const equippedCountRes = await pool.query(
        'SELECT COALESCE(SUM(equipped), 0) as total FROM player_planks WHERE player_id = $1',
        [playerId]
      );
      const equippedCount = parseInt(equippedCountRes.rows[0].total);

      if (equippedCount >= activeShip.plankSlots) {
        return res.status(400).json({ error: `Tüm direk slotları dolu! Max: ${activeShip.plankSlots}` });
      }

      // Depoda var mı kontrol et
      const itemRes = await pool.query(
        'SELECT id, quantity, equipped FROM player_planks WHERE player_id = $1 AND plank_type = $2',
        [playerId, plankType]
      );

      if (itemRes.rows.length === 0 || (itemRes.rows[0].quantity - itemRes.rows[0].equipped) <= 0) {
        return res.status(400).json({ error: 'Depoda bu direkten kalmadı!' });
      }

      // Kuşan
      await pool.query(
        'UPDATE player_planks SET equipped = equipped + 1 WHERE id = $1',
        [itemRes.rows[0].id]
      );

      // Toplam HP'yi tekrar hesaplayıp players tablosunda max_hp'yi güncelle
      await updatePlayerMaxHp(playerId, activeShip.baseHp);
    }

    res.json({ message: 'Başarıyla kuşanıldı' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// UNEQUIP AN ITEM
router.post('/unequip', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  const { itemId, isCannon } = req.body;

  try {
    const pRes = await pool.query('SELECT ship_level FROM players WHERE id = $1', [playerId]);
    if (pRes.rows.length === 0) {
      return res.status(404).json({ error: 'Oyuncu bulunamadı' });
    }
    const shipLevel = pRes.rows[0].ship_level;
    const activeShip = gameData.SHIPS.find(s => s.level === shipLevel) || gameData.SHIPS[0];

    if (isCannon) {
      const cannonType = parseInt(itemId.replace('top', ''));

      const itemRes = await pool.query(
        'SELECT id, equipped FROM player_cannons WHERE player_id = $1 AND cannon_type = $2',
        [playerId, cannonType]
      );

      if (itemRes.rows.length === 0 || itemRes.rows[0].equipped <= 0) {
        return res.status(400).json({ error: 'Takılı bu tip top bulunamadı!' });
      }

      // Çıkar
      await pool.query(
        'UPDATE player_cannons SET equipped = equipped - 1 WHERE id = $1',
        [itemRes.rows[0].id]
      );

    } else {
      const plankType = itemId === 'mast1' ? 'tahta' : 'elit';

      const itemRes = await pool.query(
        'SELECT id, equipped FROM player_planks WHERE player_id = $1 AND plank_type = $2',
        [playerId, plankType]
      );

      if (itemRes.rows.length === 0 || itemRes.rows[0].equipped <= 0) {
        return res.status(400).json({ error: 'Takılı bu tip direk bulunamadı!' });
      }

      // Çıkar
      await pool.query(
        'UPDATE player_planks SET equipped = equipped - 1 WHERE id = $1',
        [itemRes.rows[0].id]
      );

      // Toplam HP'yi tekrar hesaplayıp players tablosunda max_hp'yi güncelle
      await updatePlayerMaxHp(playerId, activeShip.baseHp);
    }

    res.json({ message: 'Başarıyla çıkarıldı' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Helper to update player's max HP and current HP based on equipped planks
async function updatePlayerMaxHp(playerId, baseHp) {
  const planksRes = await pool.query(
    'SELECT plank_type, equipped FROM player_planks WHERE player_id = $1',
    [playerId]
  );

  let hpBonus = 0;
  planksRes.rows.forEach(row => {
    const bonus = row.plank_type === 'tahta' ? 500 : 1200;
    hpBonus += bonus * (row.equipped || 0);
  });

  const newMaxHp = baseHp + hpBonus;
  
  // Mevcut HP'yi de eğer max'tan fazlaysa veya tamir amaçlı güncelleyelim
  await pool.query(
    `UPDATE players 
     SET max_hp = $1, 
         hp = LEAST(hp, $1) 
     WHERE id = $2`,
    [newMaxHp, playerId]
  );
}

module.exports = router;
