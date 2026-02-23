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

        if (result.eventOccurred) {
            io.to(roomId).emit('system_message', { message: `🚨 ${result.eventMessage}` });
        }
        const card = result.cardPlayed;
        io.to(roomId).emit('system_message', { message: `${player.name} is approaching the podium...` });

        try {
            // Pass stateCode to generateSpeech
            const humanSpeech = await generateSpeech(card.name, card.type, false, player.state);
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

    // AI Rebuttal Logic (Called when AI ATB is full)
    async function executeAITurn(roomId, aiId, io) {
        const room = roomManager.rooms[roomId];
        if (!room || room.status !== 'active') return;

        const aiPlayer = room.players[aiId];
        const playableCard = aiPlayer.hand.find(c => c.cost <= aiPlayer.politicalCapital);

        if (playableCard) {
            const result = roomManager.playCard(roomId, aiId, playableCard.instanceId);
            if (!result.success) return; // Wait for next tick if play fails (e.g. gauge not full)

            io.to(roomId).emit('room_state', room);

            if (result.eventOccurred) {
                io.to(roomId).emit('system_message', { message: `🚨 ${result.eventMessage}` });
            }

            try {
                const aiSpeech = await generateSpeech(playableCard.name, playableCard.type, true, aiPlayer.state);
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
            // AI draws if it can't play and has political capital
            if (aiPlayer.politicalCapital >= 1 && aiPlayer.deck.length > 0) {
                aiPlayer.politicalCapital -= 1;
                roomManager.drawCard(roomId, aiId);
                io.to(roomId).emit('room_state', room);
            } else if (aiPlayer.politicalCapital < 1) {
                roomManager.fundraise(roomId, aiId);
                aiPlayer.atb = 0; // Fundraising consumes the turn
                io.to(roomId).emit('room_state', room);
                io.to(roomId).emit('system_message', { message: `${aiPlayer.name} is hosting a fundraising gala.` });
            }
        }
    }

    // Capture roomId on join for the interval to use
    socket.on('join_room', (payload) => { socket.roomId = payload.roomId; });
    socket.on('join_ai_room', (payload) => { socket.roomId = payload.roomId; });

    // 5. Game Loop (10Hz - ATB Progression & State Sync)
    if (!socket.gameLoop) {
        socket.gameLoop = setInterval(() => {
            if (socket.roomId) {
                const room = roomManager.getRoom(socket.roomId);
                if (room && room.status === 'active') {
                    roomManager.updateATB(socket.roomId);

                    // Passive capital every 15s (150 ticks at 100ms)
                    if (room.capTick === undefined) room.capTick = 0;
                    room.capTick++;
                    if (room.capTick >= 150) {
                        Object.values(room.players).forEach(p => p.politicalCapital += 1);
                        room.capTick = 0;
                    }

                    io.to(socket.roomId).emit('room_state', room);

                    // Automated AI check
                    const aiId = room.playerIds.find(id => room.players[id].isAI);
                    if (aiId && room.players[aiId].atb >= 100) {
                        executeAITurn(socket.roomId, aiId, io);
                    }
                }
            }
        }, 100);
    }

    socket.on('disconnect', () => {
        if (socket.gameLoop) clearInterval(socket.gameLoop);
    });
}

module.exports = registerDebateHandlers;