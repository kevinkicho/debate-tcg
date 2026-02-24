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
            // AI draws if it can afford it and has cards
            if (aiPlayer.politicalCapital >= 5 && aiPlayer.deck.length > 0) {
                roomManager.drawCard(roomId, aiId);
                aiPlayer.atb = 0;
                io.to(roomId).emit('room_state', room);
                io.to(roomId).emit('system_message', { message: `${aiPlayer.name} has drafted a new policy platform.` });
            } else {
                roomManager.fundraise(roomId, aiId);
                aiPlayer.atb = 0;
                io.to(roomId).emit('room_state', room);
                io.to(roomId).emit('system_message', { message: `${aiPlayer.name} is hosting a high-stakes fundraising gala.` });
            }
        }
    }

    // Capture roomId on join for the interval to use
    socket.on('join_room', (payload) => { socket.roomId = payload.roomId; });
    socket.on('join_ai_room', (payload) => { socket.roomId = payload.roomId; });

    // 3. Human Drafts Policy (Mini-game Start)
    socket.on('draw_card', (payload) => {
        const result = roomManager.startDraft(socket.roomId, socket.id);
        const room = roomManager.getRoom(socket.roomId);

        if (!result.success) {
            socket.emit('play_error', { message: result.message });
            return;
        }

        // Emit the roll Result ONLY to the player
        socket.emit('draft_started', {
            roll: result.roll,
            options: result.options,
            pickCount: result.pickCount
        });

        // Broadcast turn consumption
        io.to(socket.roomId).emit('room_state', room);
        io.to(socket.roomId).emit('system_message', { message: `${room.players[socket.id].name} is consulting with policy advisors...` });
    });

    // 4. Human Selects Policy Choice
    socket.on('select_draft', (payload) => {
        const { cardInstanceIds } = payload;
        const room = roomManager.getRoom(socket.roomId);
        if (!room) return;

        const success = roomManager.selectDraft(socket.roomId, socket.id, cardInstanceIds);
        if (success) {
            io.to(socket.roomId).emit('room_state', room);
            socket.emit('system_message', { message: `Policy successfully adopted.` });
        }
    });

    // 5. Human Fundraises (Rally Mini-game)
    socket.on('fundraise', (payload) => {
        const room = roomManager.getRoom(socket.roomId);
        const result = roomManager.fundraise(socket.roomId, socket.id);

        if (!result.success) {
            socket.emit('play_error', { message: result.message });
            return;
        }

        io.to(socket.roomId).emit('room_state', room);

        const player = room.players[socket.id];
        const msg = `BIG RALLY! ${player.name} raised $${result.capitalGained}M and gained +${result.supportGained} Support!`;
        io.to(socket.roomId).emit('system_message', { message: msg });
        io.to(socket.roomId).emit('rally_result', {
            playerId: socket.id,
            capital: result.capitalGained,
            support: result.supportGained
        });
    });

    // 6. Action Intent (Psychological Warfare/Transparency)
    socket.on('set_intent', (payload) => {
        const { intent } = payload; // 'drafting', 'rallying', 'none'
        io.to(socket.roomId).emit('action_intent', { playerId: socket.id, intent });
    });

    // 7. Town Hall Submission
    socket.on('submit_townhall', (payload) => {
        const { choice } = payload;
        const room = roomManager.getRoom(socket.roomId);
        if (!room) return;

        const success = roomManager.submitTownHall(socket.roomId, socket.id, choice);
        if (success) {
            io.to(socket.roomId).emit('room_state', room);
            // If Town Hall ended, broadcast resumption
            if (!room.townHall) {
                io.to(socket.roomId).emit('townhall_ended');
                io.to(socket.roomId).emit('system_message', { message: "The Town Hall has concluded. Resume the debate!" });
            }
        }
    });

    // 5. Game Loop (10Hz)
    if (!socket.gameLoop) {
        socket.gameLoop = setInterval(() => {
            if (!socket.roomId) return;
            const room = roomManager.getRoom(socket.roomId);
            if (!room) return;

            if (room.status === 'active') {
                roomManager.updateATB(socket.roomId);

                // Passive capital every 15s (150 ticks)
                if (room.capTick === undefined) room.capTick = 0;
                room.capTick++;
                if (room.capTick >= 150) {
                    Object.values(room.players).forEach(p => p.politicalCapital += 1);
                    room.capTick = 0;
                }

                // Town Hall Trigger every ~90s (900 ticks)
                if (room.townHallTick === undefined) room.townHallTick = 0;
                room.townHallTick++;
                if (room.townHallTick >= 900) {
                    const townHall = roomManager.triggerTownHall(socket.roomId);
                    if (townHall) {
                        io.to(socket.roomId).emit('townhall_started', townHall);
                        io.to(socket.roomId).emit('system_message', { message: "🚨 GLOBAL EVENT: A Town Hall meeting is underway. All actions paused!" });
                    }
                    room.townHallTick = 0;
                }

                // Sync Stats
                room.stats = roomManager.getRoomStats(socket.roomId);
                io.to(socket.roomId).emit('room_state', room);

                // Automated AI check
                if (!room.townHall) {
                    const aiId = room.playerIds.find(id => room.players[id].isAI);
                    if (aiId && room.players[aiId].atb >= 100) {
                        executeAITurn(socket.roomId, aiId, io);
                    }
                }
            } else if (room.status === 'paused' && room.townHall) {
                // AI Response for Town Hall
                const aiId = room.playerIds.find(id => room.players[id].isAI);
                if (aiId && !room.townHall.responses[aiId] && !room.townHall.aiThinking) {
                    room.townHall.aiThinking = true;
                    setTimeout(() => {
                        roomManager.submitTownHall(socket.roomId, aiId, 'yes');
                        io.to(socket.roomId).emit('room_state', room);
                        if (!room.townHall) {
                            io.to(socket.roomId).emit('townhall_ended');
                            io.to(socket.roomId).emit('system_message', { message: "The Town Hall has concluded. Resume the debate!" });
                        }
                    }, 2000);
                }
                io.to(socket.roomId).emit('room_state', room);
            }
        }, 100);
    }

    socket.on('disconnect', () => {
        if (socket.gameLoop) clearInterval(socket.gameLoop);
    });
}

module.exports = registerDebateHandlers;