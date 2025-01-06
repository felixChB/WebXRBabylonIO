import express from "express";
import { readFileSync } from "fs";
import { createServer } from "https";
// import { createServer } from "http";
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Server } from "socket.io";
import { SocketAddress } from "net";
import { start } from "repl";

const port = process.env.PORT || 3000;

////////////// CHANGE THIS TO YOUR LOCAL IP ADDRESS ///////////////////
//const ipAdress = '192.168.178.156'; // for local network // Desktop
//const ipAdress = '192.168.1.11'; // for local network // Router
//const ipAdress = '192.168.178.35'; // for local network // Wernau
const ipAdress = '192.168.1.188'; // Router
///////////////////////////////////////////////////////////////////////

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
    constructor(id, startData) {
        this.id = id;
        this.color = startData.color;
        this.playerNumber = startData.playerNumber;
        this.startPosition = { x: startData.position.x, y: startData.position.y, z: startData.position.z };
        this.position = { x: startData.position.x, y: startData.position.y, z: startData.position.z };
        this.rotation = { x: startData.rotation.x, y: startData.rotation.y, z: startData.rotation.z };
        this.contrPosR = { x: startData.position.x, y: startData.position.y, z: startData.position.z };
        this.contrPosL = { x: startData.position.x, y: startData.position.y, z: startData.position.z };
        this.contrRotR = { x: startData.rotation.x, y: startData.rotation.y, z: startData.rotation.z };
        this.contrRotL = { x: startData.rotation.x, y: startData.rotation.y, z: startData.rotation.z };
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
var activeColor = '#ffffff';

// Server Variables
let serverStartTime;

// Game Variables
const maxPlayers = 4;
const playCubeSize = { x: 3, y: 2.5, z: 3 }; // the size of the player cube in meters
const playerAreaDepth = 1.5; // the depth of the player area in the z direction in meters

let ball = {
    position: { x: 0, y: playCubeSize.y / 2, z: 0 },
    direction: { x: 1, y: 0.2, z: 2 },
    speed: 0.02,
    size: 0.1
}

const playerPaddleSize = { h: 0.2, w: 0.4 }; // the size of the player plane in meters

let sceneStartinfos = {
    playCubeSize: playCubeSize,
    playerAreaDepth: playerAreaDepth,
    ballSize: ball.size,
    ballStartPos: ball.position,
    playerPaddleSize: playerPaddleSize
}

let playerStartInfos = {
    1: {
        playerNumber: 1,
        position: { x: (playCubeSize.x / 2 + playerAreaDepth / 2), y: 0, z: 0 },
        rotation: { x: 0, y: -Math.PI / 2, z: 0 },
        color: '#00ffff', //CMY //Cyan
        // color: '#ff0000', //RGB
        used: false
    },
    2: {
        playerNumber: 2,
        position: { x: -(playCubeSize.x / 2 + playerAreaDepth / 2), y: 0, z: 0 },
        rotation: { x: 0, y: Math.PI / 2, z: 0 },
        color: '#ff00ff', //CMY //Magenta
        // color: '#00ff00', //RGB
        used: false
    },
    3: {
        playerNumber: 3,
        position: { x: 0, y: 0, z: (playCubeSize.z / 2 + playerAreaDepth / 2) },
        rotation: { x: 0, y: Math.PI, z: 0 },
        color: '#ffff00', //CMY //Yellow
        // color: '#0000ff', //RGB
        used: false
    },
    4: {
        playerNumber: 4,
        position: { x: 0, y: 0, z: -(playCubeSize.z / 2 + playerAreaDepth / 2) },
        rotation: { x: 0, y: 0, z: 0 },
        color: '#1aa543', //CMY //Green
        // color: '#ffff00', //RGB
        used: false
    }
}

// Store all connected players
let playerList = {};

////////////////////////////////////////////////////////////////////////////////

// Handle connections and logic
io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    socket.on('clientStartTime', (clientStartTime) => {
        if (clientStartTime < serverStartTime) {
            // console.log(`Client start time (${clientStartTime}) is lower than server start time (${serverStartTime}). Forcing reload.`);
            socket.emit('reload');
        } else {
            // console.log(`Client start time (${clientStartTime}) is higher than server start time (${serverStartTime}).`);
        }
    });

    if (Object.keys(playerList).length >= maxPlayers) {
        console.log(`Maximum number of players reached. Player ${socket.id} has to wait in the waiting room.`);
        socket.emit('maxPlayersReached', { message: 'Maximum number of players reached. Wait for Players to leave the Game.' });
    }

    socket.join('waitingRoom');
    socket.emit('joinedWaitingRoom');
    socket.emit('timeForPreviousPlayers');

    // Send the current state to the new player
    socket.emit('currentState', playerList, activeColor, playerStartInfos, sceneStartinfos);

    socket.on('continueAsPreviousPlayer', (previousPlayerData) => {
        if (playerStartInfos[previousPlayerData.playerNumber].used == false) {
            playerStartInfos[previousPlayerData.playerNumber].used = true;

            const newPlayer = new Player(socket.id, previousPlayerData);

            startClientGame(newPlayer, socket);
        } else {
            socket.emit('startPosDenied');
        }
    });

    socket.on('requestGameStart', (startPlayerNum) => {
        if (playerStartInfos[startPlayerNum].used == false) {
            playerStartInfos[startPlayerNum].used = true;

            const newPlayer = new Player(socket.id, playerStartInfos[startPlayerNum]);

            startClientGame(newPlayer, socket);
        } else {
            socket.emit('startPosDenied');
        }
    });

    socket.on('playerEndVR', () => {

        if (socket.id in playerList) {
            console.log(`Player ${socket.id} left the Game.`);

            playerStartInfos[playerList[socket.id].playerNumber].used = false;

            delete playerList[socket.id];

            // socket.removeListener('clientUpdate');

            socket.leave('gameRoom');
            socket.join('waitingRoom');

            io.emit('playerDisconnected', socket.id);
        }
    });

    // Handle player disconnection
    socket.on('disconnect', () => {

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
    serverStartTime = Date.now();
    // console.log('Server start time: ' + serverStartTime);
});

// Game loop
setInterval(function () {

    if (Object.keys(playerList).length > 0) {
        // Update the ball position
        ball.position.x += ball.direction.x * ball.speed;
        ball.position.y += ball.direction.y * ball.speed;
        ball.position.z += ball.direction.z * ball.speed;

        // Bounce the ball off the walls
        // if (Math.abs(ball.position.x) > playCubeSize.x / 2) {
        //     ball.direction.x *= -1;  // Reverse X direction
        //     changeTestColor();
        // }

        // Always bounce the ball off the top and bottom
        if ((ball.position.y) > playCubeSize.y || (ball.position.y) < 0) {
            ball.direction.y *= -1;  // Reverse Y direction
            changeTestColor();
        }

        // Bounce the ball of the wall if there is no player
        if (playerStartInfos[1].used == false) {
            if (ball.position.x > playCubeSize.x / 2) {
                ball.direction.x *= -1;  // Reverse X direction
                changeTestColor();
            }
        }
        if (playerStartInfos[2].used == false) {
            if (ball.position.x < -playCubeSize.x / 2) {
                ball.direction.x *= -1;  // Reverse X direction
                changeTestColor();
            }
        }
        if (playerStartInfos[3].used == false) {
            if (ball.position.z > playCubeSize.z / 2) {
                ball.direction.z *= -1;  // Reverse X direction
                changeTestColor();
            }
        }
        if (playerStartInfos[4].used == false) {
            if (ball.position.z < -playCubeSize.z / 2) {
                ball.direction.z *= -1;  // Reverse X direction
                changeTestColor();
            }
        }

        Object.keys(playerList).forEach((key) => {
            if (playerList[key].playerNumber == 1) {
                if (ball.position.x > playCubeSize.x / 2 &&
                    playerList[key].contrPosR.z - playerPaddleSize.w / 2 < ball.position.z && ball.position.z < playerList[key].contrPosR.z + playerPaddleSize.w / 2 &&
                    playerList[key].contrPosR.y - playerPaddleSize.h / 2 < ball.position.y && ball.position.y < playerList[key].contrPosR.y + playerPaddleSize.h / 2) {
                    if (ball.direction.x > 0) {
                        ball.direction.x *= -1;  // Reverse X direction
                        changeTestColor();
                    }
                }

            } else if (playerList[key].playerNumber == 2) {
                if (ball.position.x < -playCubeSize.x / 2 &&
                    playerList[key].contrPosR.z - playerPaddleSize.w / 2 < ball.position.z && ball.position.z < playerList[key].contrPosR.z + playerPaddleSize.w / 2 &&
                    playerList[key].contrPosR.y - playerPaddleSize.h / 2 < ball.position.y && ball.position.y < playerList[key].contrPosR.y + playerPaddleSize.h / 2) {
                    if (ball.direction.x < 0) {
                        ball.direction.x *= -1;  // Reverse X direction
                        changeTestColor();
                    }
                }
            } else if (playerList[key].playerNumber == 3) {
                if (ball.position.z > playCubeSize.z / 2 &&
                    playerList[key].contrPosR.x - playerPaddleSize.w / 2 < ball.position.x && ball.position.x < playerList[key].contrPosR.x + playerPaddleSize.w / 2 &&
                    playerList[key].contrPosR.y - playerPaddleSize.h / 2 < ball.position.y && ball.position.y < playerList[key].contrPosR.y + playerPaddleSize.h / 2) {
                    if (ball.direction.z > 0) {
                        ball.direction.z *= -1;  // Reverse X direction
                        changeTestColor();
                    }
                }
            } else if (playerList[key].playerNumber == 4) {
                if (ball.position.z < -playCubeSize.z / 2 &&
                    playerList[key].contrPosR.x - playerPaddleSize.w / 2 < ball.position.x && ball.position.x < playerList[key].contrPosR.x + playerPaddleSize.w / 2 &&
                    playerList[key].contrPosR.y - playerPaddleSize.h / 2 < ball.position.y && ball.position.y < playerList[key].contrPosR.y + playerPaddleSize.h / 2) {
                    if (ball.direction.z < 0) {
                        ball.direction.z *= -1;  // Reverse X direction
                        changeTestColor();
                    }
                }
            }

            // reset the ball if out of bounds
            if (ball.position.x > playCubeSize.x / 2 + 0.5 || ball.position.x < -playCubeSize.x / 2 - 0.5 ||
                ball.position.z > playCubeSize.z / 2 + 0.5 || ball.position.z < -playCubeSize.z / 2 - 0.5) {
                ball.position = { x: 0, y: playCubeSize.y / 2, z: 0 };
                ball.direction = { x: 1, y: 0.2, z: 2 };
            }
        });
    }

    // Send the updated player list to all clients
    io.emit('serverUpdate', playerList, ball);
}, 20);

// Start the game for the new player
// can be called from a new player or an previous player
function startClientGame(newPlayer, socket) {

    // console.log('Playercount before join: ', Object.keys(playerList).length);

    socket.leave('waitingRoom');
    socket.join('gameRoom');

    console.log(`Player ${newPlayer.id} started playing.`);

    // Add new player to the game
    playerList[newPlayer.id] = newPlayer;

    // console.log('Playercount after join: ', Object.keys(playerList).length);

    // Start the Game on client side and send the player's information to the new player
    socket.emit('startClientGame', playerList[newPlayer.id]);

    // Notify other players of the new player (waitingRoom and gameRoom)
    socket.to('waitingRoom').to('gameRoom').emit('newPlayer', playerList[newPlayer.id]);

    socket.on('clientUpdate', (data) => {
        // console.log('Player data received:');
        // console.log(data.contrRotR);
        playerList[socket.id].setData(data);
        // console.log('Player data updated:');
        // console.log(playerList[socket.id].contrRotR);
    });

    // Test color change for connection
    socket.on('clicked', () => {
        changeTestColor();
    });

    socket.on('testClick', (id) => {
        console.log(`Player Position: x: ${playerList[id].contrPosR.x}, y: ${playerList[id].contrPosR.y}, z: ${playerList[id].contrPosR.z}`);
        console.log(`Ball Position: x: ${ball.position.x}, y: ${ball.position.y}, z: ${ball.position.z}`);
    });
};

function changeTestColor() {
    if (activeColor == color1) {
        activeColor = color2;
    } else {
        activeColor = color1;
    }

    io.emit('colorChanged', activeColor);
}