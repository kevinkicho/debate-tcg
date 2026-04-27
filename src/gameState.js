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
    masterData: null,

    // Logic Refs
    myPlayerId: null,
    myCurrentAtb: 0,
    isRoomPaused: false,
    myAtbFrozen: false,
    lastPlayedCardTags: null,
    lastState: null,

    // Methods
    reset() {
        this.lastHandHash = "";
        this.lastOppHandCount = 0;
        this.lastOppPoints = 0;
        this.isDrafting = false;
        this.selectedChoices = [];
        this.currentIntent = 'none';
        this.myPlayerId = null;
        this.myCurrentAtb = 0;
        this.isRoomPaused = false;
        this.myAtbFrozen = false;
        this.lastPlayedCardTags = null;
        this.lastState = null;
        this.cardCache = {};
        this.masterData = null;
    }
};
