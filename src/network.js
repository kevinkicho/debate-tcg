export class NetworkClient {
    constructor(url) {
        this.socket = io(url);
        this.roomId = null;
        this.onStateUpdate = null;

        this.socket.on('room_state', (state) => {
            if (this.onStateUpdate) this.onStateUpdate(state);
        });

        this.socket.on('play_error', (p) => alert(p.message));
    }

    joinRoom(roomId, playerName, stateCode) {
        this.roomId = roomId;
        this.socket.emit('join_room', { roomId, playerName, stateCode });
    }

    joinAIRoom(roomId, playerName, stateCode) {
        this.roomId = roomId;
        this.socket.emit('join_ai_room', { roomId, playerName, stateCode });
    }

    playCard(instanceId, type, name, cost) {
        this.socket.emit('play_card', { 
            roomId: this.roomId, 
            cardInstanceId: instanceId,
            cardType: type,
            cardName: name,
            capitalCost: cost 
        });
    }

    drawCard() {
        this.socket.emit('draw_card', { roomId: this.roomId });
    }
}