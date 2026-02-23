const express = require('express');
const http = require('http');
const cors = require('cors');
const setupSocketIO = require('./src/socket/index');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

// Basic health check route
app.get('/', (req, res) => {
    res.send({ status: 'Debate TCG Server is running' });
});

// Initialize Socket.io networking
setupSocketIO(server);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});