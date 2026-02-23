const { Server } = require('socket.io');
const registerConnectionHandlers = require('../handlers/connectionHandler');
const registerDebateHandlers = require('../handlers/debateHandler');

function setupSocketIO(httpServer) {
    const io = new Server(httpServer, {
        cors: {
            origin: "*", 
            methods: ["GET", "POST"]
        }
    });

    io.on('connection', (socket) => {
        console.log(`New client connected: ${socket.id}`);

        // Register domain-specific handlers
        registerConnectionHandlers(io, socket);
        registerDebateHandlers(io, socket);

        socket.on('disconnect', () => {
            console.log(`Client disconnected: ${socket.id}`);
        });
    });

    return io;
}

module.exports = setupSocketIO;