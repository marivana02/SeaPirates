const jwt = require('jsonwebtoken');

let io = null;

function initSocketIO(server) {
  const { Server } = require('socket.io');
  io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
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

  io.on('connection', (socket) => {
    socket.on('join:boss', (mapLevel) => {
      const room = `boss:${mapLevel}`;
      socket.join(room);
    });

    socket.on('leave:boss', (mapLevel) => {
      const room = `boss:${mapLevel}`;
      socket.leave(room);
    });

    socket.on('disconnect', () => {
      // Bağlantı kesildiğinde odayı temizleme veya loglama yapılabilir
      console.log(`[Socket] Oyuncu ayrıldı: ${socket.username} (${socket.playerId})`);
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
