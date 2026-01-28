import { TILE_SIZE, TILES, COLORS } from '../data/constants.js';

export const Tilemap = {
    // Mapping tile types to sprite coordinates (x, y) in the tilesheet
    // Adjust these based on visual inspection of Tiny Swords
    mappings: {
        [TILES.FLOOR]: { x: 1, y: 1 }, // Default Center
        [TILES.WALL]: { x: 1, y: 0 },
        [TILES.VOID]: null
    },

    render(ctx, level, assetLoader, camera) {
        const sheet = assetLoader.getImage('tileset');
        // Render Water Background (Void)
        const water = assetLoader.getImage('water_bg');
        if (water) {
            // Create pattern or simple large fill? 
            // Tiling the small water png across the screen OR drawing it for every VOID tile.
            // Efficient way: Pattern fillRect over the whole canvas first (assuming VOID is transparency/bg)
            if (!this.waterPattern) {
                this.waterPattern = ctx.createPattern(water, 'repeat');
            }
            ctx.fillStyle = this.waterPattern;

            // We need to account for camera offset in pattern??
            // ctx.createPattern doesn't easily offset. 
            // Simpler: Draw water on every VOID tile within view.
        }

        const startCol = Math.floor(camera.x / TILE_SIZE);
        const endCol = startCol + (ctx.canvas.width / TILE_SIZE) + 1;
        const startRow = Math.floor(camera.y / TILE_SIZE);
        const endRow = startRow + (ctx.canvas.height / TILE_SIZE) + 1;

        for (let y = startRow; y <= endRow; y++) {
            for (let x = startCol; x <= endCol; x++) {
                const screenX = (x - startCol) * TILE_SIZE - (camera.x % TILE_SIZE);
                const screenY = (y - startRow) * TILE_SIZE - (camera.y % TILE_SIZE);

                // Always draw water background first? Or only if VOID?
                // User said "black part uses water". Black part IS void.
                // So if we just fill the screen with water pattern first, then draw tiles on top.
                // But let's do PER TILE for consistency if we wanted specific sorting, 
                // but global fill is faster.
            }
        }

        // 1. Fill Background with Water (Shifted by camera)
        if (this.waterPattern) {
            ctx.save();
            ctx.translate(-camera.x, -camera.y);
            ctx.fillStyle = this.waterPattern;
            // Fill area covering the visible camera rect
            ctx.fillRect(camera.x, camera.y, ctx.canvas.width, ctx.canvas.height);
            ctx.restore();
        }

        // 2. Draw Floor and Walls
        for (let y = startRow; y <= endRow; y++) {
            for (let x = startCol; x <= endCol; x++) {
                const tile = level.getTile(x, y);
                const screenX = (x - startCol) * TILE_SIZE - (camera.x % TILE_SIZE);
                const screenY = (y - startRow) * TILE_SIZE - (camera.y % TILE_SIZE);

                if (tile === TILES.FLOOR) {
                    this.drawAutotile(ctx, sheet, level, x, y, screenX, screenY);
                } else if (tile === TILES.WALL) {
                    this.drawRock(ctx, assetLoader, x, y, screenX, screenY);
                }
            }
        }
    },

    drawRock(ctx, assetLoader, gridX, gridY, x, y) {
        // Deterministic random
        const hash = Math.abs(Math.sin(gridX * 12.9898 + gridY * 78.233)) * 43758.5453;
        const index = Math.floor((hash % 1) * 4) + 1; // 1 to 4

        const rock = assetLoader.getImage(`rock${index}`);
        if (rock && rock.complete && rock.naturalWidth !== 0) {
            // Draw Rock centered or fitting? Rock images might be small.
            // Tiny Swords rocks are usually decorations.
            // Let's draw centered.
            const rW = rock.width; // Usually small?
            // Scaling? Keep 1:1 or scale to tile?
            // Let's assume they fit in 64x64 or render slightly smaller.
            // Draw water background under rock too? Yes, usually rocks sit on water/ground.
            // If we filled screen with water, it's fine.

            const cx = x + (TILE_SIZE - rock.width) / 2;
            const cy = y + (TILE_SIZE - rock.height) / 2;
            ctx.drawImage(rock, Math.floor(cx), Math.floor(cy));
        } else {
            // Fallback
            ctx.fillStyle = '#595652'; // Wall color
            ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        }
    },

    drawAutotile(ctx, sheet, level, x, y, sx, sy) {
        // Check Neighbors (Tree-based logic derived from 3x3 grid)
        // 0,0  1,0  2,0
        // 0,1  1,1  2,1
        // 0,2  1,2  2,2

        const isFloor = (dx, dy) => level.getTile(x + dx, y + dy) === TILES.FLOOR;

        const n = isFloor(0, -1);
        const s = isFloor(0, 1);
        const w = isFloor(-1, 0);
        const e = isFloor(1, 0);

        let tx = 1;
        let ty = 1;

        if (!w) tx = 0;
        else if (!e) tx = 2;

        if (!n) ty = 0;
        else if (!s) ty = 2;

        if (sheet && sheet.complete && sheet.naturalWidth !== 0) {
            // Draw from sheet
            ctx.drawImage(
                sheet,
                tx * TILE_SIZE, ty * TILE_SIZE,
                TILE_SIZE, TILE_SIZE,
                Math.floor(sx), Math.floor(sy),
                TILE_SIZE, TILE_SIZE
            );
        } else {
            // Fallback
            ctx.fillStyle = '#243e26'; // Floor Color
            ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
        }
    },

    drawTile(ctx, sheet, tileType, x, y) {
        const coords = this.mappings[tileType];
        if (coords && sheet.complete) {
            // Draw Image
            ctx.drawImage(
                sheet,
                coords.x * TILE_SIZE, coords.y * TILE_SIZE, // Source X, Y
                TILE_SIZE, TILE_SIZE,                       // Source W, H
                Math.floor(x), Math.floor(y),               // Dest X, Y
                TILE_SIZE, TILE_SIZE                        // Dest W, H
            );
        } else {
            // Fallback
            ctx.fillStyle = tileType === TILES.FLOOR ? COLORS.FLOOR : COLORS.WALL;
            ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        }
    }
};
