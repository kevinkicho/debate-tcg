/**
 * Card Renderer
 * Handles the creation and rendering of card elements for human and opponent players.
 */

import { GameState } from '../gameState.js';

export class CardRenderer {
    constructor(network, uiManager) {
        this.network = network;
        this.uiManager = uiManager;
    }

    createCardElement(card) {
        const typeBase = (card.type || '').split(' ')[0].toLowerCase();
        const isAttack = (card.type || '').includes('Attack');
        const isDefense = (card.type || '').includes('Defense') || (card.type || '').includes('Save');
        const isResource = (card.type || '').includes('Resource') || (card.type || '').includes('Fundraiser');

        const intentIcon = isAttack ? '🗡️' : (isDefense ? '🛡️' : (isResource ? '💰' : '📜'));
        const typeColor = isAttack ? 'text-red-600' : (isDefense ? 'text-blue-600' : 'text-purple-600');

        const el = document.createElement('div');
        el.className = `tcg-card card-type-${typeBase}`;
        el.innerHTML = `
            <div class="flex justify-between items-start mb-4">
                <div class="card-energy text-xl bg-slate-900 text-white w-10 h-10 rounded-full flex items-center justify-center border-2 border-white/20">${card.cost}</div>
                <div class="text-right">
                    <div class="text-[12px] font-black uppercase leading-none truncate max-w-[160px]">${card.name}</div>
                    <div class="text-[9px] opacity-40 italic font-bold text-slate-900">${card.translation || ''}</div>
                </div>
            </div>
            <div class="flex-grow flex flex-col items-center justify-center text-center px-4 py-6 border-y-2 border-slate-100/50 bg-white/60 rounded-2xl my-4 relative">
                <div class="absolute -top-3 left-1/2 -translate-x-1/2 bg-white px-3 py-1 rounded-full border border-slate-200 text-xl">${intentIcon}</div>
                <div class="text-sm font-black text-slate-900 leading-tight mb-3 uppercase tracking-tighter mt-2">${card.effect}</div>
                ${card.learningGoal ? `<div class="learning-tag text-[9px] px-3 py-1 bg-blue-100 text-blue-800 rounded font-bold uppercase">${card.learningGoal}</div>` : ''}
            </div>
            <div class="flex justify-between items-center text-[10px] font-black uppercase tracking-widest ${typeColor}">
                <span>${card.type}</span>
                <span class="opacity-20 font-mono">#${(card.instanceId || '0000').slice(0, 4)}</span>
            </div>
            ${card.argType ? `
                <div class="flex justify-center mt-1">
                    <span class="text-[8px] font-black uppercase px-2 py-0.5 rounded-full border ${
                        card.argType === 'Emotional' ? 'bg-red-100 text-red-700 border-red-300' : 
                        card.argType === 'Data-Driven' ? 'bg-blue-100 text-blue-700 border-blue-300' : 
                        'bg-amber-100 text-amber-700 border-amber-300'
                    }">${card.argType}</span>
                </div>
            ` : ''}
            ${card.tags && card.tags.length ? `<div class="flex flex-wrap gap-1 mt-2">${card.tags.map(t => `<span class="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full border border-amber-400/40 bg-amber-400/10 text-amber-700">${t}</span>`).join('')}</div>` : ''}
            <div class="pt-4">
                <div class="text-[10px] text-slate-500 italic font-medium leading-snug line-clamp-3">"${card.flavorText}"</div>
            </div>
        `;
        return el;
    }

    renderHand(hand) {
        const container = document.getElementById('player-hand');
        if (!container) return;
        container.innerHTML = '';

        hand.forEach((card, index) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'card-wrapper animate-draw';
            wrapper.style.animationDelay = `${index * 50}ms`;

            const el = this.createCardElement(card);
            
            if (GameState.lastPlayedCardTags && card.tags) {
                const hasOverlap = card.tags.some(tag => GameState.lastPlayedCardTags.includes(tag));
                if (hasOverlap) el.classList.add('combo-ready');
            }

            wrapper.appendChild(el);

            wrapper.onclick = () => {
                if (GameState.myCurrentAtb < 100 || GameState.isDrafting || GameState.isRoomPaused) {
                    this.uiManager.shakeGauge();
                    return;
                }
                el.classList.add('card-played-anim');
                this.uiManager.triggerImpact(card.name, 'me');
                this.network.playCard(card.instanceId, card.type, card.name, card.cost);
            };

            container.appendChild(wrapper);
        });
    }

    renderOpponentHand(count) {
        const container = document.getElementById('opponent-hand');
        if (!container) return;
        container.innerHTML = '';
        for (let i = 0; i < count; i++) {
            const back = document.createElement('div');
            back.className = 'opp-card-back';
            back.style.animationDelay = `${i * 100}ms`;
            container.appendChild(back);
        }
    }

    renderBuffs(buffs, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';
        (buffs || []).forEach(buff => {
            const icon = document.createElement('div');
            // Class depends on stat: buff-capital, buff-support
            const statClass = (buff.stat || '').toLowerCase();
            icon.className = `buff-icon buff-${statClass} buff-${buff.type}`;
            const buffInitMap = { scandal: 'S', momentum: 'M', shield: 'D', rally: 'R', haste: 'H', slow: 'L' };
            icon.innerText = buff.stat ? buff.stat[0] : (buffInitMap[buff.type] || 'B');
            let desc = `+${buff.value || 0} ${buff.stat || 'points'} per tick`;
            if (buff.type === 'scandal') desc = `-${buff.dotAmount || 0} support per tick`;
            else if (buff.type === 'shield') desc = `absorbs ${buff.absorbAmount || 0} damage`;
            else if (buff.type === 'momentum') desc = `boosts speed by ${buff.stackAmount || 0}`;
            else if (buff.type === 'haste') desc = 'increased action speed';
            else if (buff.type === 'slow') desc = 'reduced action speed';
            else if (buff.type === 'rally') desc = 'massive rally in progress';
            icon.title = `${buff.name}: ${desc} (${Math.ceil(buff.duration)}s left)`;

            const timer = document.createElement('div');
            timer.className = 'buff-timer';
            timer.innerText = Math.ceil(buff.duration) + 's';
            icon.appendChild(timer);
            container.appendChild(icon);
        });
    }
}
