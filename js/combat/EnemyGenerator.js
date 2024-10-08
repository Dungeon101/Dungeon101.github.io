class EnemyGenerator {
    generateEnemies(isBossFight) {
        if (isBossFight) {
            return [this.generateBoss()];
        } else {
            let enemyCount = Phaser.Math.Between(1, 3);
            let enemies = [];
            for (let i = 0; i < enemyCount; i++) {
                enemies.push(this.generateRegularEnemy());
            }
            return enemies;
        }
    }

    generateRegularEnemy() {
        let enemyType = Phaser.Math.RND.pick(['skeleton', 'goblin']);
        let health = enemyType === 'skeleton' ? 50 : 30;
        return {
            name: enemyType.charAt(0).toUpperCase() + enemyType.slice(1),
            type: enemyType,
            health: health,
            maxHealth: health,
            attack: enemyType === 'skeleton' ? 10 : 15
        };
    }

    generateBoss() {
        let bossType = Phaser.Math.RND.pick(['skeleton', 'goblin']);
        let health = bossType === 'skeleton' ? 200 : 150;
        return {
            name: bossType.charAt(0).toUpperCase() + bossType.slice(1) + ' Boss',
            type: bossType + '_boss',
            health: health,
            maxHealth: health,
            attack: bossType === 'skeleton' ? 20 : 25,
            isBoss: true
        };
    }
}