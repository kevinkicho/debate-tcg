class RoomManager {
    constructor() {
        this.rooms = new Map();
    }

    createRoom(roomId) {
        if (!this.rooms.has(roomId)) {
            this.rooms.set(roomId, {
                id: roomId,
                players: {},
                topic: null,
                currentTurn: null,
                publicSupport: 0,
                status: 'waiting'
            });
        }
        return this.rooms.get(roomId);
    }

    getRoom(roomId) {
        return this.rooms.get(roomId);
    }

    // Helper function to shuffle an array (Fisher-Yates algorithm)
    shuffleArray(array) {
        let currentIndex = array.length, randomIndex;
        while (currentIndex !== 0) {
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;
            [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
        }
        return array;
    }

    // UPDATED: Now handles shuffling and drawing the initial 5 cards
    addPlayerToRoom(roomId, playerId, playerData, deckData = []) {
        const room = this.getRoom(roomId);
        if (room) {
            // 1. Copy and shuffle the deck
            const shuffledDeck = this.shuffleArray([...deckData]);
            
            // 2. Draw the first 5 cards for the hand
            const startingHand = shuffledDeck.splice(0, 5);

            room.players[playerId] = {
                ...playerData,
                politicalCapital: 10,
                deck: shuffledDeck,    // The remaining 15 cards
                hand: startingHand,    // The 5 playable cards
                board: []
            };
            
            if (Object.keys(room.players).length === 2) {
                room.status = 'active';
            }
        }
        return room;
    }

    removePlayer(roomId, playerId) {
        const room = this.getRoom(roomId);
        if (room && room.players[playerId]) {
            delete room.players[playerId];
            if (Object.keys(room.players).length === 0) {
                this.rooms.delete(roomId);
            } else {
                room.status = 'waiting';
            }
        }
    }

    deleteRoom(roomId) {
        this.rooms.delete(roomId);
    }
}

module.exports = new RoomManager();