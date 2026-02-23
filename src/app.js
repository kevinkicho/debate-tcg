import { NetworkClient } from './network.js';
import { GameUI } from './ui.js';
import { GameState } from './gameState.js';
import { UIManager } from './ui/UIManager.js';
import { CardRenderer } from './ui/CardRenderer.js';

// Initialization
const network = new NetworkClient(window.location.origin);
const ui = new GameUI();
const uiManager = new UIManager();
const cardRenderer = new CardRenderer(network, uiManager);

// Core Logic Orchestration
network.onStateUpdate = (state) => {
    ui.showGameScreen(network.roomId);

    // 1. Player Data Processing
    const me = state.players[network.socket.id];
    if (me) {
        document.getElementById('display-my-points').innerText = me.points;
        document.getElementById('display-capital').innerText = me.politicalCapital;
        document.getElementById('atb-gauge').style.width = `${me.atb}%`;

        // Capital Gauge Fill
        const capPercentage = Math.min(100, (me.politicalCapital / 30) * 100);
        const capFill = document.getElementById('capital-gauge-fill');
        if (capFill) capFill.style.width = `${capPercentage}%`;

        // Buffs
        cardRenderer.renderBuffs(me.buffs, 'my-buff-hub');

        // Buttons & Status
        const canAct = me.atb >= 100 && !GameState.isDrafting && state.status !== 'paused';
        const drawBtn = document.getElementById('draw-btn');
        const fundBtn = document.getElementById('fundraise-btn');
        if (drawBtn) drawBtn.classList.toggle('btn-charging', !canAct);
        if (fundBtn) fundBtn.classList.toggle('btn-charging', !canAct);

        const myStatusEl = document.getElementById('my-status');
        if (myStatusEl) {
            if (state.status === 'paused') myStatusEl.innerText = "Suspended";
            else if (GameState.isDrafting) myStatusEl.innerText = "Drafting a Pivot...";
            else if (me.atb < 50) myStatusEl.innerText = "Recalibrating...";
            else if (me.atb < 100) myStatusEl.innerText = "Readying Rebuttal...";
            else myStatusEl.innerText = "PRESS TO SPEAK!";
        }

        // Render Hand (Throttled)
        const currentHandHash = me.hand.map(c => c.instanceId).join('|');
        if (currentHandHash !== GameState.lastHandHash && !GameState.isDrafting) {
            cardRenderer.renderHand(me.hand);
            GameState.lastHandHash = currentHandHash;
        }

        // Sync State
        me.hand.forEach(c => GameState.cardCache[c.name] = c);
        GameState.myCurrentAtb = me.atb;
        GameState.isRoomPaused = state.status === 'paused';
    }

    // 2. Opponent Data Processing
    const oppId = Object.keys(state.players).find(id => id !== network.socket.id);
    if (oppId) {
        const opp = state.players[oppId];

        const oppStatusEl = document.getElementById('opp-status');
        if (oppStatusEl) {
            if (state.status === 'paused') oppStatusEl.innerText = "Suspended";
            else if (opp.atb < 100) oppStatusEl.innerText = "Wait for Opening...";
            else oppStatusEl.innerText = "READY TO REBUT!";
        }

        if (opp.hand.length !== GameState.lastOppHandCount) {
            cardRenderer.renderOpponentHand(opp.hand.length);
            GameState.lastOppHandCount = opp.hand.length;
        }

        cardRenderer.renderBuffs(opp.buffs, 'opp-buff-hub');

        if (opp.points > GameState.lastOppPoints && GameState.lastOppPoints > 0) {
            uiManager.triggerImpact(`+${opp.points - GameState.lastOppPoints} SUPPORT`, 'opp');
        }
        GameState.lastOppPoints = opp.points;

        document.getElementById('display-opp-points').innerText = opp.points;
        document.getElementById('opp-atb-gauge').style.width = `${opp.atb}%`;
        document.getElementById('room-id-display').innerText = `HALL: ${network.roomId}`;

        // Momentum Logic
        const myPoints = me ? me.points : 0;
        const total = myPoints + opp.points || 1;
        const momentum = (myPoints / total) * 100;
        const momBar = document.getElementById('momentum-bar');
        if (momBar) {
            momBar.style.width = `${momentum}%`;
            momBar.classList.toggle('momentum-pulse', momentum > 60 || momentum < 40);
        }
    }
};

// Event Handlers
network.onSpeechGenerated = (payload) => {
    const isPlayer = !payload.isAI;
    const bubbleClass = isPlayer ? 'bubble-right' : 'bubble-left';

    if (payload.cardData) GameState.cardCache[payload.cardName] = payload.cardData;

    uiManager.addToHistory(
        `${payload.speakerName} played <b class="card-preview-link cursor-help text-blue-400 underline decoration-dotted" data-card="${payload.cardName}">${payload.cardName}</b>`,
        (name, x, y) => uiManager.showTooltip(name, x, y, (c) => cardRenderer.createCardElement(c)),
        () => uiManager.hideTooltip()
    );

    if (isPlayer) uiManager.triggerReaction('🔥');
    else uiManager.triggerReaction('❄️');

    const content = `
        <div class="flex flex-col ${isPlayer ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-4 duration-500">
            <span class="text-[10px] font-black uppercase opacity-40 mb-2 px-4 flex items-center gap-2">
                <span class="w-2 h-2 rounded-full ${isPlayer ? 'bg-blue-500' : 'bg-red-500'}"></span>
                ${payload.speakerName} • ${payload.cardName}
            </span>
            <div class="bubble ${bubbleClass}">
                <div class="font-serif italic leading-tight">\"${payload.speechText}\"</div>
            </div>
        </div>
    `;
    addLogEntry(null, content);
};

network.socket.on('draft_started', (data) => {
    const overlay = document.getElementById('draft-overlay');
    const choicesContainer = document.getElementById('draft-choices');
    const title = document.getElementById('draft-title');
    if (!overlay || !choicesContainer) return;

    overlay.classList.remove('hidden');
    choicesContainer.innerHTML = '';
    GameState.isDrafting = true;
    GameState.selectedChoices = [];
    GameState.maxPicks = data.pickCount || 1;

    title.innerText = data.roll === 6 ? "JACKPOT! PICK 2" : (data.fatigue > 1 ? "FATIGUED DRAFT" : "DRAFT A POLICY");

    data.options.forEach(card => {
        GameState.cardCache[card.name] = card;
        const cardEl = cardRenderer.createCardElement(card);
        cardEl.classList.add('draft-choice-card');
        cardEl.onclick = () => {
            if (cardEl.classList.contains('opacity-20')) return;
            cardEl.classList.add('opacity-20', 'border-yellow-400', 'scale-90');
            GameState.selectedChoices.push(card.instanceId);
            if (GameState.selectedChoices.length >= GameState.maxPicks) {
                setTimeout(() => {
                    network.socket.emit('select_draft', { cardInstanceIds: GameState.selectedChoices });
                    overlay.classList.add('hidden');
                    GameState.isDrafting = false;
                    setIntent('none');
                    uiManager.triggerReaction('🗳️');
                }, 500);
            }
        };
        choicesContainer.appendChild(cardEl);
    });
});

network.socket.on('rally_result', (data) => {
    uiManager.triggerRallyParticles(data.playerId === network.socket.id ? 'me' : 'opp');
    const speaker = data.playerId === network.socket.id ? 'You' : 'Opponent';
    uiManager.addToHistory(`${speaker} held a massive rally in Iowa!`, () => { }, () => { });
    if (data.playerId === network.socket.id) {
        uiManager.triggerImpact(`+$${data.capital}M CAPITAL!`, 'me');
        setIntent('none');
        uiManager.triggerReaction('💵');
    }
});

// Helper functions (still local for now as they are small orchestrators)
function addLogEntry(label, content, className = '') {
    const log = document.getElementById('speech-log');
    if (!log) return;
    const entry = document.createElement('div');
    if (label === 'System') {
        entry.className = className;
        entry.innerText = content;
    } else {
        entry.innerHTML = content;
        entry.className = 'w-full mb-4';
    }
    log.appendChild(entry);
    log.scrollTo({ top: log.scrollHeight, behavior: 'smooth' });
}

function setIntent(intent) {
    const el = document.getElementById('my-intent');
    if (!el) return;
    GameState.currentIntent = intent;
    if (intent === 'none') {
        el.style.opacity = '0';
    } else {
        el.innerText = `${intent}...`;
        el.style.opacity = '1';
    }
}

// Global UI Event Listeners
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
    if (GameState.myCurrentAtb < 100 || GameState.isDrafting || GameState.isRoomPaused) {
        uiManager.shakeGauge();
        return;
    }
    setIntent('Drafting');
    network.drawCard();
};

const fundBtn = document.getElementById('fundraise-btn');
if (fundBtn) {
    fundBtn.onclick = () => {
        if (GameState.myCurrentAtb < 100 || GameState.isDrafting || GameState.isRoomPaused) {
            uiManager.shakeGauge();
            return;
        }
        setIntent('Rallying');
        network.fundraise();
    };
}
