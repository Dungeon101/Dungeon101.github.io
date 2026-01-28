export const Stats = {
    // D&D style modifiers: (Score - 10) / 2
    getModifier(score) {
        return Math.floor((score - 10) / 2);
    },

    // Calculate Derived Stats
    calculate(attributes, level, equipment = [], talents = []) {
        const mods = {
            str: this.getModifier(attributes.str),
            dex: this.getModifier(attributes.dex),
            con: this.getModifier(attributes.con),
            int: this.getModifier(attributes.int),
            wis: this.getModifier(attributes.wis),
            cha: this.getModifier(attributes.cha)
        };

        let maxHp = 10 + (attributes.con * 2) + (level * (5 + mods.con));
        let maxMana = 5 + (attributes.int * 2) + (level * (3 + mods.int));

        let attackPower = 2 + mods.str;
        let defense = 10 + mods.dex;
        let critChance = 0.05 + (mods.dex * 0.01);
        let initiative = mods.dex;

        // Apply talent bonuses
        talents.forEach(t => {
            if (t.unlocked) {
                if (t.id === 'w1') defense += 5;
                if (t.id === 'w4') maxHp += 20;
                if (t.id === 'r1') initiative += 2;
            }
        });

        return {
            maxHp,
            maxMana,
            attackPower,
            defense,
            critChance,
            initiative,
            mods
        };
    }
};

export const BaseClasses = {
    warrior: {
        str: 16, dex: 12, con: 14, int: 8, wis: 10, cha: 10
    },
    mage: {
        str: 8, dex: 12, con: 10, int: 16, wis: 14, cha: 12
    },
    rogue: {
        str: 10, dex: 16, con: 12, int: 12, wis: 10, cha: 14
    }
};
