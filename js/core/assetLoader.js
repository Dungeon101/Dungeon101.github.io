export const AssetLoader = {
    images: {},

    // Tiny Swords uses clear folder structures. We'll map keys to paths.
    toLoad: {
        'tileset': 'assets/Terrain/Tileset/Tilemap_color1.png',
        // Player Classes (Blue)
        'warrior_idle': 'assets/Units/Blue Units/Warrior/Warrior_Idle.png',
        'warrior_run': 'assets/Units/Blue Units/Warrior/Warrior_Run.png',
        'mage_idle': 'assets/Units/Blue Units/Monk/Idle.png', // Monk as Mage
        'mage_run': 'assets/Units/Blue Units/Monk/Run.png',
        'rogue_idle': 'assets/Units/Blue Units/Archer/Archer_Idle.png', // Archer as Rogue
        'rogue_run': 'assets/Units/Blue Units/Archer/Archer_Run.png',

        // Enemies (Red)
        'enemy_idle': 'assets/Units/Red Units/Warrior/Warrior_Idle.png',
        'enemy_run': 'assets/Units/Red Units/Warrior/Warrior_Run.png',

        // Environment
        'water_bg': 'assets/Terrain/Tileset/Water Background color.png',
        'rock1': 'assets/Terrain/Decorations/Rocks/Rock1.png',
        'rock2': 'assets/Terrain/Decorations/Rocks/Rock2.png',
        'rock3': 'assets/Terrain/Decorations/Rocks/Rock3.png',
        'rock4': 'assets/Terrain/Decorations/Rocks/Rock4.png',

        // Boss
        'boss_idle': 'assets/Units/Red Units/Lancer/Lancer_Idle.png',
        'boss_run': 'assets/Units/Red Units/Lancer/Lancer_Run.png'
    },

    loadAll() {
        const promises = [];

        for (const [key, path] of Object.entries(this.toLoad)) {
            promises.push(new Promise((resolve, reject) => {
                const img = new Image();
                img.src = path;
                img.onload = () => {
                    this.images[key] = img;
                    resolve(img);
                };
                img.onerror = (e) => {
                    console.error(`Failed to load asset: ${path}`, e);
                    reject(e);
                };
            }));
        }

        return Promise.all(promises);
    },

    getImage(key) {
        return this.images[key];
    }
};
