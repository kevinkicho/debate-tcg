export class DeckBuilder {
    constructor(onDeckSaved) {
        this.onDeckSaved = onDeckSaved;
        this.deckLimit = 20;
        this.currentDeck = [];
        
        // DOM Elements
        this.screen = document.getElementById('deck-builder-screen');
        this.libraryGrid = document.getElementById('library-grid');
        this.deckList = document.getElementById('deck-list');
        this.deckCountDisplay = document.getElementById('deck-count');
        this.saveBtn = document.getElementById('save-deck-btn');

        // The Full 50-Card Database
        this.availableCards = [
            { id: 'c1', name: 'Born Again Christian', type: 'Character Trait', cost: 0 },
            { id: 'c2', name: 'Orator', type: 'Character Trait', cost: 0 },
            { id: 'c3', name: 'Prince Charming', type: 'Character Trait', cost: 0 },
            { id: 'c4', name: 'Deer Hunter', type: 'Constituency Buff', cost: 2 },
            { id: 'c5', name: 'Fair Fairy', type: 'Constituency Buff', cost: 2 },
            { id: 'c6', name: 'Detail Oriented', type: 'Save/Counter', cost: 1 },
            { id: 'c7', name: 'The Gaffe', type: 'Trap Card', cost: 3 },
            { id: 'c8', name: 'The Filibuster', type: 'Heavy Attack', cost: 5 },
            { id: 'c9', name: 'Ad Hominem', type: 'Dirty Tactic', cost: 2 },
            { id: 'c10', name: 'The Pivot', type: 'Board Control', cost: 4 },
            { id: 'c11', name: 'Straw Man', type: 'Argument Debuff', cost: 2 },
            { id: 'c12', name: 'Empty Promise', type: 'High-Risk Action', cost: 1 },
            { id: 'c13', name: 'Moral High Ground', type: 'Defensive Stance', cost: 3 },
            { id: 'c14', name: 'Dog Whistle', type: 'Stealth Attack', cost: 2 },
            { id: 'c15', name: 'Mic Drop', type: 'Round Ender', cost: 5 },
            { id: 'c16', name: 'Smoke-Filled Room', type: 'Hand Manipulation', cost: 2 },
            { id: 'c17', name: 'The Quid Pro Quo', type: 'Coercion', cost: 3 },
            { id: 'c18', name: 'Lobbyist Lunch', type: 'Resource Gen', cost: 0 },
            { id: 'c19', name: 'The Leak', type: 'Information War', cost: 2 },
            { id: 'c20', name: 'Gerrymander', type: 'Board Manipulation', cost: 4 },
            { id: 'c21', name: 'County Vote Center Clerk', type: 'Save Card', cost: 1 },
            { id: 'c22', name: 'Town Hall Heckler', type: 'Public Challenge', cost: 0 },
            { id: 'c23', name: 'Viral Clip', type: 'Chaotic Event', cost: 0 },
            { id: 'c24', name: 'The Apology Tour', type: 'Damage Control', cost: 3 },
            { id: 'c25', name: 'Flashcard Prep', type: 'Debate Prep', cost: 1 },
            { id: 'c26', name: 'NIMBY', type: 'Local Blockade', cost: 2 },
            { id: 'c27', name: 'Grassroots Activist', type: 'Momentum Builder', cost: 1 },
            { id: 'c28', name: 'Union Boss', type: 'Organized Support', cost: 3 },
            { id: 'c29', name: 'Silicon Valley Donor', type: 'Tech Advantage', cost: 4 },
            { id: 'c30', name: 'The Swing State', type: 'Volatile Base', cost: 3 },
            { id: 'c31', name: 'The Ivy Leaguer', type: 'Character Trait', cost: 0 },
            { id: 'c32', name: 'Blue Collar Hero', type: 'Character Trait', cost: 0 },
            { id: 'c33', name: 'The Silver Fox', type: 'Character Trait', cost: 0 },
            { id: 'c34', name: 'The Scion', type: 'Character Trait', cost: 0 },
            { id: 'c35', name: 'War Hero', type: 'Character Trait', cost: 0 },
            { id: 'c36', name: 'The Firebrand', type: 'Character Trait', cost: 0 },
            { id: 'c37', name: 'Soccer Mom/Dad', type: 'Character Trait', cost: 0 },
            { id: 'c38', name: 'The Technocrat', type: 'Character Trait', cost: 0 },
            { id: 'c39', name: 'Rust Belt Gritty', type: 'Constituency Buff', cost: 2 },
            { id: 'c40', name: 'Wall Street Titan', type: 'Constituency Buff', cost: 3 },
            { id: 'c41', name: 'The Silent Majority', type: 'Constituency Buff', cost: 0 },
            { id: 'c42', name: 'Deep State', type: 'Constituency Buff', cost: 4 },
            { id: 'c43', name: 'The Incumbent', type: 'Constituency Buff', cost: 5 },
            { id: 'c44', name: 'Photo Op', type: 'Public Image Event', cost: 1 },
            { id: 'c45', name: 'The Late Night Appearance', type: 'Public Image Event', cost: 2 },
            { id: 'c46', name: 'Scandal in the Suburbs', type: 'Public Image Event', cost: 3 },
            { id: 'c47', name: 'Editorial Endorsement', type: 'Public Image Event', cost: 2 },
            { id: 'c48', name: 'Fake News Flare-up', type: 'Public Image Event', cost: 2 },
            { id: 'c49', name: 'Bipartisan Handshake', type: 'Public Image Event', cost: 3 },
            { id: 'c50', name: 'The Hot Mic Moment', type: 'Public Image Event', cost: 4 }
        ];

        this.init();
    }

    init() {
        this.renderLibrary();
        
        this.saveBtn.addEventListener('click', () => {
            if (this.currentDeck.length === this.deckLimit) {
                this.screen.classList.add('hidden');
                this.onDeckSaved(this.currentDeck);
            }
        });
    }

    renderLibrary() {
        this.libraryGrid.innerHTML = '';
        this.availableCards.forEach(card => {
            const cardEl = document.createElement('div');
            cardEl.className = 'draft-card';
            
            // Color code the UI slightly based on card type to make it visually pop
            let typeColor = "#7f8c8d";
            if(card.type.includes('Trait')) typeColor = "#8e44ad";
            if(card.type.includes('Attack')) typeColor = "#e74c3c";
            if(card.type.includes('Buff')) typeColor = "#27ae60";
            if(card.type.includes('Event')) typeColor = "#f39c12";

            cardEl.innerHTML = `
                <strong style="display:block; margin-bottom: 5px;">${card.name}</strong>
                <span style="background: ${typeColor}; color: white; padding: 2px 5px; border-radius: 3px; font-size: 11px;">${card.type}</span><br>
                <div style="margin-top: 8px; font-weight: bold;">Cost: ${card.cost}</div>
            `;
            cardEl.addEventListener('click', () => this.addToDeck(card));
            this.libraryGrid.appendChild(cardEl);
        });
    }

    addToDeck(card) {
        if (this.currentDeck.length < this.deckLimit) {
            this.currentDeck.push({ ...card, instanceId: Date.now() + Math.random() });
            this.updateDeckView();
        } else {
            alert('Your deck is already full! Remove a card first.');
        }
    }

    removeFromDeck(instanceId) {
        this.currentDeck = this.currentDeck.filter(c => c.instanceId !== instanceId);
        this.updateDeckView();
    }

    updateDeckView() {
        this.deckCountDisplay.innerText = this.currentDeck.length;
        this.deckList.innerHTML = '';

        this.currentDeck.forEach(card => {
            const itemEl = document.createElement('div');
            itemEl.className = 'deck-list-item';
            itemEl.innerHTML = `<span>${card.name}</span> <strong>[${card.cost}]</strong>`;
            
            itemEl.addEventListener('click', () => this.removeFromDeck(card.instanceId));
            this.deckList.appendChild(itemEl);
        });

        this.saveBtn.disabled = this.currentDeck.length !== this.deckLimit;
    }
}