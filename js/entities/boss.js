import { Enemy } from './enemy.js';
import { Stats } from '../data/stats.js';

export class Boss extends Enemy {
    constructor(x, y) {
        super(x, y);
        this.spriteKey = 'boss';
        this.name = "Dungeon Lord";
        this.isBoss = true;
        this.phase = 1;

        // Custom Boss Stats (Stronger)
        this.attributes = { str: 18, dex: 14, con: 18, int: 10, wis: 12, cha: 16 };
        // Derived calculates HP ~25-30? We want more for a boss.
        // Let's manually boost.

        // We defer calculation to CombatManager usually, but let's init here to be safe
        // Or override ensureStats in CombatManager for bosses.
    }
}
