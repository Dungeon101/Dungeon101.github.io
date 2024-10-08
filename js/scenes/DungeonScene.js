class DungeonScene extends Phaser.Scene {
    constructor() {
        super('DungeonScene');
        this.tileSize = 32;  // This is the size we want each tile to appear in the game
        this.dungeonWidth = 25;
        this.dungeonHeight = 20;
        this.currentFloor = 1;
        this.player = null;  // Initialize player as null
        this.party = null;  // Initialize party as null
    }

    init(data) {
        this.DungeonGenerator = this.registry.get('DungeonGenerator');
        gameState.currentFloor = data.newFloor || gameState.currentFloor;
        
        if (!gameState.party) {
            gameState.initializeParty([
                { name: 'Warrior', health: 100, attack: 20 },
                { name: 'Mage', health: 70, attack: 30 },
                { name: 'Rogue', health: 80, attack: 25 },
                { name: 'Healer', health: 90, attack: 15 }
            ]);
        }
        
        this.isBossFloor = gameState.currentFloor % 5 === 0;
        this.player = null;  // Reset player to null on init
        this.generateNewFloor();
    }

    generateNewFloor() {
        this.dungeon = new this.DungeonGenerator(this.dungeonWidth, this.dungeonHeight);
        this.tiles = this.dungeon.generate();
    }

    preload() {
        this.load.image('wall', 'assets/images/dungeon/wall.png');
        this.load.image('floor', 'assets/images/dungeon/floor.png');
        this.load.image('player', 'assets/images/characters/player.png');
        this.load.image('stairs', 'assets/images/dungeon/stairs.png');
        this.load.image('enemy', 'assets/images/enemies/enemy.png');
        // Add these lines for boss images
        this.load.image('skeleton_boss', 'assets/images/enemies/skeleton_boss.png');
        this.load.image('goblin_boss', 'assets/images/enemies/goblin_boss.png');
        this.load.image('boss_icon', 'assets/images/enemies/boss.png');
    }

    create() {
        this.createDungeonGraphics();
        this.createPlayer();  // Always create a new player
        this.createStairs();
        this.createEnemies();

        this.physics.add.collider(this.player, this.wallsLayer);
        this.physics.add.overlap(this.player, this.enemies, this.startCombat, null, this);
        this.physics.add.overlap(this.player, this.stairs, this.goToNextFloor, null, this);

        this.cameras.main.setBounds(0, 0, this.dungeonWidth * this.tileSize, this.dungeonHeight * this.tileSize);
        this.cameras.main.startFollow(this.player);

        this.cursors = this.input.keyboard.createCursorKeys();

        this.floorText = this.add.text(16, 16, `Floor: ${gameState.currentFloor}`, { font: '18px Arial', fill: '#ffffff' })
            .setScrollFactor(0)
            .setDepth(10);

        if (this.isBossFloor) {
            this.add.text(16, 50, 'BOSS FLOOR!', { font: '24px Arial', fill: '#ff0000' })
                .setScrollFactor(0)
                .setDepth(10);
        }

        // Add debug command to change floor
        this.input.keyboard.on('keydown-D', () => {
            const newFloor = prompt('Enter floor number:');
            if (newFloor && !isNaN(newFloor)) {
                this.currentFloor = parseInt(newFloor);
                this.scene.restart({ newFloor: this.currentFloor, party: this.party });
            }
        });

        // Add this event listener
        this.events.on('wake', this.onWake, this);
        this.events.on('resume', (sys, data) => this.onSceneResume(sys, data));
    }

    createDungeonGraphics() {
        const map = this.make.tilemap({
            tileWidth: this.tileSize,
            tileHeight: this.tileSize,
            width: this.dungeonWidth,
            height: this.dungeonHeight
        });

        // Note: we're not changing the actual image size, just how it's displayed
        const tiles = map.addTilesetImage('tiles', 'floor', this.tileSize, this.tileSize, 0, 0);
        const wallTiles = map.addTilesetImage('walls', 'wall', this.tileSize, this.tileSize, 0, 0);

        this.floorLayer = map.createBlankLayer('floor', tiles);
        this.wallsLayer = map.createBlankLayer('walls', wallTiles);

        for (let y = 0; y < this.dungeonHeight; y++) {
            for (let x = 0; x < this.dungeonWidth; x++) {
                if (this.tiles[y][x] === 0) {
                    this.floorLayer.putTileAt(0, x, y);
                } else {
                    this.wallsLayer.putTileAt(0, x, y);
                }
            }
        }

        this.wallsLayer.setCollisionByExclusion([-1]);
    }

    createPlayer() {
        let startRoom = this.dungeon.rooms[0];
        this.player = this.physics.add.sprite(
            (startRoom.x + startRoom.width / 2) * this.tileSize,
            (startRoom.y + startRoom.height / 2) * this.tileSize,
            'player'
        ).setScale(this.tileSize / 256);
        this.player.setCollideWorldBounds(true);
    }

    createStairs() {
        if (gameState.isBossFloor()) {
            let bossRoom = this.dungeon.rooms[this.dungeon.rooms.length - 1];
            this.boss = this.physics.add.sprite(
                (bossRoom.x + bossRoom.width / 2) * this.tileSize,
                (bossRoom.y + bossRoom.height / 2) * this.tileSize,
                'boss_icon'
            ).setScale((this.tileSize / 256) * 1.5);
            this.boss.defeated = false;
            this.physics.add.overlap(this.player, this.boss, this.startBossFight, null, this);
        } else {
            let endRoom = this.dungeon.rooms[this.dungeon.rooms.length - 1];
            this.stairs = this.physics.add.sprite(
                (endRoom.x + endRoom.width / 2) * this.tileSize,
                (endRoom.y + endRoom.height / 2) * this.tileSize,
                'stairs'
            ).setScale(this.tileSize / 256);
        }
    }

    createEnemies() {
        this.enemies = this.physics.add.group();
        this.dungeon.rooms.slice(1, -1).forEach(room => {
            if (Math.random() < 0.7) {  // 70% chance for a room to have an enemy
                let enemy = this.enemies.create(
                    (room.x + room.width / 2) * this.tileSize,
                    (room.y + room.height / 2) * this.tileSize,
                    'enemy'
                ).setScale(this.tileSize / 256);  // Scale down from 256x256 to tileSize x tileSize
                enemy.setCollideWorldBounds(true);
                enemy.isBoss = false;  // Add this line to explicitly mark as not a boss
            }
        });
    }

    update() {
        if (!this.player) return;  // Safety check

        const speed = 100;
        this.player.setVelocity(0);

        if (this.cursors.left.isDown) {
            this.player.setVelocityX(-speed);
        } else if (this.cursors.right.isDown) {
            this.player.setVelocityX(speed);
        }

        if (this.cursors.up.isDown) {
            this.player.setVelocityY(-speed);
        } else if (this.cursors.down.isDown) {
            this.player.setVelocityY(speed);
        }

        this.player.body.velocity.normalize().scale(speed);
    }

    onWake(sys, data) {
        if (data && data.reset) {
            this.scene.restart({ newFloor: 1, party: null });
        }
    }

    onSceneResume(sys, data) {
        if (data && data.combatVictory) {
            if (data.bossDefeated) {
                this.goToNextFloor(true);  // Pass true to indicate boss defeat
            } else {
                // Handle regular enemy defeat
                // You might want to remove the defeated enemy sprite here
            }
        }
    }

    startCombat(player, enemy) {
        enemy.destroy();  // Remove the enemy from the map
        this.scene.launch('CombatScene', { isBossFight: enemy.isBoss });  // Pass isBossFight based on the enemy type
        this.scene.pause();
    }

    startBossFight() {
        this.scene.launch('CombatScene', { 
            party: this.party, 
            currentFloor: this.currentFloor,
            isBossFight: true
        });
        this.scene.pause();
    }

    resume(data) {
        if (gameState.party.every(member => member.currentHealth <= 0)) {
            gameState.resetGame();
            this.scene.start('CharacterSelectScene');
        } else if (this.isBossFloor && this.boss && this.boss.defeated) {
            this.goToNextFloor();
        }
    }    

    goToNextFloor(afterBossFight = false) {
        if (!afterBossFight) {
            gameState.currentFloor++;  // Only increment if it's not after a boss fight
        }
        this.scene.restart({ newFloor: gameState.currentFloor });
    }
}