/**
 * UI Manager
 * Handles animations, particles, tooltips, and visual feedback.
 */

import { GameState } from '../gameState.js';

export class UIManager {
    constructor() {
        this.punditQuips = [
            "A bold pivot! Let's see if the base eats it up.",
            "Visualizers are showing a slight lean towards the incumbent.",
            "The data scientists are salivating over that last data point.",
            "I haven't seen this much energy since the 1992 primaries.",
            "The opponent looks visibly shaken. A masterclass in debate logic.",
            "We're seeing a real-time shift in the suburban demographic."
        ];
    }

    triggerReaction(emoji) {
        const arena = document.getElementById('speech-log');
        if (!arena) return;
        const el = document.createElement('div');
        el.className = 'absolute text-4xl pointer-events-none z-[2000]';
        el.innerText = emoji;
        el.style.left = `${Math.random() * 80 + 10}%`;
        el.style.bottom = '20%';
        arena.appendChild(el);

        el.animate([
            { transform: 'translateY(0) scale(1)', opacity: 1 },
            { transform: 'translateY(-300px) scale(2) rotate(20deg)', opacity: 0 }
        ], { duration: 2000, easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)' }).onfinish = () => el.remove();
    }

    showTooltip(cardName, x, y, createCardElement) {
        const card = GameState.cardCache[cardName];
        if (!card) return;
        const tooltip = document.getElementById('card-preview-tooltip');
        if (!tooltip) return;

        tooltip.innerHTML = '';
        const el = createCardElement(card);
        el.classList.add('scale-75', 'origin-top-left', 'shadow-2xl');
        tooltip.appendChild(el);
        tooltip.style.left = `${x + 20}px`;
        tooltip.style.top = `${y - 120}px`;
        tooltip.classList.remove('hidden');
        tooltip.style.opacity = '1';
    }

    hideTooltip() {
        const tooltip = document.getElementById('card-preview-tooltip');
        if (!tooltip) return;
        tooltip.style.opacity = '0';
        setTimeout(() => tooltip.classList.add('hidden'), 200);
    }

    triggerImpact(text, position) {
        const parent = document.getElementById('game-screen');
        if (!parent) return;
        const el = document.createElement('div');
        el.className = `impact-text impact-${position}`;
        el.innerText = text.toUpperCase();
        parent.appendChild(el);
        setTimeout(() => el.remove(), 1500);

        if (position === 'center') {
            parent.classList.add('screen-shake');
            setTimeout(() => parent.classList.remove('screen-shake'), 400);
        }
    }

    shakeGauge() {
        const container = document.getElementById('atb-gauge-container');
        const hint = document.getElementById('atb-error-hint');
        if (!container) return;
        container.classList.add('shake-error');
        if (hint) {
            hint.style.opacity = '1';
            setTimeout(() => hint.style.opacity = '0', 1000);
        }
        setTimeout(() => container.classList.remove('shake-error'), 400);
    }

    triggerRallyParticles(pos) {
        const screen = document.getElementById('game-screen');
        if (!screen) return;
        const startX = pos === 'me' ? 200 : window.innerWidth - 200;
        const startY = pos === 'me' ? window.innerHeight - 100 : 100;
        for (let i = 0; i < 20; i++) {
            const p = document.createElement('div');
            p.className = 'rally-particle';
            p.style.left = `${startX + (Math.random() - 0.5) * 200}px`;
            p.style.top = `${startY}px`;
            p.style.backgroundColor = `hsl(${45 + Math.random() * 20}, 100%, 50%)`;
            screen.appendChild(p);
            setTimeout(() => p.remove(), 1000);
        }
    }

    addToHistory(text, onHover, onLeave) {
        const log = document.getElementById('history-log');
        if (!log) return;

        const item = document.createElement('div');
        item.className = 'history-item text-[10px] text-white/70 leading-tight border-l-2 border-blue-500/50 pl-3';
        item.innerHTML = text;

        item.querySelectorAll('.card-preview-link').forEach(link => {
            link.onmouseenter = (e) => onHover(e.target.dataset.card, e.pageX, e.pageY);
            link.onmouseleave = () => onLeave();
        });

        log.appendChild(item);

        if (Math.random() > 0.4) {
            const quip = document.createElement('div');
            quip.className = 'history-item text-[9px] text-red-400/60 italic border-l-2 border-red-500/30 pl-3';
            quip.innerText = `🎙️ ${this.punditQuips[Math.floor(Math.random() * this.punditQuips.length)]}`;
            log.appendChild(quip);
        }

        if (log.children.length > 20) log.firstChild.remove();

        // Auto-scroll to bottom
        setTimeout(() => {
            log.scrollTo({ top: log.scrollHeight, behavior: 'smooth' });
        }, 50);
    }

    updateNewsCycle(newsCycle) {
        const nameEl = document.getElementById('news-cycle-name');
        const themeEl = document.getElementById('news-cycle-theme');
        if (!nameEl || !themeEl) return;

        if (!newsCycle) {
            nameEl.innerText = '—';
            themeEl.innerText = '';
            return;
        }

        const cycleIndex = newsCycle.cycleIndex || 0;
        const cycles = [
            { name: 'Economy Week', theme: 'economy' },
            { name: 'Scandal Week', theme: 'scandal' },
            { name: 'Foreign Policy Week', theme: 'foreign_policy' }
        ];
        const current = cycles[cycleIndex % cycles.length];

        nameEl.innerText = current ? current.name : '—';
        themeEl.innerText = current ? current.theme : '';
    }

    updateSwingStates(swingStates, playerNames, onFlipState, swingStateDefenses = {}, onDefendState) {
        const container = document.getElementById('swing-state-tallies');
        if (!container) return;

        container.innerHTML = '';

        if (!swingStates || Object.keys(swingStates).length === 0) {
            container.innerHTML = '<div class="text-[10px] text-white/40 italic">No states claimed yet</div>';
            return;
        }

        const tally = {};
        for (const [stateKey, playerId] of Object.entries(swingStates)) {
            if (!tally[playerId]) tally[playerId] = { name: playerNames[playerId] || 'Unknown', count: 0, ev: 0, states: [] };
            tally[playerId].count++;
            tally[playerId].ev += (GameState.masterData?.states[stateKey]?.electoralVotes || 0);
            tally[playerId].states.push(stateKey);
        }

        for (const [playerId, data] of Object.entries(tally)) {
            const row = document.createElement('div');
            row.className = 'flex justify-between items-center text-[10px] mb-1';
            
            const statesHtml = data.states.map(stateKey => {
                const isOpponent = playerId !== GameState.myPlayerId;
                const isDefended = swingStateDefenses[stateKey];
                const label = isDefended ? `🛡️${stateKey}` : stateKey;
                const style = isDefended ? 'border border-blue-500 rounded px-0.5 text-blue-400' : '';
                
                if (isOpponent && onFlipState) {
                    return `<button class="hover:text-white underline cursor-pointer transition-colors ${style}" onclick="window.dispatchEvent(new CustomEvent('flip-state', {detail: '${stateKey}'}))">${label}</button>`;
                }
                if (!isDefended && onDefendState) {
                    return `<button class="hover:text-white underline cursor-pointer transition-colors ${style}" onclick="window.dispatchEvent(new CustomEvent('defend-state', {detail: '${stateKey}'}))">${label}</button>`;
                }
                return `<span class="${style}">${label}</span>`;
            }).join(', ');

            row.innerHTML = `<span class="text-white/70 font-bold">${data.name}</span><span class="text-purple-400 font-black">${data.count} (${data.ev} EV) <span class="text-white/40">(${statesHtml})</span></span>`;
            container.appendChild(row);
        }
    }

    updateWinConditions(state, myPlayerId) {
        const container = document.getElementById('win-conditions-list');
        if (!container) return;
        container.innerHTML = '';

        const players = Object.values(state.players || {});
        const me = players.find(p => p.id === myPlayerId) || players[0];
        const swingStates = state.swingStates || {};
        const filibuster = state.filibusterTimer || {};

        const myEV = Object.entries(swingStates)
            .filter(([state, playerId]) => playerId === myPlayerId)
            .reduce((sum, [state]) => sum + (GameState.masterData?.states[state]?.electoralVotes || 0), 0);
        const totalEV = Object.keys(swingStates)
            .reduce((sum, state) => sum + (GameState.masterData?.states[state]?.electoralVotes || 0), 0);
        const turnCount = filibuster.turnCount || 0;
        const maxTurns = filibuster.maxTurns || 30;

        const nearThreshold = (val, max) => val / max >= 0.6;

        const conditions = [
            {
                label: '50 Support',
                desc: me ? `${me.points}/50` : '0/50',
                active: me && nearThreshold(me.points, 50),
                icon: '📊'
            },
            {
                label: 'Deck-Out',
                desc: me ? `${me.hand.length}h ${me.deck.length}d` : '—',
                active: me && (me.deck.length <= 3 || me.hand.length <= 1),
                icon: '🃏'
            },
            {
                label: 'Electoral College',
                desc: `${myEV}/${Math.ceil((totalEV || 1) / 2) + 1} EV`,
                active: totalEV > 0,
                icon: '🏛️'
            },
            {
                label: 'Filibuster',
                desc: `${turnCount}/${maxTurns}`,
                active: nearThreshold(turnCount, maxTurns),
                icon: '⏳'
            }
        ];

        conditions.forEach(c => {
            const row = document.createElement('div');
            row.className = `flex justify-between items-center text-[9px] py-0.5 px-1 rounded ${c.active ? 'text-emerald-300 bg-emerald-400/10' : 'text-white/25'}`;
            row.innerHTML = `<span class="font-bold">${c.icon} ${c.label}</span><span class="font-mono opacity-60">${c.desc}</span>`;
            container.appendChild(row);
        });

        const ecBar = document.getElementById('ec-progress-bar');
        const ecText = document.getElementById('ec-ev-count');
        if (ecBar && ecText) {
            const totalPossible = 538;
            const percent = (myEV / totalPossible) * 100;
            ecBar.style.width = `${percent}%`;
            ecText.innerText = `${myEV} / ${totalPossible} EV`;
        }
    }

    updateWinConditions(extra) {
        const container = document.getElementById('win-conditions-container');
        if (!container) return;
        const conditions = [
            { label: 'Electoral College', icon: '🏛️', value: 270 }
        ];
        if (extra && extra.coalitionDemographics !== undefined) {
            conditions.push({ label: 'Coalition', icon: '🤝', value: extra.coalitionDemographics });
        }
        const targetEl = container.querySelector('.win-conditions') || container;
        targetEl.innerHTML = conditions.map(c =>
            `<div class="win-condition-row">${c.icon} ${c.label}: ${c.value}</div>`
        ).join('');
    }

    updateStatusEffects(buffs, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';
        if (!buffs || buffs.length === 0) return;
        buffs.forEach(buff => {
            const row = document.createElement('div');
            const isDebuff = ['scandal', 'slow'].includes(buff.type);
            row.className = `hud-status-effect-entry ${isDebuff ? 'debuff' : 'buff'}`;
            const stacksText = buff.stacks ? ` ×${buff.stacks}` : '';
            const durationText = buff.duration != null ? `${Math.ceil(buff.duration)}s` : '';
            let tickText = '';
            if (buff.dotAmount) tickText = `−${buff.dotAmount}/t`;
            else if (buff.value && buff.type === 'passive') tickText = `+${buff.value}/t`;
            else if (buff.stackAmount) tickText = `+${buff.stackAmount}/t`;
            else if (buff.absorbAmount) tickText = `🛡${buff.absorbAmount}`;
            row.innerHTML = `<span class="font-bold">${buff.type}${stacksText}</span><span class="opacity-50">${durationText}</span>${tickText ? `<span class="opacity-70">${tickText}</span>` : ''}`;
            container.appendChild(row);
        });
    }

    updateEndorsements(players) {
        const el = document.getElementById('hud-endorsements');
        if (!el) return;
        const playerList = Object.values(players || {});
        let totalEndorsements = 0;
        playerList.forEach(p => {
            const hand = p.hand || [];
            const history = p.playHistory || [];
            const allCards = [...hand, ...history];
            totalEndorsements += allCards.filter(c => (c.type || '').includes('Endorsement')).length;
        });
        el.innerText = `🗳️ ${totalEndorsements}`;
    }

    updateCoalitionHUD(approvals, currentPlayer) {
        // also update win conditions with Coalition row
        if (typeof currentPlayer === 'object' && currentPlayer) {
            const coalitionCount = Object.values(approvals || {}).filter(v => v >= 50).length;
            this.updateWinConditions({
                coalitionDemographics: coalitionCount
            });
        }
        const container = document.getElementById('coalition-hud');
        if (!container) return;
        container.innerHTML = '';
        Object.entries(approvals || {}).forEach(([group, val]) => {
            const row = document.createElement('div');
            row.className = 'flex flex-col gap-1 mb-2';
            row.innerHTML = `
                <div class="flex justify-between text-[8px] font-bold uppercase text-white/40">
                    <span>${group}</span>
                    <span>${val}%</span>
                </div>
                <div class="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div class="h-full bg-blue-400 transition-all duration-500" style="width: ${val}%"></div>
                </div>`;
            container.appendChild(row);
        });
    }
}
