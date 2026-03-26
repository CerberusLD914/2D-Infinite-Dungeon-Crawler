
const { v4: uuidv4 } = require('uuid');

class Enemy {
    constructor(x, y) {
        this.id = uuidv4();
        this.x = x;
        this.y = y;
        this.speed = 3; // Slower than player (5)
        this.chaseRadius = 300; // Pixel distance to start chasing
        this.killRadius = 25;   // Pixel distance to kill
    }

    update(players, getTileAt) {
        // Simple AI: Find nearest player
        let nearest = null;
        let minDist = Infinity;

        for (const player of Object.values(players)) {
            const dist = Math.sqrt((player.x - this.x) ** 2 + (player.y - this.y) ** 2);
            if (dist < minDist) {
                minDist = dist;
                nearest = player;
            }
        }

        if (nearest && minDist < this.chaseRadius) {
            // Chase
            const dx = nearest.x - this.x;
            const dy = nearest.y - this.y;
            const angle = Math.atan2(dy, dx);

            // Propose new position
            let nextX = this.x + Math.cos(angle) * this.speed;
            let nextY = this.y + Math.sin(angle) * this.speed;

            // Check Collision
            // We verify the center point for simplicity
            if (!getTileAt || getTileAt(nextX, nextY) !== 1) {
                this.x = nextX;
                this.y = nextY;
            } else {
                // Try sliding (move only X or only Y)
                let nextX2 = this.x + Math.cos(angle) * this.speed;
                if (!getTileAt || getTileAt(nextX2, this.y) !== 1) {
                    this.x = nextX2;
                } else {
                    let nextY2 = this.y + Math.sin(angle) * this.speed;
                    if (!getTileAt || getTileAt(this.x, nextY2) !== 1) {
                        this.y = nextY2;
                    }
                }
            }

            return {
                chasing: true,
                touching: minDist < this.killRadius,
                targetId: nearest.id
            };
        }

        return { chasing: false, touching: false };
    }
}

module.exports = Enemy;
