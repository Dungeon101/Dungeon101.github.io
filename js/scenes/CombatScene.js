class CombatScene extends Phaser.Scene {
    constructor() {
        super('CombatScene');
    }

    init(data) {
        this.combatants = gameState.party.map(char => ({
            ...char,
            health: char.currentHealth,
            isEnemy: false,
            sprite: null,
            healthBar: null,
            nameText: null
        }));
        this.currentTurn = 0;
        this.isBossFight = data.isBossFight || false;
        console.log('Party in CombatScene:', this.combatants);
    }

    preload() {
        // Load character and enemy sprites
        this.combatants.forEach(char => {
            this.load.image(char.name.toLowerCase(), `assets/images/characters/${char.name.toLowerCase()}.png`);
        });
        this.load.image('skeleton', 'assets/images/enemies/skeleton.png');
        this.load.image('goblin', 'assets/images/enemies/goblin.png');
        this.load.image('skeleton_boss', 'assets/images/enemies/skeleton_boss.png');
        this.load.image('goblin_boss', 'assets/images/enemies/goblin_boss.png');
        
        this.load.image('combat-bg', 'assets/images/dungeon/combat-background.png');
        
        this.load.image('attack-effect', 'assets/images/effects/attack-effect.png');
    }

    create() {
        // Add the background image
        this.add.image(400, 300, 'combat-bg').setOrigin(0.5);

        this.add.text(400, 30, 'Combat', { font: '32px Arial', fill: '#ffffff' }).setOrigin(0.5);

        // Set up party
        const partyPositions = [
            { x: 100, y: 200 },
            { x: 100, y: 300 },
            { x: 100, y: 400 },
            { x: 100, y: 500 }
        ];

        this.combatants.forEach((char, index) => {
            let pos = partyPositions[index];
            let charSprite = this.add.image(pos.x, pos.y, char.name.toLowerCase()).setScale(0.4);
            let healthBar = this.createHealthBar(pos.x + 100, pos.y, char.health, char.maxHealth);
            let nameText = this.add.text(pos.x + 100, pos.y - 30, char.name, 
                { font: '14px Arial', fill: '#ffffff' }).setOrigin(0.5);
            char.sprite = charSprite;
            char.healthBar = healthBar;
            char.nameText = nameText;
        });

        // Set up enemies
        this.enemies = this.generateEnemies();
        const enemyPositions = [
            { x: 700, y: 200 },
            { x: 700, y: 300 },
            { x: 700, y: 400 }
        ];

        this.enemies.forEach((enemy, index) => {
            let pos = enemyPositions[index];
            let enemySprite = this.add.image(pos.x, pos.y, enemy.type).setScale(0.4);
            if (enemy.type.includes('boss')) {
                enemySprite.setScale(0.6); // Make boss 1.5 times larger than regular enemies
            }
            let healthBar = this.createHealthBar(pos.x - 100, pos.y, enemy.health, enemy.maxHealth);
            let nameText = this.add.text(pos.x - 100, pos.y - 30, enemy.name, 
                { font: '14px Arial', fill: '#ffffff' }).setOrigin(0.5);
            this.combatants.push({ 
                ...enemy, 
                sprite: enemySprite, 
                healthBar: healthBar, 
                nameText: nameText, 
                isEnemy: true 
            });
        });

        this.updateCombatantInfo();

        // Start combat
        this.time.delayedCall(1000, () => this.nextTurn());

        // Move the "BOSS FIGHT!" text to the top of the screen
        if (this.isBossFight) {
            this.add.text(400, 70, 'BOSS FIGHT!', { font: '24px Arial', fill: '#ff0000' })
                .setOrigin(0.5)
                .setDepth(10);
        }
    }

    generateEnemies() {
        if (this.isBossFight) {
            return [this.generateBoss()];
        } else {
            let enemyCount = Phaser.Math.Between(1, 3);
            let enemies = [];
            for (let i = 0; i < enemyCount; i++) {
                let enemyType = Phaser.Math.RND.pick(['skeleton', 'goblin']);
                let health = enemyType === 'skeleton' ? 50 : 30;
                enemies.push({
                    name: enemyType.charAt(0).toUpperCase() + enemyType.slice(1),
                    type: enemyType,
                    health: health,
                    maxHealth: health,
                    attack: enemyType === 'skeleton' ? 10 : 15
                });
            }
            return enemies;
        }
    }

    generateBoss() {
        let bossType = Phaser.Math.RND.pick(['skeleton', 'goblin']);
        let health = bossType === 'skeleton' ? 200 : 150;
        return {
            name: bossType.charAt(0).toUpperCase() + bossType.slice(1) + ' Boss',
            type: bossType + '_boss',
            health: health,
            maxHealth: health,
            attack: bossType === 'skeleton' ? 20 : 25
        };
    }

    nextTurn() {
        if (this.checkCombatEnd()) return;

        let combatant = this.combatants[this.currentTurn];
        if (combatant.health <= 0) {
            this.currentTurn = (this.currentTurn + 1) % this.combatants.length;
            this.nextTurn();
            return;
        }

        if (combatant.isEnemy) {
            this.enemyAction(combatant);
        } else {
            this.playerAction(combatant);
        }
    }

    playerAction(character) {
        let targets = this.combatants.filter(c => c.isEnemy && c.health > 0);
        if (targets.length === 0) {
            this.endCombat(true);
            return;
        }

        let actionText = this.add.text(400, 100, `${character.name}'s turn. Click an enemy to attack.`, 
            { font: '18px Arial', fill: '#ffffff' }).setOrigin(0.5);

        // Highlight the active character's name
        if (character.nameText) {
            character.nameText.setStyle({ fill: '#00ff00' });
        }

        targets.forEach(target => {
            if (target.sprite) {
                target.sprite.removeAllListeners('pointerdown');
                target.sprite.setInteractive();
                target.sprite.on('pointerdown', () => {
                    actionText.destroy();
                    this.attack(character, target);
                    targets.forEach(t => {
                        if (t.sprite) t.sprite.disableInteractive();
                    });
                    if (character.nameText) {
                        character.nameText.setStyle({ fill: '#ffffff' });
                    }
                    this.time.delayedCall(1000, () => {
                        this.currentTurn = (this.currentTurn + 1) % this.combatants.length;
                        this.nextTurn();
                    });
                });
            }
        });
    }

    enemyAction(enemy) {
        let targets = this.combatants.filter(c => !c.isEnemy && c.health > 0);
        if (targets.length === 0) {
            this.endCombat(false);
            return;
        }

        // Highlight the active enemy's name
        enemy.nameText.setStyle({ fill: '#ff0000' });

        let target = Phaser.Math.RND.pick(targets);
        
        // Add a delay before the enemy attacks
        this.time.delayedCall(1000, () => {
            this.attack(enemy, target);
            enemy.nameText.setStyle({ fill: '#ffffff' });  // Remove highlight
            
            this.time.delayedCall(1000, () => {
                this.currentTurn = (this.currentTurn + 1) % this.combatants.length;
                this.nextTurn();
            });
        });
    }

    attack(attacker, target) {
        let damage = attacker.attack;
        target.health = Math.max(0, target.health - damage);

        // Update health bar
        this.updateHealthBar(target.healthBar, target.sprite.x, 300, 100, 10, target.health, target.maxHealth);

        // Create attack effect
        let effect = this.add.image(target.sprite.x, target.sprite.y, 'attack-effect');
        effect.setScale(0.5);
        effect.setAlpha(0.8);

        // Animate the effect
        this.tweens.add({
            targets: effect,
            alpha: 0,
            scale: 1,
            duration: 300,
            onComplete: () => effect.destroy()
        });

        // Show damage text
        this.add.text(target.sprite.x, target.sprite.y - 20, `-${damage}`, 
            { font: '16px Arial', fill: '#ff0000' })
            .setOrigin(0.5)
            .destroy({ delay: 1000 });

        if (target.health <= 0) {
            target.sprite.setAlpha(0.5);
            target.healthBar.clear();
        }

        this.updateCombatantInfo();
    }

    updateCombatantInfo() {
        if (this.combatantInfo) {
            this.combatantInfo.forEach(info => info.destroy());
        }
        this.combatantInfo = [];

        this.combatants.forEach((combatant, index) => {
            let x = combatant.isEnemy ? combatant.sprite.x - 100 : combatant.sprite.x + 100;
            let y = combatant.sprite.y + 30;
            let info = this.add.text(x, y, `HP: ${combatant.health}/${combatant.maxHealth}`, 
                { font: '12px Arial', fill: '#ffffff', align: 'center' }).setOrigin(0.5);
            this.combatantInfo.push(info);
        });
    }

    checkCombatEnd() {
        let aliveParty = this.combatants.filter(c => !c.isEnemy && c.health > 0);
        let aliveEnemies = this.combatants.filter(c => c.isEnemy && c.health > 0);

        if (aliveParty.length === 0) {
            this.endCombat(false);
            return true;
        } else if (aliveEnemies.length === 0) {
            this.endCombat(true);
            return true;
        }
        return false;
    }

    endCombat(victory) {
        let message = victory ? (this.isBossFight ? 'You defeated the boss!' : 'You won the battle!') : 'Game Over';
        this.add.text(400, 300, message, { font: '32px Arial', fill: '#ffffff' }).setOrigin(0.5);

        this.time.delayedCall(3000, () => {
            if (victory) {
                gameState.updatePartyHealth(this.combatants.filter(c => !c.isEnemy));

                if (this.isBossFight) {
                    let dungeonScene = this.scene.get('DungeonScene');
                    if (dungeonScene.boss) {
                        dungeonScene.boss.defeated = true;
                    }
                }
                this.scene.stop();
                this.scene.resume('DungeonScene');
            } else {
                gameState.resetGame();
                this.scene.stop('DungeonScene');
                this.scene.start('CharacterSelectScene');
            }
        });
    }

    createHealthBar(x, y, health, maxHealth) {
        let width = 100;
        let height = 10;
        let border = this.add.graphics();
        border.lineStyle(2, 0xffffff, 1);
        border.strokeRect(x - width/2, y - height/2, width, height);
        
        let healthBar = this.add.graphics();
        this.updateHealthBar(healthBar, x, y, width, height, health, maxHealth);
        
        return healthBar;
    }

    updateHealthBar(healthBar, x, y, width, height, health, maxHealth) {
        healthBar.clear();
        healthBar.fillStyle(0x00ff00, 1);
        healthBar.fillRect(x - width/2, y - height/2, width * (health / maxHealth), height);
    }
}