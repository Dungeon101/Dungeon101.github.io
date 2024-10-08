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

        let actionText = this.scene.add.text(400, 100, `${character.name}'s turn. Click an enemy to attack.`, 
            { font: '18px Arial', fill: '#ffffff' }).setOrigin(0.5);

        if (character.nameText) {
            character.nameText.setStyle({ fill: '#00ff00' });
        }

        targets.forEach(target => {
            if (target.sprite) {
                target.sprite.removeAllListeners('pointerdown');
                target.sprite.setInteractive();
                target.sprite.on('pointerdown', () => {
                    actionText.destroy();
                    this.attack(character, target);
                    targets.forEach(t => {
                        if (t.sprite) t.sprite.disableInteractive();
                    });
                    if (character.nameText) {
                        character.nameText.setStyle({ fill: '#ffffff' });
                    }
                    this.scene.time.delayedCall(1000, () => {
                        this.scene.currentTurn = (this.scene.currentTurn + 1) % this.scene.combatants.length;
                        this.scene.nextTurn();
                    });
                });
            }
        });
    }

    enemyAction(enemy) {
        let targets = this.scene.combatants.filter(c => !c.isEnemy && c.health > 0);
        if (targets.length === 0) {
            this.scene.endCombat(false);
            return;
        }

        enemy.nameText.setStyle({ fill: '#ff0000' });
        let target = Phaser.Math.RND.pick(targets);
        
        this.scene.time.delayedCall(1000, () => {
            this.attack(enemy, target);
            enemy.nameText.setStyle({ fill: '#ffffff' });
            
            this.scene.time.delayedCall(1000, () => {
                this.scene.currentTurn = (this.scene.currentTurn + 1) % this.scene.combatants.length;
                this.scene.nextTurn();
            });
        });
    }

    attack(attacker, target) {
        let damage = attacker.attack;
        target.health = Math.max(0, target.health - damage);

        target.healthBar.setHealth(target.health, target.maxHealth);

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
            target.sprite.setAlpha(0.5);
            target.healthBar.bar.destroy(); 
        }

        this.scene.combatUI.updateCombatantInfo();
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
}