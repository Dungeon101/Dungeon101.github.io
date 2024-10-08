class DungeonScene extends Phaser.Scene {
    constructor() {
        super('DungeonScene');
        this.tileSize = 32;
        this.dungeonWidth = 25;
        this.dungeonHeight = 20;
    }

    init(data) {
        this.dungeonGenerator = new DungeonLayoutGenerator(this.dungeonWidth, this.dungeonHeight);
        this.dungeonSetup = new DungeonSetup(this);
        this.playerController = new PlayerController(this);
        this.dungeonUI = new DungeonUI(this);

        gameState.currentFloor = data.newFloor || gameState.currentFloor;
        this.isBossFloor = gameState.isBossFloor();

        if (!gameState.party) {
            gameState.initializeParty([
                { name: 'Warrior', health: 100, attack: 20 },
                { name: 'Mage', health: 70, attack: 30 },
                { name: 'Rogue', health: 80, attack: 25 },
                { name: 'Healer', health: 90, attack: 15 }
            ]);
        }

        this.generateNewFloor();
    }

    generateNewFloor() {
        this.tiles = this.dungeonGenerator.generate();
    }

    preload() {
        this.dungeonSetup.preloadAssets();
    }

    create() {
        this.dungeonSetup.createDungeonGraphics();
        this.player = this.dungeonSetup.createPlayer();
        this.dungeonSetup.createStairs();
        this.enemies = this.dungeonSetup.createEnemies();

        this.physics.add.collider(this.player, this.wallsLayer);
        this.physics.add.overlap(this.player, this.enemies, this.startCombat, null, this);
        this.physics.add.overlap(this.player, this.stairs, this.goToNextFloor, null, this);

        this.cameras.main.setBounds(0, 0, this.dungeonWidth * this.tileSize, this.dungeonHeight * this.tileSize);
        this.cameras.main.startFollow(this.player);

        this.cursors = this.input.keyboard.createCursorKeys();

        this.dungeonUI.createFloorText();
        this.dungeonUI.createBossFloorText();

        this.events.on('wake', this.onWake, this);
        this.events.on('resume', this.onSceneResume, this);

        this.input.keyboard.on('keydown-D', () => this.dungeonUI.showDebugPrompt.call(this.dungeonUI), this);
    }

    update() {
        this.playerController.handlePlayerMovement();
    }

    startCombat(player, enemy) {
        enemy.destroy();
        this.scene.launch('CombatScene', { isBossFight: enemy.isBoss });
        this.scene.pause();
    }

    startBossFight() {
        this.scene.launch('CombatScene', { 
            isBossFight: true
        });
        this.scene.pause();
    }

    goToNextFloor() {
        gameState.currentFloor++;
        this.scene.restart({ newFloor: gameState.currentFloor });
    }

    onWake(sys, data) {
        if (data && data.reset) {
            this.scene.restart({ newFloor: 1, party: null });
        }
    }

    onSceneResume(sys, data) {
        if (data && data.combatVictory) {
            if (data.bossDefeated) {
                // Don't increment the floor here, as it's already been incremented in CombatScene
                this.scene.restart({ newFloor: gameState.currentFloor });
            } else {
                // Handle regular enemy defeat
                // The enemy sprite is already destroyed in startCombat
            }
        }
    }
}