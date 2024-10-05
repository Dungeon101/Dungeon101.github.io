class PreloadScene extends Phaser.Scene {
    constructor() {
        super('PreloadScene');
    }

    preload() {
        // Create loading bar
        let loadingBar = this.add.graphics({
            fillStyle: {
                color: 0xffffff // white
            }
        });

        // Simulate loading assets
        for (let i = 0; i < 100; i++) {
            this.load.image('test' + i, 'assets/images/ui/loading-background.png');
        }

        // Load generic boss icon
        this.load.image('boss_icon', 'assets/images/enemies/boss.png');

        this.load.on('progress', (percent) => {
            loadingBar.fillRect(0, this.game.renderer.height / 2, this.game.renderer.width * percent, 50);
        });

        this.load.on('complete', () => {
            console.log('All assets loaded');
        });
    }

    create() {
        console.log('Preload Scene');
        this.scene.start('MainMenuScene');
    }
}
