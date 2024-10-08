class CombatSetup {
    constructor(scene) {
        this.scene = scene;
    }

    initializeCombatants() {
        return gameState.party.map(char => ({
            ...char,
            health: char.currentHealth,
            isEnemy: false,
            sprite: null,
            healthBar: null,
            nameText: null,
            defense: 5 // Add a default defense value
        }));
    }

    preloadAssets() {
        this.scene.combatants.forEach(char => {
            this.scene.load.image(char.name.toLowerCase(), `assets/images/characters/${char.name.toLowerCase()}.png`);
        });
        this.scene.load.image('skeleton', 'assets/images/enemies/skeleton.png');
        this.scene.load.image('goblin', 'assets/images/enemies/goblin.png');
        this.scene.load.image('skeleton_boss', 'assets/images/enemies/skeleton_boss.png');
        this.scene.load.image('goblin_boss', 'assets/images/enemies/goblin_boss.png');        
        this.scene.load.image('combat-bg', 'assets/images/dungeon/combat-background.png');        
        this.scene.load.image('attack-effect', 'assets/images/effects/attack-effect.png');
    }

    createBackground() {
        this.scene.add.image(400, 300, 'combat-bg').setOrigin(0.5);
        this.scene.add.text(400, 30, 'Combat', { font: '32px Arial', fill: '#ffffff' }).setOrigin(0.5);
        if (this.scene.isBossFight) {
            this.scene.add.text(400, 70, 'BOSS FIGHT!', { font: '24px Arial', fill: '#ff0000' })
                .setOrigin(0.5)
                .setDepth(10);
        }
    }

    setupParty() {
        const partyPositions = [
            { x: 50, y: 300 },
            { x: 120, y: 300 },
            { x: 190, y: 300 },
            { x: 260, y: 300 }
        ];

        this.scene.combatants.forEach((char, index) => {
            let pos = partyPositions[index];
            char.sprite = this.scene.add.image(pos.x, pos.y, char.name.toLowerCase()).setScale(0.4);
            char.healthBar = new HealthBar(this.scene, pos.x, pos.y + 50, 100, 10);
            char.healthBar.setHealth(char.health, char.maxHealth);
            char.nameText = this.scene.add.text(pos.x, pos.y - 50, char.name, 
                { font: '14px Arial', fill: '#ffffff' }).setOrigin(0.5);
            char.hpText = this.scene.add.text(pos.x, pos.y + 70, `HP: ${char.health}/${char.maxHealth}`, 
                { font: '12px Arial', fill: '#ffffff' }).setOrigin(0.5);
        });
    }

    setupEnemies(enemies) {
        const enemyPositions = [
            { x: 540, y: 300 },
            { x: 610, y: 300 },
            { x: 680, y: 300 },
            { x: 750, y: 300 }
        ];
        const bossPosition = { x: 600, y: 300 };

        enemies.forEach((enemy, index) => {
            let pos = enemy.isBoss ? bossPosition : enemyPositions[index];
            let enemySprite = this.scene.add.image(pos.x, pos.y, enemy.type).setScale(enemy.isBoss ? 0.6 : 0.4);
            let nameTextY = enemy.isBoss ? pos.y - 150 : pos.y - 50;
            let healthBarY = enemy.isBoss ? pos.y + 170 : pos.y + 50;
            let hpTextY = enemy.isBoss ? pos.y + 190 : pos.y + 70;
            
            let healthBar = new HealthBar(this.scene, pos.x, healthBarY, 100, 10);
            healthBar.setHealth(enemy.health, enemy.maxHealth);
            let nameText = this.scene.add.text(pos.x, nameTextY, enemy.name, 
                { font: '14px Arial', fill: '#ffffff' }).setOrigin(0.5);
            let hpText = this.scene.add.text(pos.x, hpTextY, `HP: ${enemy.health}/${enemy.maxHealth}`, 
                { font: '12px Arial', fill: '#ffffff' }).setOrigin(0.5);

            this.scene.combatants.push({ 
                ...enemy, 
                sprite: enemySprite, 
                healthBar: healthBar, 
                nameText: nameText,
                hpText: hpText,
                isEnemy: true 
            });
        });
    }
}