export const Items = [
    { id: 'potion_hp', name: 'Health Potion', type: 'consumable', rarity: 'common', effect: { hp: 50 }, desc: 'Restores 50 HP.' },
    { id: 'sword_iron', name: 'Iron Sword', type: 'weapon', rarity: 'common', stats: { attack: 2 }, desc: 'Standard issue.' },
    { id: 'sword_steel', name: 'Steel Sword', type: 'weapon', rarity: 'uncommon', stats: { attack: 5 }, desc: 'Sharper and stronger.' },
    { id: 'sword_flame', name: 'Flame Tongue', type: 'weapon', rarity: 'rare', stats: { attack: 8, str: 2 }, desc: 'Burns with magical fire.' },
    { id: 'armor_leather', name: 'Leather Armor', type: 'armor', rarity: 'common', stats: { defense: 1 }, desc: 'Basic protection.' },
    { id: 'armor_plate', name: 'Plate Mail', type: 'armor', rarity: 'rare', stats: { defense: 5, con: 2 }, desc: 'Heavy protection.' },
    { id: 'ring_dex', name: 'Ring of Agility', type: 'accessory', rarity: 'uncommon', stats: { dex: 2 }, desc: 'Makes you faster.' }
];

export const LootTable = {
    common: Items.filter(i => i.rarity === 'common'),
    uncommon: Items.filter(i => i.rarity === 'uncommon'),
    rare: Items.filter(i => i.rarity === 'rare'),
    legendary: Items.filter(i => i.rarity === 'legendary')
};
