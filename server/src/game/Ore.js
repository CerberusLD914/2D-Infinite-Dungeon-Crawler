
const { v4: uuidv4 } = require('uuid');

const ORE_TYPES = {
    STONE: { name: 'Stone', durability: 3, rarity: 1 },
    COPPER: { name: 'Copper', durability: 5, rarity: 2 },
    IRON: { name: 'Iron', durability: 8, rarity: 3 },
    GOLD: { name: 'Gold', durability: 10, rarity: 4 },
    DIAMOND: { name: 'Diamond', durability: 15, rarity: 5 }
};

class Ore {
    constructor(typeKey, x, y) {
        this.id = uuidv4();
        this.type = ORE_TYPES[typeKey].name;
        this.durability = ORE_TYPES[typeKey].durability;
        this.maxDurability = ORE_TYPES[typeKey].durability;
        this.x = x;
        this.y = y;
        this.lastMined = 0; // Timestamp for cooldown
    }
}

module.exports = { Ore, ORE_TYPES };
