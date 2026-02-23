import { NetworkClient } from './network.js';
import { GameUI } from './ui.js';

const network = new NetworkClient(window.location.origin);
const ui = new GameUI();

network.onStateUpdate = (state) => {
    ui.showGameScreen(network.roomId);
    const me = state.players[network.socket.id];
    if (me) {
        document.getElementById('display-my-points').innerText = me.points;
        document.getElementById('display-capital').innerText = me.politicalCapital;
        renderHand(me.hand);
    }
    const oppId = Object.keys(state.players).find(id => id !== network.socket.id);
    if (oppId) document.getElementById('display-opp-points').innerText = state.players[oppId].points;
};

function renderHand(hand) {
    const container = document.getElementById('player-hand');
    container.innerHTML = '';
    hand.forEach(card => {
        const el = document.createElement('div');
        el.className = 'w-48 h-64 bg-white text-black rounded-lg p-3 flex flex-col border-4 border-slate-300 cursor-pointer shadow-lg hover:-translate-y-2 transition-transform';
        el.innerHTML = `
            <div class="flex justify-between font-bold border-b pb-1 mb-2">
                <span class="text-[10px] uppercase truncate">${card.name}</span>
                <span class="bg-black text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px]">${card.cost}</span>
            </div>
            <div class="flex-grow text-[11px] font-bold">${card.effect}</div>
            <div class="text-[8px] text-slate-400 italic">"${card.flavorText}"</div>
        `;
        el.onclick = () => network.playCard(card.instanceId, card.type, card.name, card.cost);
        container.appendChild(el);
    });
}

document.getElementById('join-btn').onclick = () => {
    const name = document.getElementById('player-name').value;
    const room = document.getElementById('room-id').value;
    if (name && room) network.joinRoom(room, name, "54CA"); // Default to CA for testing
};

document.getElementById('join-ai-btn').onclick = () => {
    const name = document.getElementById('player-name').value;
    const room = document.getElementById('room-id').value;
    if (name && room) network.joinAIRoom(room, name, "54CA");
};

document.getElementById('draw-btn').onclick = () => network.drawCard();