const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const fs = require('fs');
const path = require('path');

// Initialize the Express app
const app = express();

// Set up middleware for parsing form data and JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const server = http.createServer(app);
const io = socketIO(server);

// Store logged-in users in memory (could be a map or object)
let loggedInUsers = {}; // Format: { username: socketId }

app.use(express.static('public'));

const usersFile = path.join(__dirname, 'users.json');

// Check if the users file exists, if not, create it
if (!fs.existsSync(usersFile)) {
    fs.writeFileSync(usersFile, JSON.stringify([]));  // Create an empty array if file doesn't exist
}

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

// Register user endpoint
app.post('/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.send('Missing credentials');

    const users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
    const userExists = users.find(u => u.username === username);

    if (userExists) return res.send('User already exists');

    users.push({ username, password });
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
    res.redirect('/login.html');
});

// Login endpoint with single tab check
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));

    const user = users.find(u => u.username === username && u.password === password);

    if (!user) return res.send('Invalid username or password');

    // Check if user is already logged in
    if (loggedInUsers[username]) {
        return res.send('User already logged in on another tab');
    }

    // Add user to the logged-in users list
    loggedInUsers[username] = true;

    // Redirect to chat app with query string (simple)
    res.redirect(`/index.html?username=${encodeURIComponent(username)}`);
});

// WebSocket for chat functionality
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

// Logout endpoint (to handle user log out and remove them from loggedInUsers)
app.post('/logout', (req, res) => {
    const { username } = req.body;
    delete loggedInUsers[username]; // Remove user from logged-in list
    res.redirect('/login.html'); // Redirect to login page
});

// Start the server
server.listen(3000, () => {
    console.log('🚀 Server running at http://localhost:3000/register.html');
});
