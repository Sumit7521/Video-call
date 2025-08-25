const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Get environment variables with defaults
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ? 
  process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()) : 
  ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:8080'];

// CORS configuration for production
const corsOptions = {
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // In development, allow localhost variations
    if (NODE_ENV === 'development') {
      if (origin.match(/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/)) {
        return callback(null, true);
      }
    }
    
    // Check against allowed origins
    if (ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    
    // In development, allow any origin as fallback
    if (NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    // In production, reject unknown origins
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
};

app.use(cors(corsOptions));

const io = new Server(server, {
  cors: {
    origin: function(origin, callback) {
      // Allow requests with no origin
      if (!origin) return callback(null, true);
      
      // In development, allow localhost variations
      if (NODE_ENV === 'development') {
        if (origin.match(/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/)) {
          return callback(null, true);
        }
      }
      
      // Check against allowed origins
      if (ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }
      
      // In development, allow any origin as fallback
      if (NODE_ENV === 'development') {
        return callback(null, true);
      }
      
      // In production, reject unknown origins
      callback(new Error('Not allowed by CORS'));
    },
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Serve static files (your frontend files)
app.use(express.static('public'));

// Store active rooms and users for better management
const activeRooms = new Map();

io.on('connection', (socket) => {
  if (NODE_ENV === 'development') {
    console.log('A user connected:', socket.id);
  }

  // When a user joins a room
  socket.on('join-room', (roomId) => {
    if (NODE_ENV === 'development') {
      console.log(`User ${socket.id} attempting to join room ${roomId}`);
    }
    
    // Leave any previous room
    const previousRooms = Array.from(socket.rooms).filter(room => room !== socket.id);
    previousRooms.forEach(room => {
      socket.leave(room);
      socket.to(room).emit('user-disconnected', socket.id);
    });

    // Join the new room
    socket.join(roomId);
    socket.roomId = roomId; // Store roomId on socket for easy access
    
    // Track active rooms
    if (!activeRooms.has(roomId)) {
      activeRooms.set(roomId, new Set());
    }
    activeRooms.get(roomId).add(socket.id);

    if (NODE_ENV === 'development') {
      console.log(`User ${socket.id} successfully joined room ${roomId}`);
      console.log(`Room ${roomId} now has ${activeRooms.get(roomId).size} users`);
    }
    
    // Notify other users in the room about the new user
    socket.to(roomId).emit('user-connected', socket.id);
  });

  // Handle incoming signaling messages (ICE candidates, offers, answers)
  socket.on('signal', (data) => {
    const { target, signal } = data;
    if (NODE_ENV === 'development') {
      console.log(`Relaying signal from ${socket.id} to ${target} (type: ${signal.type || 'ice-candidate'})`);
    }
    
    io.to(target).emit('signal', {
      signal: signal,
      from: socket.id,
    });
  });

  // Handle chat messages
  socket.on('chat', ({ message, username }) => {
    const roomId = socket.roomId || Array.from(socket.rooms).find(room => room !== socket.id);
    
    if (roomId) {
      if (NODE_ENV === 'development') {
        console.log(`Chat from ${username} (${socket.id}) in room ${roomId}: ${message}`);
      }
      socket.to(roomId).emit('chat', { message, username });
    } else if (NODE_ENV === 'development') {
      console.log(`No room found for chat from ${socket.id}`);
    }
  });

  // Handle manual leave room
  socket.on('leave-room', () => {
    const roomId = socket.roomId;
    if (roomId) {
      if (NODE_ENV === 'development') {
        console.log(`User ${socket.id} manually left room ${roomId}`);
      }
      
      socket.leave(roomId);
      socket.to(roomId).emit('user-disconnected', socket.id);
      
      // Clean up room tracking
      if (activeRooms.has(roomId)) {
        activeRooms.get(roomId).delete(socket.id);
        if (activeRooms.get(roomId).size === 0) {
          activeRooms.delete(roomId);
          if (NODE_ENV === 'development') {
            console.log(`Room ${roomId} is now empty and removed`);
          }
        }
      }
      
      socket.roomId = null;
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const roomId = socket.roomId;
    if (NODE_ENV === 'development') {
      console.log(`User ${socket.id} disconnected`);
    }
    
    if (roomId) {
      if (NODE_ENV === 'development') {
        console.log(`Notifying room ${roomId} about user ${socket.id} disconnect`);
      }
      socket.to(roomId).emit('user-disconnected', socket.id);
      
      // Clean up room tracking
      if (activeRooms.has(roomId)) {
        activeRooms.get(roomId).delete(socket.id);
        if (activeRooms.get(roomId).size === 0) {
          activeRooms.delete(roomId);
          if (NODE_ENV === 'development') {
            console.log(`Room ${roomId} is now empty and removed`);
          }
        } else if (NODE_ENV === 'development') {
          console.log(`Room ${roomId} now has ${activeRooms.get(roomId).size} users`);
        }
      }
    }
  });

  // Debug endpoint to see active rooms (only in development)
  socket.on('get-room-info', () => {
    if (NODE_ENV === 'development') {
      const roomInfo = {};
      activeRooms.forEach((users, roomId) => {
        roomInfo[roomId] = Array.from(users);
      });
      socket.emit('room-info', roomInfo);
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    activeRooms: activeRooms.size,
    totalConnections: io.engine.clientsCount,
    environment: NODE_ENV
  });
});

// Endpoint to check if a room exists
app.get('/api/check-room/:roomId', (req, res) => {
  const { roomId } = req.params;
  const exists = activeRooms.has(roomId);
  
  // Detailed logging only in development
  if (NODE_ENV === 'development') {
    console.log(`\n=== Room Check Request ===`);
    console.log(`Request from: ${req.headers.origin || 'Unknown origin'}`);
    console.log(`Room ID: ${roomId}`);
    console.log(`Room exists: ${exists}`);
    console.log(`Active rooms: ${Array.from(activeRooms.keys()).join(', ') || 'None'}`);
    console.log(`Total active rooms: ${activeRooms.size}`);
    console.log(`Total connections: ${io.engine.clientsCount}`);
    console.log(`=== End Room Check ===\n`);
  }
  
  res.json({ exists });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
  console.log(`Environment: ${NODE_ENV}`);
  console.log(`Health check available at /health`);
  if (NODE_ENV === 'development') {
    console.log(`Server URL: http://localhost:${PORT}`);
  }
});