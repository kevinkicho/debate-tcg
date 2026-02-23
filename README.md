# USA Political TCG: The Floor Debate

A high-stakes, real-time political trading card game powered by Google Gemini 2.0 Flash and an Active Time Battle (ATB) system.

## 🏛️ Game Objectives
- **Build Support**: Race your opponent to 50 Public Support points to win the debate.
- **Manage Capital**: Strategically spend Political Capital to draft policies and play influential cards.
- **Dominate the Floor**: Outpace your opponent's Action Gauge to control the flow of the debate.

## 🎮 Game Mechanics
- **Active Time Battle (ATB)**: Each player has an independent action gauge that must fill to 100% before they can act.
- **Real-Time Strategy**: The game runs at a high frequency (10Hz) to allow for fluid, non-turn-based gameplay.
- **Dynamic Card Effects**: Cards feature live text parsing for effects like "Haste" (speed up gauge), "Delay" (slow enemy), and direct score manipulation.
- **Gemini-Powered Rebuttals**: Played cards trigger unique, witty political speeches generated in real-time by AI.
- **Random Global Events**: Unpredictable events like "Market Crashes" or "Scandals" can change the board state instantly.
- **Political Economy**: Earn passive capital over time or manually "Fundraise" to afford expensive high-impact cards.

---

## 📂 Project Structure

### Root Directory
- **`index.js`**: Initializes the core backend server and serves the static frontend files.
- **`package.json`**: Manages backend dependencies and operational scripts for the Node.js environment.
- **`style.css`**: Defines the premium TCG aesthetic, SMS-style bubble chat, and card animations.
- **`index.html`**: Structures the main game interface, player stats, and real-time action gauges.
- **`political_tcg_master.json`**: Acts as the master database for all state-specific cards and their thematic effects.

### Backend Logic (`src/`)
- **`src/socket/index.js`**: Configures the real-time communication bridge between clients and the server.
- **`src/handlers/connectionHandler.js`**: Manages room creation, player matchmaking, and initial state assignment.
- **`src/handlers/debateHandler.js`**: Runs the 10Hz game loop, processes actions, and broadcasts world updates.
- **`src/state/RoomManager.js`**: Maintains the authoritative game state, including ATB gauges and card effect parsing.
- **`src/ai/geminiService.js`**: interfaces with Gemini 2.0 for speeches and provides witty local fallbacks.

### Frontend Client (`src/`)
- **`src/app.js`**: Handles real-time UI synchronization, input listeners, and dynamic card rendering.
- **`src/network.js`**: Manages the client-side socket connections and event emissions to the server.
- **`src/ui.js`**: Controls the visibility and layout transitions between the lobby and active game screens.

---

## 🛠️ Key Functionalities

### Backend: `RoomManager.js`
- **`updateATB(roomId)`**: Increments action gauges for all active players based on their individual speed levels.
- **`playCard(roomId, pid, instanceId)`**: Validates the action gauge and capital before executing a card's unique effects.
- **`_applyEffect(room, pid, effectText)`**: Parses natural language on cards to modify support, capital, or ATB speeds.
- **`_triggerRandomEvent(room)`**: Randomly selects and executes game-wide events that impact all participants.
- **`addPlayerToRoom(roomId, pid, info, deck)`**: Initializes a player's starting state and shuffles their custom deck.

### Backend: `debateHandler.js`
- **`gameLoop` (Interval)**: A high-speed recurring loop that drives the entire real-time match engine.
- **`executeAITurn(roomId, aiId, io)`**: Commands the AI senator to monitor its gauge and play cards autonomously.

### Frontend: `app.js`
- **`onStateUpdate(state)`**: Synchronizes all local UI elements with the server's authoritative game state.
- **`onSpeechGenerated(payload)`**: Renders thematic bubbles in a scrollable SMS-style chat for all debate lines.
- **`renderHand(hand)`**: Dynamically builds the player's interactable cards with premium hover effects.

### AI: `geminiService.js`
- **`generateSpeech(card, type, isAI, state)`**: Crafts localized political rhetoric using Gemini 2.0 or witty templates.

---

## 🚀 Getting Started
1. Run `npm install` in the project root to install all necessary dependencies.
2. Create a `.env` file and add your `GEMINI_API_KEY` for AI-powered dialogue.
3. Start the server by running `node index.js` in your terminal.
4. Open your browser to `http://localhost:3000` to start your campaign!