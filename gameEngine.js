/**
 * USA Political TCG - Turn-Based Core Logic
 * Handles the flow of a match between two states.
 */

const fs = require('fs');
const masterData = JSON.parse(fs.readFileSync('political_tcg_master.json', 'utf8'));

class PoliticalTCG {
    constructor(player1State, player2State) {
        this.players = [
            this.initializePlayer(player1State, "Player 1"),
            this.initializePlayer(player2State, "Player 2")
        ];
        this.activePlayerIndex = 0; // 0 or 1
        this.turnNumber = 1;
        this.phase = "START"; // START, DRAW, MAIN, END
        this.gameOver = false;
        this.winner = null;
    }

    initializePlayer(stateCode, displayName) {
        const stateInfo = masterData.states[stateCode];
        if (!stateInfo) throw new Error(`State ${stateCode} not found.`);

        return {
            name: displayName,
            state: stateCode,
            ev: stateInfo.electoralVotes,
            support: 0,        // Game "HP"
            capital: 5,        // "Mana"
            deck: [...stateInfo.cards].sort(() => Math.random() - 0.5),
            hand: [],
            activeFactions: [], // Permanent buffs
            modifiers: {
                costReduction: 0,
                supportMultiplier: 1
            },
            status: {
                isSkipped: false,
                isProtected: false
            }
        };
    }

    // --- Core Phases ---

    startTurn() {
        const p = this.players[this.activePlayerIndex];
        console.log(`\n--- Turn ${this.turnNumber}: ${p.name} (${p.state}) ---`);

        if (p.status.isSkipped) {
            console.log(`${p.name}'s turn is skipped!`);
            p.status.isSkipped = false;
            return this.endTurn();
        }

        this.phase = "DRAW";
        this.drawCard(p, 1);
        p.capital += 2; // Basic income per turn
        
        this.phase = "MAIN";
    }

    playCard(cardIndex) {
        if (this.phase !== "MAIN") return;
        
        const active = this.players[this.activePlayerIndex];
        const opponent = this.players[1 - this.activePlayerIndex];
        const card = active.hand[cardIndex];

        if (!card) return console.log("Invalid card index.");
        if (active.capital < card.cost) return console.log("Insufficient Capital!");

        // 1. Pay Cost
        active.capital -= Math.max(0, card.cost - active.modifiers.costReduction);
        
        // 2. Resolve Effect
        this.resolveEffect(card, active, opponent);

        // 3. Move to discard (removing from hand)
        active.hand.splice(cardIndex, 1);
        
        console.log(`${active.name} played: ${card.name}`);
        this.checkWinCondition();
    }

    endTurn() {
        this.phase = "END";
        this.activePlayerIndex = 1 - this.activePlayerIndex;
        if (this.activePlayerIndex === 0) this.turnNumber++;
        this.startTurn();
    }

    // --- Helper Logic ---

    drawCard(player, count) {
        for (let i = 0; i < count; i++) {
            if (player.deck.length > 0) {
                player.hand.push(player.deck.pop());
            }
        }
    }

    /**
     * Effect Parser
     * Uses the "Effect" strings from your Excel to update game numbers.
     */
    resolveEffect(card, active, opponent) {
        const text = card.effect;

        // Regex Patterns for common effects in your data
        const gainSupp = text.match(/Gain \+(\d+) Support/i);
        const gainCap = text.match(/Gain \+(\d+) Capital/i);
        const drainSupp = text.match(/Drain (\d+) Support/i);
        const drainCap = text.match(/Drain (\d+) Capital/i);
        const skipNext = text.match(/Opponent skips/i);
        const doubleSupp = text.match(/Double your Support/i);

        if (gainSupp) active.support += parseInt(gainSupp[1]) * active.modifiers.supportMultiplier;
        if (gainCap) active.capital += parseInt(gainCap[1]);
        if (drainSupp && !opponent.status.isProtected) {
            opponent.support = Math.max(0, opponent.support - parseInt(drainSupp[1]));
        }
        if (drainCap) opponent.capital = Math.max(0, opponent.capital - parseInt(drainCap[1]));
        if (skipNext) opponent.status.isSkipped = true;
        
        // Logic for "Ultimate Buff"
        if (doubleSupp) active.modifiers.supportMultiplier = 2;
    }

    checkWinCondition() {
        this.players.forEach(p => {
            if (p.support >= 50) {
                this.gameOver = true;
                this.winner = p;
                console.log(`\nWINNER: ${p.name} has secured the State of ${p.state}!`);
            }
        });
    }
}

// Example Run: 11TN vs 3WY
const game = new PoliticalTCG("TN", "WY");
game.startTurn();
game.playCard(0); // Plays first card in hand
game.endTurn();