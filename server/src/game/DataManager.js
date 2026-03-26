
const fs = require('fs');
const path = require('path');

class DataManager {
    constructor() {
        this.basePath = path.join(__dirname, '../../data');
        this.chunksPath = path.join(this.basePath, 'chunks');
        this.playersPath = path.join(this.basePath, 'players');

        // Ensure directories exist
        if (!fs.existsSync(this.chunksPath)) fs.mkdirSync(this.chunksPath, { recursive: true });
        if (!fs.existsSync(this.playersPath)) fs.mkdirSync(this.playersPath, { recursive: true });
    }

    // --- Chunks ---
    saveChunk(chunkX, chunkY, data) {
        const key = `${chunkX}_${chunkY}`;
        const filePath = path.join(this.chunksPath, `${key}.json`);
        fs.writeFile(filePath, JSON.stringify(data), (err) => {
            if (err) console.error(`Error saving chunk ${key}:`, err);
        });
    }

    loadChunk(chunkX, chunkY) {
        const key = `${chunkX}_${chunkY}`;
        const filePath = path.join(this.chunksPath, `${key}.json`);
        if (fs.existsSync(filePath)) {
            try {
                const data = fs.readFileSync(filePath, 'utf8');
                return JSON.parse(data);
            } catch (err) {
                console.error(`Error loading chunk ${key}:`, err);
                return null;
            }
        }
        return null;
    }

    // --- Players ---
    savePlayer(player) {
        const filePath = path.join(this.playersPath, `${player.id}.json`);
        const data = {
            id: player.id,
            x: player.x,
            y: player.y,
            inventory: player.inventory || {} // Future proofing
        };
        fs.writeFile(filePath, JSON.stringify(data), (err) => {
            if (err) console.error(`Error saving player ${player.id}:`, err);
        });
    }

    loadPlayer(id) {
        const filePath = path.join(this.playersPath, `${id}.json`);
        if (fs.existsSync(filePath)) {
            try {
                const data = fs.readFileSync(filePath, 'utf8');
                return JSON.parse(data);
            } catch (err) {
                console.error(`Error loading player ${id}:`, err);
                return null;
            }
        }
        return null;
    }
}

module.exports = DataManager;
