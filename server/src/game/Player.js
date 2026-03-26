
class Player {
    constructor(id, x, y) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.speed = 5;
        this.input = { up: false, down: false, left: false, right: false };
        this.inventory = {}; // { "Stone": 10, "Gold": 2 }
    }

    setMovement(input) {
        this.input = input;
    }

    update(getTileAt) {
        let nextX = this.x;
        let nextY = this.y;

        // Speed Calculation
        // Server runs at 20 TPS. Client runs at 60 FPS (approx 3x).
        // Client moves 5px per frame.
        // Server should move 5px * 3 = 15px per tick to match speed.
        const tickSpeed = 15;

        if (this.input.up) nextY -= tickSpeed;
        if (this.input.down) nextY += tickSpeed;
        if (this.input.left) nextX -= tickSpeed;
        if (this.input.right) nextX += tickSpeed;

        // Collision Check (Server Side)
        const corners = [
            { x: nextX - 14, y: nextY - 14 },
            { x: nextX + 14, y: nextY - 14 },
            { x: nextX - 14, y: nextY + 14 },
            { x: nextX + 14, y: nextY + 14 }
        ];

        let canMove = true;
        if (getTileAt) {
            for (const c of corners) {
                if (getTileAt(c.x, c.y) === 1) {
                    canMove = false;
                    break;
                }
            }
        }

        if (canMove) {
            this.x = nextX;
            this.y = nextY;
        }
    }
}

module.exports = Player;
