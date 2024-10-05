class BootScene extends Phaser.Scene {
    constructor() {
        super('BootScene');
    }

    preload() {
        // Load any assets needed for the loading screen
        this.load.image('loading-background', 'assets/images/ui/loading-background.png');
        // Add more assets as needed
    }

    create() {
        console.log('Boot Scene');
        this.scene.start('PreloadScene');
    }
}
