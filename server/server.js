const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files (your frontend files)
app.use(express.static('public'));

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // When a user joins a room
  socket.on('join-room', (roomId) => {
    console.log(`User ${socket.id} joined room ${roomId}`);
    socket.join(roomId);  // Add user to the room
    socket.to(roomId).emit('user-connected', socket.id);  // Notify other users in the room

    // Handle incoming signaling messages (like ICE candidates, offers, answers)
    socket.on('signal', (data) => {
      console.log(`Signal from ${socket.id} to ${data.target}`);
      io.to(data.target).emit('signal', {
        signal: data.signal,
        from: socket.id,
      });
    });

    // socket.on('chat', (message) => {
    //     const roomId = Array.from(socket.rooms)[1]; // Get the room the user is in
    //     socket.to(roomId).emit('chat', { message, userId: socket.id }); // Send the message with the sender's userId
    // });

    socket.on('chat', ({ message, username }) => {
       const roomId = Array.from(socket.rooms)[1];
       socket.to(roomId).emit('chat', { message, username });
    });

      

    // Handle disconnects (notify other users in the room)
    socket.on('disconnect', () => {
      console.log(`User ${socket.id} disconnected`);
      socket.to(roomId).emit('user-disconnected', socket.id);  // Notify the room
    });

    // ✅ NEW: Manual leave event
    socket.on('leave-room', () => {
      console.log(`User ${socket.id} left room ${roomId}`);
      socket.leave(roomId);
      socket.to(roomId).emit('user-disconnected', socket.id);
    });
  });
});

server.listen(3000, () => {
  console.log('Signaling server running on http://localhost:3000');
});
