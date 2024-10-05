class GameState {
    constructor() {
        this.party = null;
        this.currentFloor = 1;
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
    }
}

const gameState = new GameState();