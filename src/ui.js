export class GameUI {
    constructor() {
        this.lobbyScreen = document.getElementById('lobby-screen');
        this.gameScreen = document.getElementById('game-screen');
        this.lobbyMessage = document.getElementById('lobby-message');
        
        this.displayRoom = document.getElementById('display-room');
        this.displaySupport = document.getElementById('display-support');
        this.displayCapital = document.getElementById('display-capital');
        
        this.ellModal = document.getElementById('ell-prompt-modal');
        this.ellPromptText = document.getElementById('ell-prompt-text');
    }

    showGameScreen(roomId) {
        this.lobbyScreen.classList.add('hidden');
        this.gameScreen.classList.remove('hidden');
        this.displayRoom.innerText = roomId;
    }

    updateGameState(roomState, socketId) {
        this.displaySupport.innerText = roomState.publicSupport;
        
        // Find the specific player's data using their socket ID
        const player = roomState.players[socketId];
        if (player) {
            this.displayCapital.innerText = player.politicalCapital;
        }

        if (roomState.status === 'waiting') {
            this.lobbyMessage.innerText = 'Waiting for opponent to join...';
            this.lobbyMessage.classList.remove('hidden');
        } else {
            this.lobbyMessage.classList.add('hidden');
        }
    }

    showELLPrompt(promptText) {
        this.ellPromptText.innerText = promptText;
        this.ellModal.classList.remove('hidden');
    }

    hideELLPrompt() {
        this.ellModal.classList.add('hidden');
    }

    showMessage(message) {
        // A simple alert for now, but this could be a nice toast notification later
        alert(message);
    }
}