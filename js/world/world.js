import { DungeonGenerator } from './dungeonGenerator.js';
import { Tilemap } from './tilemap.js';
import { MAP_WIDTH, MAP_HEIGHT, TILE_SIZE } from '../data/constants.js';

export class World {
    constructor(width = MAP_WIDTH, height = MAP_HEIGHT) {
        this.width = width;
        this.height = height;
        this.level = null;
        this.camera = { x: 0, y: 0 };
    }

    generate() {
        console.log("Generating Dungeon...");
        this.level = DungeonGenerator.generate(this.width, this.height);
        // Center camera on start
        this.camera.x = this.level.startPoint.x * TILE_SIZE - (window.innerWidth / 2);
        this.camera.y = this.level.startPoint.y * TILE_SIZE - (window.innerHeight / 2);
        console.log("Dungeon Generated.", this.level.startPoint);
    }

    update(dt, player) {
        // Follow player if exists
        if (player) {
            const px = player.pixelX;
            const py = player.pixelY;

            // Simple Lerp to center
            const targetX = px - (window.innerWidth / 2) + (TILE_SIZE / 2);
            const targetY = py - (window.innerHeight / 2) + (TILE_SIZE / 2);

            this.camera.x += (targetX - this.camera.x) * 5 * dt;
            this.camera.y += (targetY - this.camera.y) * 5 * dt;
        }

        // Update Entities
        if (this.level) {
            for (const entity of this.level.entities) {
                entity.update(dt, this.level);
            }
        }
    }

    draw(ctx, assetLoader) {
        if (this.level) {
            Tilemap.render(ctx, this.level, assetLoader, this.camera);

            // Draw Entities
            for (const entity of this.level.entities) {
                if (entity.draw) {
                    entity.draw(ctx, assetLoader, this.camera);
                }
            }
        }
    }
}
