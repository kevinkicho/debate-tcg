/**
 * src/handlers/debateHandler.js
 * Bridges Socket.io events with the RoomManager state and AI services.
 */
const roomManager = require('../state/RoomManager');
const { generateSpeech } = require('../ai/geminiService');
const { getBestAIMove } = require('../../AILogic');
const quizManager = require('../state/QuizManager');

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
        room.playerIds.forEach(pid => {
            const s = io.sockets.sockets.get(pid);
            if (s) s.emit('room_state', roomManager.serializeRoomState(room, pid));
        });

        if (result.eventOccurred) {
            io.to(roomId).emit('system_message', { message: `🚨 ${result.eventMessage}` });
        }
        const card = result.cardPlayed;

        if (card && (card.type.includes('Defense') || card.type.includes('Save') || card.type.includes('Counter'))) {
            const quiz = quizManager.generateQuizForCard(socket.id, card.type);
            socket.emit('quiz_challenge', quiz);
        }
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




    });



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
        room.playerIds.forEach(pid => {
            const s = io.sockets.sockets.get(pid);
            if (s) s.emit('room_state', roomManager.serializeRoomState(room, pid));
        });
        io.to(socket.roomId).emit('system_message', { message: `${room.players[socket.id].name} is consulting with policy advisors...` });
    });

    // 4. Human Selects Policy Choice
    socket.on('select_draft', (payload) => {
        const { cardInstanceIds } = payload;
        const room = roomManager.getRoom(socket.roomId);
        if (!room) return;

        const success = roomManager.selectDraft(socket.roomId, socket.id, cardInstanceIds);
        if (success) {
            room.playerIds.forEach(pid => {
                const s = io.sockets.sockets.get(pid);
                if (s) s.emit('room_state', roomManager.serializeRoomState(room, pid));
            });
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

        room.playerIds.forEach(pid => {
            const s = io.sockets.sockets.get(pid);
            if (s) s.emit('room_state', roomManager.serializeRoomState(room, pid));
        });

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
            room.playerIds.forEach(pid => {
                const s = io.sockets.sockets.get(pid);
                if (s) s.emit('room_state', roomManager.serializeRoomState(room, pid));
            });
            // If Town Hall ended, broadcast resumption
            if (!room.townHall) {
                io.to(socket.roomId).emit('townhall_ended');
                io.to(socket.roomId).emit('system_message', { message: "The Town Hall has concluded. Resume the debate!" });
            }
        }
    });

    // 8. Crisis Response Submission
    socket.on('submit_crisis_response', (payload) => {
        const { response } = payload;
        const room = roomManager.getRoom(socket.roomId);
        if (!room) return;

        const success = roomManager.submitCrisisResponse(socket.roomId, socket.id, response);
        if (success) {
            room.playerIds.forEach(pid => {
                const s = io.sockets.sockets.get(pid);
                if (s) s.emit('room_state', roomManager.serializeRoomState(room, pid));
            });
        }
    });



    socket.on('check_quiz', (payload) => {
        const { answer, quizId } = payload;
        const room = roomManager.getRoom(socket.roomId);
        if (!room) return;

        const success = quizManager.validateAnswer(socket.id, quizId, answer);
        const pending = room.pendingEffects[socket.id];

        if (success) {
            if (pending) {
                roomManager._applyEffect(socket.roomId, socket.id, pending.effect, pending.action);
            }
            io.to(socket.roomId).emit('system_message', { message: `✅ Answer Correct! Effect applied.` });
        } else if (pending) {
            const penalty = Math.floor(pending.cost / 2);
            const player = room.players[socket.id];
            if (player) player.points = Math.max(0, player.points - penalty);
            io.to(socket.roomId).emit('system_message', { message: `❌ Answer Incorrect! Penalty: -${penalty} Support.` });
        } else {
            io.to(socket.roomId).emit('system_message', { message: `❌ Answer Incorrect! Effect failed.` });
        }

        delete room.pendingEffects[socket.id];
        room.playerIds.forEach(pid => {
            const s = io.sockets.sockets.get(pid);
            if (s) s.emit('room_state', roomManager.serializeRoomState(room, pid));
        });
    });

    socket.on('submit_impeachment_answer', (payload) => {
        const { roomId, isCorrect } = payload;
        const result = roomManager.handleImpeachmentAnswer(roomId, socket.id, isCorrect);

        if (result) {
            const room = roomManager.getRoom(roomId);
            room.playerIds.forEach(pid => {
                const s = io.sockets.sockets.get(pid);
                if (s) s.emit('room_state', roomManager.serializeRoomState(room, pid));
            });
        }
    });

    socket.on('bank_dark_money', (payload) => {
        const { roomId, amount } = payload;
        const result = roomManager.bankDarkMoney(roomId, socket.id, amount);
        if (result) {
            const room = roomManager.getRoom(roomId);
            room.playerIds.forEach(pid => {
                const s = io.sockets.sockets.get(pid);
                if (s) s.emit('room_state', roomManager.serializeRoomState(room, pid));
            });
        }
    });

    socket.on('spend_dark_money', (payload) => {
        const { roomId, cardInstanceId } = payload;
        const result = roomManager.spendDarkMoney(roomId, socket.id, cardInstanceId);
        if (result) {
            const room = roomManager.getRoom(roomId);
            room.playerIds.forEach(pid => {
                const s = io.sockets.sockets.get(pid);
                if (s) s.emit('room_state', roomManager.serializeRoomState(room, pid));
            });
        }
    });

    socket.on('filibuster', (payload) => {
        const { roomId } = payload;
        const success = roomManager.activateFilibuster(roomId, socket.id, io);
        if (success) {
            const room = roomManager.getRoom(roomId);
            room.playerIds.forEach(pid => {
                const s = io.sockets.sockets.get(pid);
                if (s) s.emit('room_state', roomManager.serializeRoomState(room, pid));
            });
        } else {
            socket.emit('play_error', { message: 'Not enough ATB to filibuster' });
        }
    });

    socket.on('cloture_vote', (payload) => {
        const { roomId } = payload;
        const success = roomManager.clotureVote(roomId, socket.id, io);
        if (success) {
            const room = roomManager.getRoom(roomId);
            room.playerIds.forEach(pid => {
                const s = io.sockets.sockets.get(pid);
                if (s) s.emit('room_state', roomManager.serializeRoomState(room, pid));
            });
        } else {
            socket.emit('play_error', { message: 'Requirement not met for cloture vote' });
        }
    });

    socket.on('veto_card', (payload) => {
        const { roomId, cardInstanceId } = payload;
        const success = roomManager.vetoCard(roomId, socket.id, cardInstanceId, io);
        if (success) {
            const room = roomManager.getRoom(roomId);
            room.playerIds.forEach(pid => {
                const s = io.sockets.sockets.get(pid);
                if (s) s.emit('room_state', roomManager.serializeRoomState(room, pid));
            });
        } else {
            socket.emit('play_error', { message: 'Cannot veto this card or insufficient Capital' });
        }
    });

    socket.on('override_card', (payload) => {
        const { roomId, cardInstanceId } = payload;
        const success = roomManager.overrideCard(roomId, socket.id, cardInstanceId, io);
        if (success) {
            const room = roomManager.getRoom(roomId);
            room.playerIds.forEach(pid => {
                const s = io.sockets.sockets.get(pid);
                if (s) s.emit('room_state', roomManager.serializeRoomState(room, pid));
            });
        } else {
            socket.emit('play_error', { message: 'Cannot override or insufficient Capital' });
        }
    });
}

async function executeAITurn(roomId, aiId, io) {
        const room = roomManager.rooms[roomId];
        if (room && room.players[aiId]) room.players[aiId]._aiTurnPending = false;
        if (!room || room.status !== 'active') return;

        const aiPlayer = room.players[aiId];
        const humanPlayer = Object.values(room.players).find(p => !p.isAI);
        let actionTaken = false;
        if (aiPlayer.hand.length < 3) {
            const result = roomManager.startDraft(roomId, aiId);
            if (result && result.options) {
                const picks = result.options.slice(0, result.pickCount).map(o => o.instanceId);
                roomManager.selectDraft(roomId, aiId, picks);
            }
            actionTaken = true;
        } else {
            const getEffCost = (c) => { 
                let cost = c.cost; 
                if (aiPlayer.costMod === 'double') cost *= 2; 
                if (aiPlayer._costDiscount) cost = Math.max(0, cost - aiPlayer._costDiscount); 
                return cost; 
            };
            const minCost = aiPlayer.hand.length > 0 ? Math.min(...aiPlayer.hand.map(getEffCost)) : 0;
            if (aiPlayer.politicalCapital < minCost) {
                roomManager.fundraise(roomId, aiId);
                actionTaken = true;
            } else {
                const cardIndex = getBestAIMove(aiPlayer, humanPlayer);
                const getEffCost = (c) => { 
                    let cost = c.cost; 
                    if (aiPlayer.costMod === 'double') cost *= 2; 
                    if (aiPlayer._costDiscount) cost = Math.max(0, cost - aiPlayer._costDiscount); 
                    return cost; 
                };
                const playableCard = cardIndex !== null ? aiPlayer.hand[cardIndex] : aiPlayer.hand.find(c => getEffCost(c) <= aiPlayer.politicalCapital);

                if (playableCard) {
                    const result = roomManager.playCard(roomId, aiId, playableCard.instanceId);
                    if (result.success) {
                        actionTaken = true;

                        if (playableCard.type.includes('Defense') || playableCard.type.includes('Save') || playableCard.type.includes('Counter')) {
                            roomManager.applyPendingEffect(roomId, aiId);
                        } else {
                            if (room.pendingEffects) delete room.pendingEffects[aiId];
                        }

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
                            console.error("AI Speech generation failed:", err);
                        }
                    }
                }
            }
        }

        if (room.availableSwingState) {
            roomManager.claimSwingState(roomId, aiId, room.availableSwingState);
            actionTaken = true;
        } else {
            if (aiPlayer.politicalCapital >= 3) {
                const myStates = Object.entries(room.swingStates || {}).filter(([_, id]) => id === aiId).map(([id]) => id);
                const undefended = myStates.filter(s => !room.swingStateDefenses || !room.swingStateDefenses[s] || room.swingStateDefenses[s] < Date.now());
                if (undefended.length > 0) {
                    const bestState = undefended.sort((a, b) => (roomManager.masterData?.states[b]?.electoralVotes || 0) - (roomManager.masterData?.states[a]?.electoralVotes || 0))[0];
                    if (roomManager.defendSwingState(roomId, aiId, bestState)) {
                        actionTaken = true;
                        io.to(roomId).emit('system_message', { message: `🛡️ ${aiPlayer.name} defended ${bestState}!` });
                    }
                }
            }
            if (!actionTaken && aiPlayer.politicalCapital >= 6) {
                const oppStates = Object.entries(room.swingStates || {}).filter(([_, id]) => id !== aiId).map(([id]) => id);
                if (oppStates.length > 0) {
                    const target = oppStates[Math.floor(Math.random() * oppStates.length)];
                    if (roomManager.flipSwingState(roomId, aiId, target)) {
                        actionTaken = true;
                        io.to(roomId).emit('system_message', { message: `🔄 ${aiPlayer.name} flipped ${target}!` });
                    }
                }
            }
        }

        if (actionTaken) {
            room.playerIds.forEach(pid => {
                const s = io.sockets.sockets.get(pid);
                if (s) s.emit('room_state', roomManager.serializeRoomState(room, pid));
            });
        }
    }

module.exports = { registerDebateHandlers, executeAITurn };