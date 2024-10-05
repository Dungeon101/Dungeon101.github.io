class DungeonGenerator {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.tiles = [];
        this.rooms = [];
    }

    generate() {
        // Initialize with walls
        for (let y = 0; y < this.height; y++) {
            this.tiles[y] = [];
            for (let x = 0; x < this.width; x++) {
                this.tiles[y][x] = 1; // 1 represents a wall
            }
        }

        // Create rooms
        for (let i = 0; i < 10; i++) { // Try to place 10 rooms
            let room = this.createRoom();
            if (room) {
                this.carveRoom(room);
                this.rooms.push(room);
            }
        }

        // Connect rooms
        for (let i = 0; i < this.rooms.length - 1; i++) {
            this.connectRooms(this.rooms[i], this.rooms[i + 1]);
        }

        return this.tiles;
    }

    createRoom() {
        let width = Math.floor(Math.random() * 3) + 3; // 3-5
        let height = Math.floor(Math.random() * 3) + 3; // 3-5
        let x = Math.floor(Math.random() * (this.width - width - 2)) + 1;
        let y = Math.floor(Math.random() * (this.height - height - 2)) + 1;

        // Check if the room overlaps with any existing room
        for (let room of this.rooms) {
            if (x < room.x + room.width + 1 &&
                x + width + 1 > room.x &&
                y < room.y + room.height + 1 &&
                y + height + 1 > room.y) {
                return null; // Room overlaps, so cancel it
            }
        }

        return { x, y, width, height };
    }

    carveRoom(room) {
        for (let y = room.y; y < room.y + room.height; y++) {
            for (let x = room.x; x < room.x + room.width; x++) {
                this.tiles[y][x] = 0; // 0 represents a floor
            }
        }
    }

    connectRooms(roomA, roomB) {
        let pointA = {
            x: Math.floor(roomA.x + roomA.width / 2),
            y: Math.floor(roomA.y + roomA.height / 2)
        };
        let pointB = {
            x: Math.floor(roomB.x + roomB.width / 2),
            y: Math.floor(roomB.y + roomB.height / 2)
        };

        while (pointA.x !== pointB.x || pointA.y !== pointB.y) {
            if (Math.random() < 0.5) {
                pointA.x += pointA.x < pointB.x ? 1 : -1;
            } else {
                pointA.y += pointA.y < pointB.y ? 1 : -1;
            }
            this.tiles[pointA.y][pointA.x] = 0;
        }
    }
}
