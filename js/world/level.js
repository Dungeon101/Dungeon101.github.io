import { TILE_SIZE, TILES } from '../data/constants.js';

export class Level {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.tiles = Array(height).fill(null).map(() => Array(width).fill(TILES.VOID));
        this.entities = [];
        this.startPoint = { x: 0, y: 0 };
    }

    getTile(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return TILES.VOID;
        return this.tiles[y][x];
    }

    setTile(x, y, type) {
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
            this.tiles[y][x] = type;
        }
    }
}
