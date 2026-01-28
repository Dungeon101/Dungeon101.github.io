import { LootTable } from '../data/items.js';

export const LootSystem = {
    rollDrop(level) {
        // Simple rarity roll
        // 60% Common, 30% Uncommon, 9% Rare, 1% Legendary
        const roll = Math.random();
        let pool = [];

        if (roll < 0.60) pool = LootTable.common;
        else if (roll < 0.90) pool = LootTable.uncommon;
        else if (roll < 0.99) pool = LootTable.rare;
        else pool = LootTable.legendary || LootTable.rare; // Fallback if no legendary yet

        if (pool.length === 0) return null;

        const item = pool[Math.floor(Math.random() * pool.length)];
        return item;
    },

    spawnLoot(x, y, level) {
        const item = this.rollDrop(level);
        if (item) {
            console.log(`Loot dropped at ${x},${y}: ${item.name}`);
            return {
                x, y,
                item,
                type: 'loot'
            }; // Entity component structure
        }
        return null;
    }
};
