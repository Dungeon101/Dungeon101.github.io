class DungeonUI {
    constructor(scene) {
        this.scene = scene;
    }

    createFloorText() {
        this.scene.floorText = this.scene.add.text(16, 16, `Floor: ${gameState.currentFloor}`, { font: '18px Arial', fill: '#ffffff' })
            .setScrollFactor(0)
            .setDepth(10);
    }

    createBossFloorText() {
        if (this.scene.isBossFloor) {
            this.scene.add.text(16, 50, 'BOSS FLOOR!', { font: '24px Arial', fill: '#ff0000' })
                .setScrollFactor(0)
                .setDepth(10);
        }
    }

    showDebugPrompt() {
        const newFloor = prompt('Enter floor number:');
        if (newFloor && !isNaN(newFloor)) {
            gameState.currentFloor = parseInt(newFloor);
            this.scene.scene.restart({ newFloor: gameState.currentFloor });
        }
    }
}