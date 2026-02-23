/**
 * Centralized Game State Store
 * Decentralizes app.js by providing a single source of truth for global variables.
 */

export const GameState = {
    // Session State
    lastHandHash: "",
    lastOppHandCount: 0,
    lastOppPoints: 0,

    // UI State
    isDrafting: false,
    selectedChoices: [],
    maxPicks: 1,
    currentIntent: 'none',

    // Data Cache
    cardCache: {},

    // Logic Refs
    myCurrentAtb: 0,
    isRoomPaused: false,

    // Methods
    reset() {
        this.lastHandHash = "";
        this.lastOppHandCount = 0;
        this.lastOppPoints = 0;
        this.isDrafting = false;
        this.selectedChoices = [];
        this.currentIntent = 'none';
    }
};
