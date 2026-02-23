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

        log.prepend(item);

        if (Math.random() > 0.4) {
            const quip = document.createElement('div');
            quip.className = 'history-item text-[9px] text-red-400/60 italic border-l-2 border-red-500/30 pl-3';
            quip.innerText = `🎙️ ${this.punditQuips[Math.floor(Math.random() * this.punditQuips.length)]}`;
            log.prepend(quip);
        }

        if (log.children.length > 15) log.lastChild.remove();
    }
}
