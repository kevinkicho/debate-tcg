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
            // Support "54CA" style codes by removing numbers
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
            politicalCapital: 5,
            atb: 0,
            atbSpeed: 2.5, // Percent per tick
            deck: this._shuffle(initialDeck),
            hand: [],
            isAI: playerInfo.isAI || false
        };

        if (!room.playerIds.includes(playerId)) {
            room.playerIds.push(playerId);
        }

        // Auto-start game if 2 players (or 1 player + AI)
        if (room.playerIds.length === 2) {
            room.status = 'active';
            // Deal starting hands
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
        if (!room || room.status !== 'active') return null;

        Object.values(room.players).forEach(player => {
            if (player.atb < 100) {
                player.atb = Math.min(100, player.atb + (player.atbSpeed || 2.5));
            }
        });
        return room;
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

    playCard(roomId, playerId, cardInstanceId) {
        const room = this.rooms[roomId];
        if (!room) return { success: false, message: "Room not found" };
        const player = room.players[playerId];

        if (player.atb < 100) {
            return { success: false, message: "Wait for Action Gauge!" };
        }

        const cardIdx = player.hand.findIndex(c => String(c.instanceId) === String(cardInstanceId));

        if (cardIdx === -1) return { success: false, message: "Card not in hand" };

        const card = player.hand[cardIdx];
        if (player.politicalCapital < card.cost) {
            return { success: false, message: "Not enough Political Capital" };
        }

        player.politicalCapital -= card.cost;
        player.hand.splice(cardIdx, 1);
        player.atb = 0; // Reset ATB on play

        // APPLY CARD EFFECTS
        const effectApplied = this._applyEffect(room, playerId, card.effect);

        // Reduce base support gain to avoid over-inflation
        // If an effect was applied (points or capital change), we give 0 base bonus.
        // If it was a complex effect we couldn't parse, we still give a tiny bonus based on cost.
        if (!effectApplied) {
            player.points += Math.max(1, card.cost);
        }

        // CHANCE FOR RANDOM EVENT (10% chance)
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

    _triggerRandomEvent(room) {
        const events = [
            { name: "Economic Surge", effect: p => p.politicalCapital += 3, msg: "The economy is booming! All candidates gain +3 Capital." },
            { name: "Stock Market Crash", effect: p => p.politicalCapital = Math.max(0, p.politicalCapital - 3), msg: "Market crash! Donors are tightening their belts. -3 Capital for everyone." },
            { name: "Protest Wave", effect: p => p.points += 2, msg: "A wave of activism! All candidates gain +2 Support." },
            { name: "Scandal Season", effect: p => p.points = Math.max(0, p.points - 5), msg: "Scandals everywhere! Everyone's approval ratings drop by 5." },
            { name: "Endorsement Rally", effect: p => { if (Math.random() > 0.5) p.points += 7; }, msg: "A major endorsement is up for grabs! Someone's getting a huge boost..." }
        ];

        const event = events[Math.floor(Math.random() * events.length)];
        Object.values(room.players).forEach(p => event.effect(p));
        return event.msg;
    }

    _applyEffect(room, playerId, effectText) {
        if (!effectText) return false;

        const player = room.players[playerId];
        const opponentId = room.playerIds.find(id => id !== playerId);
        const opponent = room.players[opponentId];
        let changed = false;

        // Parse "Gain +X Capital" or "Gain X Capital"
        const gainCapMatch = effectText.match(/Gain \+?(\d+) Capital/i);
        if (gainCapMatch) {
            player.politicalCapital += parseInt(gainCapMatch[1]);
            changed = true;
        }

        // Parse "Gain +X Support" or "Gain X Support"
        const gainSupMatch = effectText.match(/Gain \+?(\d+) Support/i);
        if (gainSupMatch) {
            player.points += parseInt(gainSupMatch[1]);
            changed = true;
        }

        // Parse "Opponent loses X Support"
        const loseSupMatch = effectText.match(/Opponent loses (\d+) Support/i);
        if (loseSupMatch && opponent) {
            opponent.points = Math.max(0, opponent.points - parseInt(loseSupMatch[1]));
            changed = true;
        }

        // Parse "Drain X Capital"
        const drainCapMatch = effectText.match(/drain (\d+) Capital/i);
        if (drainCapMatch && opponent) {
            opponent.politicalCapital = Math.max(0, opponent.politicalCapital - parseInt(drainCapMatch[1]));
            changed = true;
        }

        // Parse "Opponent loses X Capital"
        const oppLoseCapMatch = effectText.match(/Opponent loses (\d+) Capital/i);
        if (oppLoseCapMatch && opponent) {
            opponent.politicalCapital = Math.max(0, opponent.politicalCapital - parseInt(oppLoseCapMatch[1]));
            changed = true;
        }

        // --- ATB EFFECTS ---
        if (effectText.match(/Delay opponent/i) && opponent) {
            opponent.atb = Math.max(0, opponent.atb - 30);
            changed = true;
        }

        if (effectText.match(/Haste/i)) {
            player.atbSpeed += 1;
            changed = true;
        }

        if (effectText.match(/Slow opponent/i) && opponent) {
            opponent.atbSpeed = Math.max(1, opponent.atbSpeed - 0.5);
            changed = true;
        }

        return changed;
    }

    fundraise(roomId, playerId) {
        const room = this.getRoom(roomId);
        if (!room) return null;
        const player = room.players[playerId];
        if (!player) return null;

        player.politicalCapital += 1;
        return player.politicalCapital;
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
