

const { Room } = require('colyseus');
const { GameState, PlayerSchema, ChunkSchema, OreSchema, BuildingSchema, TownSchema, MerchantOfferSchema } = require('./schema/GameState');
const MapGenerator = require('../game/MapGenerator');

class GameRoom extends Room {

    onCreate(options) {
        this.setState(new GameState());
        this.mapGenerator = new MapGenerator();
        this.chunkSize = 16;
        this.tileSize = 32;
        this.chunkPx = this.chunkSize * this.tileSize;

        this.onMessage("move", (client, input) => {
            const player = this.state.players.get(client.sessionId);
            if (!player) return;

            const speed = 5;
            let moveX = 0;
            let moveY = 0;
            if (input.up) moveY -= speed;
            if (input.down) moveY += speed;
            if (input.left) moveX -= speed;
            if (input.right) moveX += speed;

            if (moveX !== 0 && moveY !== 0) {
                const diagSpeed = speed * 0.707;
                moveX = moveX > 0 ? diagSpeed : -diagSpeed;
                moveY = moveY > 0 ? diagSpeed : -diagSpeed;
            }

            if (moveX !== 0) {
                const targetX = player.x + moveX;
                if (!this.checkCollision(targetX, player.y)) player.x = targetX;
            }
            if (moveY !== 0) {
                const targetY = player.y + moveY;
                if (!this.checkCollision(player.x, targetY)) player.y = targetY;
            }
            this.updatePlayerChunks(player);
        });


        this.onMessage("mine", (client, oreId) => {
            const player = this.state.players.get(client.sessionId);
            if (!player) return;

            for (let [key, chunk] of this.state.chunks.entries()) {
                const ore = chunk.ores.get(oreId);
                if (ore) {
                    const dist = Math.sqrt((player.x - ore.x) ** 2 + (player.y - ore.y) ** 2);
                    if (dist < 50) {
                        if (this.hasAdjacentFloor(ore.x, ore.y)) {
                            // Add to inventory
                            const currentCount = player.inventory.get(ore.type) || 0;
                            player.inventory.set(ore.type, currentCount + 1);

                            chunk.ores.delete(oreId);
                        }
                    }
                    break;
                }
            }
        });

        this.onMessage("dig", (client, target) => {
            const player = this.state.players.get(client.sessionId);
            if (!player || !target) return;

            const cx = target.x + 16;
            const cy = target.y + 16;
            const dist = Math.sqrt((player.x - cx) ** 2 + (player.y - cy) ** 2);

            if (dist < 60) {
                if (this.getTileAt(cx, cy) === 1 && this.hasAdjacentFloor(cx, cy)) {
                    // Add Stone to inventory
                    const currentCount = player.inventory.get("Stone") || 0;
                    player.inventory.set("Stone", currentCount + 1);

                    this.setTileAt(target.x, target.y, 0); // Floor
                }
            }
        });



        this.onMessage("trade", (client, { townId, buildingId, item, type }) => {
            const player = this.state.players.get(client.sessionId);
            const town = this.state.towns.get(townId);
            if (!player || !town) return;
            const building = town.buildings.get(buildingId);
            if (!building || building.type !== 'merchant') return;

            // Proximity check - bit larger for big buildings
            const dist = Math.sqrt((player.x - building.x) ** 2 + (player.y - building.y) ** 2);
            if (dist > 120) return;

            const offer = building.offers.get(item);
            if (!offer || offer.limit <= 0) return;

            if (type === 'sell') { // Player selling item to merchant
                const count = player.inventory.get(item) || 0;
                if (count > 0) {
                    player.inventory.set(item, count - 1);
                    player.gold += offer.sellPrice;
                    offer.limit -= 1;
                }
            } else if (type === 'buy') { // Player buying item from merchant
                if (player.gold >= offer.buyPrice) {
                    player.gold -= offer.buyPrice;
                    const count = player.inventory.get(item) || 0;
                    player.inventory.set(item, count + 1);
                    offer.limit -= 1;
                }
            }
        });

        this.onMessage("chest", (client, { townId, buildingId, item, action }) => {
            const player = this.state.players.get(client.sessionId);
            const town = this.state.towns.get(townId);
            if (!player || !town) return;
            const building = town.buildings.get(buildingId);
            if (!building || building.type !== 'chest') return;

            // Proximity check - increased for larger buildings (chest size is 128-160px)
            const dist = Math.sqrt((player.x - building.x) ** 2 + (player.y - building.y) ** 2);
            if (dist > 150) return;

            if (action === 'deposit') {
                const pCount = player.inventory.get(item) || 0;
                if (pCount > 0) {
                    player.inventory.set(item, pCount - 1);
                    const cCount = building.chestInventory.get(item) || 0;
                    building.chestInventory.set(item, cCount + 1);
                    console.log(`[CHEST] Deposited ${item}. Player: ${pCount} -> ${pCount - 1}, Chest: ${cCount} -> ${cCount + 1}`);
                }
            } else if (action === 'withdraw') {
                const cCount = building.chestInventory.get(item) || 0;
                if (cCount > 0) {
                    building.chestInventory.set(item, cCount - 1);
                    const pCount = player.inventory.get(item) || 0;
                    player.inventory.set(item, pCount + 1);
                    console.log(`[CHEST] Withdrew ${item}. Chest: ${cCount} -> ${cCount - 1}, Player: ${pCount} -> ${pCount + 1}`);
                }
            }
        });

        this.setSimulationInterval((deltaTime) => this.update(deltaTime), 50);
    }

    setTileAt(worldX, worldY, type) {
        const chunkX = Math.floor(worldX / this.chunkPx);
        const chunkY = Math.floor(worldY / this.chunkPx);
        const key = `${chunkX}_${chunkY}`;

        const chunk = this.state.chunks.get(key);
        if (chunk) {
            const localX = Math.floor((worldX % this.chunkPx) / this.tileSize);
            const localY = Math.floor((worldY % this.chunkPx) / this.tileSize);
            const correctX = localX < 0 ? localX + this.chunkSize : localX;
            const correctY = localY < 0 ? localY + this.chunkSize : localY;
            const index = correctY * this.chunkSize + correctX;

            chunk.tiles[index] = type;
        }
    }

    hasAdjacentFloor(worldX, worldY) {
        const neighbors = [
            { x: worldX - this.tileSize, y: worldY },
            { x: worldX + this.tileSize, y: worldY },
            { x: worldX, y: worldY - this.tileSize },
            { x: worldX, y: worldY + this.tileSize }
        ];
        for (const n of neighbors) {
            if (this.getTileAt(n.x, n.y) === 0) return true;
        }
        return false;
    }


    checkCollision(x, y) {
        const radius = 12;
        const corners = [
            { x: x - radius, y: y - radius },
            { x: x + radius, y: y - radius },
            { x: x - radius, y: y + radius },
            { x: x + radius, y: y + radius }
        ];

        for (const c of corners) {
            const tile = this.getTileAt(c.x, c.y);
            if (tile === 1) return true; // Wall
        }

        // Building collision
        for (let [tId, town] of this.state.towns.entries()) {
            for (let [bId, building] of town.buildings.entries()) {
                const half = building.size / 2;
                if (x >= building.x - half && x <= building.x + half &&
                    y >= building.y - half && y <= building.y + half) {
                    return true;
                }
            }
        }
        return false;
    }

    getTileAt(worldX, worldY) {
        const chunkX = Math.floor(worldX / this.chunkPx);
        const chunkY = Math.floor(worldY / this.chunkPx);
        const key = `${chunkX}_${chunkY}`;

        const chunk = this.state.chunks.get(key);
        if (!chunk) return 0; // Assume floor if chunk not loaded yet

        const localX = Math.floor((worldX % this.chunkPx) / this.tileSize);
        const localY = Math.floor((worldY % this.chunkPx) / this.tileSize);

        const correctX = localX < 0 ? localX + this.chunkSize : localX;
        const correctY = localY < 0 ? localY + this.chunkSize : localY;

        const index = correctY * this.chunkSize + correctX;
        return chunk.tiles[index] || 0;
    }

    updatePlayerChunks(player) {
        const chunkX = Math.floor(player.x / this.chunkPx);
        const chunkY = Math.floor(player.y / this.chunkPx);

        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const cx = chunkX + dx;
                const cy = chunkY + dy;
                const key = `${cx}_${cy}`;

                if (!this.state.chunks.has(key)) {
                    this.loadChunk(cx, cy);
                }
            }
        }
    }


    loadChunk(cx, cy) {
        const key = `${cx}_${cy}`;
        const chunk = new ChunkSchema(cx, cy);
        const data = this.mapGenerator.getChunkAt(cx * this.chunkPx, cy * this.chunkPx);

        // Flatten tiles
        for (let y = 0; y < this.chunkSize; y++) {
            for (let x = 0; x < this.chunkSize; x++) {
                chunk.tiles.push(data.tiles[y][x]);
            }
        }

        // Add ores
        data.ores.forEach(ore => {
            chunk.ores.set(ore.id, new OreSchema(ore.type, ore.x, ore.y, ore.id));
        });

        // Initialize Town if applicable
        if (data.townId) {
            chunk.townId = data.townId;
            let town = this.state.towns.get(data.townId);
            if (!town) {
                const isCity = data.townId.startsWith('city');
                const namePrefix = isCity ? "City" : "Village";
                town = new TownSchema(data.townId, `${namePrefix} ${data.townId.split('_')[1]}`, cx * this.chunkPx, cy * this.chunkPx);
                this.state.towns.set(data.townId, town);
            }

            // Add buildings to town
            data.buildings.forEach((bData, idx) => {
                const bId = `${data.townId}_b_${cx}_${cy}_${idx}`;
                if (!town.buildings.has(bId)) {
                    const building = new BuildingSchema(bData.type, bData.x, bData.y, bId, bData.size);
                    if (bData.type === 'merchant') {
                        this.refreshMerchantOffers(building, town.id);
                    }
                    town.buildings.set(bId, building);
                }
            });
        }

        this.state.chunks.set(key, chunk);
    }



    refreshMerchantOffers(building, townId) {
        building.offers.clear();
        let items = ['Stone', 'Iron', 'Gold', 'Diamond'];

        // Special case: Starter village only buys/sells Stone and Iron
        if (townId === 'village_starter') {
            items = ['Stone'];
            // 50% chance for Iron in starter village
            if (Math.random() > 0.5) items.push('Iron');
        }

        // Generate a seed based on townId for consistent but unique pricing per village
        let seed = 0;
        for (let i = 0; i < townId.length; i++) seed += townId.charCodeAt(i);

        items.forEach(item => {
            const basePrice = { 'Stone': 2, 'Iron': 15, 'Gold': 60, 'Diamond': 250 }[item];

            // Town-specific multiplier (0.7 to 1.3)
            const priceMod = 0.7 + (Math.abs(Math.sin(seed + item.length)) * 0.6);

            // Merchant buy price (what player pays to merchant)
            const buyPrice = Math.floor(basePrice * priceMod);

            // Merchant sell price (what merchant pays to player)
            const sellPrice = Math.max(1, Math.floor(buyPrice * 0.6));

            let limit = 10 + Math.floor(Math.abs(Math.cos(seed)) * 30);
            if (townId === 'village_starter' && item === 'Stone') limit = 50; // More stone in starter

            building.offers.set(item, new MerchantOfferSchema(item, buyPrice, sellPrice, limit));
        });
    }



    onJoin(client, options) {
        const username = options.username || "Guest";

        // Collect existing sessions for the same username to kick them
        const duplicateSessions = this.clients.filter(c => {
            if (c.sessionId === client.sessionId) return false;
            const player = this.state.players.get(c.sessionId);
            return player && player.username === username;
        });

        if (duplicateSessions.length > 0) {
            console.log(`[Multi-Login] User "${username}" joining. Kicking persistent duplicate session...`);
            duplicateSessions.forEach(c => {
                c.leave(4000);
            });
        }

        const player = new PlayerSchema(0, 0, options.color || "#00ff00", username);
        this.state.players.set(client.sessionId, player);

        // Load initial chunks around player
        this.updatePlayerChunks(player);

        console.log(client.sessionId, "joined!");
    }


    onLeave(client, consented) {
        console.log(client.sessionId, "left!");
        this.state.players.delete(client.sessionId);
    }

    update(deltaTime) {
        // AI and other logic
    }
}

module.exports = GameRoom;

