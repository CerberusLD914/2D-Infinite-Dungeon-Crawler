const express = require('express');
const { Server } = require('colyseus');
const { createServer } = require('http');
const { WebSocketTransport } = require('@colyseus/ws-transport');
const cors = require('cors');
const GameRoom = require('./rooms/GameRoom');
const authService = require('./auth/AuthService');

const app = express();
app.use(cors());
app.use(express.json());

// --- API Routes ---
app.post('/api/register', (req, res) => {
    const { email, username, password } = req.body;
    const result = authService.register(email, username, password);
    if (result.success) res.json(result);
    else res.status(400).json(result);
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const result = authService.login(username, password);
    if (result.success) res.json(result);
    else res.status(401).json(result);
});

app.post('/api/character', (req, res) => {
    const { username, character } = req.body;
    const result = authService.updateCharacter(username, character);
    if (result.success) res.json(result);
    else res.status(400).json(result);
});

const gameServer = new Server({
    transport: new WebSocketTransport({
        server: createServer(app)
    })
});

gameServer.define('game', GameRoom);

const PORT = 3000;
gameServer.listen(PORT);
console.log(`Colyseus Server running on port ${PORT}`);
