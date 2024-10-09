class TurnOrder {
    constructor(scene, combatants) {
        this.scene = scene;
        this.combatants = combatants;
        this.imageSize = 50;
        this.spacing = 10;

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
            ).setDisplaySize(this.imageSize, this.imageSize)
             .setInteractive({ useHandCursor: true });

            // Add click event to show stats
            sprite.on('pointerdown', () => this.showStats(combatant));

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
    }

    updateHighlight(currentTurnIndex) {
        this.turnSprites.forEach((turn, index) => {
            turn.highlight.setVisible(index === currentTurnIndex);
        });
    }

    showStats(combatant) {
        if (this.statWindow) {
            this.statWindow.destroy();
        }

        const windowWidth = 250;
        const windowHeight = 250;
        const padding = 10;

        const graphics = this.scene.add.graphics();
        graphics.fillStyle(0x000000, 0.8);
        graphics.fillRect(0, 0, windowWidth, windowHeight);

        this.statWindow = this.scene.add.container(
            this.scene.sys.game.config.width / 2 - windowWidth / 2,
            this.scene.sys.game.config.height / 2 - windowHeight / 2
        );
        this.statWindow.add(graphics);

        const statText = this.scene.add.text(padding, padding, 
            `Name: ${combatant.name}\n` +
            `HP: ${combatant.health}/${combatant.maxHealth}\n` +
            `ATK: ${combatant.stats.atk}\n` +
            `DEF: ${combatant.stats.def}\n` +
            `AGL: ${combatant.stats.agl}\n` +
            `Attack: ${combatant.attack}\n` +
            `Defense: ${combatant.defense}\n` +
            `Dodge Chance: ${Math.floor(combatant.stats.calculateDodgeChance())}%`,
            { font: '16px Arial', fill: '#ffffff', wordWrap: { width: windowWidth - padding * 2 } }
        );
        this.statWindow.add(statText);

        const closeButton = this.scene.add.text(windowWidth - padding * 3, padding, 'X', 
            { font: '20px Arial', fill: '#ffffff' })
            .setInteractive({ useHandCursor: true });
        closeButton.on('pointerdown', () => this.statWindow.destroy());
        this.statWindow.add(closeButton);
    }

    // Remove the nextTurn method as it's no longer needed
}
