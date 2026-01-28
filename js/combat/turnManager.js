export class TurnManager {
    constructor() {
        this.queue = [];
        this.currentTurnIndex = 0;
        this.round = 1;
    }

    startCombat(participants) {
        // Sort by Initiative (Descending)
        // If tie, random or Player first
        this.queue = participants.sort((a, b) => {
            const initA = a.stats.derived.initiative + (Math.random() * 0.5); // Add jitter to break ties
            const initB = b.stats.derived.initiative + (Math.random() * 0.5);
            return initB - initA;
        });

        this.currentTurnIndex = 0;
        this.round = 1;
        console.log("Turn Order:", this.queue.map(e => e.name || e.type));
    }

    getCurrentActor() {
        return this.queue[this.currentTurnIndex];
    }

    nextTurn() {
        this.currentTurnIndex++;
        if (this.currentTurnIndex >= this.queue.length) {
            this.currentTurnIndex = 0;
            this.round++;
            console.log(`--- Round ${this.round} ---`);
        }
        return this.getCurrentActor();
    }

    removeParticipant(entity) {
        this.queue = this.queue.filter(e => e !== entity);
        // Adjust index if needed
        if (this.currentTurnIndex >= this.queue.length) {
            this.currentTurnIndex = 0;
        }
    }
}
