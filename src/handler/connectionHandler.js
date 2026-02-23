const roomManager = require('../state/RoomManager');

function registerConnectionHandlers(io, socket) {
    // Catch the deckData sent from the frontend Deck Builder
    socket.on('join_room', (payload) => {
        const { roomId, playerName, deckData } = payload;
        
        let room = roomManager.getRoom(roomId);
        if (!room) {
            room = roomManager.createRoom(roomId);
        }

        if (Object.keys(room.players).length >= 2) {
            socket.emit('room_error', { message: 'Debate chamber is full.' });
            return;
        }

        socket.join(roomId);
        socket.roomId = roomId;

        // Pass the player's deck to the RoomManager so it can be shuffled and dealt
        roomManager.addPlayerToRoom(roomId, socket.id, { name: playerName }, deckData);
        
        io.to(roomId).emit('room_state_update', roomManager.getRoom(roomId));
    });

    socket.on('disconnect', () => {
        if (socket.roomId) {
            roomManager.removePlayer(socket.roomId, socket.id);
            io.to(socket.roomId).emit('player_left', { playerId: socket.id });
            
            const updatedRoom = roomManager.getRoom(socket.roomId);
            if (updatedRoom) {
                io.to(socket.roomId).emit('room_state_update', updatedRoom);
            }
        }
    });
}

module.exports = registerConnectionHandlers;