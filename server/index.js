const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { ensureCert } = require('./helpers/cert');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { errorHandler } = require('./middleware/errorHandler');

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
const notificationRoutes = require('./routes/notifications');
const adminRoutes = require('./routes/admin');
const vipRoutes = require('./routes/vip');
const starterRoutes = require('./routes/starter');
const clientLogRoutes = require('./routes/clientLog');
const pool = require('./config/db');
const { initSocketIO } = require('./helpers/socket');
const { startBotTicks } = require('./bots/botAdmirals');
const { startTiamatBotTicks } = require('./bots/botTiamat');

// Yakalanmayan promise hatalarını logla (server çökmesin)
process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  // Give logger time to flush, then exit
  setTimeout(() => process.exit(1), 1000);
});

const app = express();

app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "blob:"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:"],
    }
  },
  crossOriginOpenerPolicy: false,
  originAgentCluster: false,
  strictTransportSecurity: false,
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true
}));

// CSRF koruması: state değiştiren POST isteklerinde X-Requested-With zorunlu (400 = global 401/403 override'ı tetiklemez)
app.use('/api', (req, res, next) => {
  if (req.method === 'POST' && !req.path.startsWith('/auth/') && !req.path.startsWith('/client/')) {
    if (req.headers['x-requested-with'] !== 'XMLHttpRequest') {
      return res.status(400).json({ error: 'CSRF protection: missing X-Requested-With header' });
    }
  }
  next();
});
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '../frontend'), {
  maxAge: 0,
  etag: false,
  setHeaders: (res, path) => {
    if (path.endsWith('.html') || path.endsWith('.js')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

const { standardRateLimiter, createApiRateLimiter } = require('./middleware/rateLimiter');

// Rate limit only non-combat routes (combat needs fast requests)
app.use('/api/auth', standardRateLimiter, authRoutes);
app.use('/api/player', standardRateLimiter, playerRoutes);
app.use('/api/shop', standardRateLimiter, shopRoutes);
app.use('/api/equipment', standardRateLimiter, equipmentRoutes);
app.use('/api/ships', standardRateLimiter, shipsRoutes);
app.use('/api/auction', standardRateLimiter, auctionRoutes);
app.use('/api/maps', standardRateLimiter, mapRoutes);
app.use('/api/quests', standardRateLimiter, questsRoutes);
app.use('/api/events', standardRateLimiter, eventRoutes);
app.use('/api/notifications', standardRateLimiter, notificationRoutes);
app.use('/api/admin', standardRateLimiter, adminRoutes);
app.use('/api/vip', standardRateLimiter, vipRoutes);
app.use('/api/starter', standardRateLimiter, starterRoutes);
app.use('/api/client', clientLogRoutes);

// Combat routes - lightweight rate limiter (frequent but capped)
const combatLimiter = createApiRateLimiter(120, 60000, 'combat'); // 120 req/min
app.use('/api/combat', combatLimiter, combatRoutes);

// Global error handler (must be last)
app.use(errorHandler);

app.get('/', (req, res) => {
  res.json({ message: 'SeaPirates API çalışıyor!' });
});

const PORT = process.env.PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;

(async () => {
  const certDir = path.join(__dirname, 'certs');
  if (!fs.existsSync(certDir)) fs.mkdirSync(certDir, { recursive: true });

  const servers = [];

  // HTTP sunucu (APK için) — development'ta her zaman, production'da disable
  const enableHttp = process.env.DISABLE_HTTP !== 'true';
  if (enableHttp) {
    const httpServer = http.createServer(app);
    initSocketIO(httpServer);
    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`HTTP sunucu ${PORT} portunda çalışıyor`);
      startBotTicks();
      startTiamatBotTicks();
    });
    servers.push(httpServer);
  } else {
    console.log('HTTP sunucu devre dışı (DISABLE_HTTP=true)');
  }

  // HTTPS sunucu (tarayıcı için) — sertifika varsa çalışır
  if (await ensureCert(certDir)) {
    const httpsOpts = {
      key: fs.readFileSync(path.join(certDir, 'key.pem')),
      cert: fs.readFileSync(path.join(certDir, 'cert.pem'))
    };
    const httpsServer = https.createServer(httpsOpts, app);
    initSocketIO(httpsServer);
    httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
      console.log(`HTTPS sunucu ${HTTPS_PORT} portunda çalışıyor`);
    });
    servers.push(httpsServer);
  }
  const shutdown = async (signal) => {
    console.log(`\n${signal} alındı, sunucu kapatılıyor...`);
    servers.forEach(s => s.close());
    pool.end().then(() => {
      console.log('PostgreSQL bağlantısı kapatıldı.');
      process.exit(0);
    });
    setTimeout(() => {
      console.error('Zaman aşımı, zorla kapatılıyor...');
      process.exit(1);
    }, 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
})();
