export const TILE_SIZE = 64; // Tiny Swords default is often 64x64 (including padding) or can be treated as such
export const MAP_WIDTH = 50;
export const MAP_HEIGHT = 50;
export const MIN_ROOM_SIZE = 6;
export const MAX_ROOM_SIZE = 12;

export const TILES = {
    VOID: 0,
    FLOOR: 1,
    WALL: 2,
    DOOR: 3
};

export const COLORS = {
    VOID: '#0d0f1b',
    FLOOR: '#243e26', // Fallback color
    WALL: '#595652'
};
