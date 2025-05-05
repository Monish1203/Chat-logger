const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Serve static files from the 'public' folder
app.use(express.static('public'));

const logFilePath = path.join(__dirname, 'chat.txt');

// ─── Download Endpoint ──────────────────────────────────────────────────────
// Lets clients download the full chat log
app.get('/download-chat', (req, res) => {
  res.download(logFilePath, 'chat.txt', err => {
    if (err) {
      console.error('❌ Error sending chat.txt:', err);
      res.sendStatus(500);
    }
  });
});

io.on('connection', (socket) => {
    console.log('✅ New user connected');

    // 1️⃣ Send chat history to the new user
    fs.readFile(logFilePath, 'utf8', (err, data) => {
        if (!err && data) {
            socket.emit('chatHistory', data);
        }
    });

    // 2️⃣ Handle new chat messages
    socket.on('chatMessage', ({ username, message }) => {
        const time = new Date().toLocaleString();
        const log = `[${time}] ${username}: ${message}\n`;

        // Save to file
        fs.appendFile(logFilePath, log, (err) => {
            if (err) {
                console.error('❌ Error writing to file');
            }
        });

        // Broadcast to all users
        io.emit('chatMessage', { username, message, time });
    });

    socket.on('disconnect', () => {
        console.log('❌ User disconnected');
    });
});

// Start the server
server.listen(3000, () => {
    console.log('🚀 Server running at http://localhost:3000');
});
