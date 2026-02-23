const roomManager = require('../state/RoomManager');
const { generateSpeech } = require('../ai/geminiService');

function registerDebateHandlers(io, socket) {
    
    // 1. Human Plays a Card
    socket.on('play_card', async (payload) => {
        const { roomId, instanceId, cardType, capitalCost, cardName } = payload;
        const room = roomManager.getRoom(roomId);

        if (!room || room.status !== 'active') return;
        const player = room.players[socket.id];
        
        if (player.politicalCapital < capitalCost) {
            socket.emit('play_error', { message: 'Not enough Political Capital.' });
            return;
        }

        // FIX: Force both the stored ID and the incoming ID into Strings to guarantee a match
        const cardIndex = player.hand.findIndex(c => String(c.instanceId) === String(instanceId));
        
        if (cardIndex === -1) {
            console.log("Card not found in hand! Sync error.");
            return;
        }

        // Deduct capital and remove card
        player.politicalCapital -= capitalCost;
        player.hand.splice(cardIndex, 1);
        
        // Gain points (10 points per card to race to 50)
        player.points += 10;
        io.to(roomId).emit('room_state_update', room); 

        // Generate Human Speech
        io.to(roomId).emit('system_message', { message: `${player.name} is approaching the podium...` });
        const humanSpeech = await generateSpeech(cardName, cardType, false);
        
        io.to(roomId).emit('speech_generated', { 
            speakerName: player.name, 
            speechText: humanSpeech,
            cardName: cardName,
            isAI: false
        });

        // Check Win Condition
        if (player.points >= 50) {
            io.to(roomId).emit('game_over', { winner: player.name });
            room.status = 'finished';
            return;
        }

        // Trigger AI Turn if playing against AI
        const aiPlayerId = Object.keys(room.players).find(id => room.players[id].isAI);
        if (aiPlayerId) {
            executeAITurn(roomId, aiPlayerId, io);
        }
    });

    // 2. The AI's Automated Turn
    async function executeAITurn(roomId, aiId, io) {
        const room = roomManager.getRoom(roomId);
        const aiPlayer = room.players[aiId];

        // Ensure AI has cards, draw if empty
        if (aiPlayer.hand.length === 0 && aiPlayer.deck.length > 0) {
            aiPlayer.hand.push(aiPlayer.deck.pop());
        }
        if (aiPlayer.hand.length === 0) return; // Completely out of cards

        // AI picks a random card to play
        const randomCardIndex = Math.floor(Math.random() * aiPlayer.hand.length);
        const playedCard = aiPlayer.hand.splice(randomCardIndex, 1)[0];
        
        aiPlayer.points += 10;
        io.to(roomId).emit('room_state_update', room);

        io.to(roomId).emit('system_message', { message: `${aiPlayer.name} is preparing a rebuttal...` });
        const aiSpeech = await generateSpeech(playedCard.name, playedCard.type, true);

        io.to(roomId).emit('speech_generated', { 
            speakerName: aiPlayer.name, 
            speechText: aiSpeech,
            cardName: playedCard.name,
            isAI: true
        });

        if (aiPlayer.points >= 50) {
            io.to(roomId).emit('game_over', { winner: aiPlayer.name });
            room.status = 'finished';
        }
    }

    // 3. Human Draws a Card
    socket.on('draw_card', (payload) => {
        const { roomId } = payload;
        const room = roomManager.getRoom(roomId);
        if (!room || room.status !== 'active') return;

        const player = room.players[socket.id];

        if (player.politicalCapital < 1) {
            socket.emit('play_error', { message: 'You need 1 Political Capital to draw!' });
            return;
        }

        if (player.deck.length > 0) {
            player.politicalCapital -= 1; 
            const drawnCard = player.deck.pop();
            player.hand.push(drawnCard);
            
            io.to(roomId).emit('room_state_update', room);
            socket.emit('system_message', { message: `Drew a card: ${drawnCard.name}` });
        } else {
            socket.emit('play_error', { message: 'Your deck is completely empty!' });
        }
    });
}

module.exports = registerDebateHandlers;