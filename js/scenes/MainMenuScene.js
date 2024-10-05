class MainMenuScene extends Phaser.Scene {
    constructor() {
        super('MainMenuScene');
    }

    create() {
        console.log('Main Menu Scene');
        
        const title = this.add.text(this.cameras.main.centerX, 100, 'Darkest Dungeon-like Game', {
            font: '32px Arial',
            fill: '#ffffff'
        }).setOrigin(0.5);

        const startButton = this.add.text(this.cameras.main.centerX, 200, 'Start Game', {
            font: '24px Arial',
            fill: '#ffffff'
        }).setOrigin(0.5).setInteractive();

        startButton.on('pointerdown', () => {
            console.log('Starting CharacterSelectScene');
            this.scene.start('CharacterSelectScene');
        });
    }
}
