const roomManager = require('../state/RoomManager');
const quizManager = require('../state/QuizManager');

function registerDebateHandlers(io, socket) {
    
    // 1. Player drops a card on the board
    socket.on('play_card', (payload) => {
        const { roomId, instanceId, cardType, capitalCost } = payload;
        const room = roomManager.getRoom(roomId);

        if (!room || room.status !== 'active') return;
        const player = room.players[socket.id];
        
        if (player.politicalCapital < capitalCost) {
            socket.emit('play_error', { message: 'Not enough Political Capital.' });
            return;
        }

        // Check if the card is actually in their hand
        const cardIndex = player.hand.findIndex(c => c.instanceId === instanceId);
        if (cardIndex === -1) {
            socket.emit('play_error', { message: 'Card not found in hand.' });
            return;
        }

        // Deduct capital and remove the card from the hand array
        player.politicalCapital -= capitalCost;
        player.hand.splice(cardIndex, 1);
        
        io.to(roomId).emit('room_state_update', room); // Sync the empty hand slot to the UI

        // Generate the specific UI quiz payload
        const quizPayload = quizManager.generateQuizForCard(socket.id, cardType);
        
        socket.emit('quiz_required', {
            quizData: quizPayload
        });

        socket.to(roomId).emit('waiting_for_opponent_quiz', {
            message: 'Opponent is answering a press question...'
        });
    });

    // 2. Player submits their UI quiz answer
    socket.on('submit_quiz_answer', (payload) => {
        const { roomId, answer } = payload;
        const room = roomManager.getRoom(roomId);
        if (!room) return;

        const isPassed = quizManager.validateAnswer(socket.id, answer);

        if (isPassed) {
            room.publicSupport += 5; 
            io.to(roomId).emit('room_state_update', room);
            io.to(roomId).emit('action_success', { 
                playerId: socket.id,
                message: 'Brilliant rhetoric! The argument stands.' 
            });
        } else {
            io.to(roomId).emit('action_failed', { 
                playerId: socket.id,
                message: 'A terrible gaffe! The press is having a field day.' 
            });
        }
    });

    // 3. NEW: Player requests to draw a card
    socket.on('draw_card', (payload) => {
        const { roomId } = payload;
        const room = roomManager.getRoom(roomId);
        if (!room || room.status !== 'active') return;

        const player = room.players[socket.id];

        if (player.deck.length > 0) {
            // Pop the top card from the deck and push it into the hand
            const drawnCard = player.deck.pop();
            player.hand.push(drawnCard);
            
            // Sync state so the UI renders the new card
            io.to(roomId).emit('room_state_update', room);
            socket.emit('action_success', { message: `Drew a card: ${drawnCard.name}` });
        } else {
            socket.emit('play_error', { message: 'Your deck is completely empty!' });
        }
    });
}

module.exports = registerDebateHandlers;