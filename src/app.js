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

const masterData = await fetch('/political_tcg_master.json').then(r => r.json());
GameState.masterData = masterData;

network.onPlayError = (message) => {
    uiManager.triggerImpact(message, 'center');
    uiManager.addToHistory(`<span class="text-red-500 font-bold">Error: ${message}</span>`, () => { }, () => { });
};

network.onPlayerLeft = (payload) => {
    addLogEntry('System', `Opponent has left the chamber. Returning to lobby...`, 'text-red-400 uppercase font-black');
    GameState.reset();
    const speechLog = document.getElementById('speech-log');
    if (speechLog) speechLog.innerHTML = '';
    const historyLog = document.getElementById('history-log');
    if (historyLog) historyLog.innerHTML = '';
    setTimeout(() => {
        ui.showLobbyScreen();
    }, 3000);
};

network.onDamageApplied = (payload) => {
    uiManager.triggerImpact('damage', 'red');
};

network.onDebateChain = (payload) => {
    uiManager.triggerImpact(`Combo x${payload.chainLength}!`, 'purple');
};

network.onDemographicsShift = (payload) => {
    const player = GameState.players[GameState.myPlayerId];
    if (player) {
        uiManager.updateCoalitionHUD(player.demographicApprovals);
    }
};

network.onCoalitionThreshold = (payload) => {
    const player = GameState.players[GameState.myPlayerId];
    let count = 0;
    if (player && player.demographicApprovals) {
        count = Object.values(player.demographicApprovals).filter(v => v >= 50).length;
    }
    const needed = 3 - count;
    const message = `🌟 COALITION PROGRESS: ${payload.group.toUpperCase()} REACHED 50%! ${needed > 0 ? `Need ${needed} more for victory!` : 'COALITION SECURED!'}`;
    
    const banner = document.createElement('div');
    banner.className = 'fixed top-20 left-1/2 -translate-x-1/2 z-[6000] bg-yellow-500 text-black px-8 py-4 rounded-xl font-black shadow-2xl animate-bounce border-4 border-white uppercase tracking-tighter text-xl';
    banner.innerText = message;
    document.body.appendChild(banner);
    setTimeout(() => banner.remove(), 4000);

    uiManager.triggerImpact(message, 'gold');
};

network.onSystemMessage = (payload) => {
    addLogEntry('System', payload.message, 'text-blue-400 uppercase font-black');
};

network.onSwingStateFlipped = (payload) => {
    const ev = GameState.masterData?.states[payload.stateId]?.electoralVotes || 0;
    addLogEntry('System', `⚡ STATE FLIPPED: ${payload.stateId} (${ev} EV) has changed hands!`, 'text-purple-400 uppercase font-black');
};

network.onSwingStateDefended = (payload) => {
    const ev = GameState.masterData?.states[payload.stateKey]?.electoralVotes || 0;
    addLogEntry('System', `🛡️ STATE DEFENDED: ${payload.stateKey} (${ev} EV) is now fortified!`, 'text-emerald-400 uppercase font-black');
};

network.onSwingStateAvailable = (payload) => {
    const banner = document.createElement('div');
    banner.className = 'fixed top-8 left-1/2 -translate-x-1/2 z-[5000] bg-blue-600 text-white px-6 py-3 rounded-full font-bold shadow-2xl animate-bounce flex items-center gap-4 border-2 border-white/20';
    const ev = GameState.masterData?.states[payload.stateCode]?.electoralVotes || 0;
    banner.innerHTML = `<span>🚨 SWING STATE AVAILABLE: ${payload.stateCode} (${ev} EV)</span> <button id="claim-swing-btn" class="bg-white text-blue-600 px-3 py-1 rounded-full text-xs uppercase font-black hover:bg-blue-100 transition-colors">Claim</button>`;
    document.body.appendChild(banner);
    
    document.getElementById('claim-swing-btn').onclick = () => {
        network.socket.emit('claim_swing_state', { roomId: network.roomId, stateKey: payload.stateCode });
        banner.remove();
    };

    setTimeout(() => banner.remove(), 10000);
};

network.onImpeachmentStarted = (payload) => {
    const overlay = document.createElement('div');
    overlay.id = 'impeachment-overlay';
    overlay.className = 'fixed inset-0 bg-black/80 z-[10000] flex items-center justify-center p-4';
    
    const content = document.createElement('div');
    content.className = 'bg-slate-900 border-4 border-red-600 p-8 rounded-2xl max-w-2xl w-full text-center shadow-2xl';
    
    content.innerHTML = `
        <h2 class="text-4xl font-black text-red-500 mb-4 uppercase italic">🚨 Impeachment Inquiry! 🚨</h2>
        <p class="text-xl text-white mb-8">${payload.quiz.question}</p>
        <div class="grid grid-cols-1 gap-4" id="impeachment-options"></div>
    `;

    overlay.appendChild(content);
    document.body.appendChild(overlay);

    const optionsDiv = content.querySelector('#impeachment-options');
    payload.quiz.options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = 'bg-slate-800 hover:bg-red-600 text-white p-4 rounded-lg font-bold transition-colors border border-slate-700';
        btn.innerText = opt;
        btn.onclick = () => {
            network.submitImpeachmentAnswer(idx === payload.quiz.correctIndex);
            overlay.remove();
        };
        optionsDiv.appendChild(btn);
    });
};

// Core Logic Orchestration
network.onStateUpdate = (state) => {
    ui.showGameScreen(network.roomId);

    const phaseEl = document.getElementById('campaign-phase');
    if (phaseEl && state.campaignPhase) {
        phaseEl.innerText = state.campaignPhase;
    }

    // 1. Player Data Processing
    const me = state.players[network.socket.id];
    if (me) {
        GameState.myPlayerId = network.socket.id;
        document.getElementById('display-my-points').innerText = me.points;
        document.getElementById('display-scandal').innerText = me.scandalPoints || 0;
        document.getElementById('display-capital').innerText = me.politicalCapital;
        document.getElementById('atb-gauge').style.width = `${me.atb}%`;

        // Capital Gauge Fill
        const capPercentage = Math.min(100, (me.politicalCapital / 30) * 100);
        const capFill = document.getElementById('capital-gauge-fill');
        if (capFill) capFill.style.width = `${capPercentage}%`;

        // Buffs
        cardRenderer.renderBuffs(me.buffs, 'my-buff-hub');

        // Buttons & Status
        const canAct = me.atb >= 100 && !GameState.isDrafting && state.status !== 'paused' && !GameState.myAtbFrozen;
        const drawBtn = document.getElementById('draw-btn');
        const fundBtn = document.getElementById('fundraise-btn');
        if (drawBtn) drawBtn.disabled = !canAct;
        if (fundBtn) fundBtn.disabled = !canAct;
        if (drawBtn) drawBtn.classList.toggle('btn-charging', !canAct);
        if (fundBtn) fundBtn.classList.toggle('btn-charging', !canAct);

        const clotureBtn = document.getElementById('cloture-btn');
        const filibusterBtn = document.getElementById('filibuster-btn');
        const canCloture = state.filibuster?.active && state.filibuster.attackerId !== network.socket.id && me.politicalCapital >= 6;
        if (clotureBtn) clotureBtn.disabled = !canCloture;
        if (filibusterBtn) filibusterBtn.disabled = !!state.filibuster?.active;

        if (state.filibuster?.active) {
            let banner = document.getElementById('filibuster-banner');
            if (!banner) {
                banner = document.createElement('div');
                banner.id = 'filibuster-banner';
                banner.className = 'fixed top-8 left-1/2 -translate-x-1/2 z-[5000] bg-red-700 text-white px-6 py-3 rounded-full font-bold shadow-2xl animate-pulse flex items-center gap-4 border-2 border-white/20';
                const isMe = state.filibuster.attackerId === network.socket.id;
                banner.innerHTML = isMe ? '<span style="font-weight: 900">🎤 You are filibustering!</span>' : '<span style="font-weight: 900">🔇 Opponent is filibustering — You are silenced!</span>';
                const barContainer = document.createElement('div');
                barContainer.id = 'filibuster-bar-container';
                barContainer.className = 'w-32 h-2 bg-black/30 rounded-full overflow-hidden ml-2';
                const barFill = document.createElement('div');
                barFill.id = 'filibuster-bar-fill';
                barFill.className = 'h-full bg-white transition-all duration-300';
                barContainer.appendChild(barFill);
                banner.appendChild(barContainer);
                document.body.appendChild(banner);
                if (!isMe) GameState.myAtbFrozen = true;
            }
            const timerSpan = document.getElementById('filibuster-timer');
            if (timerSpan) {
                timerSpan.innerText = `Turn: ${state.filibusterTimer.turnCount}/${state.filibusterTimer.maxTurns}`;
            } else {
                const ts = document.createElement('span');
                ts.id = 'filibuster-timer';
                ts.className = 'text-xs bg-white/20 px-2 py-1 rounded-full ml-2';
                ts.innerText = `Turn: ${state.filibusterTimer.turnCount}/${state.filibusterTimer.maxTurns}`;
                banner.appendChild(ts);
            }
            const barFill = document.getElementById('filibuster-bar-fill');
            if (barFill) {
                const progress = (state.filibusterTimer.turnCount / state.filibusterTimer.maxTurns) * 100;
                barFill.style.width = `${progress}%`;
            }
        }

        const myStatusEl = document.getElementById('my-status');
        if (myStatusEl) {
            if (state.status === 'paused') myStatusEl.innerText = "Suspended";
            else if (state.filibuster?.active) {
                myStatusEl.innerText = state.filibuster.attackerId === network.socket.id ? "FILIBUSTERING" : "SILENCED";
            }
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
        GameState.lastPlayedCardTags = state.lastPlayedCard ? state.lastPlayedCard.tags : null;
        GameState.lastState = state;

        // HUD Updates
        uiManager.updateNewsCycle(state.newsCycle);
        const playerNames = {};
        for (const [id, p] of Object.entries(state.players)) playerNames[id] = p.playerName || p.name;
        uiManager.updateSwingStates(state.swingStates, playerNames, (stateKey) => {
            network.socket.emit('flip_swing_state', { roomId: network.roomId, stateKey });
        }, state.swingStateDefenses, (stateKey) => {
            network.socket.emit('defend_swing_state', { roomId: network.roomId, stateKey });
        });

        window.addEventListener('flip-state', (e) => {
            network.socket.emit('flip_swing_state', { roomId: network.roomId, stateKey: e.detail });
        }, { once: false });
        window.addEventListener('defend-state', (e) => {
            network.socket.emit('defend_swing_state', { roomId: network.roomId, stateKey: e.detail });
        }, { once: false });
        uiManager.updateWinConditions(state, network.socket.id);
        if (me.buffs) uiManager.updateStatusEffects(me.buffs, 'hud-status-effects-me');
        const oppEntry = Object.entries(state.players).find(([id]) => id !== network.socket.id);
        if (oppEntry && oppEntry[1].buffs) uiManager.updateStatusEffects(oppEntry[1].buffs, 'hud-status-effects-opp');
        uiManager.updateEndorsements(state.players);
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
            else if (state.filibuster?.active) {
                oppStatusEl.innerText = state.filibuster.attackerId === oppId ? "FILIBUSTERING" : "SILENCED";
            }
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
    }



    // 3. Campaign Stats & Odds
    const stats = state.stats;
    if (stats) {
        const myStats = stats.players.find(p => p.id === network.socket.id);
        const oppStats = stats.players.find(p => p.id !== network.socket.id);

        if (myStats && oppStats) {
            // Calculate local momentum and win probability
            // The server sends absolute stats, we derive the local percentage
            const myId = network.socket.id;
            const p1 = stats.players[0];
            const isP1 = p1.id === myId;

            const localMomentum = isP1 ? stats.momentum : (100 - stats.momentum);
            const localWinProb = isP1 ? stats.winProb : (100 - stats.winProb);

            const momBar = document.getElementById('momentum-bar');
            const momVal = document.getElementById('momentum-val');
            if (momBar) momBar.style.width = `${localMomentum}%`;
            if (momVal) momVal.innerText = `${Math.round(localMomentum)}%`;

            const winProbVal = document.getElementById('win-prob-val');
            if (winProbVal) winProbVal.innerText = `${Math.round(localWinProb)}%`;

            const oddsBreakdown = document.getElementById('odds-breakdown');
            if (oddsBreakdown) {
                oddsBreakdown.innerHTML = `
                    <div class="flex justify-between text-[8px] uppercase">
                        <span class="text-blue-400/60">Poll Advantage</span>
                        <span class="${myStats.buffCount >= oppStats.buffCount ? 'text-emerald-400' : 'text-red-400'}">
                            ${myStats.buffCount - oppStats.buffCount >= 0 ? '+' : ''}${myStats.buffCount - oppStats.buffCount}
                        </span>
                    </div>
                    <div class="flex justify-between text-[8px] uppercase">
                        <span class="text-blue-400/60">Policy Depth</span>
                        <span class="text-white/40">${myStats.handSize} Cards</span>
                    </div>
                `;
            }
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

network.onPhaseChange = (data) => {
    const phaseEl = document.getElementById('campaign-phase');
    if (phaseEl) phaseEl.innerText = data.to;
    uiManager.addToHistory(`Phase Shift: ${data.to}`, () => { }, () => { });
    uiManager.triggerImpact(data.to, 'center');
};

network.onNewsCycleEvent = (data) => {
    uiManager.addToHistory(`📰 ${data.event.name}: ${data.event.description}`, () => { }, () => { });
    uiManager.triggerImpact(data.event.name, 'center');
};

network.onFilibusterActive = (payload) => {
    const banner = document.createElement('div');
    banner.id = 'filibuster-banner';
    banner.className = 'fixed top-8 left-1/2 -translate-x-1/2 z-[5000] bg-red-700 text-white px-6 py-3 rounded-full font-bold shadow-2xl animate-pulse flex items-center gap-4 border-2 border-white/20';
    const isMe = payload.attackerId === network.socket.id;
    if (isMe) {
        banner.innerHTML = '<span>🎤 You are filibustering!</span>';
        document.getElementById('opp-atb-gauge').parentElement.classList.add('filibuster-frozen');
    } else {
        banner.innerHTML = '<span>🔇 Opponent is filibustering — You are silenced!</span>';
        document.getElementById('atb-gauge').parentElement.classList.add('filibuster-frozen');
        GameState.myAtbFrozen = true;
    }
    document.body.appendChild(banner);
};

network.onFilibusterEnded = (payload) => {
    const banner = document.getElementById('filibuster-banner');
    if (banner) banner.remove();
    document.getElementById('atb-gauge').parentElement.classList.remove('filibuster-frozen');
    document.getElementById('opp-atb-gauge').parentElement.classList.remove('filibuster-frozen');
    GameState.myAtbFrozen = false;
};

network.onNewsCycleRotate = (data) => {
    uiManager.addToHistory(`🔄 News Cycle: ${data.newCycle}`, () => { }, () => { });
    uiManager.triggerImpact(data.newCycle, 'center');
};

network.onSwingStateClaimed = (data) => {
    const isMine = data.playerId === network.socket.id;
    const stateData = GameState.masterData?.states[data.stateId];
    const stateInfo = data.stateId ? `${stateData?.name || data.stateId} (${stateData?.electoralVotes || 0} EV)` : '';
    const supportInfo = data.supportLevel ? `Support: ${data.supportLevel}` : '';
    const details = [stateInfo, supportInfo].filter(Boolean).join(' | ');
    uiManager.addToHistory(`${isMine ? 'You' : 'Opponent'} claimed a swing state!${details ? ' (' + details + ')' : ''}`, () => { }, () => { });
    if (isMine) uiManager.triggerImpact('Swing State!', 'me');
};

const hideTownHallOverlay = () => {
    const overlay = document.getElementById('townhall-overlay');
    if (overlay) overlay.classList.add('hidden');
};

const hideCrisisOverlay = () => {
    const overlay = document.getElementById('crisis-overlay');
    if (overlay) overlay.classList.add('hidden');
};

network.onInternationalCrisisStarted = (payload) => {
    const overlay = document.getElementById('crisis-overlay');
    const nameEl = document.getElementById('crisis-name');
    const descEl = document.getElementById('crisis-description');
    const optionsEl = document.getElementById('crisis-options');

    if (!overlay) return;

    nameEl.innerText = payload.name;
    descEl.innerText = payload.description;
    optionsEl.innerHTML = '';

    payload.options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'bg-red-600 hover:bg-red-500 text-white px-8 py-4 rounded-2xl font-black transition-all transform hover:scale-105';
        btn.innerText = opt.label;
        btn.onclick = () => {
            network.socket.emit('submit_crisis_response', { roomId: network.roomId, responseId: opt.id });
            hideCrisisOverlay();
        };
        optionsEl.appendChild(btn);
    });

    overlay.classList.remove('hidden');
};

network.onGameOver = (data) => {
    const winnerName = data.winner;
    uiManager.triggerImpact(`Winner: ${winnerName}`, 'center');
    uiManager.addToHistory(`🏆 Game Over! The winner is ${winnerName}`, () => { }, () => { });
    hideTownHallOverlay();

    const overlay = document.getElementById('game-over-overlay');
    if (overlay) {
        const winnerEl = document.getElementById('game-over-winner');
        const conditionEl = document.getElementById('game-over-condition');
        if (winnerEl) winnerEl.innerText = winnerName;
        if (conditionEl) conditionEl.innerText = data.condition || 'Electoral College';
        
        const players = Object.values(GameState.lastState?.players || {});
        if (players.length >= 2) {
            document.getElementById('score-p1-name').innerText = players[0].name;
            document.getElementById('score-p1-val').innerText = players[0].points;
            document.getElementById('score-p2-name').innerText = players[1].name;
            document.getElementById('score-p2-val').innerText = players[1].points;

            if (data.condition === 'electoral-college') {
                const swingStates = GameState.lastState?.swingStates || {};
                const breakdown = players.map(p => {
                    const claimed = Object.entries(swingStates).filter(([_, id]) => id === p.id).map(([id]) => id);
                    const ev = claimed.reduce((sum, id) => sum + (GameState.masterData?.states[id]?.electoralVotes || 0), 0);
                    return { name: p.name, ev, states: claimed };
                });

                const evEl = document.getElementById('game-over-ev-breakdown');
                if (evEl) {
                    evEl.innerHTML = breakdown.map(p => `
                        <div class="flex justify-between text-xs mb-1">
                            <span>${p.name}: <span class="text-purple-400 font-bold">${p.ev} EV</span></span>
                            <span class="opacity-50 text-[10px]">${p.states.join(', ') || 'None'}</span>
                        </div>
                    `).join('');
                    evEl.classList.remove('hidden');
                }
            }
        }

        overlay.classList.remove('hidden');

        document.getElementById('play-again-btn').onclick = () => {
            overlay.classList.add('hidden');
            GameState.reset();
            document.getElementById('speech-log').innerHTML = '';
            document.getElementById('history-log').innerHTML = '';
            ui.showLobbyScreen();
            network.socket.disconnect();
        };
    }
};

network.onTownHallStarted = (data) => {
    const overlay = document.getElementById('townhall-overlay');
    const topicEl = document.getElementById('townhall-topic');
    const questionEl = document.getElementById('townhall-question');

    if (topicEl) topicEl.innerText = data.topic.name;
    if (questionEl) questionEl.innerText = data.topic.question;
    if (overlay) overlay.classList.remove('hidden');
};

network.onTownHallEnded = () => {
    hideTownHallOverlay();
};

network.onComboTriggered = (data) => {
    const tagsStr = (data.matchedTags || []).join(', ');
    uiManager.addToHistory(`🔥 COMBO! matched [${tagsStr}] for +${data.bonusAmount} support!`, () => { }, () => { });
    uiManager.triggerImpact('COMBO!', 'center');
};

network.socket.on('quiz_challenge', (payload) => {
    const overlay = document.getElementById('quiz-overlay');
    if (!overlay) return;

    const promptEl = document.getElementById('quiz-prompt');
    const optionsContainer = document.getElementById('quiz-options');

    if (promptEl) promptEl.innerText = payload.question;
    
    if (optionsContainer) {
        optionsContainer.innerHTML = '';
        if (payload.options) {
            payload.options.forEach(opt => {
                const btn = document.createElement('button');
                btn.className = 'bg-white/10 hover:bg-white/20 p-4 rounded-xl font-bold transition-all';
                btn.innerText = opt.text;
                btn.onclick = () => {
                    network.socket.emit('check_quiz', { answer: opt.id, quizId: payload.quizId });
                    overlay.classList.add('hidden');
                };
                optionsContainer.appendChild(btn);
            });
        } else if (payload.targetWord) {
            const input = document.createElement('input');
            input.className = 'w-full p-4 rounded-xl bg-white/10 text-white font-bold text-center';
            input.placeholder = 'Type rapid-fire...';
            const submit = document.createElement('button');
            submit.className = 'w-full mt-4 bg-blue-600 p-4 rounded-xl font-bold';
            submit.innerText = 'SUBMIT';
            submit.onclick = () => {
                network.socket.emit('check_quiz', { answer: input.value, quizId: payload.quizId });
                overlay.classList.add('hidden');
            };
            optionsContainer.appendChild(input);
            optionsContainer.appendChild(submit);
        }
    }

    overlay.classList.remove('hidden');
});

window.submitVote = (choice) => {
    network.submitTownhall(choice);
    hideTownHallOverlay();
};

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
    // Use requestAnimationFrame for smoother scrolling to the actual bottom
    requestAnimationFrame(() => {
        log.scrollTo({ top: log.scrollHeight, behavior: 'smooth' });
    });
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
    const state = document.getElementById('state-select').value;
    if (name && room) network.joinRoom(room, name, state);
};

document.getElementById('join-ai-btn').onclick = () => {
    let name = document.getElementById('player-name').value;
    let room = document.getElementById('room-id').value;
    const state = document.getElementById('state-select').value;
    if (!name) name = "Candidate_" + Math.floor(Math.random() * 1000);
    if (!room) room = "AI_Duel_" + Math.floor(Math.random() * 1000);
    network.joinAIRoom(room, name, state);
};

document.getElementById('draw-btn').onclick = () => {
    if (GameState.myCurrentAtb < 100 || GameState.isDrafting || GameState.isRoomPaused) {
        uiManager.shakeGauge();
        return;
    }
    setIntent('Drafting');
    network.drawCard();
};

const darkMoneyBtn = document.getElementById('dark-money-btn');
if (darkMoneyBtn) {
    darkMoneyBtn.onclick = () => {
        if (GameState.isDrafting || GameState.isRoomPaused) {
            uiManager.shakeGauge();
            return;
        }
        setIntent('Dark Money');
        network.bankDarkMoney(3);
    };
}

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

const filiBtn = document.getElementById('filibuster-btn');
if (filiBtn) {
    filiBtn.onclick = () => {
        if (GameState.myCurrentAtb < 50 || GameState.isDrafting || GameState.isRoomPaused) {
            uiManager.shakeGauge();
            return;
        }
        setIntent('Filibustering');
        network.filibuster();
    };
}

const clotureBtn = document.getElementById('cloture-btn');
if (clotureBtn) {
    clotureBtn.onclick = () => {
        const me = GameState.lastState?.players[network.socket.id];
        const canCloture = GameState.lastState?.filibuster?.active && GameState.lastState.filibuster.attackerId !== network.socket.id && me?.politicalCapital >= 6;
        if (GameState.isDrafting || GameState.isRoomPaused || !canCloture) {
            uiManager.shakeGauge();
            return;
        }
        setIntent('Cloture Vote');
        network.clotureVote();
    };
}

// News Cycle Control Panel
function setupNewsCycleControls() {
    const ticker = document.getElementById('news-ticker');
    if (!ticker) return;

    const controls = document.createElement('div');
    controls.className = 'flex gap-2 ml-4 items-center text-xs';
    
    const spinBtn = document.createElement('button');
    spinBtn.className = 'bg-indigo-600 text-white px-2 py-1 rounded font-bold hover:bg-indigo-500';
    spinBtn.innerText = 'SPIN NEWS (4C)';
    spinBtn.onclick = () => {
        const themeIndex = prompt('Choose Cycle Index (0: Economy, 1: Scandal, 2: Foreign Policy)');
        if (themeIndex !== null) network.socket.emit('shift_news_cycle', { roomId: GameState.roomId, themeIndex: parseInt(themeIndex) });
    };

    const suppressBtn = document.createElement('button');
    suppressBtn.className = 'bg-slate-600 text-white px-2 py-1 rounded font-bold hover:bg-slate-500';
    suppressBtn.innerText = 'SUPPRESS (3C)';
    suppressBtn.onclick = () => network.socket.emit('suppress_scandal', { roomId: GameState.roomId });

    controls.appendChild(spinBtn);
    controls.appendChild(suppressBtn);
    ticker.appendChild(controls);
}

document.addEventListener('DOMContentLoaded', setupNewsCycleControls);
