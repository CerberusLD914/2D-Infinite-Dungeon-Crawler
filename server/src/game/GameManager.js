
const Player = require('./Player');
const MapGenerator = require('./MapGenerator');
const DataManager = require('./DataManager');
const Enemy = require('./Enemy');

class GameManager {
    constructor(io) {
        this.io = io;
        this.players = {};
        this.enemies = {};
        this.mapGenerator = new MapGenerator();
        this.dataManager = new DataManager();
        this.loadedChunks = {};

        setInterval(() => this.spawnEnemies(), 5000);
    }

    // --- Helper for Tiles ---
    getTileAt(worldX, worldY) {
        const chunkSize = 16;
        const tileSize = 32;
        const chunkX = Math.floor(worldX / (chunkSize * tileSize));
        const chunkY = Math.floor(worldY / (chunkSize * tileSize));
        const key = `${chunkX}_${chunkY}`;

        if (!this.loadedChunks[key]) return 0; // Assume floor if not loaded? Or blocks? Safety: floor.

        const localX = Math.floor((worldX % (chunkSize * tileSize)) / tileSize);
        const localY = Math.floor((worldY % (chunkSize * tileSize)) / tileSize);

        // Handle negative modulo for negative coords
        const correctX = localX < 0 ? localX + chunkSize : localX;
        const correctY = localY < 0 ? localY + chunkSize : localY;

        return this.loadedChunks[key].tiles[correctY][correctX];
    }

    setTileAt(worldX, worldY, type) {
        const chunkSize = 16;
        const tileSize = 32;
        const chunkX = Math.floor(worldX / (chunkSize * tileSize));
        const chunkY = Math.floor(worldY / (chunkSize * tileSize));
        const key = `${chunkX}_${chunkY}`;

        if (this.loadedChunks[key]) {
            const localX = Math.floor((worldX % (chunkSize * tileSize)) / tileSize);
            const localY = Math.floor((worldY % (chunkSize * tileSize)) / tileSize);
            const correctX = localX < 0 ? localX + chunkSize : localX;
            const correctY = localY < 0 ? localY + chunkSize : localY;

            this.loadedChunks[key].tiles[correctY][correctX] = type;

            // Save immediately
            this.dataManager.saveChunk(chunkX, chunkY, this.loadedChunks[key]);

            // Notify clients
            this.io.emit('mapUpdate', { chunkX, chunkY, x: correctX, y: correctY, type });
        }
    }

    // --- Enemy Logic ---
    spawnEnemies() {
        const playerIds = Object.keys(this.players);
        if (playerIds.length === 0) return;
        if (Object.keys(this.enemies).length > playerIds.length * 5) return;

        const randomPlayerId = playerIds[Math.floor(Math.random() * playerIds.length)];
        const player = this.players[randomPlayerId];

        const angle = Math.random() * Math.PI * 2;
        const dist = 300 + Math.random() * 300;
        const x = player.x + Math.cos(angle) * dist;
        const y = player.y + Math.sin(angle) * dist;

        const enemy = new Enemy(x, y);
        this.enemies[enemy.id] = enemy;
    }

    handlePlayerDeath(playerId) {
        const player = this.players[playerId];
        if (player) {
            player.inventory = {};
            player.x = 0;
            player.y = 0;
            this.dataManager.savePlayer(player);

            this.io.to(playerId).emit('playerDied', { message: 'You died! Inventory lost.' });
            this.io.to(playerId).emit('playerInventory', player.inventory);
            this.io.emit('stateUpdate', {
                players: this.players,
                enemies: {}
            });
        }
    }

    // --- Player Logic ---
    addPlayer(socket, user) {
        // Load persistency by Username if possible, or Socket ID as fallback
        const id = user.username || socket.id;
        const savedData = this.dataManager.loadPlayer(id);

        let player;
        if (savedData) {
            player = new Player(socket.id, savedData.x, savedData.y); // Socket ID is still network ID
            player.inventory = savedData.inventory || {};
            player.username = user.username;
            player.color = user.character ? user.character.color : '#00ff00';
        } else {
            player = new Player(socket.id, 0, 0);
            player.username = user.username;
            player.color = user.character ? user.character.color : '#00ff00';
        }

        this.players[socket.id] = player;

        socket.emit('currentPlayers', this.players);
        socket.emit('playerInventory', player.inventory);

        // Load initial area
        this.updatePlayerChunks(player);

        socket.broadcast.emit('newPlayer', this.players[socket.id]);
    }

    removePlayer(id) {
        if (this.players[id]) {
            this.dataManager.savePlayer(this.players[id]);
            delete this.players[id];
            this.io.emit('playerDisconnected', id);
        }
    }

    handleInput(id, input) {
        const p = this.players[id];
        if (!p) return;

        // Calculate theoretical next position
        const speed = p.speed;
        let nextX = p.x;
        let nextY = p.y;

        if (input.up) nextY -= speed;
        if (input.down) nextY += speed;
        if (input.left) nextX -= speed;
        if (input.right) nextX += speed;

        // Check collision at corners of player hitbox (32x32)
        // Center anchor assumption:
        // TopLeft, TopRight, BottomLeft, BottomRight
        const corners = [
            { x: nextX - 14, y: nextY - 14 },
            { x: nextX + 14, y: nextY - 14 },
            { x: nextX - 14, y: nextY + 14 },
            { x: nextX + 14, y: nextY + 14 }
        ];

        let canMove = true;
        for (const c of corners) {
            if (this.getTileAt(c.x, c.y) === 1) {
                canMove = false;
                break;
            }
        }

        if (canMove) {
            p.x = nextX;
            p.y = nextY;
            p.input = input; // Keep input for client prediction sync if needed
        }
    }

    handleMine(id, oreId) {
        // Reuse existing mining logic
        const player = this.players[id];
        if (!player) return;

        let foundOre = null;
        let foundChunkKey = null;

        for (const [key, chunk] of Object.entries(this.loadedChunks)) {
            const ore = chunk.ores.find(o => o.id === oreId);
            if (ore) {
                foundOre = ore;
                foundChunkKey = key;
                break;
            }
        }

        if (foundOre) {
            const dist = Math.sqrt((player.x - foundOre.x) ** 2 + (player.y - foundOre.y) ** 2);
            if (dist > 50) return;

            const now = Date.now();
            if (now - foundOre.lastMined < 1500) return;

            foundOre.lastMined = now;
            foundOre.durability--;

            if (!player.inventory[foundOre.type]) player.inventory[foundOre.type] = 0;
            player.inventory[foundOre.type]++;

            this.dataManager.savePlayer(player);
            this.io.to(id).emit('playerInventory', player.inventory);

            this.io.emit('oreHit', { id: oreId, damage: 1 });

            if (foundOre.durability <= 0) {
                const chunk = this.loadedChunks[foundChunkKey];
                chunk.ores = chunk.ores.filter(o => o.id !== oreId);
                const [cx, cy] = foundChunkKey.split('_').map(Number);
                this.dataManager.saveChunk(cx, cy, chunk);
                this.io.emit('oreDestroyed', oreId);
            } else {
                const [cx, cy] = foundChunkKey.split('_').map(Number);
                this.dataManager.saveChunk(cx, cy, this.loadedChunks[foundChunkKey]);
            }
        }
    }

    handleDig(id, target) {
        const player = this.players[id];
        if (!player || !target) return;

        // Validation: Distance
        // Target is center of tile (target.x, target.y) ? 
        // Client sends TopLeft: tx, ty.
        // Let's assume target contains x, y which are world coords of the tile.

        // Add 16 to get center for distance check
        const targetCenterX = target.x + 16;
        const targetCenterY = target.y + 16;
        const dist = Math.sqrt((player.x - targetCenterX) ** 2 + (player.y - targetCenterY) ** 2);

        if (dist > 60) return; // Allow small margin (client checks < 50)

        // Validate content
        if (this.getTileAt(target.x, target.y) === 1) {
            this.setTileAt(target.x, target.y, 0);

            // Add Stone
            if (!player.inventory['Stone']) player.inventory['Stone'] = 0;
            player.inventory['Stone']++;
            this.io.to(id).emit('playerInventory', player.inventory);
            this.dataManager.savePlayer(player);
        }
    }

    update() {
        for (const id in this.players) {
            const p = this.players[id];
            // p.update(); // Removed, handleInput does movement now via strict authoritative
            // Ideally we run p.update() only if we want simulating inertial movement or something
            // But we modified player to just set input. 
            // We should use the handleInput logic to actually Move.
            // But handleInput is event-driven. 
            // For smooth movement, we should apply input in update loop.
            // Let's keep it simple: handleInput updates Position directly for now (as written above).

            this.updatePlayerChunks(p);
        }

        // Enemies
        const enemyUpdates = {};
        for (const id in this.enemies) {
            const enemy = this.enemies[id];
            const result = enemy.update(this.players, this.getTileAt.bind(this));
            enemyUpdates[id] = { x: enemy.x, y: enemy.y };
            if (result.touching) this.handlePlayerDeath(result.targetId);
        }

        this.io.emit('stateUpdate', {
            players: this.players,
            enemies: enemyUpdates
        });
    }

    updatePlayerChunks(p) {
        const chunkSize = 16;
        const tileSize = 32;
        const chunkPx = chunkSize * tileSize;
        const currentChunkX = Math.floor(p.x / chunkPx);
        const currentChunkY = Math.floor(p.y / chunkPx);

        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const targetX = (currentChunkX + dx) * chunkPx;
                const targetY = (currentChunkY + dy) * chunkPx;
                this.loadAndSendChunk(targetX, targetY, this.io.to(p.id));
            }
        }
    }

    loadAndSendChunk(pixelX, pixelY, socketWrapper) {
        const chunkSize = 16;
        const tileSize = 32;
        const chunkX = Math.floor(pixelX / (chunkSize * tileSize));
        const chunkY = Math.floor(pixelY / (chunkSize * tileSize));
        const key = `${chunkX}_${chunkY}`;

        if (!this.loadedChunks[key]) {
            const saved = this.dataManager.loadChunk(chunkX, chunkY);
            if (saved) {
                this.loadedChunks[key] = saved;
            } else {
                this.loadedChunks[key] = this.mapGenerator.getChunkAt(pixelX, pixelY);
                this.dataManager.saveChunk(chunkX, chunkY, this.loadedChunks[key]);
            }
        }

        socketWrapper.emit('mapChunk', this.loadedChunks[key]);
    }
}

module.exports = GameManager;
