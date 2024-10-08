class CombatScene extends Phaser.Scene {
    constructor() {
        super('CombatScene');
    }

    init(data) {
        this.combatSetup = new CombatSetup(this);
        this.combatActions = new CombatActions(this);
        this.combatUI = new CombatUI(this);
        this.enemyGenerator = new EnemyGenerator();
        this.characterAbilities = new CharacterAbilities(this);

        this.combatants = this.combatSetup.initializeCombatants();
        this.currentTurn = 0;
        this.isBossFight = data.isBossFight || false;
    }

    preload() {
        this.combatSetup.preloadAssets();
        //this.load.image('highlight', 'assets/images/ui/highlight.png');
    }

    create() {
        this.combatSetup.createBackground();
        this.combatSetup.setupParty();
        this.enemies = this.enemyGenerator.generateEnemies(this.isBossFight);
        this.combatSetup.setupEnemies(this.enemies);
        this.combatUI.updateCombatantInfo();

        this.currentTurnIndex = 0;
        this.combatantTurnOrder = this.combatants.filter(combatant => combatant.health > 0);
        this.setupAbilityButtons();
        
        // Create the turn order UI
        this.turnOrderUI = new TurnOrder(this, this.combatantTurnOrder);

        this.updateTurnOrderDisplay();

        this.time.delayedCall(1000, () => this.nextTurn());
    }

    setupAbilityButtons() {
        this.abilityButtons = this.combatants.map(combatant => {
            if (!combatant.isEnemy) {
                const abilityInfo = this.characterAbilities.getAbilityInfo(combatant.name);
                const x = combatant.sprite.x;
                const y = combatant.hpText.y + 30;

                const button = this.add.rectangle(x, y, 40, 40, 0x4a4a4a).setInteractive();
                const icon = this.add.text(x, y, 'A', { font: '20px Arial' }).setOrigin(0.5);
                const cooldownText = this.add.text(x, y + 25, '', { font: '12px Arial' }).setOrigin(0.5);
                const description = this.add.text(x, y + 45, abilityInfo.description, { 
                    font: '10px Arial', 
                    wordWrap: { width: 80 } 
                }).setOrigin(0.5);

                button.on('pointerdown', () => this.useAbility(combatant));

                const abilityButton = { button, icon, cooldownText, description, combatant };
                this.hideAbilityButton(abilityButton);
                return abilityButton;
            }
            return null;
        }).filter(button => button !== null);
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

    useAbility(character) {
        if (this.combatantTurnOrder[this.currentTurnIndex] === character) {
            const message = this.characterAbilities.useAbility(character, this.combatants);
            this.showMessage(message);
            this.updateAbilityButtons();
            this.time.delayedCall(2000, () => {
                this.nextTurn();
            });
        }
    }

    updateAbilityButtons() {
        this.abilityButtons.forEach(abilityButton => {
            if (abilityButton.combatant === this.combatantTurnOrder[this.currentTurnIndex]) {
                this.showAbilityButton(abilityButton);
                const cooldown = this.characterAbilities.abilityCooldowns[abilityButton.combatant.name.toLowerCase()] || 0;
                if (cooldown > 0) {
                    abilityButton.button.setFillStyle(0x8a8a8a);
                    abilityButton.cooldownText.setText(cooldown);
                } else {
                    abilityButton.button.setFillStyle(0x4a4a4a);
                    abilityButton.cooldownText.setText('');
                }
            } else {
                this.hideAbilityButton(abilityButton);
            }
        });
    }

    nextTurn() {
        if (this.combatActions.checkCombatEnd()) return;

        let currentCombatant = this.combatantTurnOrder[this.currentTurnIndex];

        // Update cooldowns for the character whose turn just ended
        if (!currentCombatant.isEnemy) {
            this.characterAbilities.updateCooldowns(currentCombatant);
        }

        // Move to the next combatant
        this.currentTurnIndex = (this.currentTurnIndex + 1) % this.combatantTurnOrder.length;
        currentCombatant = this.combatantTurnOrder[this.currentTurnIndex];

        // Skip dead combatants
        while (currentCombatant.health <= 0) {
            this.currentTurnIndex = (this.currentTurnIndex + 1) % this.combatantTurnOrder.length;
            currentCombatant = this.combatantTurnOrder[this.currentTurnIndex];
        }

        this.updateTurnOrderDisplay();
        this.updateAbilityButtons();

        if (currentCombatant.isEnemy) {
            this.combatActions.enemyAction(currentCombatant);
        } else {
            this.combatActions.playerAction(currentCombatant);
        }
    }

    updateTurnOrderDisplay() {
        this.turnOrderUI.updateHighlight(this.currentTurnIndex);
    }

    showMessage(message) {
        const text = this.add.text(400, 300, message, {
            font: '18px Arial',
            fill: '#ffffff',
            backgroundColor: '#000000',
            padding: { x: 10, y: 5 }
        }).setOrigin(0.5);

        this.time.delayedCall(2000, () => {
            text.destroy();
        });
    }

    endCombat(victory) {
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
}