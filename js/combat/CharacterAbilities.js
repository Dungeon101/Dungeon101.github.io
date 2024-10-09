class CharacterAbilities {
    constructor(scene) {
        this.scene = scene;
        this.abilityCooldowns = {};
    }

    getAbilityInfo(characterName) {
        const abilities = {
            warrior: { name: 'Berserk', cooldown: 3, description: 'Increase ATK for 2 turns' },
            mage: { name: 'Fireball', cooldown: 2, description: 'Deal AoE damage to all enemies' },
            rogue: { name: 'Backstab', cooldown: 2, description: 'Deal high damage to one enemy' },
            healer: { name: 'Heal', cooldown: 3, description: 'Heal all allies' }
        };
        return abilities[characterName] || { name: 'Unknown', cooldown: 0, description: 'No ability' };
    }

    useAbility(character, targets) {
        const abilityName = character.name.toLowerCase();
        if (this.abilityCooldowns[abilityName] > 0) {
            return `${character.name}'s ability is on cooldown for ${this.abilityCooldowns[abilityName]} more rounds.`;
        }

        let message = '';
        switch (abilityName) {
            case 'warrior':
                message = this.warriorAbility(character);
                break;
            case 'mage':
                message = this.mageAbility(character, targets.filter(t => t.isEnemy && t.health > 0));
                break;
            case 'rogue':
                message = this.rogueAbility(character, targets.filter(t => t.isEnemy && t.health > 0));
                break;
            case 'healer':
                message = this.healerAbility(character, targets.filter(t => !t.isEnemy));
                break;
        }

        this.abilityCooldowns[abilityName] = this.getAbilityInfo(abilityName).cooldown;
        return message;
    }

    warriorAbility(character) {
        character.berserkTurns = 2;
        character.berserkBonus = 1.5; // 50% attack increase
        return `${character.name} goes berserk, increasing their attack by 50% for 2 turns!`;
    }

    mageAbility(character, enemies) {
        const damage = Math.floor(character.stats.atk * 0.8);
        enemies.forEach(enemy => {
            this.scene.combatActions.applyDamage(enemy, damage);
        });
        return `${character.name} casts Fireball, dealing ${damage} damage to all enemies!`;
    }

    rogueAbility(character, enemies) {
        if (enemies.length === 0) {
            return `${character.name} attempts to backstab, but there are no enemies left!`;
        }
        const target = enemies[0]; // Target the first living enemy
        const damage = Math.floor(character.stats.atk * 2); // Double damage for backstab
        this.scene.combatActions.applyDamage(target, damage);
        return `${character.name} backstabs ${target.name}, dealing ${damage} damage!`;
    }

    healerAbility(character, allies) {
        const healAmount = Math.floor(character.stats.atk * 1.5);
        allies.forEach(ally => {
            ally.health = Math.min(ally.health + healAmount, ally.maxHealth);
            if (ally.healthBar) {
                ally.healthBar.setHealth(ally.health, ally.maxHealth);
            }
            if (ally.hpText) {
                ally.hpText.setText(`HP: ${ally.health}/${ally.maxHealth}`);
            }
        });
        return `${character.name} casts Group Heal, restoring ${healAmount} HP to all allies!`;
    }

    updateCooldowns() {
        for (let char in this.abilityCooldowns) {
            if (this.abilityCooldowns[char] > 0) {
                this.abilityCooldowns[char]--;
            }
        }

        this.scene.combatants.forEach(combatant => {
            if (combatant.berserkTurns > 0) {
                combatant.berserkTurns--;
                if (combatant.berserkTurns === 0) {
                    combatant.berserkBonus = 1; // Reset berserk bonus
                }
            }
        });
    }
}
