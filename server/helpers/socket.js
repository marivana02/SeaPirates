const jwt = require('jsonwebtoken');
const pool = require('../config/db');

let io = null;

function initSocketIO(server) {
  const { Server } = require('socket.io');
  io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true,
      methods: ['GET', 'POST']
    }
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.playerId = decoded.id;
      socket.username = decoded.username || decoded.displayName || 'Unknown';
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  // Periyodik temizlik: 5 dakikadır ping atmayanları offline yap
  setInterval(async () => {
    try {
      await pool.query(
        "UPDATE players SET is_online = false, last_seen = NOW() WHERE is_online = true AND (last_seen IS NULL OR EXTRACT(EPOCH FROM (NOW() - last_seen)) > 300)"
      );
    } catch (e) { /* silent */ }
  }, 60000);

  io.on('connection', (socket) => {
    socket.on('join:boss', (mapLevel) => {
      const room = `boss:${mapLevel}`;
      socket.join(room);
    });

    socket.on('leave:boss', (mapLevel) => {
      const room = `boss:${mapLevel}`;
      socket.leave(room);
    });

    socket.on('disconnect', async () => {
      const playerId = socket.playerId;
      console.log(`[Socket] Oyuncu ayrıldı: ${socket.username} (${playerId})`);
      if (playerId) {
        try {
          await pool.query(
            'UPDATE players SET is_online = false, last_seen = NOW() WHERE id = $1',
            [playerId]
          );
        } catch (e) { /* silent */ }
      }
    });
  });

  return io;
}

function getIO() {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
}

function broadcastBossHp(mapLevel, data) {
  if (!io) return;
  io.to(`boss:${mapLevel}`).emit('boss:hpUpdate', data);
}

module.exports = { initSocketIO, getIO, broadcastBossHp };
