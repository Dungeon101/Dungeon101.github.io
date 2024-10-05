class CombatScene extends Phaser.Scene {
    constructor() {
        super('CombatScene');
    }

    init(data) {
        this.party = data.party;
        this.currentFloor = data.currentFloor;
        this.combatants = []; // Reset combatants array
        this.currentTurn = 0; // Reset turn counter
        this.isBossFight = data.isBossFight || false;
        console.log('Party in CombatScene:', this.party);
    }

    preload() {
        // Load character and enemy sprites
        this.party.forEach(char => {
            this.load.image(char.name.toLowerCase(), `assets/images/characters/${char.name.toLowerCase()}.png`);
        });
        this.load.image('skeleton', 'assets/images/enemies/skeleton.png');
        this.load.image('goblin', 'assets/images/enemies/goblin.png');
        // Add these lines for boss images
        this.load.image('skeleton_boss', 'assets/images/enemies/skeleton_boss.png');
        this.load.image('goblin_boss', 'assets/images/enemies/goblin_boss.png');
        
        // Update this line to use the correct path
        this.load.image('combat-bg', 'assets/images/dungeon/combat-background.png');
    }

    create() {
        // Add the background image
        this.add.image(400, 300, 'combat-bg').setOrigin(0.5);

        this.add.text(400, 50, 'Combat', { font: '32px Arial', fill: '#ffffff' }).setOrigin(0.5);

        // Set up party
        this.party.forEach((char, index) => {
            let charSprite = this.add.image(100 + index * 100, 300, char.name.toLowerCase()).setScale(0.5);
            this.combatants.push({ ...char, sprite: charSprite, isEnemy: false });
        });

        // Set up enemies
        let enemies = this.generateEnemies();
        console.log('Enemies in create:', enemies);
        enemies.forEach((enemy, index) => {
            let x = 700 - index * 100;
            console.log(`Placing enemy ${enemy.name} at x: ${x}`);
            let enemySprite = this.add.image(x, 300, enemy.type).setScale(0.5);
            this.combatants.push({ ...enemy, sprite: enemySprite, isEnemy: true });
        });

        this.updateCombatantInfo();

        // Start combat
        this.time.delayedCall(1000, () => this.nextTurn());

        // Move the "BOSS FIGHT!" text to the bottom of the screen
        if (this.isBossFight) {
            this.add.text(400, 550, 'BOSS FIGHT!', { font: '32px Arial', fill: '#ff0000' })
                .setOrigin(0.5)
                .setDepth(10); // Ensure it's on top of other elements
        }
    }

    generateEnemies() {
        if (this.isBossFight) {
            return [this.generateBoss()];
        } else {
            let enemyCount = Phaser.Math.Between(1, 3);
            console.log(`Generating ${enemyCount} enemies`);
            let enemies = [];
            for (let i = 0; i < enemyCount; i++) {
                let enemyType = Phaser.Math.RND.pick(['skeleton', 'goblin']);
                enemies.push({
                    name: enemyType.charAt(0).toUpperCase() + enemyType.slice(1),
                    type: enemyType,
                    health: enemyType === 'skeleton' ? 50 : 30,
                    attack: enemyType === 'skeleton' ? 10 : 15
                });
            }
            console.log('Generated enemies:', enemies);
            return enemies;
        }
    }

    generateBoss() {
        let bossType = Phaser.Math.RND.pick(['skeleton', 'goblin']);
        return {
            name: bossType.charAt(0).toUpperCase() + bossType.slice(1) + ' Boss',
            type: bossType + '_boss',
            health: bossType === 'skeleton' ? 500 : 300,
            attack: bossType === 'skeleton' ? 100 : 150
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

        targets.forEach(target => {
            target.sprite.removeAllListeners('pointerdown');
            target.sprite.setInteractive();
            target.sprite.on('pointerdown', () => {
                actionText.destroy();
                this.attack(character, target);
                targets.forEach(t => t.sprite.disableInteractive());
                this.time.delayedCall(1000, () => {
                    this.currentTurn = (this.currentTurn + 1) % this.combatants.length;
                    this.nextTurn();
                });
            });
        });
    }

    enemyAction(enemy) {
        let targets = this.combatants.filter(c => !c.isEnemy && c.health > 0);
        if (targets.length === 0) {
            this.endCombat(false);
            return;
        }

        let target = Phaser.Math.RND.pick(targets);
        this.attack(enemy, target);
        
        this.time.delayedCall(1000, () => {
            this.currentTurn = (this.currentTurn + 1) % this.combatants.length;
            this.nextTurn();
        });
    }

    attack(attacker, target) {
        let damage = attacker.attack;
        target.health -= damage;
        this.add.text(target.sprite.x, target.sprite.y - 20, `-${damage}`, 
            { font: '16px Arial', fill: '#ff0000' })
            .setOrigin(0.5)
            .destroy({ delay: 1000 });

        if (target.health <= 0) {
            target.sprite.setTint(0xff0000);
        }

        this.updateCombatantInfo();
    }

    updateCombatantInfo() {
        if (this.combatantInfo) {
            this.combatantInfo.forEach(info => info.destroy());
        }
        this.combatantInfo = [];

        this.combatants.forEach((combatant, index) => {
            let x = combatant.isEnemy ? 700 - (index - this.party.length) * 100 : 100 + index * 100;
            let info = this.add.text(x, 400, `${combatant.name}\nHP: ${combatant.health}`, 
                { font: '14px Arial', fill: '#ffffff', align: 'center' }).setOrigin(0.5);
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
                if (this.isBossFight) {
                    let dungeonScene = this.scene.get('DungeonScene');
                    if (dungeonScene.boss) {
                        dungeonScene.boss.defeated = true;
                    }
                }
                this.resetCombatState();
                this.scene.stop();
                this.scene.resume('DungeonScene', { party: this.party });
            } else {
                this.resetCombatState();
                this.scene.stop('DungeonScene');  // Stop the DungeonScene
                this.scene.start('CharacterSelectScene');
            }
        });
    }

    resetCombatState() {
        this.combatants = [];
        this.currentTurn = 0;
        if (this.combatantInfo) {
            this.combatantInfo.forEach(info => info.destroy());
        }
        this.combatantInfo = [];
    }
}
