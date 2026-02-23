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

        // Mock Card Database (You will expand this with your 50+ cards)
        this.availableCards = [
            { id: 'c1', name: 'Slippery Slope', type: 'Attack', cost: 2 },
            { id: 'c2', name: 'Defense Mechanism', type: 'Defense', cost: 2 },
            { id: 'c3', name: 'The Filibuster', type: 'Ultimate', cost: 5 },
            { id: 'c4', name: 'Gaffe Trap', type: 'Trap', cost: 3 },
            { id: 'c5', name: 'Pork Barrel', type: 'Action', cost: 4 },
            { id: 'c6', name: 'Grassroots Rally', type: 'Buff', cost: 1 },
            { id: 'c7', name: 'Ad Hominem', type: 'Attack', cost: 3 },
            { id: 'c8', name: 'Empty Promise', type: 'Action', cost: 1 }
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
            cardEl.innerHTML = `
                <strong>${card.name}</strong><br>
                <small>${card.type}</small><br>
                Cost: ${card.cost}
            `;
            cardEl.addEventListener('click', () => this.addToDeck(card));
            this.libraryGrid.appendChild(cardEl);
        });
    }

    addToDeck(card) {
        if (this.currentDeck.length < this.deckLimit) {
            // Push a clone so we can have multiples of the same card if desired
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
            itemEl.innerHTML = `<span>${card.name}</span> <span>[${card.cost}]</span>`;
            
            itemEl.addEventListener('click', () => this.removeFromDeck(card.instanceId));
            this.deckList.appendChild(itemEl);
        });

        // Enable save button only if exactly 20 cards are chosen
        this.saveBtn.disabled = this.currentDeck.length !== this.deckLimit;
    }
}