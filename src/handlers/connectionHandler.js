const roomManager = require('../state/RoomManager');
const { executeAITurn } = require('./debateHandler');

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
        const updatedRoom = roomManager.getRoom(roomId);
        if (updatedRoom && updatedRoom.status === 'active') {
            roomManager.startGameLoop(roomId, io, executeAITurn);
        }
        const sockets = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
        sockets.forEach(socketId => {
            const socketInstance = io.sockets.sockets.get(socketId);
            if (socketInstance) socketInstance.emit('room_state', roomManager.serializeRoomState(room, socketId));
        });
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

        const updatedRoom = roomManager.getRoom(roomId);
        if (updatedRoom && updatedRoom.status === 'active') {
            roomManager.startGameLoop(roomId, io, executeAITurn);
        }

        const sockets = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
        sockets.forEach(socketId => {
            const socketInstance = io.sockets.sockets.get(socketId);
            if (socketInstance) socketInstance.emit('room_state', roomManager.serializeRoomState(room, socketId));
        });
    });

    socket.on('claim_swing_state', (payload) => {
        const { roomId, stateKey } = payload;
        const room = roomManager.getRoom(roomId);
        if (!room) return;

        roomManager.claimSwingState(roomId, stateKey, socket.id);
        room.availableSwingState = null;

        const sockets = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
        sockets.forEach(socketId => {
            const socketInstance = io.sockets.sockets.get(socketId);
            if (socketInstance) socketInstance.emit('room_state', roomManager.serializeRoomState(room, socketId));
        });
    });

    socket.on('flip_swing_state', (payload) => {
        const { roomId, stateKey } = payload;
        const room = roomManager.getRoom(roomId);
        if (!room) return;

        roomManager.flipSwingState(roomId, stateKey, socket.id);

        const sockets = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
        sockets.forEach(socketId => {
            const socketInstance = io.sockets.sockets.get(socketId);
            if (socketInstance) socketInstance.emit('room_state', roomManager.serializeRoomState(room, socketId));
        });
    });

    socket.on('defend_swing_state', (payload) => {
        const { roomId, stateKey } = payload;
        const room = roomManager.getRoom(roomId);
        if (!room) return;

        roomManager.defendSwingState(roomId, socket.id, stateKey);

        const sockets = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
        sockets.forEach(socketId => {
            const socketInstance = io.sockets.sockets.get(socketId);
            if (socketInstance) socketInstance.emit('room_state', roomManager.serializeRoomState(room, socketId));
        });
    });

    socket.on('buy_lobbyist', (payload) => {
        const { roomId, lobbyType } = payload;
        const success = roomManager.buyLobbyist(roomId, socket.id, lobbyType);
        if (success) {
            const room = roomManager.getRoom(roomId);
            const sockets = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
            sockets.forEach(socketId => {
                const socketInstance = io.sockets.sockets.get(socketId);
                if (socketInstance) socketInstance.emit('room_state', roomManager.serializeRoomState(room, socketId));
            });
        } else {
            socket.emit('room_error', { message: 'Insufficient capital or invalid lobbyist type.' });
        }
    });

    socket.on('disconnect', () => {
        if (socket.roomId) {
            roomManager.removePlayer(socket.roomId, socket.id);
            io.to(socket.roomId).emit('player_left', { playerId: socket.id });
            const updatedRoom = roomManager.getRoom(socket.roomId);
            if (updatedRoom) {
                const sockets = Array.from(io.sockets.adapter.rooms.get(socket.roomId) || []);
                sockets.forEach(socketId => {
                    const socketInstance = io.sockets.sockets.get(socketId);
                    if (socketInstance) socketInstance.emit('room_state', roomManager.serializeRoomState(updatedRoom, socketId));
                });
            }
        }
    });
}

module.exports = registerConnectionHandlers;
