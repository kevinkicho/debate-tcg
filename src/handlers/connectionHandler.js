const roomManager = require('../state/RoomManager');

function registerConnectionHandlers(io, socket) {

    // Standard PvP Matchmaking
    socket.on('join_room', (payload) => {
        const { roomId, playerName, stateCode, deckData } = payload;
        let room = roomManager.getRoom(roomId) || roomManager.createRoom(roomId);

        if (Object.keys(room.players).length >= 2) {
            socket.emit('room_error', { message: 'Debate chamber is full.' });
            return;
        }

        socket.join(roomId);
        socket.roomId = roomId;
        roomManager.addPlayerToRoom(roomId, socket.id, { name: playerName, stateCode, isAI: false }, deckData);
        // Use 'room_state' event which debateHandler and frontend expect
        io.to(roomId).emit('room_state', roomManager.getRoom(roomId));
    });

    // NEW: Single Player vs AI Setup
    socket.on('join_ai_room', (payload) => {
        const { roomId, playerName, stateCode, deckData } = payload;

        // Force delete the room if it exists to start fresh
        roomManager.deleteRoom(roomId);
        let room = roomManager.createRoom(roomId);

        socket.join(roomId);
        socket.roomId = roomId;

        // 1. Add the Human Player
        roomManager.addPlayerToRoom(roomId, socket.id, { name: playerName, stateCode, isAI: false }, deckData);

        // 2. Add the AI Opponent (Give it the same state's deck if no deckData provided)
        const aiId = 'AI_OPPONENT';
        roomManager.addPlayerToRoom(roomId, aiId, { name: 'ChatBot Senator', stateCode: stateCode || "54CA", isAI: true }, deckData ? [...deckData] : null);

        io.to(roomId).emit('room_state', room);
    });

    socket.on('disconnect', () => {
        if (socket.roomId) {
            roomManager.removePlayer(socket.roomId, socket.id);
            io.to(socket.roomId).emit('player_left', { playerId: socket.id });
            const updatedRoom = roomManager.getRoom(socket.roomId);
            if (updatedRoom) {
                io.to(socket.roomId).emit('room_state', updatedRoom);
            }
        }
    });
}

module.exports = registerConnectionHandlers;
