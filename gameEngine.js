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
        this.swingStates = {};
        this.filibusterTimer = { maxTurns: 30, turnCount: 0 };
    }

    initializePlayer(stateCode, displayName) {
        const stateInfo = masterData.states[stateCode];
        if (!stateInfo) throw new Error(`State ${stateCode} not found.`);

        return {
            name: displayName,
            state: stateCode,
            ev: stateInfo.electoralVotes,
            support: 0,
            capital: 5,
            deck: [...stateInfo.cards].sort(() => Math.random() - 0.5),
            hand: [],
            activeFactions: [],
            modifiers: {
                costReduction: 0,
                supportMultiplier: 1
            },
            status: {
                isSkipped: false,
                isProtected: false
            },
            deckOut: false
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
        let drawn = 0;
        for (let i = 0; i < count; i++) {
            if (player.deck.length > 0) {
                player.hand.push(player.deck.pop());
                drawn++;
            } else {
                player.deckOut = true;
            }
        }
        return drawn;
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
        // 1. 50-Support victory (existing)
        for (const p of this.players) {
            if (p.support >= 50) {
                this.gameOver = true;
                this.winner = p;
                console.log(`\nWINNER: ${p.name} wins by SUPPORT (${p.support})!`);
                return;
            }
        }

        // 2. Deck-out: opponent has no deck and no hand
        for (const p of this.players) {
            if (p.deckOut || (p.deck.length === 0 && p.hand.length === 0)) {
                const opponent = this.players.find(o => o !== p);
                this.gameOver = true;
                this.winner = opponent;
                console.log(`\nWINNER: ${opponent.name} wins by DECK-OUT (${p.name} exhausted)!`);
                return;
            }
        }

        // 3. Electoral-college majority
        const p1EV = Object.values(this.swingStates).filter(v => v === this.players[0]).length;
        const p2EV = Object.values(this.swingStates).filter(v => v === this.players[1]).length;
        const totalEV = p1EV + p2EV;
        if (totalEV > 0) {
            const majority = Math.ceil(totalEV / 2);
            if (p1EV >= majority && p1EV > p2EV) {
                this.gameOver = true;
                this.winner = this.players[0];
                console.log(`\nWINNER: ${this.players[0].name} wins by ELECTORAL COLLEGE (${p1EV} EV)!`);
                return;
            }
            if (p2EV >= majority && p2EV > p1EV) {
                this.gameOver = true;
                this.winner = this.players[1];
                console.log(`\nWINNER: ${this.players[1].name} wins by ELECTORAL COLLEGE (${p2EV} EV)!`);
                return;
            }
        }

        // 4. Filibuster timeout
        this.filibusterTimer.turnCount++;
        if (this.filibusterTimer.turnCount >= this.filibusterTimer.maxTurns) {
            const p1s = this.players[0].support;
            const p2s = this.players[1].support;
            this.gameOver = true;
            if (p1s > p2s) {
                this.winner = this.players[0];
            } else if (p2s > p1s) {
                this.winner = this.players[1];
            } else {
                this.winner = null;
            }
            console.log(`\nFILIBUSTER TIMEOUT after ${this.filibusterTimer.turnCount} turns! ${this.winner ? this.winner.name + ' wins!' : 'TIE!'}`);
        }
    }
}

// Example Run: 11TN vs 3WY
const game = new PoliticalTCG("TN", "WY");
game.startTurn();
game.playCard(0); // Plays first card in hand
game.endTurn();