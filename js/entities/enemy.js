import { Entity } from './entity.js';

export class Enemy extends Entity {
    constructor(x, y, type) {
        // Map type to asset
        // For now, all enemies use 'warrior' red version (which we need to load or re-use logic)
        // AssetLoader needs to load Red Units. 
        // I'll stick to 'warrior' blue for now (as placeholder) if I haven't loaded Red, 
        // but I should load Red.

        super(x, y, 'warrior'); // Placeholder asset until I add Red to loader
        this.type = type;
        this.stats = { hp: 50, maxHp: 50, attack: 10 };

        // Visual tint (if I could apply it via Canvas, but simple way is separate asset)
        // I will update AssetLoader to load Red Warrior soon.
    }
}
