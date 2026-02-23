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
        document.getElementById('atb-gauge').style.width = `${me.atb}%`;
        renderHand(me.hand);
    }
    const oppId = Object.keys(state.players).find(id => id !== network.socket.id);
    if (oppId) {
        const opp = state.players[oppId];
        document.getElementById('display-opp-points').innerText = opp.points;
        document.getElementById('opp-atb-gauge').style.width = `${opp.atb}%`;
    }
};

network.onSystemMessage = (msg) => {
    addLogEntry('System', msg, 'text-slate-400 italic');
};

network.onSpeechGenerated = (payload) => {
    const isPlayer = !payload.isAI;
    const bubbleClass = isPlayer ? 'bubble-right bg-blue-700 text-white ml-auto' : 'bubble-left bg-red-800 text-white mr-auto';
    const sideClass = isPlayer ? 'text-right' : 'text-left';

    const content = `
        <div class="flex flex-col ${isPlayer ? 'items-end' : 'items-start'} mb-4">
            <span class="text-[10px] font-black uppercase tracking-tighter opacity-50 mb-1 px-2">${payload.speakerName} played ${payload.cardName}</span>
            <div class="bubble ${bubbleClass} px-6 py-4 rounded-3xl shadow-2xl relative">
                <div class="text-xl font-serif italic leading-tight">"${payload.speechText}"</div>
                <!-- Speech Bubble Tail -->
                <div class="absolute bottom-0 ${isPlayer ? '-right-1 border-l-blue-700' : '-left-1 border-r-red-800'} w-0 h-0 border-[10px] border-transparent border-t-blue-700"></div>
            </div>
        </div>
    `;
    addLogEntry(null, content, 'w-full');
};

function addLogEntry(label, content, className) {
    const log = document.getElementById('speech-log');
    const entry = document.createElement('div');
    entry.className = className;
    if (label === 'System') {
        entry.innerHTML = `<div class="text-center my-4"><span class="bg-slate-800 text-slate-400 text-[10px] uppercase font-bold px-4 py-1 rounded-full">${content}</span></div>`;
    } else {
        entry.innerHTML = content;
    }
    log.appendChild(entry);

    // Smooth auto-scroll
    log.scrollTo({
        top: log.scrollHeight,
        behavior: 'smooth'
    });
}

function renderHand(hand) {
    const container = document.getElementById('player-hand');
    container.innerHTML = '';
    hand.forEach(card => {
        const el = document.createElement('div');
        el.className = 'tcg-card w-52 h-60 rounded-2xl p-4 flex flex-col cursor-pointer shrink-0 border-4 border-slate-200';

        // Dynamic color based on type
        const typeColor = card.type.includes('Attack') ? 'text-red-600' : (card.type.includes('Character') ? 'text-emerald-600' : 'text-blue-600');

        el.innerHTML = `
            <div class="flex justify-between items-start mb-1">
                <span class="text-[10px] font-black uppercase leading-none truncate pr-1">${card.name}</span>
                <div class="card-energy shrink-0 w-5 h-5 text-[10px]">${card.cost}</div>
            </div>
            
            <div class="flex-grow bg-slate-50 rounded-lg p-2 mb-1 flex items-center justify-center text-center overflow-hidden">
                <div class="text-[9px] font-bold text-slate-700 leading-tight">${card.effect}</div>
            </div>
            
            <div class="text-[8px] font-black uppercase tracking-widest ${typeColor} mb-1">${card.type}</div>
            
            <div class="mt-auto pt-1 border-t border-slate-200">
                <div class="text-[8px] text-slate-400 italic font-medium leading-snug">"${card.flavorText}"</div>
            </div>
        `;
        el.onclick = () => {
            el.classList.add('scale-90', 'rotate-2');
            setTimeout(() => network.playCard(card.instanceId, card.type, card.name, card.cost), 150);
        };
        container.appendChild(el);
    });
}

document.getElementById('join-btn').onclick = () => {
    const name = document.getElementById('player-name').value;
    const room = document.getElementById('room-id').value;
    if (name && room) network.joinRoom(room, name, "CA");
};

document.getElementById('join-ai-btn').onclick = () => {
    const name = document.getElementById('player-name').value;
    const room = document.getElementById('room-id').value;
    if (name && room) network.joinAIRoom(room, name, "CA");
};

document.getElementById('draw-btn').onclick = () => {
    network.drawCard();
};

const fundBtn = document.getElementById('fundraise-btn');
if (fundBtn) {
    fundBtn.onclick = () => {
        // Immediate visual feedback
        fundBtn.classList.add('scale-95', 'opacity-50');
        setTimeout(() => fundBtn.classList.remove('scale-95', 'opacity-50'), 100);
        network.fundraise();
    };
}
