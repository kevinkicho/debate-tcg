export class NetworkClient {
    constructor(serverUrl) {
        this.socket = io(serverUrl);
        this.roomId = null;
        this.playerName = null;
        this.onStateUpdate = null;
        this.onActionMessage = null;
        this.onQuizRequired = null; 

        this.setupListeners();
    }

    setupListeners() {
        this.socket.on('connect', () => {
            console.log('Connected to the server with ID:', this.socket.id);
        });

        this.socket.on('room_state_update', (roomState) => {
            if (this.onStateUpdate) this.onStateUpdate(roomState);
        });

        this.socket.on('action_success', (payload) => {
            if (this.onActionMessage) this.onActionMessage(payload.message);
        });

        this.socket.on('action_failed', (payload) => {
            if (this.onActionMessage) this.onActionMessage(payload.message);
        });

        this.socket.on('play_error', (payload) => {
            alert(payload.message); 
        });

        this.socket.on('room_error', (payload) => {
            alert(payload.message);
        });

        this.socket.on('quiz_required', (payload) => {
            if (this.onQuizRequired) this.onQuizRequired(payload.quizData);
        });

        this.socket.on('waiting_for_opponent_quiz', (payload) => {
             if (this.onActionMessage) this.onActionMessage(payload.message);
        });
    }

    joinRoom(roomId, playerName, deckData) {
        this.roomId = roomId;
        this.playerName = playerName;
        this.socket.emit('join_room', { roomId, playerName, deckData });
    }

    joinAIRoom(roomId, playerName, deckData) {
        this.roomId = roomId;
        this.playerName = playerName;
        this.socket.emit('join_ai_room', { roomId, playerName, deckData });
    }

    playCard(instanceId, cardType, cardName, capitalCost) {
        if (!this.roomId) return;
        this.socket.emit('play_card', {
            roomId: this.roomId,
            instanceId: instanceId,
            cardType: cardType,
            cardName: cardName,
            capitalCost: capitalCost
        });
    }

    drawCard() {
        if (!this.roomId) return;
        this.socket.emit('draw_card', {
            roomId: this.roomId
        });
    }

    submitQuizAnswer(answerData) {
        if (!this.roomId) return;
        this.socket.emit('submit_quiz_answer', {
            roomId: this.roomId,
            answer: answerData
        });
    }
}