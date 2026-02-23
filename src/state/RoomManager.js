const masterData = require('../../political_tcg_master.json');
const { v4: uuidv4 } = require('uuid');

class RoomManager {
    constructor() {
        this.rooms = {};
    }

    getRoom(roomId) {
        return this.rooms[roomId];
    }

    createRoom(roomId) {
        this.rooms[roomId] = {
            id: roomId,
            status: 'waiting',
            activePlayerIndex: 0,
            players: {},
            playerIds: []
        };
        return this.rooms[roomId];
    }

    addPlayerToRoom(roomId, playerId, playerInfo, deckData) {
        const room = this.rooms[roomId];
        if (!room) return null;

        // Use provided deckData if available, otherwise fallback to masterData for the state
        let initialCards = [];
        if (deckData && Array.isArray(deckData) && deckData.length > 0) {
            initialCards = deckData;
        } else {
            const cleanedStateCode = playerInfo.stateCode ? playerInfo.stateCode.replace(/[0-9]/g, '') : '';
            const stateConfig = masterData.states[cleanedStateCode] || masterData.states[playerInfo.stateCode] || { cards: [] };
            initialCards = stateConfig.cards;
        }

        const initialDeck = initialCards.map(card => ({
            ...card,
            instanceId: uuidv4(),
            ownerId: playerId
        }));

        room.players[playerId] = {
            id: playerId,
            name: playerInfo.name,
            state: playerInfo.stateCode,
            points: 0,
            politicalCapital: 10,
            atb: 0,
            atbSpeed: 2.5,
            fatigue: 0, // Drafting more than once in a row increases fatigue
            deck: this._shuffle(initialDeck),
            hand: [],
            buffs: [],
            costMod: 0, // New property
            skipNextTurn: false, // New property
            lastIntention: 'none', // New property
            isAI: playerInfo.isAI || false
        };

        if (!room.playerIds.includes(playerId)) {
            room.playerIds.push(playerId);
        }

        if (room.playerIds.length === 2) {
            room.status = 'active';
            room.townHall = null;
            room.playerIds.forEach(id => {
                for (let i = 0; i < 5; i++) {
                    this.drawCard(roomId, id);
                }
            });
        }

        return room.players[playerId];
    }

    updateATB(roomId) {
        const room = this.rooms[roomId];
        if (!room) return null;

        const isPaused = room.status === 'paused';

        Object.values(room.players).forEach(player => {
            // 1. Process Buff Durations & Passive Generation
            player.buffs = player.buffs.filter(buff => {
                const step = 0.1;
                buff.duration -= step;

                // Handle Passive Generation (every second-ish)
                if (buff.type === 'passive' && !isPaused) {
                    player._passiveAccumulator = (player._passiveAccumulator || 0) + step;
                    if (player._passiveAccumulator >= 10) { // roughly every 10 update cycles (1 sec)
                        if (buff.stat === 'Capital') player.politicalCapital += buff.value;
                        if (buff.stat === 'Support') player.points += buff.value;
                        player._passiveAccumulator = 0;
                    }
                }

                return buff.duration > 0;
            });

            if (isPaused) return;

            // 2. Calculate current ATB speed
            let currentSpeed = player.atbSpeed || 2.5;
            player.buffs.forEach(buff => {
                if (buff.type === 'haste') currentSpeed += 1.5;
                if (buff.type === 'slow') currentSpeed -= 1.2;
            });

            // 3. Increment ATB
            if (player.atb < 100) {
                if (player.skipNextTurn) {
                    // Skip logic: consume part of the skip
                    player.atb = 0;
                    player.skipNextTurn = false;
                } else {
                    player.atb = Math.min(100, player.atb + Math.max(0.5, currentSpeed));
                }
            }
        });
        return room;
    }

    triggerTownHall(roomId) {
        const room = this.rooms[roomId];
        if (!room || room.status !== 'active') return null;

        const topics = [
            { id: 'tax', name: 'Tax Reform', question: 'Should we increase taxes on billionaires to fund moon bases?' },
            { id: 'climate', name: 'Climate Emergency', question: 'Ban all plastic straws to save the turtles, or just build bigger straws?' },
            { id: 'tech', name: 'AI Sovereignty', question: 'Should AIs be allowed to run for local school boards?' },
            { id: 'ufo', name: 'Interstellar Diplomacy', question: 'Establish a "First Contact" embassy in Vegas, or ignore the glowing saucers?' },
            { id: 'pizza', name: 'National Diet', question: 'Mandatory "Free Pizza Fridays" for all citizens to boost national morale?' }
        ];

        room.status = 'paused';
        room.townHall = {
            topic: topics[Math.floor(Math.random() * topics.length)],
            responses: {}
        };
        return room.townHall;
    }

    submitTownHall(roomId, playerId, choice) {
        const room = this.rooms[roomId];
        if (!room || !room.townHall) return false;

        room.townHall.responses[playerId] = choice;

        // Check if everyone voted
        if (Object.keys(room.townHall.responses).length === room.playerIds.length) {
            // Resolve rewards
            Object.keys(room.townHall.responses).forEach(pid => {
                const player = room.players[pid];
                player.politicalCapital += 10;
                player.points += 5;
            });
            room.status = 'active';
            room.townHall = null;
        }
        return true;
    }

    drawCard(roomId, playerId) {
        const room = this.rooms[roomId];
        if (!room) return null;
        const player = room.players[playerId];
        if (!player || player.deck.length === 0) return null;

        const card = player.deck.pop();
        player.hand.push(card);
        return card;
    }

    startDraft(roomId, playerId) {
        const room = this.getRoom(roomId);
        if (!room) return null;
        const player = room.players[playerId];
        if (player.atb < 100) return { success: false, message: "Action Gauge not ready!" };

        // 1. Roll Dice (1-6)
        const roll = Math.floor(Math.random() * 6) + 1;
        player.atb = 0;

        // Policy Fatigue logic: Consecutive drafts are harder
        player.fatigue += 1;
        if (player.fatigue > 1) {
            // If they draft again without playing a card, they get fewer options
            console.log(`${player.name} is experiencing Policy Fatigue!`);
        }

        const choiceCount = roll === 6 ? 4 : (roll >= 3 ? 3 : 2);
        // Reduce choice count if fatigue is high
        const adjustedChoiceCount = Math.max(1, choiceCount - Math.max(0, player.fatigue - 1));

        const options = [];
        for (let i = 0; i < adjustedChoiceCount && player.deck.length > 0; i++) {
            options.push(player.deck[player.deck.length - 1 - i]);
        }

        return {
            success: true,
            roll,
            options,
            pickCount: (roll === 6 && player.fatigue <= 1) ? 2 : 1,
            fatigue: player.fatigue
        };
    }

    playCard(roomId, playerId, cardInstanceId) {
        const room = this.rooms[roomId];
        if (!room) return { success: false, message: "Room not found" };
        const player = room.players[playerId];

        if (player.atb < 100) return { success: false, message: "Wait for Action Gauge!" };

        const cardIdx = player.hand.findIndex(c => String(c.instanceId) === String(cardInstanceId));
        if (cardIdx === -1) return { success: false, message: "Card not in hand" };

        const card = player.hand[cardIdx];

        // Calculate Adjusted Cost
        let finalCost = card.cost;
        if (player.costMod === 'double') finalCost *= 2;
        if (player._costDiscount) finalCost = Math.max(0, finalCost - player._costDiscount);

        if (player.politicalCapital < finalCost) return { success: false, message: "Not enough Political Capital" };

        player.politicalCapital -= finalCost;
        player.hand.splice(cardIdx, 1);
        player.atb = 0;
        player.fatigue = 0; // Reset fatigue on play!
        player.costMod = 'none'; // Reset cost multiplier

        const effectApplied = this._applyEffect(room, playerId, card.effect);
        if (!effectApplied) {
            player.points += Math.max(1, card.cost);
        }

        let eventMessage = null;
        if (Math.random() < 0.15) {
            eventMessage = this._triggerRandomEvent(room);
        }

        return {
            success: true,
            cardPlayed: card,
            eventOccurred: !!eventMessage,
            eventMessage: eventMessage,
            gameOver: player.points >= 50,
            winner: player.points >= 50 ? player.name : null
        };
    }

    _applyEffect(room, playerId, effectText) {
        if (!effectText) return false;

        const player = room.players[playerId];
        const opponentId = room.playerIds.find(id => id !== playerId);
        const opponent = room.players[opponentId];
        let changed = false;

        // --- DIRECT STAT CHANGES ---
        const gainCapMatch = effectText.match(/Gain \+?(\d+) Capital/i);
        if (gainCapMatch) { player.politicalCapital += parseInt(gainCapMatch[1]); changed = true; }

        const gainSupMatch = effectText.match(/Gain \+?(\d+) Support/i);
        if (gainSupMatch) { player.points += parseInt(gainSupMatch[1]); changed = true; }

        const drainCapMatch = effectText.match(/Drain (\d+) Capital/i);
        if (drainCapMatch && opponent) { opponent.politicalCapital = Math.max(0, opponent.politicalCapital - parseInt(drainCapMatch[1])); changed = true; }

        if (effectText.match(/Drain all opponent's Capital/i) && opponent) {
            opponent.politicalCapital = 0;
            changed = true;
        }

        const loseSupMatch = effectText.match(/Opponent loses (\d+) Support/i);
        if (loseSupMatch && opponent) { opponent.points = Math.max(0, opponent.points - parseInt(loseSupMatch[1])); changed = true; }

        // --- HAND DISRUPTION ---
        const discardMatch = effectText.match(/Discard (\d+) card/i);
        if (discardMatch && opponent && opponent.hand.length > 0) {
            for (let i = 0; i < parseInt(discardMatch[1]); i++) {
                if (opponent.hand.length > 0) opponent.hand.splice(Math.floor(Math.random() * opponent.hand.length), 1);
            }
            changed = true;
        }

        if (effectText.match(/Force opponent to discard half their hand/i) && opponent) {
            const count = Math.floor(opponent.hand.length / 2);
            for (let i = 0; i < count; i++) {
                opponent.hand.splice(Math.floor(Math.random() * opponent.hand.length), 1);
            }
            changed = true;
        }

        // --- TURN FLOW ---
        if (effectText.match(/Skip their turn/i) && opponent) {
            opponent.skipNextTurn = true;
            changed = true;
        }

        if (effectText.match(/Delay opponent|hazardous AQI|stuck on the PCH/i) && opponent) {
            opponent.atb = Math.max(0, opponent.atb - 40);
            changed = true;
        }

        // --- COST MODIFIERS ---
        if (effectText.match(/next card costs double/i) && opponent) {
            opponent.costMod = 'double';
            changed = true;
        }
        if (effectText.match(/cards cost (\d+) less/i)) {
            const m = effectText.match(/cards cost (\d+) less/i);
            player._costDiscount = parseInt(m[1]); // Persistence logic would need a buff for this
            changed = true;
        }

        // --- PASSIVE BUFFS (FACTIONS) ---
        const passiveMatch = effectText.match(/Steady stream of \+1 (Capital|Support)/i);
        if (passiveMatch) {
            const stat = passiveMatch[1];
            player.buffs.push({
                id: uuidv4(),
                name: `${stat} Faction`,
                type: 'passive',
                stat: stat,
                value: 1,
                duration: 60,
                msg: `Gaining +1 ${stat} every few seconds.`
            });
            changed = true;
        }

        // --- MISC BUFFS ---
        if (effectText.match(/Haste/i)) {
            player.buffs.push({ id: uuidv4(), name: 'Speed Campaign', type: 'haste', duration: 20, msg: 'ATB filling faster!' });
            changed = true;
        }

        if (effectText.match(/Slow opponent|Bureaucracy/i) && opponent) {
            opponent.buffs.push({ id: uuidv4(), name: 'Red Tape', type: 'slow', duration: 20, msg: 'ATB slowed by bureaucracy!' });
            changed = true;
        }

        return changed;
    }

    fundraise(roomId, playerId) {
        const room = this.getRoom(roomId);
        if (!room) return null;
        const player = room.players[playerId];
        if (!player) return null;

        if (player.atb < 100) return { success: false, message: "Wait for Action Gauge!" };

        const capitalGained = Math.floor(Math.random() * 11) + 5;
        const supportGained = Math.floor(Math.random() * 3) + 1;

        player.politicalCapital += capitalGained;
        player.points += supportGained;
        player.atb = 0;
        player.fatigue = 0; // Reset fatigue on rally too!

        return {
            success: true,
            capitalGained,
            supportGained
        };
    }

    _triggerRandomEvent(room) {
        const events = [
            { name: "Economic Surge", effect: p => p.politicalCapital += 10, msg: "The economy is booming! All candidates gain +$10M Capital." },
            { name: "Stock Market Crash", effect: p => p.politicalCapital = Math.max(0, p.politicalCapital - 5), msg: "Market crash! Donors are tightening their belts. -$5M Capital for everyone." },
            { name: "Protest Wave", effect: p => p.points += 5, msg: "A wave of activism! All candidates gain +5 Support." },
            { name: "Scandal Season", effect: p => p.points = Math.max(0, p.points - 5), msg: "Scandals everywhere! Everyone's approval ratings drop by 5." },
            { name: "Endorsement Rally", effect: p => { if (Math.random() > 0.5) p.points += 7; }, msg: "A major endorsement is up for grabs! Someone's getting a huge boost..." }
        ];

        const event = events[Math.floor(Math.random() * events.length)];
        Object.values(room.players).forEach(p => event.effect(p));
        return event.msg;
    }

    selectDraft(roomId, playerId, cardInstanceIds) {
        const room = this.getRoom(roomId);
        if (!room) return false;
        const player = room.players[playerId];

        cardInstanceIds.forEach(id => {
            const cardIdx = player.deck.findIndex(c => String(c.instanceId) === String(id));
            if (cardIdx !== -1) {
                const card = player.deck.splice(cardIdx, 1)[0];
                player.hand.push(card);
            }
        });
        return true;
    }

    removePlayer(roomId, playerId) {
        const room = this.rooms[roomId];
        if (!room) return;

        delete room.players[playerId];
        room.playerIds = room.playerIds.filter(id => id !== playerId);

        if (room.playerIds.length === 0) {
            delete this.rooms[roomId];
        } else {
            room.status = 'waiting';
        }
    }

    deleteRoom(roomId) {
        if (this.rooms[roomId]) {
            delete this.rooms[roomId];
            return true;
        }
        return false;
    }

    _shuffle(array) {
        const newArray = [...array];
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
    }
}

module.exports = new RoomManager();
