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
const { sendPushToAll } = require('./helpers/fcm');

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
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'", "https://static.cloudflareinsights.com", "https://cloudflareinsights.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "blob:", "https://static.cloudflareinsights.com"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "http:"],
      upgradeInsecureRequests: null,
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
  if (req.method === 'POST' && !req.path.startsWith('/api/auth/') && !req.path.startsWith('/client/')) {
    if (req.headers['x-requested-with'] !== 'XMLHttpRequest') {
      return res.status(400).json({ error: 'CSRF protection: missing X-Requested-With header' });
    }
  }
  next();
});
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '../frontend'), {
  maxAge: 0,
  etag: true,
  setHeaders: (res, path) => {
    if (/\.(png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|eot)$/i.test(path)) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    } else {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
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

  // Startup migration (DDL bir kere çalışır)
  try {
    await pool.query('ALTER TABLE players ADD COLUMN IF NOT EXISTS last_inactive_reminder TIMESTAMP');
    console.log('[MIGRATION] players.last_inactive_reminder OK');
  } catch (e) {
    console.error('[MIGRATION] error:', e.message);
  }

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

      // Her saat başı uzun süre girmeyen oyunculara bildirim (günde 1 kez)
      setInterval(async () => {
        try {
          const { sendPush } = require('./helpers/fcm');
          const res = await pool.query(
            `SELECT DISTINCT p.id FROM players p
             JOIN fcm_tokens ft ON ft.player_id = p.id
             WHERE p.last_seen IS NOT NULL
               AND p.last_seen < NOW() - INTERVAL '24 hours'
               AND p.last_seen > NOW() - INTERVAL '72 hours'
               AND (p.last_inactive_reminder IS NULL
                    OR p.last_inactive_reminder < NOW() - INTERVAL '24 hours')`
          );
          for (const row of res.rows) {
            sendPush(row.id, 'inactive_reminder', {});
            await pool.query('UPDATE players SET last_inactive_reminder = NOW() WHERE id = $1', [row.id]);
          }
        } catch (e) {
          console.error('[CRON] inactive reminder error:', e.message);
        }
      }, 60 * 60 * 1000);
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
