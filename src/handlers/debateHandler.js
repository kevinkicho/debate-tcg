/**
 * src/handlers/debateHandler.js
 * Bridges Socket.io events with the RoomManager state and AI services.
 */
const roomManager = require('../state/RoomManager');
const { generateSpeech } = require('../ai/geminiService');

function registerDebateHandlers(io, socket) {
    
    // 1. Human Plays a Card
    socket.on('play_card', async (payload) => {
        const { roomId, cardInstanceId } = payload;
        const room = roomManager.rooms[roomId];

        if (!room || room.status !== 'active') return;
        
        const player = room.players[socket.id];
        
        // Execute move in RoomManager
        const result = roomManager.playCard(roomId, socket.id, cardInstanceId);
        
        if (!result.success) {
            socket.emit('play_error', { message: result.message });
            return;
        }

        // Broadcast state update immediately
        io.to(roomId).emit('room_state', room); 

        // Generate Speech for the played card
        const card = result.cardPlayed;
        io.to(roomId).emit('system_message', { message: `${player.name} is approaching the podium...` });
        
        try {
            const humanSpeech = await generateSpeech(card.name, card.type, false);
            io.to(roomId).emit('speech_generated', { 
                speakerName: player.name, 
                speechText: humanSpeech,
                cardName: card.name,
                isAI: false
            });
        } catch (err) {
            console.error("AI Speech generation failed:", err);
        }

        // Check Win Condition
        if (result.gameOver) {
            io.to(roomId).emit('game_over', { winner: result.winner });
            return;
        }

        // Trigger AI Turn if it's an AI room
        const aiPlayerId = room.playerIds.find(id => room.players[id].isAI);
        if (aiPlayerId) {
            // Short delay for realism
            setTimeout(() => executeAITurn(roomId, aiPlayerId, io), 1500);
        }
    });

    // 2. The AI's Automated Turn
    async function executeAITurn(roomId, aiId, io) {
        const room = roomManager.rooms[roomId];
        if (!room || room.status !== 'active') return;

        const aiPlayer = room.players[aiId];

        // Basic AI Logic: Play the first affordable card
        const playableCard = aiPlayer.hand.find(c => c.cost <= aiPlayer.politicalCapital);
        
        if (playableCard) {
            const result = roomManager.playCard(roomId, aiId, playableCard.instanceId);
            io.to(roomId).emit('room_state', room);

            io.to(roomId).emit('system_message', { message: `${aiPlayer.name} is preparing a rebuttal...` });
            
            try {
                const aiSpeech = await generateSpeech(playableCard.name, playableCard.type, true);
                io.to(roomId).emit('speech_generated', { 
                    speakerName: aiPlayer.name, 
                    speechText: aiSpeech,
                    cardName: playableCard.name,
                    isAI: true
                });
            } catch (err) {
                console.error("AI Speech failed:", err);
            }

            if (result.gameOver) {
                io.to(roomId).emit('game_over', { winner: result.winner });
            }
        } else {
            // AI draws if it can't play
            roomManager.drawCard(roomId, aiId);
            aiPlayer.politicalCapital = Math.max(0, aiPlayer.politicalCapital - 1);
            io.to(roomId).emit('room_state', room);
        }
    }

    // 3. Human Draws a Card
    socket.on('draw_card', (payload) => {
        const { roomId } = payload;
        const room = roomManager.rooms[roomId];
        if (!room || room.status !== 'active') return;

        const player = room.players[socket.id];

        if (player.politicalCapital < 1) {
            socket.emit('play_error', { message: 'You need 1 Political Capital to draw!' });
            return;
        }

        if (player.deck.length > 0) {
            player.politicalCapital -= 1; 
            roomManager.drawCard(roomId, socket.id);
            
            io.to(roomId).emit('room_state', room);
            socket.emit('system_message', { message: `Policy drafted.` });
        } else {
            socket.emit('play_error', { message: 'Your deck is completely empty!' });
        }
    });
}

module.exports = registerDebateHandlers;