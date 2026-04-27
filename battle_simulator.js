const roomManager = require('./src/state/RoomManager');
const { executeAITurn } = require('./src/handlers/debateHandler');

async function runSimulation(state1, state2, games = 50) {
    let wins = 0, losses = 0, totalTurns = 0;

    for (let i = 0; i < games; i++) {
        const roomId = `sim_${Date.now()}_${i}`;
        const io = {
            to: () => ({ emit: () => {} }),
            sockets: { sockets: new Map(), adapter: { rooms: new Map() } }
        };

        roomManager.deleteRoom(roomId);
        const room = roomManager.createRoom(roomId);
        const p1Id = 'AI_1', p2Id = 'AI_2';
        roomManager.addPlayerToRoom(roomId, p1Id, { name: 'AI 1', stateCode: state1, isAI: true }, null);
        roomManager.addPlayerToRoom(roomId, p2Id, { name: 'AI 2', stateCode: state2, isAI: true }, null);

        let turns = 0;
        while (true) {
            roomManager.updateATB(roomId);
            const winResult = roomManager.checkWinConditions(roomId);
            if (winResult) {
                if (winResult.winner === 'AI 1') wins++;
                else if (winResult.winner === 'AI 2') losses++;
                totalTurns += turns;
                break;
            }
            
            const aiId = room.playerIds.find(id => room.players[id].atb >= 100);
            if (aiId) {
                await executeAITurn(roomId, aiId, io);
            } else {
                const filibusterId = room.playerIds.find(id => room.players[id].atb >= 50);
                if (filibusterId && !room.filibuster?.active) {
                    roomManager.activateFilibuster(roomId, filibusterId, io);
                } else if (room.filibuster?.active) {
                    const opponentId = room.playerIds.find(id => id !== room.filibuster.attackerId);
                    if (opponentId && room.players[opponentId].politicalCapital >= 6) {
                        roomManager.clotureVote(roomId, opponentId, io);
                    }
                }
            }
            turns++;
            if (turns > 1000) break;
        }
        roomManager.deleteRoom(roomId);
    }

    return { wins, losses, avgTurns: totalTurns / games };
}

module.exports = { runSimulation, simulate: runSimulation };