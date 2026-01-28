import { TILE_SIZE } from '../data/constants.js';

export class Entity {
    constructor(x, y, spriteKey) {
        // Grid Position
        this.gridX = x;
        this.gridY = y;

        // Visual Position (pixels)
        this.pixelX = x * TILE_SIZE;
        this.pixelY = y * TILE_SIZE;

        this.spriteKey = spriteKey;

        // Animation
        this.frame = 0;
        this.timer = 0;
        this.state = 'idle'; // idle, run, attack
        this.flipX = false;

        this.isMoving = false;
    }

    update(dt) {
        const targetX = this.gridX * TILE_SIZE;
        const targetY = this.gridY * TILE_SIZE;

        // Simple movement interpolation
        const speed = 300 * dt; // Pixels per second

        if (this.pixelX < targetX) this.pixelX = Math.min(this.pixelX + speed, targetX);
        if (this.pixelX > targetX) this.pixelX = Math.max(this.pixelX - speed, targetX);
        if (this.pixelY < targetY) this.pixelY = Math.min(this.pixelY + speed, targetY);
        if (this.pixelY > targetY) this.pixelY = Math.max(this.pixelY - speed, targetY);

        this.isMoving = (this.pixelX !== targetX || this.pixelY !== targetY);

        // Update Animation State
        if (this.isMoving) this.state = 'run';
        else this.state = 'idle';

        // Animate
        this.timer += dt;
        if (this.timer > 0.1) { // 100ms per frame
            this.frame++;
            this.timer = 0;
        }
    }

    draw(ctx, assetLoader, camera) {
        // Resolve Sprite
        // Key format: "warrior" -> "warrior_idle" or "warrior_run"
        const fullKey = `${this.spriteKey}_${this.state}`;
        const img = assetLoader.getImage(fullKey);

        if (!img) {
            // Fallback rendering
            ctx.fillStyle = 'red';
            ctx.fillRect(
                this.pixelX - camera.x,
                this.pixelY - camera.y,
                TILE_SIZE, TILE_SIZE
            );
            return;
        }

        // Calculate Frame
        const frameWidth = 192; // Tiny Swords default frame size usually 192x192?? or 64x64?
        // Let's assume 192 (3x3 tiles) is common in this pack for "Factions", but Units are often 64x64 or 192x192 canvas.
        // Actually Tiny Swords units are usually centered in 192x192 canvas (padding).
        // I will attempt 192. If it looks small/large/cropped, I'll adjust.
        // But drawing it into TILE_SIZE (64x64) dest. Keep aspect ratio.

        const SPRITE_SIZE = 192;
        const numFrames = Math.floor(img.width / SPRITE_SIZE);
        const currentFrame = this.frame % numFrames;

        const screenX = this.pixelX - camera.x - (SPRITE_SIZE - TILE_SIZE) / 2; // Center it
        const screenY = this.pixelY - camera.y - (SPRITE_SIZE - TILE_SIZE) / 2 - 20; // Shift up a bit for visual depth

        ctx.save();
        if (this.flipX) {
            ctx.translate(screenX + SPRITE_SIZE, screenY);
            ctx.scale(-1, 1);
            ctx.drawImage(
                img,
                currentFrame * SPRITE_SIZE, 0,
                SPRITE_SIZE, SPRITE_SIZE,
                0, 0,
                SPRITE_SIZE, SPRITE_SIZE
            );
        } else {
            ctx.drawImage(
                img,
                currentFrame * SPRITE_SIZE, 0,
                SPRITE_SIZE, SPRITE_SIZE,
                screenX, screenY,
                SPRITE_SIZE, SPRITE_SIZE
            );
        }
        ctx.restore();
    }
}
