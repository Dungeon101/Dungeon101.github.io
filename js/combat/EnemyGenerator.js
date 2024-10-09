class EnemyGenerator {
    constructor(currentFloor) {
        this.currentFloor = currentFloor;
    }

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
        let stats = this.generateEnemyStats(false);
        return {
            name: enemyType.charAt(0).toUpperCase() + enemyType.slice(1),
            type: enemyType,
            stats: stats,
            health: stats.calculateMaxHP(),
            maxHealth: stats.calculateMaxHP(),
            attack: stats.calculateAttack(),
            defense: stats.calculateDefense(),
            isEnemy: true
        };
    }

    generateBoss() {
        let bossType = Phaser.Math.RND.pick(['skeleton', 'goblin']);
        let stats = this.generateEnemyStats(true);
        return {
            name: bossType.charAt(0).toUpperCase() + bossType.slice(1) + ' Boss',
            type: bossType + '_boss',
            stats: stats,
            health: stats.calculateMaxHP(),
            maxHealth: stats.calculateMaxHP(),
            attack: stats.calculateAttack(),
            defense: stats.calculateDefense(),
            isEnemy: true,
            isBoss: true
        };
    }

    generateEnemyStats(isBoss) {
        const floorFactor = this.currentFloor / 100; // 0.01 to 1
        const baseStat = Math.floor(5 + (45 * floorFactor)); // 5 to 50
        const randomVariation = () => Phaser.Math.Between(-2, 2);

        let stats = {
            atk: baseStat + randomVariation(),
            def: baseStat + randomVariation(),
            agl: baseStat + randomVariation(),
            hp: baseStat + randomVariation()
        };

        if (isBoss) {
            Object.keys(stats).forEach(key => {
                stats[key] = Math.floor(stats[key] * 1.5); // 50% stronger for bosses
            });
        }

        return new CharacterStats(stats.atk, stats.def, stats.agl, stats.hp);
    }
}