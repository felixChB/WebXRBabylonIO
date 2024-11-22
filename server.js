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
    constructor(id, playerStartInfo, isVR) {
        this.id = id;
        this.isVR = isVR;
        this.playerNumber = playerStartInfo.player;
        this.startPosition = { x: playerStartInfo.x, y: playerStartInfo.y, z: playerStartInfo.z };
        this.position = { x: playerStartInfo.x, y: playerStartInfo.y, z: playerStartInfo.z };
        this.rotation = { x: 0, y: 0, z: 0 };
        this.contrPosR = { x: playerStartInfo.x, y: playerStartInfo.y, z: playerStartInfo.z };
        this.contrPosL = { x: playerStartInfo.x, y: playerStartInfo.y, z: playerStartInfo.z };
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

let playerStartInfos = {
    1: { player: 1, x: 5, y: 2, z: 0, color: '#ff0000', used: false },
    2: { player: 2, x: -5, y: 2, z: 0, color: '#00ff00', used: false },
    3: { player: 3, x: 0, y: 2, z: 5, color: '#0000ff', used: false },
    4: { player: 4, x: 0, y: 2, z: -5, color: '#ffff00', used: false }
}

// Store all connected players
let playerList = {};

////////////////////////////////////////////////////////////////////////////////

// Handle connections and logic
io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    if (Object.keys(playerList).length >= maxPlayers) {
        console.log(`Maximum number of players reached. Player ${socket.id} has to wait in the waiting room.`);
        socket.emit('maxPlayersReached', { message: 'Maximum number of players reached. Wait for Players to leave the Game.' });
    }

    socket.join('waitingRoom');
    socket.emit('joinedWaitingRoom');

    // Send the current state to the new player
    socket.emit('currentState', playerList, activeColor, playerStartInfos);

    socket.on('requestGameStart', (startPlayerNum) => {
        if (playerStartInfos[startPlayerNum].used == false) {
            playerStartInfos[startPlayerNum].used = true;
            //socket.emit('startPosAccepted', playerStartInfos[buttonNum]);

            socket.leave('waitingRoom');
            socket.join('gameRoom');

            console.log(`Player ${socket.id} started playing.`);

            const newPlayer = new Player(socket.id, playerStartInfos[startPlayerNum], socket.isVR);

            // Add new player to the game
            playerList[socket.id] = newPlayer;

            // Start the Game on client side and send the player's information to the new player
            socket.emit('startClientGame', playerList[socket.id]);

            // Notify other players of the new player (waitingRoom and gameRoom)
            socket.to('waitingRoom').to('gameRoom').emit('newPlayer', playerList[socket.id]);

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
        } else {
            socket.emit('startPosDenied');
        }
    });

    socket.on('playerStartVR', isUsingVR => {

        // Check if the maximum number of players has been reached
        if (Object.keys(playerList).length >= maxPlayers) {
            console.log(`Maximum number of players reached. Player ${socket.id} has to stay in the waiting room.`);
            socket.emit('maxPlayersReached', { message: 'Maximum number of players reached. Try again later.' });
        } else {
            socket.leave('waitingRoom');
            socket.join('gameRoom');

            console.log(`Player ${socket.id} started playing.`);

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

    socket.on('playerEndVR', () => {

        if (socket.id in playerList) {
            console.log(`Player ${socket.id} left the Game.`);

            // Return the player's color to the array
            // playerColors.push(playerList[socket.id].color);
            // startPositions.push(playerList[socket.id].startPosition);

            playerStartInfos[playerList[socket.id].playerNumber].used = false;

            delete playerList[socket.id];

            socket.leave('gameRoom');
            socket.join('waitingRoom');
        }
    });

    // Handle player disconnection
    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);

        if (socket.id in playerList) {
            console.log(`Player ${socket.id} disconnected from the game.`);

            playerStartInfos[playerList[socket.id].playerNumber].used = false;

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
}, 20);