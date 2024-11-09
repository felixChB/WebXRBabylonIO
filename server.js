import express from "express";
import { readFileSync } from "fs";
import { createServer } from "https";
// import { createServer } from "http";
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Server } from "socket.io";
import { SocketAddress } from "net";

const port = process.env.PORT || 3000;

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
var aciveColor;

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
        contr_pos_r: playerStartPos,
        contr_pos_l: playerStartPos,
        contr_rot_r: { x: 0, y: 0, z: 0 },
        contr_rot_l: { x: 0, y: 0, z: 0 },
        color: playerColors.shift()
    };

    // Send the player's information to the new player
    socket.emit('yourPlayerInfo', players[socket.id]);

    // Notify other players of the new player
    socket.broadcast.emit('newPlayer', players[socket.id]);

    // Send the current state to the new player
    socket.emit('currentState', players);

    socket.on('update', (data) => {
        players[socket.id].position = data.position;
        players[socket.id].rotation = data.rotation;
        players[socket.id].contr_pos_r = data.contr_pos_r;
        players[socket.id].contr_pos_l = data.contr_pos_l;
        players[socket.id].contr_rot_r = data.contr_rot_r;
        players[socket.id].contr_rot_l = data.contr_rot_l;
    });

    // Test color change for connection
    socket.on('clicked', () => {
        // console.log('Clicked');

        if (aciveColor == color1) {
            aciveColor = color2;
        } else {
            aciveColor = color1;
        }
        // console.log(aciveColor);
        io.emit('colorChanged', aciveColor);
    });

    // Handle player disconnection
    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);

        // Return the player's color to the array
        playerColors.push(players[socket.id].color);
        startPositions.push(players[socket.id].startPosition);

        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
        socket.emit('currentState', players);
    });
});

httpsServer.listen(port, () => {
    console.log('Server is listening on port https://localhost:' + port);
});


// Game loop
setInterval(function () {
    io.emit('currentState', players);
}, 20);