export class NetworkClient {
    constructor(url) {
        this.socket = io(url);
        this.roomId = null;
        this.onStateUpdate = null;

        this.socket.on('room_state', (state) => {
            if (this.onStateUpdate) this.onStateUpdate(state);
        });

        this.socket.on('play_error', (p) => {
            console.warn('Game Error:', p.message);
            if (this.onPlayError) this.onPlayError(p.message);
        });

        this.socket.on('system_message', (payload) => {
            if (this.onSystemMessage) this.onSystemMessage(payload.message);
        });

        this.socket.on('speech_generated', (payload) => {
            if (this.onSpeechGenerated) this.onSpeechGenerated(payload);
        });
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

    fundraise() {
        this.socket.emit('fundraise', { roomId: this.roomId });
    }
}