class CharacterSelectScene extends Phaser.Scene {
    constructor() {
        super('CharacterSelectScene');
        this.selectedCharacters = [];
    }

    preload() {
        this.load.image('warrior', 'assets/images/characters/warrior.png');
        this.load.image('mage', 'assets/images/characters/mage.png');
        this.load.image('rogue', 'assets/images/characters/rogue.png');
        this.load.image('healer', 'assets/images/characters/healer.png');
    }

    create() {
        console.log('Character Select Scene');
        this.selectedCharacters = [];
        
        this.add.text(400, 50, 'Select Your Party (4 Characters)', {
            font: '32px Arial',
            fill: '#ffffff'
        }).setOrigin(0.5);

        const characters = [
            { name: 'Warrior', stats: this.generateStartingStats(), special: 'Shield Block' },
            { name: 'Mage', stats: this.generateStartingStats(), special: 'Fireball' },
            { name: 'Rogue', stats: this.generateStartingStats(), special: 'Backstab' },
            { name: 'Healer', stats: this.generateStartingStats(), special: 'Heal' }
        ];

        characters.forEach((char, index) => {
            const x = 200 + (index % 2) * 400;
            const y = 200 + Math.floor(index / 2) * 200;

            const charSprite = this.add.image(x, y - 50, char.name.toLowerCase()).setScale(0.5);
            
            const charButton = this.add.text(x, y + 50, char.name, {
                font: '24px Arial',
                fill: '#ffffff'
            }).setOrigin(0.5).setInteractive();

            const charInfo = this.add.text(x, y + 80, 
                `ATK: ${char.stats.atk} DEF: ${char.stats.def}\n` +
                `AGL: ${char.stats.agl} HP: ${char.stats.hp}\n` +
                `Special: ${char.special}`, {
                font: '16px Arial',
                fill: '#cccccc',
                align: 'center'
            }).setOrigin(0.5);

            charButton.on('pointerdown', () => this.selectCharacter(char, charSprite));
        });

        this.startButton = this.add.text(400, 500, 'Start Adventure', {
            font: '24px Arial',
            fill: '#ffffff'
        }).setOrigin(0.5).setInteractive();

        this.startButton.on('pointerdown', () => this.startAdventure());

        this.selectedText = this.add.text(400, 550, 'Selected: 0/4', {
            font: '20px Arial',
            fill: '#ffffff'
        }).setOrigin(0.5);
    }

    generateStartingStats() {
        let remainingPoints = 6; // 10 total points, but 4 are used for the base 1 in each stat
        let stats = { atk: 1, def: 1, agl: 1, hp: 1 };
        const statKeys = ['atk', 'def', 'agl', 'hp'];

        while (remainingPoints > 0) {
            const randomStat = Phaser.Math.RND.pick(statKeys);
            stats[randomStat]++;
            remainingPoints--;
        }

        return new CharacterStats(stats.atk, stats.def, stats.agl, stats.hp);
    }

    selectCharacter(character, sprite) {
        console.log('Selecting character:', character.name);
        if (this.selectedCharacters.length < 4 && !this.selectedCharacters.includes(character)) {
            this.selectedCharacters.push(character);
            sprite.setTint(0x00ff00);
        } else if (this.selectedCharacters.includes(character)) {
            this.selectedCharacters = this.selectedCharacters.filter(c => c !== character);
            sprite.clearTint();
        } else {
            console.log('Party is full');
        }
        this.updateSelectedText();
    }

    updateSelectedText() {
        this.selectedText.setText(`Selected: ${this.selectedCharacters.length}/4`);
        this.startButton.setColor(this.selectedCharacters.length === 4 ? '#00ff00' : '#ffffff');
    }

    startAdventure() {
        if (this.selectedCharacters.length === 4) {
            console.log('Starting adventure with party:', this.selectedCharacters);
            gameState.initializeParty(this.selectedCharacters);
            this.scene.start('DungeonScene');
        } else {
            console.log('Please select 4 characters');
        }
    }
}
