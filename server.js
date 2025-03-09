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
//const ipAdress = '192.168.178.84'; // Desktop zuhause // LAN
//const ipAdress = '192.168.178.35'; // Desktop zuhause // WLAN
//const ipAdress = '192.168.1.163'; // for local network // Router
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

class PlayerGameData {
    constructor(playerData) {
        this.id = playerData.id;
        this.position = { x: playerData.position.x, y: playerData.position.y, z: playerData.position.z };
        this.rotation = { x: playerData.rotation.x, y: playerData.rotation.y, z: playerData.rotation.z };
        this.contrPosR = { x: playerData.contrPosR.x, y: playerData.contrPosR.y, z: playerData.contrPosR.z };
        this.contrPosL = { x: playerData.contrPosL.x, y: playerData.contrPosL.y, z: playerData.contrPosL.z };
        this.contrRotR = { x: playerData.contrRotR.x, y: playerData.contrRotR.y, z: playerData.contrRotR.z };
        this.contrRotL = { x: playerData.contrRotL.x, y: playerData.contrRotL.y, z: playerData.contrRotL.z };
    }
}

class Player {
    constructor(id, startData) {
        this.id = id;
        this.color = startData.color;
        this.playerNumber = startData.playerNumber;
        this.score = 0;
        this.startPosition = { x: startData.position.x, y: startData.position.y, z: startData.position.z };
        this.position = { x: startData.position.x, y: startData.position.y, z: startData.position.z };
        this.rotation = { x: startData.rotation.x, y: startData.rotation.y, z: startData.rotation.z };
        this.contrPosR = { x: startData.position.x, y: startData.position.y, z: startData.position.z };
        this.contrPosL = { x: startData.position.x, y: startData.position.y, z: startData.position.z };
        this.contrRotR = { x: startData.rotation.x, y: startData.rotation.y, z: startData.rotation.z };
        this.contrRotL = { x: startData.rotation.x, y: startData.rotation.y, z: startData.rotation.z };
    }

    // set data coming from the client
    setData(data) {
        this.position = data.position;
        this.rotation = data.rotation;
        this.contrPosR = data.contrPosR;
        this.contrPosL = data.contrPosL;
        this.contrRotR = data.contrRotR;
        this.contrRotL = data.contrRotL;
    }

    // send the current player data to the client
    sendData() {
        io.emit('playerUpdate', this);
    }
};

//////////////////////////// Server Testing TCP /////////////////////////////

let connectedClientNumber = 0;

/////////////////////////////  VARIABLES  //////////////////////////////////
// Server Variables
let serverStartTime;

// Store all connected players
let playerList = {};

// Game Variables
const maxPlayers = 4;
const playCubeSize = { x: 1.5, y: 2, z: 1.5 }; // the size of the player cube in meters
const playCubeElevation = 0; // the elevation of the player cube in meters
const playerAreaDepth = 1; // the depth of the player area in the z direction in meters
const playerPaddleSize = { h: 0.2, w: 0.4 }; // the size of the player plane in meters
const ballStartSpeed = 0.02;
const ballStartColor = '#1f53ff';

let activeColor = ballStartColor;

let ball = {
    position: { x: 0, y: (playCubeSize.y / 2) - playCubeElevation, z: 0 },
    velocity: getNormalizedVector({ x: getRandomNumber(0.5, 2), y: getRandomNumber(0.5, 1), z: getRandomNumber(0.5, 2) }),
    speed: ballStartSpeed,
    size: 0.03,
    color: ballStartColor
}

let sceneStartinfos = {
    playCubeSize: playCubeSize,
    playCubeElevation: playCubeElevation,
    playerAreaDepth: playerAreaDepth,
    playerPaddleSize: playerPaddleSize,
    ballSize: ball.size,
    ballStartPos: ball.position,
    ballColor: ball.color
}

let playgroundDistance = 1; // the distance from the player area to the wall in meters

let playerStartInfos = {
    1: {
        playerNumber: 1,
        position: { x: (playCubeSize.x / 2 + playerAreaDepth / 2 + playgroundDistance), y: 0, z: 0 },
        rotation: { x: 0, y: -Math.PI / 2, z: 0 },
        color: '#00ffff', //CMY //Cyan
        // color: '#ff0000', //RGB
        used: false
    },
    2: {
        playerNumber: 2,
        position: { x: -(playCubeSize.x / 2 + playerAreaDepth / 2 + playgroundDistance), y: 0, z: 0 },
        rotation: { x: 0, y: Math.PI / 2, z: 0 },
        color: '#ff00ff', //CMY //Magenta
        // color: '#00ff00', //RGB
        used: false
    },
    3: {
        playerNumber: 3,
        position: { x: 0, y: 0, z: (playCubeSize.z / 2 + playerAreaDepth / 2 + playgroundDistance) },
        rotation: { x: 0, y: Math.PI, z: 0 },
        color: '#ffff00', //CMY //Yellow
        // color: '#0000ff', //RGB
        used: false
    },
    4: {
        playerNumber: 4,
        position: { x: 0, y: 0, z: -(playCubeSize.z / 2 + playerAreaDepth / 2 + playgroundDistance) },
        rotation: { x: 0, y: 0, z: 0 },
        color: '#1aa543', //CMY //Green
        // color: '#ffff00', //RGB
        used: false
    }
}

////////////////////////////////////////////////////////////////////////////////

// Handle connections and logic
io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);
    socket.emit('ClientID', socket.id);
    connectedClientNumber++;

    // Network Ping Pong Test //

    socket.on('pong', (data) => {
        console.log("Pong received");
        console.log("Pong received Data: " + data.serverSendTime + " | " + data.clientReceiveTime + " | " + data.clientId);
        const serverReceiveTime = Date.now();
        const serverSendTime = data.serverSendTime;
        const clientReceiveTime = data.clientReceiveTime;

        const serverToClientLatency = clientReceiveTime - serverSendTime;
        const clientToServerLatency = serverReceiveTime - clientReceiveTime;

        console.log(`${data.clientId}: Server -> Client: ${serverToClientLatency} ms | Client -> Server: ${clientToServerLatency} ms, Roundtrip: ${serverToClientLatency + clientToServerLatency} ms`);
    });

    socket.on('ServerPong', (clientServerSendTime) => {
        const ServerSendTime = clientServerSendTime;
        const ServerReceiveTime = Date.now();
        const ServerRoundTripTime = ServerReceiveTime - ServerSendTime;
        console.log('Server Round Trip Time: ', ServerRoundTripTime);
    });

    socket.on('clientRoundTripTime', (clientRoundTripTime, id) => {
        console.log(`${id} RTT: ${clientRoundTripTime}`);
    });

    // Function to send a ping message to the client
    // function sendPing() {
    //     const serverSendTime = Date.now();
    //     socket.emit('ping', { serverSendTime, clientId: socket.id, ballPos: ball.position });
    // }

    // Send a ping message every 5 seconds
    // const pingInterval = setInterval(sendPing, 500);

    // End Network Ping Pong Test //

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
            socket.emit('timeForPreviousPlayers');

            io.emit('playerDisconnected', socket.id);
            io.emit('scoreUpdate', socket.id, 0);
        }
    });

    // Handle player disconnection
    socket.on('disconnect', () => {
        //clearInterval(pingInterval);
        connectedClientNumber--;

        if (socket.id in playerList) {
            console.log(`Player ${socket.id} disconnected from the game.`);

            playerStartInfos[playerList[socket.id].playerNumber].used = false;

            delete playerList[socket.id];
        } else {
            console.log(`Player ${socket.id} disconnected from the waiting room.`);
        }

        io.emit('playerDisconnected', socket.id);
        io.emit('scoreUpdate', socket.id, 0);
    });
});

httpsServer.listen(port, ipAdress, () => {
    // console.log('Server is listening on port https://localhost:' + port);        // for localhost network
    console.log('Server is listening on port https://' + ipAdress + ':' + port);    // for local ip network
    serverStartTime = Date.now();
    // console.log('Server start time: ' + serverStartTime);
});

///////////////////////// Game loop and logic /////////////////////////////
// if (connectedClientNumber > 0) {
//    console.log('Game loop started.');
setInterval(function () {

    // if there are players in the game
    if (Object.keys(playerList).length > 0) {
        // Update the ball position
        ball.position.x += ball.velocity.x * ball.speed;
        ball.position.y += ball.velocity.y * ball.speed;
        ball.position.z += ball.velocity.z * ball.speed;

        // if (ball.position.x < playCubeSize.x / 2 || ball.position.x > -playCubeSize.x / 2 || ball.position.z < playCubeSize.z / 2 || ball.position.z > -playCubeSize.z / 2) {

        // Bounce off walls --------------------------------------------------------------------------------------
        // Always bounce the ball off the top and bottom
        if (ball.position.y + ball.size >= playCubeSize.y) {
            ball.position.y = playCubeSize.y - ball.size;
            ball.velocity.y *= -1;  // Reverse Y velocity
            ballBounce(5, false);
        }
        if (ball.position.y - ball.size <= playCubeElevation) {
            ball.position.y = playCubeElevation + ball.size;
            ball.velocity.y *= -1;  // Reverse Y velocity
            ballBounce(6, false);
        }

        // Bounce the ball of the wall if there is no player
        if (playerStartInfos[1].used == false) {
            if (ball.position.x + ball.size >= playCubeSize.x / 2) {
                ball.position.x = playCubeSize.x / 2 - ball.size;
                ball.velocity.x *= -1;  // Reverse X velocity
                ballBounce(1, false);
            }
        }
        if (playerStartInfos[2].used == false) {
            if (ball.position.x - ball.size <= -playCubeSize.x / 2) {
                ball.position.x = -playCubeSize.x / 2 + ball.size;
                ball.velocity.x *= -1;  // Reverse X velocity
                ballBounce(2, false);
            }
        }
        if (playerStartInfos[3].used == false) {
            if (ball.position.z + ball.size >= playCubeSize.z / 2) {
                ball.position.z = playCubeSize.z / 2 - ball.size;
                ball.velocity.z *= -1;  // Reverse Z velocity
                ballBounce(3, false);
            }
        }
        if (playerStartInfos[4].used == false) {
            if (ball.position.z - ball.size <= -playCubeSize.z / 2) {
                ball.position.z = -playCubeSize.z / 2 + ball.size;
                ball.velocity.z *= -1;  // Reverse Z velocity
                ballBounce(4, false);
            }
        }

        // Bounce off paddles --------------------------------------------------------------------------------------
        // Check for collision with player paddles
        Object.keys(playerList).forEach((key) => {
            if (playerList[key].playerNumber == 1) {
                // clamp the paddle position to the play area
                let paddleY, paddleZ;
                if (playerList[key].contrPosR.y + playerPaddleSize.h / 2 > playCubeSize.y) {
                    paddleY = playCubeSize.y - playerPaddleSize.h / 2;
                } else if (playerList[key].contrPosR.y - playerPaddleSize.h / 2 < playCubeElevation) {
                    paddleY = playCubeElevation + playerPaddleSize.h / 2;
                } else {
                    paddleY = playerList[key].contrPosR.y;
                }
                if (playerList[key].contrPosR.z + playerPaddleSize.w / 2 > playCubeSize.z / 2) {
                    paddleZ = playCubeSize.z / 2 - playerPaddleSize.w / 2;
                } else if (playerList[key].contrPosR.z - playerPaddleSize.w / 2 < -playCubeSize.z / 2) {
                    paddleZ = -playCubeSize.z / 2 + playerPaddleSize.w / 2;
                } else {
                    paddleZ = playerList[key].contrPosR.z;
                }
                // clamped paddle position to use for the collision and bounce calculation
                let clampedPaddlePos = { x: playCubeSize.x / 2, y: paddleY, z: paddleZ };

                if (ball.position.x + ball.size >= playCubeSize.x / 2 && ball.position.x < playCubeSize.x / 2 + ball.size &&
                    clampedPaddlePos.z - playerPaddleSize.w / 2 <= ball.position.z + ball.size && ball.position.z - ball.size <= clampedPaddlePos.z + playerPaddleSize.w / 2 &&
                    clampedPaddlePos.y - playerPaddleSize.h / 2 <= ball.position.y + ball.size && ball.position.y - ball.size <= clampedPaddlePos.y + playerPaddleSize.h / 2) {
                    if (ball.velocity.x >= 0) {
                        // ball.velocity.x *= -1;  // Reverse X velocity
                        calculateBallBounce(clampedPaddlePos, playerList[key].playerNumber);

                        playerList[key].score += 1;
                        ballBounce(1, true);
                        io.emit('scoreUpdate', playerList[key].id, playerList[key].score);
                    }
                }

            } else if (playerList[key].playerNumber == 2) {
                // clamp the paddle position to the play area
                let paddleY, paddleZ;
                if (playerList[key].contrPosR.y + playerPaddleSize.h / 2 > playCubeSize.y) {
                    paddleY = playCubeSize.y - playerPaddleSize.h / 2;
                } else if (playerList[key].contrPosR.y - playerPaddleSize.h / 2 < playCubeElevation) {
                    paddleY = playCubeElevation + playerPaddleSize.h / 2;
                } else {
                    paddleY = playerList[key].contrPosR.y;
                }
                if (playerList[key].contrPosR.z + playerPaddleSize.w / 2 > playCubeSize.z / 2) {
                    paddleZ = playCubeSize.z / 2 - playerPaddleSize.w / 2;
                } else if (playerList[key].contrPosR.z - playerPaddleSize.w / 2 < -playCubeSize.z / 2) {
                    paddleZ = -playCubeSize.z / 2 + playerPaddleSize.w / 2;
                } else {
                    paddleZ = playerList[key].contrPosR.z;
                }
                // clamped paddle position to use for the collision and bounce calculation
                let clampedPaddlePos = { x: -playCubeSize.x / 2, y: paddleY, z: paddleZ };

                if (ball.position.x - ball.size <= -playCubeSize.x / 2 && ball.position.x > -playCubeSize.x / 2 - ball.size &&
                    clampedPaddlePos.z - playerPaddleSize.w / 2 <= ball.position.z + ball.size && ball.position.z - ball.size <= clampedPaddlePos.z + playerPaddleSize.w / 2 &&
                    clampedPaddlePos.y - playerPaddleSize.h / 2 <= ball.position.y + ball.size && ball.position.y - ball.size <= clampedPaddlePos.y + playerPaddleSize.h / 2) {
                    if (ball.velocity.x < 0) {
                        // ball.velocity.x *= -1;  // Reverse X velocity
                        calculateBallBounce(clampedPaddlePos, playerList[key].playerNumber);

                        playerList[key].score += 1;
                        ballBounce(2, true);
                        io.emit('scoreUpdate', playerList[key].id, playerList[key].score);
                    }
                }
            } else if (playerList[key].playerNumber == 3) {
                // clamp the paddle position to the play area
                let paddleY, paddleX;
                if (playerList[key].contrPosR.y + playerPaddleSize.h / 2 > playCubeSize.y) {
                    paddleY = playCubeSize.y - playerPaddleSize.h / 2;
                } else if (playerList[key].contrPosR.y - playerPaddleSize.h / 2 < playCubeElevation) {
                    paddleY = playCubeElevation + playerPaddleSize.h / 2;
                } else {
                    paddleY = playerList[key].contrPosR.y;
                }
                if (playerList[key].contrPosR.x + playerPaddleSize.w / 2 > playCubeSize.x / 2) {
                    paddleX = playCubeSize.x / 2 - playerPaddleSize.w / 2;
                } else if (playerList[key].contrPosR.x - playerPaddleSize.w / 2 < -playCubeSize.x / 2) {
                    paddleX = -playCubeSize.x / 2 + playerPaddleSize.w / 2;
                } else {
                    paddleX = playerList[key].contrPosR.x;
                }
                // clamped paddle position to use for the collision and bounce calculation
                let clampedPaddlePos = { x: paddleX, y: paddleY, z: playCubeSize.z / 2 };

                if (ball.position.z + ball.size >= playCubeSize.z / 2 && ball.position.z < playCubeSize.x / 2 + ball.size &&
                    clampedPaddlePos.x - playerPaddleSize.w / 2 < ball.position.x + ball.size && ball.position.x - ball.size < clampedPaddlePos.x + playerPaddleSize.w / 2 &&
                    clampedPaddlePos.y - playerPaddleSize.h / 2 < ball.position.y + ball.size && ball.position.y - ball.size < clampedPaddlePos.y + playerPaddleSize.h / 2) {
                    if (ball.velocity.z >= 0) {
                        // ball.velocity.z *= -1;  // Reverse Z velocity
                        calculateBallBounce(clampedPaddlePos, playerList[key].playerNumber);

                        playerList[key].score += 1;
                        ballBounce(3, true);
                        io.emit('scoreUpdate', playerList[key].id, playerList[key].score);
                    }
                }
            } else if (playerList[key].playerNumber == 4) {
                // clamp the paddle position to the play area
                let paddleY, paddleX;
                if (playerList[key].contrPosR.y + playerPaddleSize.h / 2 > playCubeSize.y) {
                    paddleY = playCubeSize.y - playerPaddleSize.h / 2;
                } else if (playerList[key].contrPosR.y - playerPaddleSize.h / 2 < playCubeElevation) {
                    paddleY = playCubeElevation + playerPaddleSize.h / 2;
                } else {
                    paddleY = playerList[key].contrPosR.y;
                }
                if (playerList[key].contrPosR.x + playerPaddleSize.w / 2 > playCubeSize.x / 2) {
                    paddleX = playCubeSize.x / 2 - playerPaddleSize.w / 2;
                } else if (playerList[key].contrPosR.x - playerPaddleSize.w / 2 < -playCubeSize.x / 2) {
                    paddleX = -playCubeSize.x / 2 + playerPaddleSize.w / 2;
                } else {
                    paddleX = playerList[key].contrPosR.x;
                }
                // clamped paddle position to use for the collision and bounce calculation
                let clampedPaddlePos = { x: paddleX, y: paddleY, z: -playCubeSize.z / 2 };

                if (ball.position.z - ball.size <= -playCubeSize.z / 2 && ball.position.z > -playCubeSize.x / 2 - ball.size &&
                    clampedPaddlePos.x - playerPaddleSize.w / 2 < ball.position.x + ball.size && ball.position.x - ball.size < clampedPaddlePos.x + playerPaddleSize.w / 2 &&
                    clampedPaddlePos.y - playerPaddleSize.h / 2 < ball.position.y + ball.size && ball.position.y - ball.size < clampedPaddlePos.y + playerPaddleSize.h / 2) {
                    if (ball.velocity.z < 0) {
                        // ball.velocity.z *= -1;  // Reverse Z velocity
                        calculateBallBounce(clampedPaddlePos, playerList[key].playerNumber);

                        playerList[key].score += 1;
                        ballBounce(4, true);
                        io.emit('scoreUpdate', playerList[key].id, playerList[key].score);
                    }
                }
            }
        });
        // value for the out of bounds check
        let outOfBoundsValue = 0.3;

        // reset the ball if out of bounds
        if (ball.position.x > playCubeSize.x / 2 + outOfBoundsValue || ball.position.x < -playCubeSize.x / 2 - outOfBoundsValue ||
            ball.position.z > playCubeSize.z / 2 + outOfBoundsValue || ball.position.z < -playCubeSize.z / 2 - outOfBoundsValue) {


            // Reset Player points on miss --------------------------------------------------------------------------------------
            if (ball.position.x > playCubeSize.x / 2 + outOfBoundsValue) {
                // player 1 missed
                Object.keys(playerList).forEach((key) => {
                    if (playerList[key].playerNumber == 1) {
                        playerList[key].score = scoreAfterMiss(playerList[key].score);
                        io.emit('scoreUpdate', playerList[key].id, playerList[key].score);
                    }
                });
            } else if (ball.position.x < -playCubeSize.x / 2 - outOfBoundsValue) {
                // player 2 missed
                Object.keys(playerList).forEach((key) => {
                    if (playerList[key].playerNumber == 2) {
                        playerList[key].score = scoreAfterMiss(playerList[key].score);
                        io.emit('scoreUpdate', playerList[key].id, playerList[key].score);
                    }
                });
            } else if (ball.position.z > playCubeSize.z / 2 + outOfBoundsValue) {
                // player 3 missed
                Object.keys(playerList).forEach((key) => {
                    if (playerList[key].playerNumber == 3) {
                        playerList[key].score = scoreAfterMiss(playerList[key].score);
                        io.emit('scoreUpdate', playerList[key].id, playerList[key].score);
                    }
                });
            } else if (ball.position.z < -playCubeSize.z / 2 - outOfBoundsValue) {
                // player 4 missed
                Object.keys(playerList).forEach((key) => {
                    if (playerList[key].playerNumber == 4) {
                        playerList[key].score = scoreAfterMiss(playerList[key].score);
                        io.emit('scoreUpdate', playerList[key].id, playerList[key].score);
                    }
                });
            }
            // Reset the ball
            resetGame();
        } else {
            // make the ball always a litle bit faster
            ball.speed += 0.00001;
        }

        // Sending the current game state to all players
        // the necessary data of the players and the ball
        io.emit('serverUpdate', prepareGameData(), ball.position, Date.now());

    } else {
        // reset the ball if no player is in the game
        if (ball.position.x != 0 && ball.position.y != (playCubeSize.y / 2) - playCubeElevation && ball.position.z != 0) {
            resetGame();
        }
    }
}, 20);
// }

///////////////////////// End Game loop and logic /////////////////////////////

// prepare the player Data package for sending to the clients
// only send the necessary data to the clients (postion, rotation, id)
function prepareGameData() {
    let playerGameDataList = {};
    Object.keys(playerList).forEach((key) => {
        playerGameDataList[key] = new PlayerGameData(playerList[key]);
    });

    // console.log(playerGameDataList);
    return playerGameDataList;
}

function scoreAfterMiss(oldScore) {
    let newScore = oldScore - 10;
    if (newScore < 0) {
        newScore = 0;
    }
    return newScore;
}

// Start the game for the new player
// can be called from a new player or an previous player
function startClientGame(newPlayer, socket) {

    socket.leave('waitingRoom');
    socket.join('gameRoom');

    console.log(`Player ${newPlayer.id} started playing.`);

    // Add new player to the game
    playerList[newPlayer.id] = newPlayer;

    // Start the Game on client side and send the player's information to the new player
    socket.emit('startClientGame', playerList[newPlayer.id]);

    // Notify other players of the new player (waitingRoom and gameRoom)
    socket.to('waitingRoom').to('gameRoom').emit('newPlayer', playerList[newPlayer.id]);

    socket.on('clientUpdate', (data) => {
        playerList[socket.id].setData(data);
        socket.emit('clientPong', data.clientSendTime);
    });

    // Test color change for connection
    // socket.on('clicked', (playerColor) => {
    //     changeBallColor(playerColor);
    // });

    socket.on('testClick', (id) => {
        playerList[id].score += 1;
        io.emit('scoreUpdate', id, playerList[id].score);
    });
};

// function changeBallColor(playerColor) {
//     activeColor = playerColor;

//     io.emit('colorChanged', activeColor);
// }

function getRandomNumber(min, max) {
    const num = Math.random() * (max - min) + min;
    return Math.random() < 0.5 ? num : -num;
}

function getNormalizedVector(vector) {
    const length = Math.sqrt(vector.x * vector.x + vector.y * vector.y + vector.z * vector.z);
    return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
}

function resetGame() {
    ball.position = { x: 0, y: (playCubeSize.y / 2) - playCubeElevation, z: 0 };
    ball.velocity = getNormalizedVector({ x: getRandomNumber(0.5, 2), y: getRandomNumber(0.5, 1), z: getRandomNumber(0.5, 2) });
    ball.speed = ballStartSpeed;
    ball.color = ballStartColor;
    // changeBallColor(ballStartColor);
}

function calculateBallBounce(contrRPos, playerNumber) {

    // define the min and max distance from the paddle center to the ball
    // for the width and height
    let ballPaddleMinDistW = -playerPaddleSize.w / 2 - ball.size;
    let ballPaddleMaxDistW = playerPaddleSize.w / 2 + ball.size;

    let ballPaddleMinDistH = -playerPaddleSize.h / 2 - ball.size;
    let ballPaddleMaxDistH = playerPaddleSize.h / 2 + ball.size;

    // define the max angle for the bounce
    // 2 = 90°, 4 = 45°, 6 = 30°, 8 = 22.5°, 9 = 20°
    const maxBounceAngleW = Math.PI / 3;
    const maxBounceAngleH = Math.PI / 3;

    // constant speed (should always be 1)
    const velocitySpeedCheck = Math.sqrt(ball.velocity.x ** 2 + ball.velocity.y ** 2 + ball.velocity.z ** 2);
    const velocitySpeed = 1;
    // console.log('velocitySpeedCheck: ' + velocitySpeedCheck);

    let impactZ, impactX;
    let bounceAngleZ, bounceAngleX;

    // new variable to calculate the bounce
    // first assign the current velocity to the bounce velocity
    let ballBounceVelocity = { x: ball.velocity.x, y: ball.velocity.y, z: ball.velocity.z };

    // always calculate the impact on the height
    const impactY = 2 * (((ball.position.y - contrRPos.y) - ballPaddleMinDistH) / (ballPaddleMaxDistH - ballPaddleMinDistH)) - 1; // [-1, 1]
    const bounceAngleY = impactY * maxBounceAngleH;

    ballBounceVelocity.y = velocitySpeed * Math.sin(bounceAngleY);

    // calculate the impact diffenrently for the players because of the different axis
    if (playerNumber == 1 || playerNumber == 2) {
        impactZ = 2 * (((ball.position.z - contrRPos.z) - ballPaddleMinDistW) / (ballPaddleMaxDistW - ballPaddleMinDistW)) - 1;  // [-1, 1]
        bounceAngleZ = impactZ * maxBounceAngleW;

        // calculate the new velocity for z and x
        // for player 1 and 2 z is fo the width and x for the depth
        ballBounceVelocity.z = velocitySpeed * Math.sin(bounceAngleZ);

        if (playerNumber == 1) { // negative x direction for player 1
            ballBounceVelocity.x = -Math.sqrt(Math.max(0.09, velocitySpeed ** 2 - ballBounceVelocity.z ** 2 - ballBounceVelocity.y ** 2)); // Adjust depth velocity to maintain speed
        } else if (playerNumber == 2) { // positive x direction for player 2
            ballBounceVelocity.x = Math.sqrt(Math.max(0.09, velocitySpeed ** 2 - ballBounceVelocity.z ** 2 - ballBounceVelocity.y ** 2)); // Adjust depth velocity to maintain speed
        }
    } else if (playerNumber == 3 || playerNumber == 4) {
        impactX = 2 * (((ball.position.x - contrRPos.x) - ballPaddleMinDistW) / (ballPaddleMaxDistW - ballPaddleMinDistW)) - 1;  // [-1, 1]
        bounceAngleX = impactX * maxBounceAngleW;

        // calculate the new velocity for x and z
        // for player 3 and 4 x is fo the width and z for the depth
        ballBounceVelocity.x = velocitySpeed * Math.sin(bounceAngleX);

        if (playerNumber == 3) { // negative z direction for player 3
            ballBounceVelocity.z = -Math.sqrt(Math.max(0.09, velocitySpeed ** 2 - ballBounceVelocity.x ** 2 - ballBounceVelocity.y ** 2)); // Adjust depth velocity to maintain speed
        } else if (playerNumber == 4) { // positive z direction for player 4
            ballBounceVelocity.z = Math.sqrt(Math.max(0.09, velocitySpeed ** 2 - ballBounceVelocity.x ** 2 - ballBounceVelocity.y ** 2)); // Adjust depth velocity to maintain speed
        }
    }
    // the fix with the Math.max(0.01, ...) is needed because sometimes the velocity is negative and the sqrt function can't handle negative values
    // so the velocity is set to 0.01 to avoid the error
    // this will affect the balls speed a little bit, but it is not noticeable and will fix itself after a view bounces

    let inOutStrength = 1.2;

    let inOutBounce, middleVector;
    if (playerNumber == 1 || playerNumber == 2) { // negative z direction for player 1 and 2
        inOutBounce = ball.velocity.x * -1;
        middleVector = { x: (ballBounceVelocity.x + inOutBounce), y: (ballBounceVelocity.y + ball.velocity.y * inOutStrength), z: (ballBounceVelocity.z + ball.velocity.z * inOutStrength) };
    } else if (playerNumber == 3 || playerNumber == 4) { // negative z direction for player 3 and 4
        inOutBounce = ball.velocity.z * -1;
        middleVector = { x: (ballBounceVelocity.x + ball.velocity.x * inOutStrength), y: (ballBounceVelocity.y + ball.velocity.y * inOutStrength), z: (ballBounceVelocity.z + inOutBounce) };
    }

    // take the middle vector between the normal bounce and the paddle bounce
    //let middleVector = { x: (ballBounceVelocity.x + ball.velocity.x), y: (ballBounceVelocity.y + ball.velocity.y), z: (ballBounceVelocity.z + ball.velocity.z) };
    ballBounceVelocity = getNormalizedVector(middleVector);

    // console.log('Velocity X: ', ballBounceVelocity.x);

    // ballBounceVelocity = getNormalizedVector(ballBounceVelocity);

    ball.velocity = ballBounceVelocity;
}

function ballBounce(playerNumber, isPaddle) {
    if (isPaddle == true) {
        // changeBallColor(playerStartInfos[playerNumber].color);
        // make the Ball faster, if the ball hits a paddle
        ball.speed += 0.0001;
    }
    io.emit('ballBounce', playerNumber, isPaddle);
}