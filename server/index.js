const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const authRoutes   = require('./routes/auth');
const playerRoutes = require('./routes/player');
const combatRoutes = require('./routes/combat');
const shopRoutes = require('./routes/shop');
const equipmentRoutes = require('./routes/equipment');
const shipsRoutes = require('./routes/ships');
const auctionRoutes = require('./routes/auction');
const mapRoutes = require('./routes/maps');
const questsRoutes = require('./routes/quests');
const eventRoutes = require('./routes/events');
const pool = require('./config/db');

// Otomatik migration: display_name kolonu yoksa ekle
(async () => {
  try {
    await pool.query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS display_name VARCHAR(50) DEFAULT ''`);
    await pool.query(`UPDATE players SET display_name = username WHERE display_name IS NULL OR display_name = ''`);
    console.log('✓ display_name kolonu kontrol edildi.');
  } catch (err) {
    console.error('display_name migration hatası:', err.message);
  }
})();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// --- SİMÜLASYON SUNUCU TAKİP LOGU ---
const logStream = fs.createWriteStream(path.join(__dirname, 'server_test.log'), { flags: 'a' });

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const mem = Math.round(process.memoryUsage().rss / 1024 / 1024);
    const logLine = `[${new Date().toLocaleTimeString('tr-TR')}] ${req.method} ${req.originalUrl} | Status: ${res.statusCode} | Süre: ${duration}ms | RAM: ${mem}MB\n`;
    
    // Her isteği log dosyasına yaz
    logStream.write(logLine);
    
    // Eğer istek uzun sürerse (500ms+) veya sunucu hatası (400-500) verirse konsola kırmızı bas
    if (res.statusCode >= 400 || duration > 500) {
      console.error(res.statusCode >= 500 ? '\x1b[31m[HATA]\x1b[0m' : '\x1b[33m[GECİKME/UYARI]\x1b[0m', logLine.trim());
    }
  });
  next();
});
// -------------------------------------

app.use('/api/auth',   authRoutes);
app.use('/api/player', playerRoutes);
app.use('/api/combat', combatRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/equipment', equipmentRoutes);
app.use('/api/ships', shipsRoutes);
app.use('/api/auction', auctionRoutes);
app.use('/api/maps', mapRoutes);
app.use('/api/quests', questsRoutes);
app.use('/api/events', eventRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'SeaPirates API çalışıyor!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Sunucu ${PORT} portunda çalışıyor`);
});
