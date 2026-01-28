export const Talents = {
    warrior: [
        { id: 'w1', name: 'Iron Skin', x: 200, y: 100, req: [], desc: '+5 Defense', cost: 1, unlocked: false, active: false },
        { id: 'w2', name: 'Power Strike', x: 400, y: 100, req: ['w1'], desc: 'Unlock Heavy Attack', cost: 1, unlocked: false, active: false },
        { id: 'w3', name: 'Rage', x: 600, y: 100, req: ['w2'], desc: '+10% Dmg when low HP', cost: 2, unlocked: false, active: false },
        { id: 'w4', name: 'Vitality', x: 200, y: 250, req: [], desc: '+20 Max HP', cost: 1, unlocked: false, active: false },
        { id: 'w5', name: 'Cleave', x: 400, y: 250, req: ['w4'], desc: 'Attacks hit adjacent enemies', cost: 3, unlocked: false, active: false }
    ],
    mage: [
        { id: 'm1', name: 'Mana Flow', x: 200, y: 100, req: [], desc: 'Regen 1 Mana/Turn', cost: 1, unlocked: false, active: false },
        { id: 'm2', name: 'Fireball', x: 400, y: 100, req: ['m1'], desc: 'Unlock Fireball Skill', cost: 1, unlocked: false, active: false }
    ],
    rogue: [
        { id: 'r1', name: 'Swiftness', x: 200, y: 100, req: [], desc: '+2 Speed', cost: 1, unlocked: false, active: false },
        { id: 'r2', name: 'Backstab', x: 400, y: 100, req: ['r1'], desc: 'Crit Dmg x3', cost: 2, unlocked: false, active: false }
    ]
};
