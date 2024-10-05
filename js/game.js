window.addEventListener('load', () => {
    const game = new Phaser.Game(config);

    // Add scenes dynamically
    game.scene.add('BootScene', BootScene);
    game.scene.add('PreloadScene', PreloadScene);
    game.scene.add('MainMenuScene', MainMenuScene);
    game.scene.add('CharacterSelectScene', CharacterSelectScene);
    game.scene.add('DungeonScene', DungeonScene);
    game.scene.add('CombatScene', CombatScene);

    // Pass DungeonGenerator to DungeonScene
    game.registry.set('DungeonGenerator', DungeonGenerator);

    // Start the first scene
    game.scene.start('BootScene');

    // Add debug object
    window.gameDebug = {
        setFloor: (floorNumber) => {
            const dungeonScene = game.scene.getScene('DungeonScene');
            if (dungeonScene) {
                dungeonScene.currentFloor = floorNumber;
                dungeonScene.scene.restart({ newFloor: floorNumber, party: dungeonScene.party });
            } else {
                console.log('DungeonScene not active');
            }
        }
    };
});