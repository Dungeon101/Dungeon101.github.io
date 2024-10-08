class DungeonSetup {
    constructor(scene) {
        this.scene = scene;
    }

    preloadAssets() {
        this.scene.load.image('wall', 'assets/images/dungeon/wall.png');
        this.scene.load.image('floor', 'assets/images/dungeon/floor.png');
        this.scene.load.image('player', 'assets/images/characters/player.png');
        this.scene.load.image('stairs', 'assets/images/dungeon/stairs.png');
        this.scene.load.image('enemy', 'assets/images/enemies/enemy.png');
        this.scene.load.image('skeleton_boss', 'assets/images/enemies/skeleton_boss.png');
        this.scene.load.image('goblin_boss', 'assets/images/enemies/goblin_boss.png');
        this.scene.load.image('boss_icon', 'assets/images/enemies/boss.png');
    }

    createDungeonGraphics() {
        const map = this.scene.make.tilemap({
            tileWidth: this.scene.tileSize,
            tileHeight: this.scene.tileSize,
            width: this.scene.dungeonWidth,
            height: this.scene.dungeonHeight
        });

        const tiles = map.addTilesetImage('tiles', 'floor', this.scene.tileSize, this.scene.tileSize, 0, 0);
        const wallTiles = map.addTilesetImage('walls', 'wall', this.scene.tileSize, this.scene.tileSize, 0, 0);

        this.scene.floorLayer = map.createBlankLayer('floor', tiles);
        this.scene.wallsLayer = map.createBlankLayer('walls', wallTiles);

        for (let y = 0; y < this.scene.dungeonHeight; y++) {
            for (let x = 0; x < this.scene.dungeonWidth; x++) {
                if (this.scene.tiles[y][x] === 0) {
                    this.scene.floorLayer.putTileAt(0, x, y);
                } else {
                    this.scene.wallsLayer.putTileAt(0, x, y);
                }
            }
        }

        this.scene.wallsLayer.setCollisionByExclusion([-1]);
    }

    createPlayer() {
        let startRoom = this.scene.dungeonGenerator.rooms[0];
        let player = this.scene.physics.add.sprite(
            (startRoom.x + startRoom.width / 2) * this.scene.tileSize,
            (startRoom.y + startRoom.height / 2) * this.scene.tileSize,
            'player'
        ).setScale(this.scene.tileSize / 256);
        player.setCollideWorldBounds(true);
        return player;
    }

    createStairs() {
        if (this.scene.isBossFloor) {
            let bossRoom = this.scene.dungeonGenerator.rooms[this.scene.dungeonGenerator.rooms.length - 1];
            this.scene.boss = this.scene.physics.add.sprite(
                (bossRoom.x + bossRoom.width / 2) * this.scene.tileSize,
                (bossRoom.y + bossRoom.height / 2) * this.scene.tileSize,
                'boss_icon'
            ).setScale((this.scene.tileSize / 256) * 1.5);
            this.scene.boss.defeated = false;
            this.scene.physics.add.overlap(this.scene.player, this.scene.boss, this.scene.startBossFight, null, this.scene);
        } else {
            let endRoom = this.scene.dungeonGenerator.rooms[this.scene.dungeonGenerator.rooms.length - 1];
            this.scene.stairs = this.scene.physics.add.sprite(
                (endRoom.x + endRoom.width / 2) * this.scene.tileSize,
                (endRoom.y + endRoom.height / 2) * this.scene.tileSize,
                'stairs'
            ).setScale(this.scene.tileSize / 256);
        }
    }

    createEnemies() {
        let enemies = this.scene.physics.add.group();
        this.scene.dungeonGenerator.rooms.slice(1, -1).forEach(room => {
            if (Math.random() < 0.7) {  // 70% chance for a room to have an enemy
                let enemy = enemies.create(
                    (room.x + room.width / 2) * this.scene.tileSize,
                    (room.y + room.height / 2) * this.scene.tileSize,
                    'enemy'
                ).setScale(this.scene.tileSize / 256);
                enemy.setCollideWorldBounds(true);
                enemy.isBoss = false;
            }
        });
        return enemies;
    }
}
