class CombatScene extends Phaser.Scene {
    constructor() {
        super('CombatScene');
    }

    init(data) {
        this.isBossFight = data.isBossFight;
        this.currentFloor = gameState.currentFloor;
    }

    preload() {
        // Load combat background
        this.load.image('combat-bg', 'assets/images/dungeon/combat-background.png');

        // Load character images
        this.load.image('warrior', 'assets/images/characters/warrior.png');
        this.load.image('mage', 'assets/images/characters/mage.png');
        this.load.image('rogue', 'assets/images/characters/rogue.png');
        this.load.image('healer', 'assets/images/characters/healer.png');

        // Load enemy images
        this.load.image('skeleton', 'assets/images/enemies/skeleton.png');
        this.load.image('goblin', 'assets/images/enemies/goblin.png');
        this.load.image('skeleton_boss', 'assets/images/enemies/skeleton_boss.png');
        this.load.image('goblin_boss', 'assets/images/enemies/goblin_boss.png');

        // Load any other necessary assets
        this.load.image('attack-effect', 'assets/images/effects/attack-effect.png');

        // Load ability icons
        this.load.image('berserk-icon', 'assets/images/ui/Berserk.png');
        this.load.image('fireball-icon', 'assets/images/ui/Fireball.png');
        this.load.image('backstab-icon', 'assets/images/ui/Backstab.png');
        this.load.image('heal-icon', 'assets/images/ui/Heal.png'); // Changed from 'Group Heal' to 'Heal'
    }

    create() {
        console.log('Combat Scene');
        this.combatSetup = new CombatSetup(this);
        this.combatActions = new CombatActions(this);
        this.combatUI = new CombatUI(this);
        this.characterAbilities = new CharacterAbilities(this);

        this.combatants = this.combatSetup.initializeCombatants();
        console.log('Combatants:', this.combatants);

        const enemyGenerator = new EnemyGenerator(this.currentFloor);
        const enemies = enemyGenerator.generateEnemies(this.isBossFight);
        console.log('Enemies:', enemies);

        this.combatants = [...this.combatants, ...enemies];

        this.combatSetup.setupCombatScene();

        this.currentTurnIndex = 0;
        this.combatantTurnOrder = this.combatants.sort((a, b) => b.stats.agl - a.stats.agl);
        
        this.setupAbilityButtons();
        
        // Create the turn order UI with a defensive check
        if (typeof TurnOrder !== 'undefined') {
            this.turnOrderUI = new TurnOrder(this, this.combatantTurnOrder);
        } else {
            console.warn('TurnOrder class is not defined');
        }

        this.updateTurnOrderDisplay();

        this.time.delayedCall(1000, () => this.nextTurn());

        this.currentRound = 0;
    }

    setupAbilityButtons() {
        this.abilityButtons = [];
        const characters = this.combatants.filter(c => !c.isEnemy);
        characters.forEach((character, index) => {
            const ability = this.characterAbilities.getAbilityInfo(character.name.toLowerCase());
            
            // Use the character's sprite position to determine the ability icon position
            const x = character.sprite.x;
            const y = character.sprite.y + 100; // Adjust this value to position the icon below the character

            // Load ability icon
            const iconKey = `${ability.name.toLowerCase().replace(' ', '-')}-icon`;
            
            const icon = this.add.image(x, y, iconKey).setScale(0.4);
            icon.setInteractive();

            const text = this.add.text(x, y + 30, ability.name, { 
                font: '12px Arial', 
                fill: '#ffffff' 
            }).setOrigin(0.5);

            const description = this.add.text(x, y + 50, ability.description, { 
                font: '10px Arial', 
                fill: '#ffffff',
                wordWrap: { width: 80 }
            }).setOrigin(0.5);

            icon.on('pointerdown', () => this.useAbility(character));
            
            this.abilityButtons.push({ icon, text, description, character });
        });

        this.updateAbilityButtons();
    }

    useAbility(character) {
        if (this.combatantTurnOrder[this.currentTurnIndex] === character) {
            const message = this.characterAbilities.useAbility(character, this.combatants);
            this.showMessage(message);
            this.updateAbilityButtons();
            if (!message.includes('cooldown')) {
                this.time.delayedCall(2000, () => {
                    this.combatActions.endTurn();
                });
            }
        }
    }

    updateAbilityButtons() {
        this.abilityButtons.forEach(abilityButton => {
            const cooldown = this.characterAbilities.abilityCooldowns[abilityButton.character.name.toLowerCase()] || 0;
            const isCurrentTurn = this.combatantTurnOrder[this.currentTurnIndex] === abilityButton.character;

            abilityButton.icon.setVisible(isCurrentTurn);
            abilityButton.text.setVisible(isCurrentTurn);
            abilityButton.description.setVisible(isCurrentTurn);

            if (isCurrentTurn) {
                if (cooldown > 0) {
                    abilityButton.icon.setTint(0x888888);
                    abilityButton.text.setText(`${abilityButton.text.text.split(' ')[0]} (${cooldown})`);
                } else {
                    abilityButton.icon.clearTint();
                    abilityButton.text.setText(abilityButton.text.text.split(' ')[0]);
                }
            }
        });
    }

    showMessage(message) {
        const text = this.add.text(400, 300, message, { font: '18px Arial', fill: '#ffffff' }).setOrigin(0.5);
        this.time.delayedCall(2000, () => text.destroy());
    }

    updateTurnOrderDisplay() {
        console.log('Updating turn order display');
        if (this.turnOrderUI && this.turnOrderUI.updateHighlight) {
            this.turnOrderUI.updateHighlight(this.currentTurnIndex);
        } else {
            console.warn('Turn order UI or updateHighlight method is not available');
        }
    }

    nextTurn() {
        console.log('Moving to next turn');
        if (this.checkCombatEnd()) return;

        do {
            this.currentTurnIndex = (this.currentTurnIndex + 1) % this.combatantTurnOrder.length;
            if (this.currentTurnIndex === 0) {
                this.currentRound++;
                this.characterAbilities.updateCooldowns();
            }
        } while (this.combatantTurnOrder[this.currentTurnIndex].health <= 0);

        const currentCombatant = this.combatantTurnOrder[this.currentTurnIndex];
        
        if (currentCombatant.isEnemy) {
            this.enemyTurn(currentCombatant);
        } else {
            this.playerTurn(currentCombatant);
        }

        this.updateTurnOrderDisplay();
        this.updateAbilityButtons();
    }

    enemyTurn(enemy) {
        console.log(`Enemy ${enemy.name}'s turn`);
        this.combatActions.enemyAction(enemy);
    }

    playerTurn(character) {
        console.log(`Player ${character.name}'s turn`);
        this.updateAbilityButtons();
        this.combatActions.playerAction(character);
    }

    checkCombatEnd() {
        const allPlayersDead = this.combatants.filter(c => !c.isEnemy).every(c => c.health <= 0);
        const allEnemiesDead = this.combatants.filter(c => c.isEnemy).every(c => c.health <= 0);

        if (allPlayersDead) {
            this.endCombat(false);
            return true;
        } else if (allEnemiesDead) {
            this.endCombat(true);
            return true;
        }

        return false;
    }

    hideAbilityButton(abilityButton) {
        abilityButton.button.setVisible(false);
        abilityButton.icon.setVisible(false);
        abilityButton.cooldownText.setVisible(false);
        abilityButton.description.setVisible(false);
    }

    showAbilityButton(abilityButton) {
        abilityButton.button.setVisible(true);
        abilityButton.icon.setVisible(true);
        abilityButton.cooldownText.setVisible(true);
        abilityButton.description.setVisible(true);
    }

    endCombat(victory) {
        if (victory) {
            this.improveHeroStats();
        }
        this.combatUI.showEndCombatMessage(victory, this.isBossFight);
        this.time.delayedCall(3000, () => {
            if (victory) {
                gameState.updatePartyHealth(this.combatants.filter(c => !c.isEnemy));
                if (this.isBossFight) {
                    gameState.currentFloor++;
                }
                this.scene.stop();
                this.scene.resume('DungeonScene', { 
                    combatVictory: true, 
                    bossDefeated: this.isBossFight,
                    newFloor: gameState.currentFloor
                });
            } else {
                gameState.resetGame();
                this.scene.stop('DungeonScene');
                this.scene.start('CharacterSelectScene');
            }
        });
    }

    improveHeroStats() {
        const statIncrease = Math.floor(this.currentFloor / 10) + 1; // 1 to 11 points
        this.combatants.filter(c => !c.isEnemy).forEach(hero => {
            const statToImprove = Phaser.Math.RND.pick(['atk', 'def', 'agl', 'hp']);
            hero.stats[statToImprove] += statIncrease;
            console.log(`${hero.name}'s ${statToImprove} increased by ${statIncrease}`);
        });
    }
}