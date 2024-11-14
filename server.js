import express from "express";
import { readFileSync } from "fs";
import { createServer } from "https";
// import { createServer } from "http";
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Server } from "socket.io";
import { SocketAddress } from "net";

const port = process.env.PORT || 3000;
const ipAdress = '192.168.178.156'; // for local network // Desktop

const app = express();

const __dirname = dirname(fileURLToPath(import.meta.url));
// const httpServer = createServer(app);

// Construct the absolute path for the SSL certificate files
const keyPath = join(__dirname, 'sslcerts', 'selfsigned.key');
const certPath = join(__dirname, 'sslcerts', 'selfsigned.cert');

const httpsServer = createServer({
    key: readFileSync(keyPath),
    cert: readFileSync(certPath)
}, app);

const io = new Server(httpsServer, { /* options */ });

app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'index.html'));
});

app.use(express.static('.'));

// Store all connected players
let players = {};

/////////////////////////////  VARIABLES  //////////////////////////////////
const color1 = '#d60040';
const color2 = '#91ff42';
var activeColor;

const maxPlayers = 4;
const playerColors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00'];
const startPositions = [{ x: 5, y: 2, z: 0 }, { x: -5, y: 2, z: 0 }, { x: 0, y: 2, z: 5 }, { x: 0, y: 2, z: -5 }];
////////////////////////////////////////////////////////////////////////////////

// Handle connections and logic
io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    // Check if the maximum number of players has been reached
    if (Object.keys(players).length >= maxPlayers) {
        console.log(`Maximum number of players reached. Disconnecting ${socket.id}`);
        socket.emit('maxPlayersReached', { message: 'Maximum number of players reached. Try again later.' });
        socket.disconnect();
        return;
    }

    // Set the start position for the new player
    const playerStartPos = startPositions.shift();

    // Add new player to the game
    players[socket.id] = {
        id: socket.id,
        startPosition: playerStartPos,
        position: playerStartPos,
        rotation: { x: 0, y: 0, z: 0 },
        contrPosR: playerStartPos,
        contrPosL: playerStartPos,
        contrRotR: { x: 0, y: 0, z: 0 },
        contrRotL: { x: 0, y: 0, z: 0 },
        color: playerColors.shift()
    };

    // Send the player's information to the new player
    socket.emit('yourPlayerInfo', players[socket.id]);

    // Notify other players of the new player
    socket.broadcast.emit('newPlayer', players[socket.id]);

    // Send the current state to the new player
    socket.emit('currentState', players, activeColor);

    socket.on('clientUpdate', (data) => {
        players[socket.id].position = data.position;
        players[socket.id].rotation = data.rotation;
        players[socket.id].contrPosR = data.contrPosR;
        players[socket.id].contrPosL = data.contrPosL;
        players[socket.id].contrRotR = data.contrRotR;
        players[socket.id].contrRotL = data.contrRotL;
    });

    // Test color change for connection
    socket.on('clicked', () => {
        // console.log('Clicked');

        if (activeColor == color1) {
            activeColor = color2;
        } else {
            activeColor = color1;
        }
        // console.log(activeColor);
        io.emit('colorChanged', activeColor);
    });

    // Handle player disconnection
    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);

        // Return the player's color to the array
        playerColors.push(players[socket.id].color);
        startPositions.push(players[socket.id].startPosition);

        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

httpsServer.listen(port, ipAdress, () => {
    // console.log('Server is listening on port https://localhost:' + port);        // for localhost network
    console.log('Server is listening on port https://' + ipAdress + ':' + port);    // for local ip network
});


// Game loop
setInterval(function () {
    io.emit('serverUpdate', players);
}, 20);