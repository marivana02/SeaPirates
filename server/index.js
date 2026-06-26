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

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "blob:"],
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
  origin: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
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

const { standardRateLimiter } = require('./middleware/rateLimiter');

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

// Combat routes - no rate limiter (frequent requests expected)
app.use('/api/combat', combatRoutes);

// Global error handler (must be last)
app.use(errorHandler);

app.get('/', (req, res) => {
  res.json({ message: 'SeaPirates API çalışıyor!' });
});

const PORT = process.env.PORT || 3000;
const REDIRECT_PORT = PORT + 1;

(async () => {
  const certDir = path.join(__dirname, 'certs');
  if (!fs.existsSync(certDir)) fs.mkdirSync(certDir, { recursive: true });

  if (await ensureCert(certDir)) {
    // Sertifika varsa: HTTPS port 3000'de çalışır (telefon HTTPS-Only modu için)
    const httpsOpts = {
      key: fs.readFileSync(path.join(certDir, 'key.pem')),
      cert: fs.readFileSync(path.join(certDir, 'cert.pem'))
    };
    const httpsServer = https.createServer(httpsOpts, app);
    initSocketIO(httpsServer);
    httpsServer.listen(PORT, () => {
      console.log(`HTTPS sunucu ${PORT} portunda çalışıyor`);
      startBotTicks();
      startTiamatBotTicks();
    });

    // HTTP redirect (port+1) — HTTPS-Only modu OLMAYAN cihazlar için
    const httpRedirect = http.createServer((req, res) => {
      const host = req.headers.host ? req.headers.host.split(':')[0] : 'localhost';
      res.writeHead(301, { Location: `https://${host}:${PORT}${req.url}` });
      res.end();
    });
    httpRedirect.listen(REDIRECT_PORT, () => {
      console.log(`HTTP -> HTTPS yönlendirme ${REDIRECT_PORT} portunda`);
    });

    // Graceful shutdown
    const servers = [httpsServer, httpRedirect];
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
  } else {
    // Sertifika yoksa: HTTP üzerinden çalış (fallback)
    const httpServer = http.createServer(app);
    initSocketIO(httpServer);
    httpServer.listen(PORT, () => {
      console.log(`HTTP sunucu ${PORT} portunda çalışıyor (fallback - sertifika yok)`);
      startBotTicks();
      startTiamatBotTicks();
    });

    const shutdown = async (signal) => {
      console.log(`\n${signal} alındı, sunucu kapatılıyor...`);
      httpServer.close();
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
  }
})();
