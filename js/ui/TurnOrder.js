class TurnOrder {
    constructor(scene, combatants, y) {
        this.scene = scene;
        this.combatants = combatants;
        this.imageSize = 50;
        this.spacing = 10;
        this.currentTurnIndex = 0;

        // Calculate y position for bottom of the screen
        this.y = this.scene.sys.game.config.height - this.imageSize / 2 - 20; // 20px padding from bottom

        this.createTurnOrder();
    }

    createTurnOrder() {
        const totalWidth = (this.imageSize + this.spacing) * this.combatants.length - this.spacing;
        const startX = (this.scene.sys.game.config.width - totalWidth) / 2;

        this.turnSprites = this.combatants.map((combatant, index) => {
            const x = startX + index * (this.imageSize + this.spacing) + this.imageSize / 2;
            const sprite = this.scene.add.image(
                x,
                this.y,
                combatant.isEnemy ? combatant.type : combatant.name.toLowerCase()
            ).setDisplaySize(this.imageSize, this.imageSize);

            // Add a semi-transparent rectangle as an overlay
            const highlight = this.scene.add.rectangle(
                x,
                this.y,
                this.imageSize,
                this.imageSize,
                0xffff00,
                0.5
            ).setVisible(false);

            return { sprite, highlight };
        });

        this.updateHighlight();
    }

    updateHighlight(currentTurnIndex) {
        this.turnSprites.forEach((turn, index) => {
            turn.highlight.setVisible(index === currentTurnIndex);
        });
    }

    nextTurn() {
        this.currentTurnIndex = (this.currentTurnIndex + 1) % this.combatants.length;
        this.updateHighlight();
    }
}
