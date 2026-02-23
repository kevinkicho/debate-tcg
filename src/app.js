import { NetworkClient } from './network.js';
import { GameUI } from './ui.js';
import { DeckBuilder } from './deckBuilder.js';

const SERVER_URL = 'http://localhost:3000';

const network = new NetworkClient(SERVER_URL);
const ui = new GameUI();
let draftDeck = []; 

const builder = new DeckBuilder((savedDeck) => {
    draftDeck = savedDeck;
    document.getElementById('lobby-screen').classList.remove('hidden');
});

network.onStateUpdate = (roomState) => {
    ui.showGameScreen(network.roomId);
    
    // Update Scoreboard
    const myPlayerData = roomState.players[network.socket.id];
    if (myPlayerData) {
        document.getElementById('display-my-points').innerText = myPlayerData.points;
        document.getElementById('display-capital').innerText = myPlayerData.politicalCapital;
        document.getElementById('cards-left-label').innerText = `Deck: ${myPlayerData.deck.length}`;
        
        if (roomState.status === 'active') {
            renderHandToBoard(myPlayerData.hand);
        }
    }

    // Find Opponent Score
    const opponentId = Object.keys(roomState.players).find(id => id !== network.socket.id);
    if (opponentId) {
        document.getElementById('display-opp-points').innerText = roomState.players[opponentId].points;
    }

    if (roomState.status === 'waiting') {
        document.getElementById('lobby-message').innerText = 'Waiting for opponent to join...';
        document.getElementById('lobby-message').classList.remove('hidden');
    } else {
        document.getElementById('lobby-message').classList.add('hidden');
    }
};

// Listeners for the AI Event System
network.socket.on('speech_generated', (payload) => {
    const log = document.getElementById('speech-log');
    // Remove the "Awaiting arguments" placeholder
    if(log.innerHTML.includes('Awaiting opening arguments')) log.innerHTML = '';

    const align = payload.isAI ? 'flex-start' : 'flex-end';
    const bgColor = payload.isAI ? '#ecf0f1' : '#dff9fb';
    const border = payload.isAI ? '1px solid #bdc3c7' : '1px solid #7ed6df';

    const bubble = document.createElement('div');
    bubble.style.alignSelf = align;
    bubble.style.background = bgColor;
    bubble.style.border = border;
    bubble.style.padding = '10px 15px';
    bubble.style.borderRadius = '8px';
    bubble.style.maxWidth = '80%';

    bubble.innerHTML = `
        <small style="color: #7f8c8d; display: block; margin-bottom: 5px;">
            <strong>${payload.speakerName}</strong> used [${payload.cardName}]
        </small>
        <span style="font-size: 16px;">"${payload.speechText}"</span>
    `;
    
    log.appendChild(bubble);
    log.scrollTop = log.scrollHeight; // Auto-scroll to bottom
});

network.socket.on('system_message', (payload) => {
    document.getElementById('system-message').innerText = payload.message;
});

network.socket.on('game_over', (payload) => {
    alert(`GAME OVER! ${payload.winner} has reached 50 points and won the debate!`);
});

network.socket.on('play_error', (payload) => {
    alert(payload.message);
});

// Lobby Buttons
document.getElementById('join-btn').addEventListener('click', () => {
    const playerName = document.getElementById('player-name').value;
    const roomId = document.getElementById('room-id').value;
    if (playerName && roomId) network.joinRoom(roomId, playerName, draftDeck);
});

// NEW: Play against AI
document.getElementById('join-ai-btn').addEventListener('click', () => {
    const playerName = document.getElementById('player-name').value;
    const roomId = document.getElementById('room-id').value;
    if (playerName && roomId) {
        network.socket.emit('join_ai_room', { roomId, playerName, deckData: draftDeck });
    }
});

document.getElementById('draw-btn').addEventListener('click', () => {
    network.drawCard();
});

function renderHandToBoard(currentHandArray) {
    const handContainer = document.getElementById('player-hand');
    handContainer.innerHTML = ''; 

    currentHandArray.forEach(card => {
        const btn = document.createElement('button');
        btn.className = 'card-btn';
        
        btn.setAttribute('data-instance-id', card.instanceId); 
        btn.setAttribute('data-type', card.type);
        btn.setAttribute('data-cost', card.cost);
        btn.setAttribute('data-name', card.name); // Need name for AI generation
        btn.innerText = `Play "${card.name}" (Cost: ${card.cost})`;
        
        handContainer.appendChild(btn);
    });
}

document.getElementById('player-hand').addEventListener('click', (e) => {
    if (e.target.classList.contains('card-btn')) {
        const instanceId = e.target.getAttribute('data-instance-id'); 
        const cardType = e.target.getAttribute('data-type');
        const cardName = e.target.getAttribute('data-name');
        const cost = parseInt(e.target.getAttribute('data-cost'), 10);
        
        network.socket.emit('play_card', {
            roomId: network.roomId,
            instanceId: instanceId,
            cardType: cardType,
            cardName: cardName,
            capitalCost: cost
        });
    }
});