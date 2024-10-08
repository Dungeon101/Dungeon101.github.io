class CombatScene extends Phaser.Scene {
    constructor() {
        super('CombatScene');
    }

    init(data) {
        this.combatSetup = new CombatSetup(this);
        this.combatActions = new CombatActions(this);
        this.combatUI = new CombatUI(this);
        this.enemyGenerator = new EnemyGenerator();

        this.combatants = this.combatSetup.initializeCombatants();
        this.currentTurn = 0;
        this.isBossFight = data.isBossFight || false;
    }

    preload() {
        this.combatSetup.preloadAssets();
    }

    create() {
        this.combatSetup.createBackground();
        this.combatSetup.setupParty();
        this.enemies = this.enemyGenerator.generateEnemies(this.isBossFight);
        this.combatSetup.setupEnemies(this.enemies);
        this.combatUI.updateCombatantInfo();
        this.time.delayedCall(1000, () => this.nextTurn());
    }

    nextTurn() {
        if (this.combatActions.checkCombatEnd()) return;

        let combatant = this.combatants[this.currentTurn];
        if (combatant.health <= 0) {
            this.currentTurn = (this.currentTurn + 1) % this.combatants.length;
            this.nextTurn();
            return;
        }

        if (combatant.isEnemy) {
            this.combatActions.enemyAction(combatant);
        } else {
            this.combatActions.playerAction(combatant);
        }
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