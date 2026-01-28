
import { Level } from './level.js';
import { TILES, MAP_WIDTH, MAP_HEIGHT, MIN_ROOM_SIZE, MAX_ROOM_SIZE } from '../data/constants.js';
import { Entity } from '../entities/entity.js';
import { Enemy } from '../entities/enemy.js';
import { Boss } from '../entities/boss.js';

export const DungeonGenerator = {
    generate(levelNum) {
        const level = new Level(MAP_WIDTH, MAP_HEIGHT);

        for (let y = 0; y < MAP_HEIGHT; y++) {
            for (let x = 0; x < MAP_WIDTH; x++) {
                level.tiles[y][x] = TILES.VOID;
            }
        }

        const rooms = [];
        const numRooms = 10;

        for (let i = 0; i < numRooms; i++) {
            const w = this.randomRange(MIN_ROOM_SIZE, MAX_ROOM_SIZE);
            const h = this.randomRange(MIN_ROOM_SIZE, MAX_ROOM_SIZE);
            const x = this.randomRange(1, MAP_WIDTH - w - 1);
            const y = this.randomRange(1, MAP_HEIGHT - h - 1);

            const newRoom = { x, y, w, h };

            // Check for room overlap
            let failed = false;
            for (const other of rooms) {
                if (x < other.x + other.w && x + w > other.x &&
                    y < other.y + other.h && y + h > other.y) {
                    failed = true;
                    break;
                }
            }

            if (!failed) {
                rooms.push(newRoom);
            }
        }

        // Draw all rooms first
        for (const room of rooms) {
            this.createRoom(level, room);
        }

        // Then carve corridors (ensures connectivity)
        for (let i = 1; i < rooms.length; i++) {
            const prev = rooms[i - 1];
            const curr = rooms[i];
            this.createCorridor(level, prev, curr);
        }

        // Spawn enemies in rooms (skip first, boss in last)
        for (let i = 1; i < rooms.length; i++) {
            const r = rooms[i];
            const cx = Math.floor(r.x + r.w / 2);
            const cy = Math.floor(r.y + r.h / 2);

            if (i === rooms.length - 1) {
                level.entities.push(new Boss(cx, cy));
            } else {
                level.entities.push(new Enemy(cx, cy));
            }
        }

        // Set player spawn point (center of first room)
        const firstRoom = rooms[0];
        level.spawnX = Math.floor(firstRoom.x + firstRoom.w / 2);
        level.spawnY = Math.floor(firstRoom.y + firstRoom.h / 2);
        level.startPoint = { x: level.spawnX, y: level.spawnY };

        console.log(`[Gen] First Room: x=${firstRoom.x} y=${firstRoom.y} w=${firstRoom.w} h=${firstRoom.h}`);
        console.log(`[Gen] Spawn Point: ${level.spawnX}, ${level.spawnY}`);

        return level;
    },

    createRoom(level, room) {
        for (let y = room.y; y < room.y + room.h; y++) {
            for (let x = room.x; x < room.x + room.w; x++) {
                // Determine Wall or Floor
                if (x === room.x || x === room.x + room.w - 1 ||
                    y === room.y || y === room.y + room.h - 1) {
                    level.tiles[y][x] = TILES.WALL;
                } else {
                    level.tiles[y][x] = TILES.FLOOR;
                }
            }
        }
    },

    createCorridor(level, r1, r2) {
        const x1 = Math.floor(r1.x + r1.w / 2);
        const y1 = Math.floor(r1.y + r1.h / 2);
        const x2 = Math.floor(r2.x + r2.w / 2);
        const y2 = Math.floor(r2.y + r2.h / 2);

        // Random L-shaped corridor
        if (Math.random() < 0.5) {
            this.hCorridor(level, x1, x2, y1);
            this.vCorridor(level, y1, y2, x2);
        } else {
            this.vCorridor(level, y1, y2, x1);
            this.hCorridor(level, x1, x2, y2);
        }
    },

    hCorridor(level, x1, x2, y) {
        const start = Math.min(x1, x2);
        const end = Math.max(x1, x2);
        for (let x = start; x <= end; x++) {
            level.tiles[y][x] = TILES.FLOOR;
            level.tiles[y + 1][x] = TILES.FLOOR;
        }
    },

    vCorridor(level, y1, y2, x) {
        const start = Math.min(y1, y2);
        const end = Math.max(y1, y2);
        for (let y = start; y <= end; y++) {
            level.tiles[y][x] = TILES.FLOOR;
            level.tiles[y][x + 1] = TILES.FLOOR;
        }
    },

    randomRange(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
};
