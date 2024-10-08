class GameState {
    constructor() {
        this.party = null;
        this.currentFloor = 1;
        this.bossDefeated = false;
    }

    initializeParty(party) {
        this.party = party.map(char => ({
            ...char,
            maxHealth: char.health,
            currentHealth: char.health
        }));
    }

    updatePartyHealth(updatedParty) {
        this.party = updatedParty.map((char, index) => ({
            ...this.party[index],
            currentHealth: char.health
        }));
    }

    resetGame() {
        this.party = null;
        this.currentFloor = 1;
        this.bossDefeated = false;
    }

    // New method to check if current floor is a boss floor
    isBossFloor() {
        return this.currentFloor % 5 === 0;
    }
}

const gameState = new GameState();