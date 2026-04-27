const express = require('express');
const http = require('http');
const cors = require('cors');
const setupSocketIO = require('./src/socket/index');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

// Serve all files in this folder to the browser over HTTP
app.use(express.static(__dirname));

const battleSim = require('./battle_simulator');

app.get('/api/balance/:state1/:state2', async (req, res) => {
    const { state1, state2 } = req.params;
    const result = await battleSim.runSimulation(state1, state2);

    res.json({
        state1, state2, 
        state1Wins: result.wins, 
        state2Wins: result.losses, 
        avgTurns: result.avgTurns
    });
});

// Initialize Socket.io networking
setupSocketIO(server);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    console.log(`--> Play the game by opening: http://localhost:${PORT}`);
});