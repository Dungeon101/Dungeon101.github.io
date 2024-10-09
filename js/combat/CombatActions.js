class CombatActions {
    constructor(scene) {
        this.scene = scene;
    }

    playerAction(character) {
        let targets = this.scene.combatants.filter(c => c.isEnemy && c.health > 0);
        if (targets.length === 0) {
            this.scene.endCombat(true);
            return;
        }

        if (character.nameText) {
            character.nameText.setStyle({ fill: '#00ff00' });
        }

        this.enableTargetSelection(character, targets);
    }

    enableTargetSelection(character, targets) {
        targets.forEach(target => {
            if (target.sprite) {
                target.sprite.removeAllListeners('pointerdown');
                target.sprite.setInteractive();
                target.sprite.on('pointerdown', () => {
                    this.attack(character, target);
                    this.disableTargetSelection(targets);
                    if (character.nameText) {
                        character.nameText.setStyle({ fill: '#ffffff' });
                    }
                    this.scene.time.delayedCall(1000, () => {
                        this.endTurn();
                    });
                });
            }
        });
    }

    disableTargetSelection(targets) {
        targets.forEach(target => {
            if (target.sprite) {
                target.sprite.disableInteractive();
                target.sprite.removeAllListeners('pointerdown');
            }
        });
    }

    enemyAction(enemy) {
        if (enemy.health <= 0) {
            this.endTurn();
            return;
        }

        let targets = this.scene.combatants.filter(c => !c.isEnemy && c.health > 0);
        if (targets.length === 0) {
            this.scene.endCombat(false);
            return;
        }

        if (enemy.nameText) {
            enemy.nameText.setStyle({ fill: '#ff0000' });
        }
        let target = Phaser.Math.RND.pick(targets);
        
        this.scene.time.delayedCall(1000, () => {
            this.attack(enemy, target);
            if (enemy.nameText) {
                enemy.nameText.setStyle({ fill: '#ffffff' });
            }
            
            this.scene.time.delayedCall(1000, () => {
                this.endTurn();
            });
        });
    }

    attack(attacker, target) {
        console.log(`${attacker.name} is attacking ${target.name}`);
        let damage = attacker.stats.calculateAttack();
        
        // Apply Berserk bonus if active
        if (attacker.berserkBonus) {
            damage = Math.floor(damage * attacker.berserkBonus);
        }

        if (target.stats.calculateDodgeChance() > Math.random() * 100) {
            this.scene.add.text(target.sprite.x, target.sprite.y - 20, 'Dodged!', 
                { font: '16px Arial', fill: '#ffffff' })
                .setOrigin(0.5)
                .destroy({ delay: 1000 });
            return;
        }

        this.applyDamage(target, damage);
    }

    applyDamage(target, damage) {
        damage = Math.max(1, damage - target.stats.calculateDefense());
        target.health = Math.max(0, target.health - damage);

        if (target.healthBar) {
            target.healthBar.setHealth(target.health, target.maxHealth);
        }
        if (target.hpText) {
            target.hpText.setText(`HP: ${target.health}/${target.maxHealth}`);
        }

        let effect = this.scene.add.image(target.sprite.x, target.sprite.y, 'attack-effect');
        effect.setScale(0.5);
        effect.setAlpha(0.8);

        this.scene.tweens.add({
            targets: effect,
            alpha: 0,
            scale: 1,
            duration: 300,
            onComplete: () => effect.destroy()
        });

        this.scene.add.text(target.sprite.x, target.sprite.y - 20, `-${damage}`, 
            { font: '16px Arial', fill: '#ff0000' })
            .setOrigin(0.5)
            .destroy({ delay: 1000 });

        if (target.health <= 0) {
            this.handleDeath(target);
        }

        this.scene.combatUI.updateCombatantInfo();
    }

    handleDeath(target) {
        target.sprite.setAlpha(0.5);
        target.healthBar.bar.destroy();
        // Any other death-related logic
    }

    checkCombatEnd() {
        let aliveParty = this.scene.combatants.filter(c => !c.isEnemy && c.health > 0);
        let aliveEnemies = this.scene.combatants.filter(c => c.isEnemy && c.health > 0);

        if (aliveParty.length === 0) {
            this.scene.endCombat(false);
            return true;
        } else if (aliveEnemies.length === 0) {
            this.scene.endCombat(true);
            return true;
        }
        return false;
    }

    endTurn() {
        this.scene.nextTurn();
    }
}