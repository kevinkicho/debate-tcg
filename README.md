# The Floor Debate TCG

A real-time, multiplayer political trading card game built with Node.js, WebSockets, and Google's Gemini 2.5 Flash AI. Players draft a 20-card deck from a 50-card library and battle opponents (or an AI ChatBot Senator) in a race to 50 points by managing "Political Capital" and generating dynamic, AI-written political speeches.

## Core Functionality
* **Deck Building:** Players construct a custom 20-card deck from a diverse 50-card library of political maneuvers before joining a match.
* **Real-Time Multiplayer:** The game synchronizes state instantly across multiple browser windows using WebSockets for a seamless PvP experience.
* **AI Opponent:** Players can challenge an automated AI opponent that independently manages its hand, draws cards, and plays against the user.
* **Dynamic AI Speeches:** Every time a card is played, the Google Gemini 2.5 Flash API writes and broadcasts a unique, thematic, and humorous political speech based on the card's name and type.
* **Resource Management:** Players must strategically spend "Political Capital" to play heavy-hitting cards or draw new cards from their deck.
* **Race to 50:** The core win condition tasks players with reaching 50 Public Support points before their opponent to win the debate.

---

## File Directory & Descriptions

### Root Files
* **`index.js`**: This is the main server entry point that initializes the Express web server, serves the frontend interface, and binds the Socket.io network listener.
* **`package.json`**: This file tracks the project's metadata and manages all required backend dependencies like Socket.io, Express, and the Google AI SDK.
* **`.env`**: This secure configuration file stores private environment variables, specifically the `GEMINI_API_KEY` required for text generation.
* **`index.html`**: This is the main frontend markup document that structures the Deck Builder, Lobby, and dynamic Game Board interfaces.
* **`style.css`**: This stylesheet governs the visual layout, grid systems, and aesthetic styling of all user interface components.

### Frontend Client (`src/`)
* **`app.js`**: This main frontend controller wires the DOM elements to the network layer and handles user input events.
* **`network.js`**: This module acts as the communication bridge, capturing server events and emitting player actions over WebSockets.
* **`ui.js`**: This module manages DOM manipulation by updating numerical displays and toggling the visibility of different application screens.
* **`deckBuilder.js`**: This module contains the 50-card database and manages the logic for users drafting exactly 20 cards into their active deck.

### Backend Server (`src/`)
* **`socket/index.js`**: This file configures the Socket.io server instance and routes incoming client connections to their appropriate domain handlers.
* **`handlers/connectionHandler.js`**: This module manages the matchmaking logic for placing users into standard PvP rooms or configuring Single-Player vs AI rooms.
* **`handlers/debateHandler.js`**: This file contains the core gameplay loop, validating card costs, deducting capital, tracking points, and triggering AI speeches.
* **`state/RoomManager.js`**: This module acts as the central state database, tracking active rooms, shuffling player decks, and dealing starting hands.
* **`ai/geminiService.js`**: This service file authenticates with Google's Generative AI SDK to prompt the Gemini 2.5 Flash model for contextual dialogue.

---

## Core Function Descriptions

### Frontend Functions (`network.js` & `app.js`)
* **`joinRoom()`**: Emits a request to the server to place the human player and their custom deck into a standard PvP matchmaking room.
* **`joinAIRoom()`**: Emits a request to the server to spawn a fresh room containing the human player and an automated AI opponent.
* **`playCard()`**: Transmits the unique ID, type, and cost of a clicked card to the server for validation and execution.
* **`drawCard()`**: Sends a request to the server to deduct 1 Political Capital and move the top card of the player's deck into their hand.
* **`renderHandToBoard()`**: Dynamically generates HTML button elements representing the player's current playable cards based on the server's authoritative state.

### Backend Functions (`RoomManager.js` & `debateHandler.js`)
* **`createRoom()`**: Initializes a fresh, empty debate chamber object with a default topic and a "waiting" status.
* **`addPlayerToRoom()`**: Injects a player into a room, shuffles their submitted deck, and deals them a starting hand of 5 cards.
* **`shuffleArray()`**: Uses the Fisher-Yates algorithm to mathematically randomize the order of a player's drafted deck.
* **`executeAITurn()`**: Forces the AI player to automatically draw a card if needed, select a random card to play, and score points without human input.

### AI Functions (`geminiService.js`)
* **`generateSpeech()`**: Constructs a prompt using the played card's metadata and queries the Gemini API to return a localized, in-character political quote.

---

## How to Run the Game Locally
1. Ensure Node.js is installed on your machine.
2. Open a terminal in the root directory and run `npm install` to grab the dependencies.
3. Add your Google Gemini API key to the `.env` file.
4. Run `node index.js` in the terminal to start the server.
5. Open a web browser and navigate to `http://localhost:3000`.