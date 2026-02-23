import { NetworkClient } from './network.js';
import { GameUI } from './ui.js';
import { QuizUI } from './quizUI.js';
import { DeckBuilder } from './deckBuilder.js';

const SERVER_URL = 'http://localhost:3000';

const network = new NetworkClient(SERVER_URL);
const ui = new GameUI();
let draftDeck = []; 

const builder = new DeckBuilder((savedDeck) => {
    draftDeck = savedDeck;
    document.getElementById('lobby-screen').classList.remove('hidden');
});

const quizEngine = new QuizUI((playerAnswer) => {
    network.submitQuizAnswer(playerAnswer);
});

// Network Event: Update UI state
network.onStateUpdate = (roomState) => {
    ui.showGameScreen(network.roomId);
    ui.updateGameState(roomState, network.socket.id);
    
    // Fetch the active player's data from the server state
    const myPlayerData = roomState.players[network.socket.id];
    
    if (myPlayerData && roomState.status === 'active') {
        // Render the exact hand the server dealt us
        renderHandToBoard(myPlayerData.hand);
        
        // Optional: Update a label showing how many cards are left in the deck
        document.getElementById('cards-left-label').innerText = `Deck: ${myPlayerData.deck.length}`;
    }
};

network.onActionMessage = (message) => {
    ui.showMessage(message);
};

network.onQuizRequired = (quizData) => {
    quizEngine.renderQuiz(quizData);
};

// Lobby Event: Join the Server
document.getElementById('join-btn').addEventListener('click', () => {
    const playerName = document.getElementById('player-name').value;
    const roomId = document.getElementById('room-id').value;
    
    if (playerName && roomId) {
        network.joinRoom(roomId, playerName, draftDeck);
    } else {
        alert("Please enter both a name and a room ID.");
    }
});

// NEW: Request a card draw
document.getElementById('draw-btn').addEventListener('click', () => {
    network.drawCard();
});

// Helper Function: Dynamically render the server-verified hand
function renderHandToBoard(currentHandArray) {
    const handContainer = document.getElementById('player-hand');
    handContainer.innerHTML = ''; 

    currentHandArray.forEach(card => {
        const btn = document.createElement('button');
        btn.className = 'card-btn';
        
        // Use the unique instanceId so the server knows exactly which copy of a card was played
        btn.setAttribute('data-instance-id', card.instanceId); 
        btn.setAttribute('data-type', card.type);
        btn.setAttribute('data-cost', card.cost);
        btn.innerText = `Play "${card.name}" (Cost: ${card.cost})`;
        
        handContainer.appendChild(btn);
    });
}

// Game Event: Click a card in your hand to play it
document.getElementById('player-hand').addEventListener('click', (e) => {
    if (e.target.classList.contains('card-btn')) {
        const instanceId = e.target.getAttribute('data-instance-id'); // Use instanceId
        const cardType = e.target.getAttribute('data-type');
        const cost = parseInt(e.target.getAttribute('data-cost'), 10);
        
        network.playCard(instanceId, cardType, cost);
    }
});