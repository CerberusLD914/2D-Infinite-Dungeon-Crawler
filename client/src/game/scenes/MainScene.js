

import Phaser from 'phaser';

export default class MainScene extends Phaser.Scene {
    constructor() {
        super('MainScene');
        this.room = null;
        this.players = {};
        this.chunks = {};
        this.ores = {};
        this.buildings = {};
        this.cursors = null;
        this.wasd = null;
        this.myId = null;
        this.isShuttingDown = false;
        this.chunkSize = 16;
        this.tileSize = 32;
    }

    preload() {
        this.load.image('ore_diamond', 'assets/ores/Diamante.png');
        this.load.image('ore_iron', 'assets/ores/Hierro.png');
        this.load.image('ore_gold', 'assets/ores/ORO.png');
        this.load.image('ore_stone', 'assets/ores/Piedra.png');
        this.load.image('backpack', 'assets/backpack.png');
        this.load.image('forge', 'assets/forge.png');
        this.load.image('merchant', 'assets/merchant.png');
        this.load.image('chest', 'assets/chest.png');
        this.load.image('house', 'assets/house.png');
    }

    create() {
        // Lighting
        this.lights.enable().setAmbientColor(0x111111);

        this.cameras.main.setBackgroundColor('#000000');

        // Input
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.W,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            left: Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D
        });

        const client = this.registry.get('colyseus');
        const user = this.registry.get('user');

        this.initGame(client, user);
    }

    async initGame(client, user) {
        try {
            this.room = await client.joinOrCreate("game", {
                username: user.username,
                color: user.character ? user.character.color : "#00ff00"
            });
            this.myId = this.room.sessionId;

            // Player sync
            this.room.state.players.onAdd((player, sessionId) => {
                const color = parseInt(player.color.replace('#', ''), 16);
                const p = this.add.rectangle(player.x, player.y, 28, 28, color);
                p.setPipeline('Light2D');

                // Name Tag
                const text = this.add.text(0, -25, player.username, { fontSize: '12px' }).setOrigin(0.5);
                p.nameTag = text;

                // Player Light
                p.light = this.lights.addLight(player.x, player.y, 200).setIntensity(2).setColor(0xffffff);

                p.serverX = player.x;
                p.serverY = player.y;
                this.players[sessionId] = p;

                if (sessionId === this.myId) {
                    this.cameras.main.startFollow(p, true, 0.1, 0.1);
                }

                player.onChange(() => {
                    p.serverX = player.x;
                    p.serverY = player.y;
                });
            });

            this.room.state.players.onRemove((player, sessionId) => {
                const p = this.players[sessionId];
                if (p) {
                    if (p.light) this.lights.removeLight(p.light);
                    p.nameTag.destroy();
                    p.destroy();
                    delete this.players[sessionId];
                }
            });


            // Chunk sync
            this.room.state.chunks.onAdd((chunk, key) => {
                this.renderChunk(chunk, key);

                // Track Ores in this chunk
                chunk.ores.onAdd((ore, oreId) => {
                    this.renderOre(ore, oreId);
                });

                chunk.ores.onRemove((ore, oreId) => {
                    if (this.ores[oreId]) {
                        if (this.ores[oreId].light) this.lights.removeLight(this.ores[oreId].light);
                        this.ores[oreId].destroy();
                        delete this.ores[oreId];
                    }
                });

                // Listen for tile changes
                chunk.tiles.onChange((value, index) => {
                    this.updateTileAt(chunk, key, index, value);
                });
            });

            // Town sync
            this.room.state.towns.onAdd((town, townId) => {
                town.buildings.onAdd((building, bId) => {
                    this.renderBuilding(town, building, bId);
                });
            });


            // Input: Click to mine/dig
            this.input.on('pointerdown', (pointer) => {
                const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);

                // Check if we clicked an ore
                for (let id in this.ores) {
                    const ore = this.ores[id];
                    const dist = Phaser.Math.Distance.Between(worldPoint.x, worldPoint.y, ore.x, ore.y);
                    if (dist < 20) {
                        this.room.send("mine", id);
                        return;
                    }
                }

                // Interaction with buildings
                this.room.state.towns.forEach((town, tId) => {
                    town.buildings.forEach((building, bId) => {
                        const dist = Phaser.Math.Distance.Between(worldPoint.x, worldPoint.y, building.x, building.y);
                        if (dist < building.size / 1.5) {
                            if (building.type === 'merchant') this.openMerchantUI(town, building);
                            if (building.type === 'chest') this.openChestUI(town, building);
                            return;
                        }
                    });
                });

                // Otherwise, try to dig
                const tx = Math.floor(worldPoint.x / 32) * 32;
                const ty = Math.floor(worldPoint.y / 32) * 32;
                this.room.send("dig", { x: tx, y: ty });

            });


            // Highlighter
            this.highlighter = this.add.rectangle(0, 0, 32, 32, 0xffffff, 0.2).setOrigin(0);
            this.highlighter.setStrokeStyle(2, 0xffffff, 0.5);

            // Inventory HUD
            this.createInventoryHUD();

        } catch (e) {
            console.error("Join error", e);
        }
    }

    createInventoryHUD() {
        // Backpack Icon
        const backpackIcon = this.add.image(10, 10, 'backpack').setOrigin(0).setDisplaySize(50, 50).setScrollFactor(0).setInteractive({ useHandCursor: true });
        backpackIcon.setDepth(1000);

        // Inventory Panel Container
        this.inventoryPanel = this.add.container(60, 10).setScrollFactor(0).setVisible(false).setDepth(1001);
        const panelBg = this.add.rectangle(0, 0, 300, 200, 0x000000, 0.9).setOrigin(0);
        panelBg.setStrokeStyle(2, 0xffcc00); // Golden border

        const title = this.add.text(10, 10, 'INVENTORY', { fontSize: '18px', color: '#ffcc00', fontWeight: 'bold' });
        this.goldLabel = this.add.text(285, 10, '0g', { fontSize: '18px', color: '#ffff00', fontWeight: 'bold' }).setOrigin(1, 0);

        this.inventorySlots = this.add.container(10, 40);
        this.inventoryPanel.add([panelBg, title, this.goldLabel, this.inventorySlots]);

        // Make draggable
        this.inventoryPanel.setInteractive(new Phaser.Geom.Rectangle(0, 0, 300, 200), Phaser.Geom.Rectangle.Contains);
        this.input.setDraggable(this.inventoryPanel);

        this.input.on('drag', (pointer, gameObject, dragX, dragY) => {
            if (gameObject === this.inventoryPanel) {
                gameObject.x = dragX;
                gameObject.y = dragY;
            }
        });

        // Toggle visibility
        backpackIcon.on('pointerdown', () => {
            this.inventoryPanel.setVisible(!this.inventoryPanel.visible);
            if (this.inventoryPanel.visible) this.updateInventoryUI(this.room.state.players.get(this.myId));
        });


        this.room.state.players.onAdd((player, sessionId) => {
            if (sessionId === this.myId) {
                player.inventory.onAdd(() => this.updateInventoryUI(player));
                player.inventory.onChange(() => this.updateInventoryUI(player));
                // Use listen() for property changes in this Colyseus version
                player.listen("gold", (gold) => {
                    this.goldLabel.setText(`${gold}g`);
                });
                this.goldLabel.setText(`${player.gold}g`);
            }
        });
    }


    updateInventoryUI(player) {
        if (!player || !this.inventoryPanel.visible) return;

        // If chest is open, clicking inventory deposits item
        let onSlotClick = null;
        if (this.chestPanel) {
            onSlotClick = (item) => {
                console.log(`[CLIENT] Depositing ${item} to chest`);
                this.room.send("chest", {
                    townId: this.chestPanel.town.id,
                    buildingId: this.chestPanel.building.id,
                    item,
                    action: 'deposit'
                });
            };
        }

        this.renderSlots(player.inventory, this.inventorySlots, onSlotClick);
    }

    renderSlots(itemsMap, targetContainer, onSlotClick = null) {
        console.log('[RENDER SLOTS] Called with onSlotClick:', onSlotClick, 'Items:', itemsMap);
        targetContainer.removeAll(true);
        let slotX = 0;
        let slotY = 0;
        const slotSize = 64;
        const padding = 10;

        itemsMap.forEach((totalCount, name) => {
            console.log(`[RENDER SLOTS] Rendering item ${name}, count: ${totalCount}, has click handler: ${!!onSlotClick}`);
            let remaining = totalCount;
            while (remaining > 0) {
                const stackSize = Math.min(remaining, 64);
                const slot = this.add.container(slotX, slotY);
                const box = this.add.rectangle(0, 0, slotSize, slotSize, 0x333333).setOrigin(0);
                box.setStrokeStyle(1, 0x666666);

                const iconMap = { 'Stone': 'ore_stone', 'Iron': 'ore_iron', 'Gold': 'ore_gold', 'Diamond': 'ore_diamond' };
                const icon = this.add.image(slotSize / 2, slotSize / 2, iconMap[name] || 'ore_stone').setDisplaySize(40, 40);
                const countLabel = this.add.text(slotSize - 5, slotSize - 5, stackSize.toString(), { fontSize: '14px', color: '#ffffff' }).setOrigin(1);

                slot.add([box, icon, countLabel]);
                if (onSlotClick) {
                    box.setInteractive({ useHandCursor: true });
                    box.on('pointerdown', () => {
                        console.log(`[RENDER SLOTS] Click handler triggered for ${name}`);
                        onSlotClick(name);
                    });
                }
                targetContainer.add(slot);

                remaining -= stackSize;
                slotX += slotSize + padding;
                if (slotX > 210) { slotX = 0; slotY += slotSize + padding; }
            }
        });
    }



    renderBuilding(town, building, bId) {
        if (this.buildings[bId]) return;
        const b = this.add.image(building.x, building.y, building.type).setDisplaySize(building.size, building.size);
        b.setPipeline('Light2D');
        b.setDepth(10);

        const label = building.type === 'merchant' ? 'MERCHANT' : building.type.toUpperCase();
        const text = this.add.text(building.x, building.y - (building.size / 2 + 10), `${label}\n(${town.name})`, {
            fontSize: '11px',
            color: '#ffcc00',
            align: 'center',
            fontWeight: 'bold',
            backgroundColor: '#000000aa',
            padding: { x: 4, y: 2 }
        }).setOrigin(0.5).setDepth(11);

        this.buildings[bId] = { sprite: b, label: text, x: building.x, y: building.y, town, building };
    }



    openMerchantUI(town, building) {
        if (this.merchantPanel) this.merchantPanel.destroy();

        this.inventoryPanel.setVisible(true);
        this.merchantPanel = this.add.container(400, 50).setScrollFactor(0).setDepth(2000);
        this.merchantPanel.building = building;
        this.merchantTab = 'buy'; // Default tab

        const bg = this.add.rectangle(0, 0, 350, 450, 0x000000, 0.95).setOrigin(0);
        bg.setStrokeStyle(2, 0xffcc00);

        const title = this.add.text(10, 10, `${town.name} Merchant`, { fontSize: '18px', color: '#ffcc00', fontWeight: 'bold' });

        const closeBtn = this.add.text(320, 10, 'X', { fontSize: '20px', color: '#ff0000', fontWeight: 'bold' }).setInteractive({ useHandCursor: true });
        closeBtn.on('pointerdown', () => {
            this.merchantPanel.destroy();
            this.merchantPanel = null;
        });

        // Tabs
        const buyTabBtn = this.add.container(10, 45);
        const buyBg = this.add.rectangle(0, 0, 80, 30, 0x333333).setOrigin(0);
        const buyTxt = this.add.text(40, 15, 'BUY', { fontSize: '14px', fontWeight: 'bold' }).setOrigin(0.5);
        buyTabBtn.add([buyBg, buyTxt]);
        buyTabBtn.setInteractive(new Phaser.Geom.Rectangle(0, 0, 80, 30), Phaser.Geom.Rectangle.Contains);

        const sellTabBtn = this.add.container(100, 45);
        const sellBg = this.add.rectangle(0, 0, 80, 30, 0x333333).setOrigin(0);
        const sellTxt = this.add.text(40, 15, 'SELL', { fontSize: '14px', fontWeight: 'bold' }).setOrigin(0.5);
        sellTabBtn.add([sellBg, sellTxt]);
        sellTabBtn.setInteractive(new Phaser.Geom.Rectangle(0, 0, 80, 30), Phaser.Geom.Rectangle.Contains);

        const content = this.add.container(0, 85);
        this.merchantPanel.add([bg, title, closeBtn, buyTabBtn, sellTabBtn, content]);

        const refreshTab = () => {
            content.removeAll(true);
            buyBg.setFillStyle(this.merchantTab === 'buy' ? 0xffcc00 : 0x333333);
            buyTxt.setColor(this.merchantTab === 'buy' ? '#000000' : '#ffffff');
            sellBg.setFillStyle(this.merchantTab === 'sell' ? 0xffcc00 : 0x333333);
            sellTxt.setColor(this.merchantTab === 'sell' ? '#000000' : '#ffffff');

            let yOffset = 10;
            building.offers.forEach((offer, item) => {
                const row = this.add.container(10, yOffset);
                const itemTitle = this.add.text(0, 0, item, { fontSize: '16px', color: '#ffcc00', fontWeight: 'bold' });
                const priceLabel = this.merchantTab === 'buy' ? `Buy: ${offer.buyPrice}g` : `Sell: ${offer.sellPrice}g`;
                const priceTxt = this.add.text(0, 20, `${priceLabel} | Stock: ${offer.limit}`, { fontSize: '13px', color: '#ffffff' });

                const actionBtn = this.add.rectangle(230, 5, 80, 30, this.merchantTab === 'buy' ? 0xffff00 : 0x00ff00, 0.6).setOrigin(0).setInteractive({ useHandCursor: true });
                const actionTxt = this.add.text(270, 20, this.merchantTab.toUpperCase(), { fontSize: '13px', fontWeight: 'bold', color: '#000000' }).setOrigin(0.5);

                actionBtn.on('pointerdown', () => {
                    this.room.send("trade", { townId: town.id, buildingId: building.id, item, type: this.merchantTab });
                });

                row.add([itemTitle, priceTxt, actionBtn, actionTxt]);
                content.add(row);
                yOffset += 55;
            });
        };

        buyTabBtn.on('pointerdown', () => { this.merchantTab = 'buy'; refreshTab(); });
        sellTabBtn.on('pointerdown', () => { this.merchantTab = 'sell'; refreshTab(); });

        refreshTab();

        // Draggable
        this.merchantPanel.setInteractive(new Phaser.Geom.Rectangle(0, 0, 350, 40), Phaser.Geom.Rectangle.Contains);
        this.input.setDraggable(this.merchantPanel);
        this.input.on('drag', (pointer, gameObject, dragX, dragY) => {
            if (gameObject === this.merchantPanel) {
                gameObject.x = dragX;
                gameObject.y = dragY;
            }
        });
        this.merchantPanel.sendToBack(bg);
    }


    openChestUI(town, building) {
        if (this.chestPanel) this.chestPanel.destroy();

        this.inventoryPanel.setVisible(true);
        this.chestPanel = this.add.container(400, 50).setScrollFactor(0).setDepth(2000);
        this.chestPanel.building = building;
        this.chestPanel.town = town;

        const bg = this.add.rectangle(0, 0, 350, 400, 0x000000, 0.95).setOrigin(0).setStrokeStyle(2, 0x00ffff);
        const title = this.add.text(10, 10, `Village Chest (${town.name})`, { fontSize: '18px', color: '#00ffff', fontWeight: 'bold' });

        const closeBtn = this.add.text(320, 10, 'X', { fontSize: '20px', color: '#ff0000', fontWeight: 'bold' }).setInteractive({ useHandCursor: true });
        closeBtn.on('pointerdown', () => {
            this.chestPanel.destroy();
            this.chestPanel = null;
            this.updateInventoryUI(this.room.state.players.get(this.myId)); // Refresh to disable deposit clicks
        });

        const slotCont = this.add.container(10, 50);
        this.chestPanel.add([bg, title, closeBtn, slotCont]);

        const updateChest = () => {
            if (!this.chestPanel) return;
            console.log('[CHEST UI] Rendering chest contents:', building.chestInventory);
            this.renderSlots(building.chestInventory, slotCont, (item) => {
                console.log(`[CHEST UI] Withdrawing ${item} from chest`);
                this.room.send("chest", { townId: town.id, buildingId: building.id, item, action: 'withdraw' });
            });
        };

        building.chestInventory.onAdd(updateChest);
        building.chestInventory.onChange(updateChest);
        updateChest();

        // Draggable
        this.chestPanel.setInteractive(new Phaser.Geom.Rectangle(0, 0, 350, 40), Phaser.Geom.Rectangle.Contains);
        this.input.setDraggable(this.chestPanel);
        this.input.on('drag', (pointer, gameObject, dragX, dragY) => {
            if (gameObject === this.chestPanel) {
                gameObject.x = dragX;
                gameObject.y = dragY;
            }
        });

        // Refresh inventory UI to enable "click to deposit"
        const player = this.room.state.players.get(this.myId);
        console.log('[CHEST UI] Opening chest, refreshing inventory with deposit handler');
        this.updateInventoryUI(player);
    }




    updateTileAt(chunk, chunkKey, index, value) {
        // Redraw only if necessary
        const container = this.chunks[chunkKey];
        if (container) {
            container.removeAll(true);
            delete this.chunks[chunkKey];
            this.renderChunk(chunk, chunkKey);
        }
    }


    renderChunk(chunk, key) {
        if (this.chunks[key]) return;

        const container = this.add.container(chunk.x * this.chunkSize * this.tileSize, chunk.y * this.chunkSize * this.tileSize);
        this.chunks[key] = container;

        const graphics = this.add.graphics();
        graphics.setPipeline('Light2D');
        container.add(graphics);

        graphics.fillStyle(0x444444);
        graphics.lineStyle(1, 0x000000, 0.5);

        for (let i = 0; i < chunk.tiles.length; i++) {
            const tileType = chunk.tiles[i];
            if (tileType === 1) { // Wall
                const lx = (i % this.chunkSize) * this.tileSize;
                const ly = Math.floor(i / this.chunkSize) * this.tileSize;

                graphics.fillRect(lx, ly, this.tileSize, this.tileSize);
                graphics.strokeRect(lx, ly, this.tileSize, this.tileSize);
            }
        }
    }


    renderOre(ore, id) {
        if (this.ores[id]) return;

        const textureMap = {
            'Stone': 'ore_stone',
            'Copper': 'ore_iron', // Falling back to iron as copper isn't in Assets/Ores
            'Iron': 'ore_iron',
            'Gold': 'ore_gold',
            'Diamond': 'ore_diamond'
        };


        const texture = textureMap[ore.type] || 'ore_stone';
        const o = this.add.image(ore.x, ore.y, texture).setDisplaySize(42, 42);
        o.setPipeline('Light2D');

        // Add subtle light to premium ores
        if (ore.type === 'Diamond' || ore.type === 'Gold') {
            const colors = { 'Diamond': 0x00ffff, 'Gold': 0xffd700 };
            o.light = this.lights.addLight(ore.x, ore.y, 50).setColor(colors[ore.type]).setIntensity(1);
        }

        this.ores[id] = o;

    }

    update(time, delta) {
        if (!this.room) return;
        const myPlayer = this.players[this.myId];

        const left = this.cursors.left.isDown || this.wasd.left.isDown;
        const right = this.cursors.right.isDown || this.wasd.right.isDown;
        const up = this.cursors.up.isDown || this.wasd.up.isDown;
        const down = this.cursors.down.isDown || this.wasd.down.isDown;

        const input = { left, right, up, down };

        // Local Player Prediction & Interpolation
        for (let id in this.players) {
            const p = this.players[id];

            if (id === this.myId) {
                // prediction simplified: pull towards server
                p.x = Phaser.Math.Linear(p.x, p.serverX, 0.2);
                p.y = Phaser.Math.Linear(p.y, p.serverY, 0.2);
            } else {
                p.x = Phaser.Math.Linear(p.x, p.serverX, 0.1);
                p.y = Phaser.Math.Linear(p.y, p.serverY, 0.1);
            }


            p.nameTag.setPosition(p.x, p.y - 25);
            if (p.light) p.light.setPosition(p.x, p.y);
        }

        // Update Highlighter
        const worldPoint = this.input.activePointer.positionToCamera(this.cameras.main);
        const tx = Math.floor(worldPoint.x / 32) * 32;
        const ty = Math.floor(worldPoint.y / 32) * 32;
        if (this.highlighter) {
            this.highlighter.setPosition(tx, ty);
        }



        // Send to server
        if (left || right || up || down) {
            this.room.send("move", input);



            // Auto-close Merchant UI if too far
            if (myPlayer && this.merchantPanel && this.merchantPanel.building) {
                const dist = Phaser.Math.Distance.Between(myPlayer.x, myPlayer.y, this.merchantPanel.building.x, this.merchantPanel.building.y);
                if (dist > 180) {
                    this.merchantPanel.destroy();
                    this.merchantPanel = null;
                }
            }


            // Auto-close Chest UI if too far
            if (myPlayer && this.chestPanel && this.chestPanel.building) {
                const dist = Phaser.Math.Distance.Between(myPlayer.x, myPlayer.y, this.chestPanel.building.x, this.chestPanel.building.y);
                if (dist > 180) {
                    this.chestPanel.destroy();
                    this.chestPanel = null;
                    // Use server state player, not client sprite
                    const serverPlayer = this.room.state.players.get(this.myId);
                    if (serverPlayer) this.updateInventoryUI(serverPlayer);
                }
            }
        }


        // Chunk, Ore & Building Management (Fix lag and handle re-rendering)
        if (myPlayer && time % 1000 < 50) {
            const cullDist = 1200;
            const renderDist = 800;

            // 1. Cull Distant Assets
            for (let key in this.chunks) {
                const container = this.chunks[key];
                const dist = Phaser.Math.Distance.Between(myPlayer.x, myPlayer.y, container.x + 256, container.y + 256);
                if (dist > cullDist) {
                    container.destroy();
                    delete this.chunks[key];
                }
            }
            for (let id in this.ores) {
                const ore = this.ores[id];
                const dist = Phaser.Math.Distance.Between(myPlayer.x, myPlayer.y, ore.x, ore.y);
                if (dist > cullDist) {
                    if (ore.light) this.lights.removeLight(ore.light);
                    ore.destroy();
                    delete this.ores[id];
                }
            }
            // Cull Buildings
            for (let id in this.buildings) {
                const b = this.buildings[id];
                const dist = Phaser.Math.Distance.Between(myPlayer.x, myPlayer.y, b.x, b.y);
                if (dist > cullDist) {
                    b.sprite.destroy();
                    b.label.destroy();
                    delete this.buildings[id];
                }
            }

            // 2. Re-render nearby chunks already in state
            this.room.state.chunks.forEach((chunk, key) => {
                if (!this.chunks[key]) {
                    const cx = chunk.x * this.chunkSize * this.tileSize;
                    const cy = chunk.y * this.chunkSize * this.tileSize;
                    const dist = Phaser.Math.Distance.Between(myPlayer.x, myPlayer.y, cx + 256, cy + 256);
                    if (dist < renderDist) {
                        this.renderChunk(chunk, key);

                        // Re-attach ore listeners
                        chunk.ores.onAdd((ore, oreId) => this.renderOre(ore, oreId));
                        chunk.ores.onRemove((ore, oreId) => {
                            if (this.ores[oreId]) {
                                if (this.ores[oreId].light) this.lights.removeLight(this.ores[oreId].light);
                                this.ores[oreId].destroy();
                                delete this.ores[oreId];
                            }
                        });

                        // Re-attach tile change listener for wall removal
                        chunk.tiles.onChange((value, index) => {
                            this.updateTileAt(chunk, key, index, value);
                        });

                        // Render existing ores
                        chunk.ores.forEach((ore, oreId) => this.renderOre(ore, oreId));

                        // Re-render town buildings if applicable
                        if (chunk.townId && this.room.state.towns.has(chunk.townId)) {
                            const town = this.room.state.towns.get(chunk.townId);
                            town.buildings.forEach((building, bId) => this.renderBuilding(town, building, bId));
                        }
                    }
                }
            });
        }

    }
}

