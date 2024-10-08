class CombatUI {
    constructor(scene) {
        this.scene = scene;
    }

    updateCombatantInfo() {
        this.scene.combatants.forEach((combatant) => {
            if (combatant.hpText) {
                combatant.hpText.setText(`HP: ${combatant.health}/${combatant.maxHealth}`);
            }
            if (combatant.healthBar) {
                combatant.healthBar.setHealth(combatant.health, combatant.maxHealth);
            }
        });
    }

    showEndCombatMessage(victory, isBossFight) {
        let message = victory ? (isBossFight ? 'You defeated the boss!' : 'You won the battle!') : 'Game Over';
        this.scene.add.text(400, 300, message, { font: '32px Arial', fill: '#ffffff' }).setOrigin(0.5);
    }
}