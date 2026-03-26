
const { Ore, ORE_TYPES } = require('./Ore');

class MapGenerator {
    constructor() {
        this.chunkSize = 16; // 16x16 tiles
        this.tileSize = 32; // Pixels
        // Random seed
        this.seed = Math.random() * 10000;
    }

    // --- Value Noise Implementation ---
    // Simple hashed noise 0..1
    hash(x, y) {
        let n = Math.sin(x * 12.9898 + y * 78.233 + this.seed) * 43758.5453;
        return n - Math.floor(n);
    }

    // Linear interpolation
    lerp(a, b, t) {
        return a + (b - a) * t;
    }

    // 2D Value Noise
    noise(x, y) {
        const ix = Math.floor(x);
        const iy = Math.floor(y);
        const fx = x - ix;
        const fy = y - iy;

        // Four corners
        const a = this.hash(ix, iy);
        const b = this.hash(ix + 1, iy);
        const c = this.hash(ix, iy + 1);
        const d = this.hash(ix + 1, iy + 1);

        // Smoothstep for smoother caves
        const ux = fx * fx * (3.0 - 2.0 * fx);
        const uy = fy * fy * (3.0 - 2.0 * fy);

        return this.lerp(
            this.lerp(a, b, ux),
            this.lerp(c, d, ux),
            uy
        );
    }



    // Noise for village locations (Medium frequency)
    villageNoise(x, y) {
        return this.noise(x * 0.1, y * 0.1);
    }

    // Noise for city locations (Low frequency = rare)
    cityNoise(x, y) {
        return this.noise(x * 0.02, y * 0.02);
    }


    getChunkAt(playerX, playerY) {
        const chunkX = Math.floor(playerX / (this.chunkSize * this.tileSize));
        const chunkY = Math.floor(playerY / (this.chunkSize * this.tileSize));

        const tiles = [];
        const ores = [];
        const buildings = [];
        let townId = "";
        let townSize = 0; // 0: None, 1: Village, 2: City

        const scale = 0.1;
        const dist = Math.sqrt(chunkX * chunkX + chunkY * chunkY);


        // Starter Village at Spawn (0,0)
        if (chunkX === 0 && chunkY === 0) {
            townId = "village_starter";
            townSize = 1;
        } else {
            // Rare City check
            const cn = this.cityNoise(chunkX, chunkY);
            if (cn > 0.85) {
                townId = `city_${Math.floor(chunkX / 5)}_${Math.floor(chunkY / 5)}`;
                townSize = 2; // City
            } else {
                // Village check
                const vn = this.villageNoise(chunkX, chunkY);
                if (vn > 0.82) {
                    townId = `village_${Math.floor(chunkX / 3)}_${Math.floor(chunkY / 3)}`;
                    townSize = 1; // Village
                }
            }
        }

        // Town logic: spawn larger buildings
        if (townSize > 0) {
            const spawnRate = townSize === 2 ? 0.12 : 0.08;
            for (let by = 3; by < this.chunkSize - 3; by += 6) {
                for (let bx = 3; bx < this.chunkSize - 3; bx += 6) {
                    const worldX = chunkX * this.chunkSize + bx;
                    const worldY = chunkY * this.chunkSize + by;

                    let shouldSpawn = this.hash(worldX * 30, worldY * 30) > (1 - spawnRate);
                    let bType = 'house';


                    // Force starter village buildings
                    if (townId === "village_starter") {
                        if (bx === 3 && by === 3) { shouldSpawn = true; bType = 'house'; }
                        if (bx === 9 && by === 9) { shouldSpawn = true; bType = 'merchant'; }
                        if (bx === 9 && by === 3) { shouldSpawn = true; bType = 'chest'; }
                    } else if (shouldSpawn) {
                        const bRoll = this.hash(worldX * 40, worldY * 40);
                        if (bRoll > 0.85) bType = 'merchant';
                        else if (bRoll > 0.70) bType = 'forge';
                        else if (bRoll > 0.55) bType = 'chest';
                    }

                    if (shouldSpawn) {
                        // Minimum 4x4 tiles = 128px. Merchants/Forges slightly larger.
                        buildings.push({
                            type: bType,
                            x: worldX * this.tileSize + 32,
                            y: worldY * this.tileSize + 32,
                            size: (bType === 'merchant' || bType === 'forge') ? 160 : 128
                        });
                    }
                }
            }
        }

        for (let y = 0; y < this.chunkSize; y++) {
            const row = [];
            for (let x = 0; x < this.chunkSize; x++) {
                const worldX = chunkX * this.chunkSize + x;
                const worldY = chunkY * this.chunkSize + y;

                const n = this.noise(worldX * scale, worldY * scale);
                let isWall = n < 0.45;

                // Footprint check
                let inBuilding = false;
                for (const b of buildings) {
                    const bx = Math.floor(b.x / this.tileSize);
                    const by = Math.floor(b.y / this.tileSize);
                    const half = Math.floor(b.size / (this.tileSize * 2));
                    if (worldX >= bx - half && worldX <= bx + half &&
                        worldY >= by - half && worldY <= by + half) {
                        inBuilding = true;
                        break;
                    }
                }

                let clearSpace = false;
                if (townSize === 2) clearSpace = true;
                if (townSize === 1) {
                    const centerX = chunkX * this.chunkSize + 8;
                    const centerY = chunkY * this.chunkSize + 8;
                    const dx = worldX - centerX;
                    const dy = worldY - centerY;
                    if (Math.sqrt(dx * dx + dy * dy) < 9) clearSpace = true; // Increased radius
                }
                if (inBuilding) clearSpace = true;

                if (clearSpace) isWall = false;

                if (Math.abs(worldX) < 5 && Math.abs(worldY) < 5) {
                    row.push(0);
                } else {
                    row.push(isWall ? 1 : 0);
                }

                // Ores
                if (!isWall && !clearSpace && !inBuilding) {
                    if (this.hash(worldX * 10, worldY * 10) > 0.95) {
                        const rarityRoll = this.hash(worldX * 20, worldY * 20);
                        let oreType = 'STONE';
                        if (dist > 50 && rarityRoll > 0.98) oreType = 'DIAMOND';
                        else if (dist > 30 && rarityRoll > 0.95) oreType = 'GOLD';
                        else if (dist > 10 && rarityRoll > 0.90) oreType = 'IRON';
                        else if (dist > 5 && rarityRoll > 0.80) oreType = 'COPPER';

                        ores.push(new Ore(oreType, worldX * this.tileSize + 16, worldY * this.tileSize + 16));
                    }
                }
            }
            tiles.push(row);
        }

        return { chunkX, chunkY, tiles, ores, buildings, townId };
    }
}


module.exports = MapGenerator;

