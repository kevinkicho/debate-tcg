export class NetworkClient {
    constructor(url) {
        this.socket = io(url);
        this.roomId = null;
        this.onStateUpdate = null;
        this.onTownHallStarted = null;
        this.onTownHallEnded = null;
        this.onComboTriggered = null;
        this.onQuizChallenge = null;
        this.onSwingStateFlipped = null;
        this.onSwingStateDefended = null;
        this.onImpeachmentStarted = null;
        this.onDebateChain = null;
        this.onDemographicsShift = null;
        this.onCoalitionThreshold = null;
        this.onFilibusterActive = null;
        this.onFilibusterEnded = null;

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

        this.socket.on('phase-change', (payload) => {
            if (this.onPhaseChange) this.onPhaseChange(payload);
        });

        this.socket.on('news-cycle-event', (payload) => {
            if (this.onNewsCycleEvent) this.onNewsCycleEvent(payload);
        });

        this.socket.on('news-cycle-rotate', (payload) => {
            if (this.onNewsCycleRotate) this.onNewsCycleRotate(payload);
        });

        this.socket.on('swing-state-claimed', (payload) => {
            if (this.onSwingStateClaimed) this.onSwingStateClaimed(payload);
        });

        this.socket.on('game_over', (payload) => {
            if (this.onGameOver) this.onGameOver(payload);
        });

        this.socket.on('townhall_started', (payload) => {
            if (this.onTownHallStarted) this.onTownHallStarted(payload);
        });

        this.socket.on('townhall_ended', () => {
            if (this.onTownHallEnded) this.onTownHallEnded();
        });

        this.socket.on('combo-triggered', (payload) => {
            if (this.onComboTriggered) this.onComboTriggered(payload);
        });

        this.socket.on('quiz_challenge', (payload) => {
            if (this.onQuizChallenge) this.onQuizChallenge(payload);
        });

        this.socket.on('player_left', (payload) => {
            if (this.onPlayerLeft) this.onPlayerLeft(payload);
        });

        this.socket.on('damage-applied', (payload) => {
            if (this.onDamageApplied) this.onDamageApplied(payload);
        });

        this.socket.on('swing-state-available', (payload) => {
            if (this.onSwingStateAvailable) this.onSwingStateAvailable(payload);
        });

        this.socket.on('swing-state-flipped', (payload) => {
            if (this.onSwingStateFlipped) this.onSwingStateFlipped(payload);
        });

        this.socket.on('swing-state-defended', (payload) => {
            if (this.onSwingStateDefended) this.onSwingStateDefended(payload);
        });

        this.socket.on('international-crisis-started', (payload) => {
            if (this.onInternationalCrisisStarted) this.onInternationalCrisisStarted(payload);
        });

        this.socket.on('impeachment_started', (payload) => {
            if (this.onImpeachmentStarted) this.onImpeachmentStarted(payload);
        });

        this.socket.on('debate-chain', (payload) => {
            if (this.onDebateChain) this.onDebateChain(payload);
        });

        this.socket.on('demographics-shift', (payload) => {
            if (this.onDemographicsShift) this.onDemographicsShift(payload);
        });

        this.socket.on('coalition-threshold', (payload) => {
            if (this.onCoalitionThreshold) this.onCoalitionThreshold(payload);
        });

        this.socket.on('filibuster_active', (payload) => {
            if (this.onFilibusterActive) this.onFilibusterActive(payload);
        });

        this.socket.on('filibuster_ended', (payload) => {
            if (this.onFilibusterEnded) this.onFilibusterEnded(payload);
        });
    }

    joinRoom(roomId, playerName, stateCode) {
        this.socket.connect();
        this.roomId = roomId;
        this.socket.emit('join_room', { roomId, playerName, stateCode });
    }

    joinAIRoom(roomId, playerName, stateCode) {
        this.socket.connect();
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

    submitTownhall(choice) {
        this.socket.emit('submit_townhall', { roomId: this.roomId, choice });
    }

    submitCrisisResponse(response) {
        this.socket.emit('submit_crisis_response', { roomId: this.roomId, response });
    }

    submitImpeachmentAnswer(isCorrect) {
        this.socket.emit('submit_impeachment_answer', { roomId: this.roomId, isCorrect });
    }

    bankDarkMoney(amount) {
        this.socket.emit('bank_dark_money', { roomId: this.roomId, amount });
    }

    spendDarkMoney(cardInstanceId) {
        this.socket.emit('spend_dark_money', { roomId: this.roomId, cardInstanceId });
    }

    filibuster() {
        this.socket.emit('filibuster', { roomId: this.roomId });
    }

    clotureVote() {
        this.socket.emit('cloture_vote', { roomId: this.roomId });
    }
}