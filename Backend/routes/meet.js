import express from 'express';
import { Server } from 'socket.io';

const router = express.Router();
const activeRooms = new Map();
let io; // will be initialized later

// Initialize Socket.IO on an existing HTTP server
function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: function (origin, callback) {
        if (!origin) return callback(null, true);

        const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
          ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
          : [];

        if (process.env.NODE_ENV === 'development') {
          if (origin.match(/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/)) {
            return callback(null, true);
          }
          return callback(null, true);
        }

        if (ALLOWED_ORIGINS.includes(origin)) {
          return callback(null, true);
        }

        callback(new Error('Not allowed by CORS'));
      },
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join-room', (roomId) => {
      console.log(`User ${socket.id} joining room ${roomId}`);

      // Leave previous rooms
      const previousRooms = Array.from(socket.rooms).filter(r => r !== socket.id);
      previousRooms.forEach(r => {
        socket.leave(r);
        socket.to(r).emit('user-disconnected', socket.id);
      });

      // Join new room
      socket.join(roomId);
      socket.roomId = roomId;

      if (!activeRooms.has(roomId)) {
        activeRooms.set(roomId, new Set());
      }
      activeRooms.get(roomId).add(socket.id);

      console.log(`Room ${roomId} now has ${activeRooms.get(roomId).size} users`);

      socket.to(roomId).emit('user-connected', socket.id);
    });

    socket.on('signal', ({ target, signal }) => {
      io.to(target).emit('signal', { signal, from: socket.id });
    });

    socket.on('chat', ({ message, username }) => {
      const roomId = socket.roomId || Array.from(socket.rooms).find(r => r !== socket.id);
      if (roomId) {
        socket.to(roomId).emit('chat', { message, username });
      }
    });

    socket.on('leave-room', () => {
      const roomId = socket.roomId;
      if (roomId) {
        socket.leave(roomId);
        socket.to(roomId).emit('user-disconnected', socket.id);
        if (activeRooms.has(roomId)) {
          activeRooms.get(roomId).delete(socket.id);
          if (activeRooms.get(roomId).size === 0) {
            activeRooms.delete(roomId);
          }
        }
        socket.roomId = null;
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
      const roomId = socket.roomId;
      if (roomId) {
        socket.to(roomId).emit('user-disconnected', socket.id);
        if (activeRooms.has(roomId)) {
          activeRooms.get(roomId).delete(socket.id);
          if (activeRooms.get(roomId).size === 0) {
            activeRooms.delete(roomId);
          }
        }
      }
    });
  });
}

// REST endpoints using the same router
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    activeRooms: activeRooms.size,
    totalConnections: io ? io.engine.clientsCount : 0,
    environment: process.env.NODE_ENV || 'development'
  });
});

router.get('/check-room/:roomId', (req, res) => {
  const { roomId } = req.params;
  const exists = activeRooms.has(roomId);
  console.log(`Room check: ${roomId} exists: ${exists}`);
  res.json({
    exists,
    userCount: exists ? activeRooms.get(roomId).size : 0
  });
});

export { router, initSocket };
