import { Entity } from './entity.js';
import { Input } from '../core/input.js';
import { TILES } from '../data/constants.js';
import { Stats, BaseClasses } from '../data/stats.js';

export class Player extends Entity {
    constructor(x, y, charClass) {
        // Map class to asset key
        let spriteKey = 'warrior';
        if (charClass === 'mage') spriteKey = 'mage';
        if (charClass === 'rogue') spriteKey = 'rogue';

        super(x, y, spriteKey);
        this.charClass = charClass;

        this.attributes = { ...BaseClasses[charClass] };

        // Talents are loaded dynamically in Game.startRun()
        this.talents = [];

        this.stats = {};
        this.recalcStats();

        this.currentHp = this.stats.derived.maxHp;
        this.currentMana = this.stats.derived.maxMana;
        this.level = 1;
        this.xp = 0;
        this.maxXp = 100;
        this.talentPoints = 1;

        this.inventory = [];
    }

    gainXp(amount) {
        this.xp += amount;
        if (this.xp >= this.maxXp) {
            this.levelUp();
        }
    }

    levelUp() {
        this.xp -= this.maxXp;
        this.level++;
        this.maxXp = Math.floor(this.maxXp * 1.5);
        this.talentPoints++;

        this.recalcStats();
        this.currentHp = this.stats.derived.maxHp;
        this.currentMana = this.stats.derived.maxMana;

        console.log(`Level Up! Now Level ${this.level}. Talent Points: ${this.talentPoints}`);

        // Handle multiple level ups from large XP gains
        if (this.xp >= this.maxXp) {
            this.levelUp();
        }
    }

    recalcStats() {
        // Recalculate derived stats including talent bonuses
        this.stats.derived = Stats.calculate(this.attributes, this.level || 1, [], this.talents || []);
    }

    update(dt, level) {
        super.update(dt);

        if (!this.isMoving) {
            let dx = 0;
            let dy = 0;

            if (Input.isDown('ArrowUp') || Input.isDown('KeyW')) dy = -1;
            else if (Input.isDown('ArrowDown') || Input.isDown('KeyS')) dy = 1;
            else if (Input.isDown('ArrowLeft') || Input.isDown('KeyA')) dx = -1;
            else if (Input.isDown('ArrowRight') || Input.isDown('KeyD')) dx = 1;

            if (dx !== 0 || dy !== 0) {
                if (dx < 0) this.flipX = true;
                if (dx > 0) this.flipX = false;

                const targetX = this.gridX + dx;
                const targetY = this.gridY + dy;

                const enemy = level.entities.find(e => e.gridX === targetX && e.gridY === targetY);
                if (enemy) {
                    window.dispatchEvent(new CustomEvent('combat-encounter', { detail: { enemy } }));
                    return;
                }

                const tile = level.getTile(targetX, targetY);
                if (tile === TILES.FLOOR || tile === TILES.DOOR) {
                    this.gridX = targetX;
                    this.gridY = targetY;
                }
            }
        }
    }
}
