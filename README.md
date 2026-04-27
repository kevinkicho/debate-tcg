# USA Political TCG: The Great Debate

> ⚠️ **Project in development — not production-ready.**
> This repository is frequently used as a target for AI-swarm testing activity, so the codebase changes constantly and may be in a broken or partially-working state at any given moment. It may not function properly and/or fail to deliver a sound gaming experience. Use at your own risk and expect rough edges.

A high-stakes, turn-based trading card game where players represent different US states, utilizing political strategy and debate tactics to secure electoral victory.

## 🎯 Game Objectives
- **Win Condition**: Be the first player to reach **50 Support** through strategic card play and debate performance.
- **Core Loop**: Manage resources, play cards to gain support or disrupt opponents, and react to real-time events.

## ⚙️ Game Mechanics
- **Support (HP)**: Your primary health metric and winning condition; reaching 50 wins the game.
- **Capital (Resource)**: Dynamic currency used to play cards, generated each turn and through fundraising.
- **ATB (Active Time Battle)**: A real-time charging meter system that determines when players or AI can take actions.
- **Card Types**: Includes "Action", "Resource Gen", "Character Trait", "Attack", "Defense", and "Ultimate Attack".
- **Dynamic Events**: Random "Town Hall" events and "Rallies" that can shift the momentum of the game.

## 📂 Project Structure

```text
debate-tcg/
├── AILogic.js               # AI decision-making scoring logic
├── BattleArena.jsx          # Main game board React component
├── CardIcons.jsx            # SVG icons for card types
├── DeckSelector.jsx         # State deck selection UI
├── PolishedPoliticalCard.jsx # Styled premium card component
├── PoliticalCard.jsx        # Standard card UI component
├── battle_simulator.js      # Interaction testing script
├── convertCards.js          # Card data transformation utility
├── converter.js             # General data processing tool
├── gameEngine.js            # Core local game logic engine
├── index.html               # Main entry point layout
├── index.js                 # Server entry script
├── political_tcg_master.json # Master card/state database
├── schema.json              # Data validation schema
├── style.css                # Global styles and Tailwind utilities
├── tailwind.config.js       # Tailwind CSS configuration
└── src/
    ├── app.js               # Client orchestrator & socket events
    ├── deckBuilder.js       # Deck construction logic
    ├── gameState.js         # Client-side state store
    ├── network.js           # Socket.io connection manager
    ├── ui.js                # Legacy UI helper functions
    ├── ai/
    │   └── geminiService.js  # Gemini AI debate generation service
    ├── data/
    │   └── quizzes.json      # Town Hall quiz event data
    ├── handlers/
    │   ├── connectionHandler.js # Player connection management
    │   └── debateHandler.js     # Socket logic & AI integration
    ├── state/
    │   ├── QuizManager.js    # Quiz event handling logic
    │   └── RoomManager.js    # Server room & ATB state management
    └── ui/
        ├── CardRenderer.js   # DOM card element manager
        └── UIManager.js      # Visual effects & impact manager
```

### Core Files
- **AILogic.js**: Contains the scoring heuristic for the AI to determine the most impactful card to play.
- **BattleArena.jsx**: React component that renders the main game board, player HUDs, and the active hand.
- **CardIcons.jsx**: Provides SVG icons for different card types like Attack, Defense, and Resource Generation.
- **DeckSelector.jsx**: UI component for searching and selecting state-specific decks from the master data.
- **PolishedPoliticalCard.jsx**: A premium, styled card component with hover effects, icons, and learning goals.
- **PoliticalCard.jsx**: The standard card UI component displaying name, cost, effect, and flavor text.
- **battle_simulator.js**: Script for testing and simulating card interactions and game flow.
- **convertCards.js**: Utility to transform raw card data into the format required by the game engine.
- **converter.js**: Additional data conversion tool for processing state and card information.
- **gameEngine.js**: Core local game logic class handling turns, phases, card costs, and effect resolution.
- **index.html**: Main entry point for the web application, containing the base layout and containers.
- **index.js**: Entry script for the server-side application.
- **political_tcg_master.json**: The primary database containing all state information, electoral votes, and card data.
- **schema.json**: Defines the structure and validation rules for the game's data.
- **style.css**: Main stylesheet containing layout designs, animations, and Tailwind utilities.
- **tailwind.config.js**: Configuration file for the Tailwind CSS framework integration.

### src/ Directory
- **app.js**: Client-side orchestrator that listens for socket events and updates the UI state.
- **deckBuilder.js**: Manages the logic for constructing and validating player decks.
- **gameState.js**: Simple store for tracking current client-side game variables and card caches.
- **network.js**: Handles Socket.io client connections and event emission to the server.
- **ui.js**: Legacy UI helper for managing basic DOM manipulations.

### src/ Subdirectories
- **geminiService.js**: Interfaces with Google's Gemini AI to generate dynamic political speeches and rebuttals.
- **quizzes.json**: Data store for the "Town Hall" interactive quiz events.
- **connectionHandler.js**: Manages player connection and disconnection logic on the server.
- **debateHandler.js**: Bridges socket events with the RoomManager and AI speech generation services.
- **QuizManager.js**: Handles the selection and validation of Town Hall quiz events.
- **RoomManager.js**: Primary server-side logic for managing room states, ATB timers, and multiplayer synchronization.
- **CardRenderer.js**: Specialized utility for creating and managing physical card elements in the DOM.
- **UIManager.js**: Manages complex UI interactions like particles, impact frames, and status updates.

## 🛠️ Key Functionalities

### Core Logic
- `initializePlayer(stateCode)`: Sets up starting stats, electoral votes, and shuffles the state-specific deck.
- `updateATB(roomId)`: Increments a real-time meter for players, triggering turns when full.
- `playCard(roomId, playerId, cardId)`: Validates capital, deducts cost, and applies the card's specific effect text.
- `_applyEffect(room, player, effect)`: Parses natural language effect strings to modify game state numbers.

### AI & Speech
- `getBestAIMove(ai, human)`: A scoring system that prioritizes moves based on survival, economy, and winning.
- `generateSpeech(context)`: Calls Gemini AI to create contextual debate dialogue based on recently played cards.

### Networking
- `registerDebateHandlers(io, socket)`: Maps game-specific socket events (play_card, rally, town_hall) to logic.
- `onStateUpdate(state)`: Client-side listener that reconciles the local UI with the server's master room state.

## 🚀 Technical Stack
- **Frontend**: React, Tailwind CSS, Vanilla JavaScript
- **Backend**: Node.js, Express, Socket.io
- **AI Integration**: Google Gemini AI (via Google Generative AI SDK)
- **Data Management**: JSON-based state and card databases.