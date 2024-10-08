class CharacterAbilities {
    constructor(scene) {
        this.scene = scene;
        this.abilityCooldowns = {};
    }

    getAbilityInfo(characterName) {
        const abilities = {
            warrior: { name: 'Shield Block', description: 'Double defense for 1 turn', cooldown: 3 },
            mage: { name: 'Fireball', description: 'Deal 15 damage to all enemies', cooldown: 2 },
            rogue: { name: 'Backstab', description: 'Deal 30 damage to one enemy', cooldown: 2 },
            healer: { name: 'Group Heal', description: 'Heal all allies for 20 HP', cooldown: 3 }
        };
        return abilities[characterName.toLowerCase()];
    }

    useAbility(character, targets) {
        const abilityName = character.name.toLowerCase();
        if (this.abilityCooldowns[abilityName] > 0) {
            return `${character.name}'s ability is on cooldown for ${this.abilityCooldowns[abilityName]} more turns.`;
        }

        const result = this[abilityName + 'Ability'](character, targets);
        this.abilityCooldowns[abilityName] = this.getAbilityInfo(abilityName).cooldown;
        return result;
    }

    updateCooldowns() {
        for (let abilityName in this.abilityCooldowns) {
            if (this.abilityCooldowns[abilityName] > 0) {
                this.abilityCooldowns[abilityName]--;
            }
        }
    }

    warriorAbility(character) {
        character.defense = character.defense * 2;
        this.scene.time.delayedCall(2000, () => {
            character.defense = character.defense / 2;
        });
        return `${character.name} used Shield Block! Defense doubled for this turn.`;
    }

    mageAbility(character, targets) {
        const damage = 15;
        targets.forEach(target => {
            if (target.isEnemy && target.health > 0) {
                this.scene.combatActions.attack(character, target, damage);
            }
        });
        return `${character.name} cast Fireball! All enemies take ${damage} damage.`;
    }

    rogueAbility(character, targets) {
        const damage = 30;
        const target = targets.find(t => t.isEnemy && t.health > 0);
        if (target) {
            this.scene.combatActions.attack(character, target, damage);
            return `${character.name} used Backstab on ${target.name}! It deals ${damage} damage.`;
        }
        return `${character.name} couldn't find a target for Backstab!`;
    }

    healerAbility(character, targets) {
        const healAmount = 20;
        targets.forEach(target => {
            if (!target.isEnemy) {
                target.health = Math.min(target.health + healAmount, target.maxHealth);
                target.healthBar.setHealth(target.health, target.maxHealth);
            }
        });
        return `${character.name} used Group Heal! All allies recover ${healAmount} HP.`;
    }
}
