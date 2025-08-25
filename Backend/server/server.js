const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Configure CORS to allow requests from frontend
app.use(cors({
  origin: "http://localhost:5173",
  methods: ["GET", "POST"]
}));

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

// Serve static files (your frontend files)
app.use(express.static('public'));

// Store active rooms and users for better management
const activeRooms = new Map();

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // When a user joins a room
  socket.on('join-room', (roomId) => {
    console.log(`User ${socket.id} attempting to join room ${roomId}`);
    
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

    console.log(`User ${socket.id} successfully joined room ${roomId}`);
    console.log(`Room ${roomId} now has ${activeRooms.get(roomId).size} users`);
    
    // Notify other users in the room about the new user
    socket.to(roomId).emit('user-connected', socket.id);
  });

  // Handle incoming signaling messages (ICE candidates, offers, answers)
  socket.on('signal', (data) => {
    const { target, signal } = data;
    console.log(`Relaying signal from ${socket.id} to ${target} (type: ${signal.type || 'ice-candidate'})`);
    
    io.to(target).emit('signal', {
      signal: signal,
      from: socket.id,
    });
  });

  // Handle chat messages
  socket.on('chat', ({ message, username }) => {
    const roomId = socket.roomId || Array.from(socket.rooms).find(room => room !== socket.id);
    
    if (roomId) {
      console.log(`Chat from ${username} (${socket.id}) in room ${roomId}: ${message}`);
      socket.to(roomId).emit('chat', { message, username });
    } else {
      console.log(`No room found for chat from ${socket.id}`);
    }
  });

  // Handle manual leave room
  socket.on('leave-room', () => {
    const roomId = socket.roomId;
    if (roomId) {
      console.log(`User ${socket.id} manually left room ${roomId}`);
      
      socket.leave(roomId);
      socket.to(roomId).emit('user-disconnected', socket.id);
      
      // Clean up room tracking
      if (activeRooms.has(roomId)) {
        activeRooms.get(roomId).delete(socket.id);
        if (activeRooms.get(roomId).size === 0) {
          activeRooms.delete(roomId);
          console.log(`Room ${roomId} is now empty and removed`);
        }
      }
      
      socket.roomId = null;
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const roomId = socket.roomId;
    console.log(`User ${socket.id} disconnected`);
    
    if (roomId) {
      console.log(`Notifying room ${roomId} about user ${socket.id} disconnect`);
      socket.to(roomId).emit('user-disconnected', socket.id);
      
      // Clean up room tracking
      if (activeRooms.has(roomId)) {
        activeRooms.get(roomId).delete(socket.id);
        if (activeRooms.get(roomId).size === 0) {
          activeRooms.delete(roomId);
          console.log(`Room ${roomId} is now empty and removed`);
        } else {
          console.log(`Room ${roomId} now has ${activeRooms.get(roomId).size} users`);
        }
      }
    }
  });

  // Debug endpoint to see active rooms
  socket.on('get-room-info', () => {
    const roomInfo = {};
    activeRooms.forEach((users, roomId) => {
      roomInfo[roomId] = Array.from(users);
    });
    socket.emit('room-info', roomInfo);
  });
});

// Optional: Add a simple REST endpoint to check server status
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    activeRooms: activeRooms.size,
    totalConnections: io.engine.clientsCount 
  });
});

server.listen(3000, () => {
  console.log('Signaling server running on http://localhost:3000');
  console.log('Health check available at http://localhost:3000/health');
});