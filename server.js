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

export class PlayerData {

}

export class Player {
    constructor(id, startPosition, color, isVR) {
        this.id = id;
        this.color = color;
        this.isVR = isVR;
        this.startPosition = startPosition;
        this.position = startPosition;
        this.rotation = { x: 0, y: 0, z: 0 };
        this.contrPosR = startPosition;
        this.contrPosL = startPosition;
        this.contrRotR = { x: 0, y: 0, z: 0 };
        this.contrRotL = { x: 0, y: 0, z: 0 };
    }

    setData(data) {
        this.position = data.position;
        this.rotation = data.rotation;
        this.contrPosR = data.contrPosR;
        this.contrPosL = data.contrPosL;
        this.contrRotR = data.contrRotR;
        this.contrRotL = data.contrRotL;
    }

    sendData() {
        io.emit('playerUpdate', this);
    }
};

/////////////////////////////  VARIABLES  //////////////////////////////////
const color1 = '#d60040';
const color2 = '#91ff42';
var activeColor;

const maxPlayers = 4;
const playerColors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00'];
const startPositions = [{ x: 5, y: 2, z: 0 }, { x: -5, y: 2, z: 0 }, { x: 0, y: 2, z: 5 }, { x: 0, y: 2, z: -5 }];

// Store all connected players
let playerList = {};

////////////////////////////////////////////////////////////////////////////////

// Handle connections and logic
io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    socket.join('watingRoom');
    socket.emit('joinedWaitingRoom');

    socket.emit('currentState', playerList, activeColor);

    // Check if the maximum number of players has been reached
    // if (Object.keys(playerList).length >= maxPlayers) {
    //     console.log(`Maximum number of players reached. Disconnecting ${socket.id}`);
    //     socket.emit('maxPlayersReached', { message: 'Maximum number of players reached. Try again later.' });
    //     socket.disconnect();
    //     return;
    // }

    socket.on('playerStartVR', isUsingVR => {

        // Check if the maximum number of players has been reached
        if (Object.keys(playerList).length >= maxPlayers) {
            console.log(`Maximum number of players reached. Player ${socket.id} has to stay in the waiting room.`);
            socket.emit('maxPlayersReached', { message: 'Maximum number of players reached. Try again later.' });
        } else {
            socket.leave('waitingRoom');
            socket.join('gameRoom');

            // Set the start position for the new player
            const playerStartPos = startPositions.shift();
            const playerColor = playerColors.shift();

            const newPlayer = new Player(socket.id, playerStartPos, playerColor, socket.isVR);

            // Add new player to the game
            playerList[socket.id] = newPlayer;

            // Send the player's information to the new player
            socket.emit('yourPlayerInfo', playerList[socket.id]);

            // Notify other players of the new player
            socket.broadcast.emit('newPlayer', playerList[socket.id]);

            // Send the current state to the new player
            // socket.emit('currentState', playerList, activeColor);

            socket.on('clientUpdate', (data) => {
                // console.log('Player data received:');
                // console.log(data.contrRotR);
                playerList[socket.id].setData(data);
                // console.log('Player data updated:');
                // console.log(playerList[socket.id].contrRotR);
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
        }
    });



    // Handle player disconnection
    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);

        if (socket.id in playerList) {
            console.log(`Player ${socket.id} disconnected from the game.`);

            // Return the player's color to the array
            playerColors.push(playerList[socket.id].color);
            startPositions.push(playerList[socket.id].startPosition);

            delete playerList[socket.id];
        } else {
            console.log(`Player ${socket.id} disconnected from the waiting room.`);
        }

        io.emit('playerDisconnected', socket.id);
    });
});

httpsServer.listen(port, ipAdress, () => {
    // console.log('Server is listening on port https://localhost:' + port);        // for localhost network
    console.log('Server is listening on port https://' + ipAdress + ':' + port);    // for local ip network
});


// Game loop
setInterval(function () {
    // console.log('Sending server update');
    // console.log(playerList);
    io.emit('serverUpdate', playerList);
}, 100);