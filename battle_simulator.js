/**
 * USA Political TCG - Battle Simulator
 * Tests game balance between two state decks.
 */

const fs = require('fs');

// Load the master data we generated
const data = JSON.parse(fs.readFileSync('political_tcg_master.json', 'utf8'));

class Player {
    constructor(stateCode) {
        const stateData = data.states[stateCode];
        this.state = stateCode;
        this.deck = [...stateData.cards];
        this.hand = [];
        this.support = 0;
        this.capital = 5;
        this.activeBuffs = [];
        this.skipTurn = false;
        
        // Initial Draw
        this.draw(5);
    }

    draw(count = 1) {
        for(let i=0; i<count; i++) {
            if(this.deck.length > 0) {
                const idx = Math.floor(Math.random() * this.deck.length);
                this.hand.push(this.deck.splice(idx, 1)[0]);
            }
        }
    }

    // A simple regex-based effect parser for testing
    parseEffect(effectText, opponent) {
        const gainSupport = effectText.match(/Gain \+(\d+) Support/i);
        const gainCapital = effectText.match(/Gain \+(\d+) Capital/i);
        const drainSupport = effectText.match(/Drain (\d+) Support/i);
        const drainCapital = effectText.match(/Drain (\d+) Capital/i);
        const skipOpponent = effectText.match(/Opponent skips/i);

        if (gainSupport) this.support += parseInt(gainSupport[1]);
        if (gainCapital) this.capital += parseInt(gainCapital[1]);
        if (drainSupport) opponent.support = Math.max(0, opponent.support - parseInt(drainSupport[1]));
        if (drainCapital) opponent.capital = Math.max(0, opponent.capital - parseInt(drainCapital[1]));
        if (skipOpponent) opponent.skipTurn = true;
    }
}

function simulateMatch(code1, code2) {
    let p1 = new Player(code1);
    let p2 = new Player(code2);
    let rounds = 0;

    console.log(`--- MATCH START: ${code1} vs ${code2} ---`);

    while (p1.support < 50 && p2.support < 50 && rounds < 20) {
        rounds++;
        
        [p1, p2].forEach((active, i) => {
            let passive = i === 0 ? p2 : p1;
            
            if (active.skipTurn) {
                active.skipTurn = false;
                return;
            }

            // Start of Turn
            active.draw();
            active.capital += 2;

            // Simple AI: Play the most expensive card we can afford
            active.hand.sort((a, b) => b.cost - a.cost);
            let played = active.hand.find(c => c.cost <= active.capital);

            if (played) {
                active.capital -= played.cost;
                active.parseEffect(played.effect, passive);
                active.hand = active.hand.filter(c => c !== played);
            }
        });
    }

    console.log(`Match ended in ${rounds} rounds.`);
    console.log(`${code1}: ${p1.support} Support | ${code2}: ${p2.support} Support`);
    return p1.support >= 50 ? code1 : code2;
}

// Example: Simulating California vs. Texas
const winner = simulateMatch('CA', 'TX');
console.log(`Winner: ${winner}`);