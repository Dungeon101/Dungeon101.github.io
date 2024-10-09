class CharacterStats {
    constructor(atk = 50, def = 50, agl = 50, hp = 50) {
        this.atk = this.clamp(atk, 0, 99);
        this.def = this.clamp(def, 0, 99);
        this.agl = this.clamp(agl, 0, 99);
        this.hp = this.clamp(hp, 0, 99);
    }

    clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    calculateMaxHP() {
        return 50 + this.hp * 2;
    }

    calculateAttack() {
        return 10 + Math.floor(this.atk * 0.5);
    }

    calculateDefense() {
        return Math.floor(this.def * 0.3);
    }

    calculateDodgeChance() {
        return Math.min(this.agl * 0.5, 50); // Max 50% dodge chance
    }

    static generateRandomStats() {
        return new CharacterStats(
            Math.floor(Math.random() * 100),
            Math.floor(Math.random() * 100),
            Math.floor(Math.random() * 100),
            Math.floor(Math.random() * 100)
        );
    }
}
