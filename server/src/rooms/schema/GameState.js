

const schema = require('@colyseus/schema');
const { Schema, MapSchema, ArraySchema, type } = schema;



class PlayerSchema extends Schema {
    constructor(x, y, color, username) {
        super();
        this.x = x;
        this.y = y;
        this.color = color;
        this.username = username;
        this.health = 100;
        this.gold = 100;
        this.inventory = new MapSchema();
    }
}
type("number")(PlayerSchema.prototype, "x");
type("number")(PlayerSchema.prototype, "y");
type("string")(PlayerSchema.prototype, "color");
type("string")(PlayerSchema.prototype, "username");
type("number")(PlayerSchema.prototype, "health");
type("number")(PlayerSchema.prototype, "gold");
type({ map: "number" })(PlayerSchema.prototype, "inventory");



class OreSchema extends Schema {
    constructor(type, x, y, id) {
        super();
        this.type = type;
        this.x = x;
        this.y = y;
        this.id = id;
    }
}
type("string")(OreSchema.prototype, "type");
type("number")(OreSchema.prototype, "x");
type("number")(OreSchema.prototype, "y");
type("string")(OreSchema.prototype, "id");

class MerchantOfferSchema extends Schema {
    constructor(item, buyPrice, sellPrice, limit) {
        super();
        this.item = item;
        this.buyPrice = buyPrice;   // Price merchant pays to player
        this.sellPrice = sellPrice; // Price player pays to merchant
        this.limit = limit;         // Remaining stock/capacity
    }
}
type("string")(MerchantOfferSchema.prototype, "item");
type("number")(MerchantOfferSchema.prototype, "buyPrice");
type("number")(MerchantOfferSchema.prototype, "sellPrice");
type("number")(MerchantOfferSchema.prototype, "limit");


class BuildingSchema extends Schema {
    constructor(type, x, y, id, size = 64) {
        super();
        this.type = type; // 'forge', 'merchant', 'chest', 'house'
        this.x = x;
        this.y = y;
        this.id = id;
        this.size = size;
        this.offers = new MapSchema();
        this.chestInventory = new MapSchema(); // For type 'chest'
    }
}
type("string")(BuildingSchema.prototype, "type");
type("number")(BuildingSchema.prototype, "x");
type("number")(BuildingSchema.prototype, "y");
type("string")(BuildingSchema.prototype, "id");
type("number")(BuildingSchema.prototype, "size");
type({ map: MerchantOfferSchema })(BuildingSchema.prototype, "offers");
type({ map: "number" })(BuildingSchema.prototype, "chestInventory");

class TownSchema extends Schema {
    constructor(id, name, x, y) {
        super();
        this.id = id;
        this.name = name;
        this.x = x;
        this.y = y;
        this.buildings = new MapSchema();
        this.lastOfferUpdate = Date.now();
    }
}
type("string")(TownSchema.prototype, "id");
type("string")(TownSchema.prototype, "name");
type("number")(TownSchema.prototype, "x");
type("number")(TownSchema.prototype, "y");
type({ map: BuildingSchema })(TownSchema.prototype, "buildings");
type("number")(TownSchema.prototype, "lastOfferUpdate");

class ChunkSchema extends Schema {
    constructor(x, y) {
        super();
        this.x = x;
        this.y = y;
        this.tiles = new ArraySchema();
        this.ores = new MapSchema();
        this.townId = ""; // Reference to a town if this chunk contains town elements
    }
}
type("number")(ChunkSchema.prototype, "x");
type("number")(ChunkSchema.prototype, "y");
type({ array: "number" })(ChunkSchema.prototype, "tiles");
type({ map: OreSchema })(ChunkSchema.prototype, "ores");
type("string")(ChunkSchema.prototype, "townId");

class GameState extends Schema {
    constructor() {
        super();
        this.players = new MapSchema();
        this.chunks = new MapSchema();
        this.towns = new MapSchema();
    }
}
type({ map: PlayerSchema })(GameState.prototype, "players");
type({ map: ChunkSchema })(GameState.prototype, "chunks");
type({ map: TownSchema })(GameState.prototype, "towns");

module.exports = { GameState, PlayerSchema, ChunkSchema, OreSchema, BuildingSchema, TownSchema, MerchantOfferSchema };


