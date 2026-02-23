const masterData = require('../../political_tcg_master.json');
const { v4: uuidv4 } = require('uuid');

class RoomManager {
    constructor() {
        this.rooms = {};
    }

    getRoom(roomId) {
        return this.rooms[roomId];
    }

    createRoom(roomId, playerInfo) {
        const stateConfig = masterData.states[playerInfo.stateCode] || { cards: [] };
        const initialDeck = stateConfig.cards.map(card => ({
            ...card,
            instanceId: uuidv4(),
            ownerId: playerInfo.id
        }));

        this.rooms[roomId] = {
            id: roomId,
            status: 'waiting',
            activePlayerIndex: 0,
            players: {
                [playerInfo.id]: {
                    id: playerInfo.id,
                    name: playerInfo.name,
                    state: playerInfo.stateCode,
                    points: 0,
                    politicalCapital: 5,
                    deck: this._shuffle(initialDeck),
                    hand: [],
                    isAI: false
                }
            },
            playerIds: [playerInfo.id]
        };
        return this.rooms[roomId];
    }

    deleteRoom(roomId) {
        if (this.rooms[roomId]) {
            delete this.rooms[roomId];
            return true;
        }
        return false;
    }

    playCard(roomId, playerId, cardInstanceId) {
        const room = this.rooms[roomId];
        const player = room.players[playerId];
        const cardIdx = player.hand.findIndex(c => String(c.instanceId) === String(cardInstanceId));
        
        if (cardIdx === -1) return { success: false, message: "Card not in hand" };

        const card = player.hand[cardIdx];
        player.politicalCapital -= card.cost;
        player.hand.splice(cardIdx, 1);
        player.points += 10;

        return { success: true, cardPlayed: card, gameOver: player.points >= 50 };
    }

    _shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
}

module.exports = new RoomManager();