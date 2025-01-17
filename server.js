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
const ipAdress = '192.168.178.156'; //wlan fuwa
//const ipAdress = '192.168.1.188'; // Router
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
        this.score = 0;
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

// Server Variables
let serverStartTime;

// Game Variables
const maxPlayers = 4;
const playCubeSize = { x: 1.5, y: 2, z: 1.5 }; // the size of the player cube in meters
const playerAreaDepth = 1; // the depth of the player area in the z direction in meters
const ballStartSpeed = 0.02;
const playerPaddleSize = { h: 0.2, w: 0.4 }; // the size of the player plane in meters
const ballStartColor = '#ffffff';

let activeColor = ballStartColor;

let ball = {
    position: { x: 0, y: playCubeSize.y / 2, z: 0 },
    direction: getNormalizedVector({ x: getRandomNumber(0.5, 2), y: getRandomNumber(0.5, 1), z: getRandomNumber(0.5, 2) }),
    speed: ballStartSpeed,
    size: 0.07,
    color: ballStartColor
}

let sceneStartinfos = {
    playCubeSize: playCubeSize,
    playerAreaDepth: playerAreaDepth,
    ballSize: ball.size,
    ballStartPos: ball.position,
    ballColor: ball.color,
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
            socket.emit('timeForPreviousPlayers');

            io.emit('playerDisconnected', socket.id);
            io.emit('scoreUpdate', socket.id, 0);
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
setInterval(function () {

    // if there are players in the game
    if (Object.keys(playerList).length > 0) {
        // Update the ball position
        ball.position.x += ball.direction.x * ball.speed;
        ball.position.y += ball.direction.y * ball.speed;
        ball.position.z += ball.direction.z * ball.speed;

        // Bounce off walls --------------------------------------------------------------------------------------
        // Always bounce the ball off the top and bottom
        if (ball.position.y + ball.size > playCubeSize.y || ball.position.y - ball.size < 0) {
            ball.direction.y *= -1;  // Reverse Y direction
            //changeBallColor();
        }

        // Bounce the ball of the wall if there is no player
        if (playerStartInfos[1].used == false) {
            if (ball.position.x + ball.size > playCubeSize.x / 2) {
                ball.direction.x *= -1;  // Reverse X direction
                ballBounce(1, false);
            }
        }
        if (playerStartInfos[2].used == false) {
            if (ball.position.x - ball.size < -playCubeSize.x / 2) {
                ball.direction.x *= -1;  // Reverse X direction
                ballBounce(2, false);
            }
        }
        if (playerStartInfos[3].used == false) {
            if (ball.position.z + ball.size > playCubeSize.z / 2) {
                ball.direction.z *= -1;  // Reverse Z direction
                ballBounce(3, false);
            }
        }
        if (playerStartInfos[4].used == false) {
            if (ball.position.z - ball.size < -playCubeSize.z / 2) {
                ball.direction.z *= -1;  // Reverse Z direction
                ballBounce(4, false);
            }
        }

        // Bounce off paddles --------------------------------------------------------------------------------------
        // Check for collision with player paddles
        Object.keys(playerList).forEach((key) => {
            if (playerList[key].playerNumber == 1) {
                if (ball.position.x + ball.size > playCubeSize.x / 2 && ball.position.x < playCubeSize.x / 2 &&
                    playerList[key].contrPosR.z - playerPaddleSize.w / 2 < ball.position.z + ball.size && ball.position.z - ball.size < playerList[key].contrPosR.z + playerPaddleSize.w / 2 &&
                    playerList[key].contrPosR.y - playerPaddleSize.h / 2 < ball.position.y + ball.size && ball.position.y - ball.size < playerList[key].contrPosR.y + playerPaddleSize.h / 2) {
                    if (ball.direction.x > 0) {
                        // ball.direction.x *= -1;  // Reverse X direction

                        calculateBallBounce(playerList[key].contrPosR, 1);

                        playerList[key].score += 1;
                        ballBounce(1, true);
                        io.emit('scoreUpdate', playerList[key].id, playerList[key].score);
                    }
                }

            } else if (playerList[key].playerNumber == 2) {
                if (ball.position.x - ball.size < -playCubeSize.x / 2 && ball.position.x > -playCubeSize.x / 2 &&
                    playerList[key].contrPosR.z - playerPaddleSize.w / 2 < ball.position.z && ball.position.z < playerList[key].contrPosR.z + playerPaddleSize.w / 2 &&
                    playerList[key].contrPosR.y - playerPaddleSize.h / 2 < ball.position.y && ball.position.y < playerList[key].contrPosR.y + playerPaddleSize.h / 2) {
                    if (ball.direction.x < 0) {
                        ball.direction.x *= -1;  // Reverse X direction
                        playerList[key].score += 1;
                        ballBounce(2, true);
                        io.emit('scoreUpdate', playerList[key].id, playerList[key].score);
                    }
                }
            } else if (playerList[key].playerNumber == 3) {
                if (ball.position.z + ball.size > playCubeSize.z / 2 && ball.position.z < playCubeSize.x / 2 &&
                    playerList[key].contrPosR.x - playerPaddleSize.w / 2 < ball.position.x && ball.position.x < playerList[key].contrPosR.x + playerPaddleSize.w / 2 &&
                    playerList[key].contrPosR.y - playerPaddleSize.h / 2 < ball.position.y && ball.position.y < playerList[key].contrPosR.y + playerPaddleSize.h / 2) {
                    if (ball.direction.z > 0) {
                        ball.direction.z *= -1;  // Reverse Z direction
                        playerList[key].score += 1;
                        ballBounce(3, true);
                        io.emit('scoreUpdate', playerList[key].id, playerList[key].score);
                    }
                }
            } else if (playerList[key].playerNumber == 4) {
                if (ball.position.z - ball.size < -playCubeSize.z / 2 && ball.position.z > -playCubeSize.x / 2 &&
                    playerList[key].contrPosR.x - playerPaddleSize.w / 2 < ball.position.x && ball.position.x < playerList[key].contrPosR.x + playerPaddleSize.w / 2 &&
                    playerList[key].contrPosR.y - playerPaddleSize.h / 2 < ball.position.y && ball.position.y < playerList[key].contrPosR.y + playerPaddleSize.h / 2) {
                    if (ball.direction.z < 0) {
                        ball.direction.z *= -1;  // Reverse Z direction
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
                        playerList[key].score = 0;
                        io.emit('scoreUpdate', playerList[key].id, playerList[key].score);
                    }
                });
            } else if (ball.position.x < -playCubeSize.x / 2 - outOfBoundsValue) {
                // player 2 missed
                Object.keys(playerList).forEach((key) => {
                    if (playerList[key].playerNumber == 2) {
                        playerList[key].score = 0;
                        io.emit('scoreUpdate', playerList[key].id, playerList[key].score);
                    }
                });
            } else if (ball.position.z > playCubeSize.z / 2 + outOfBoundsValue) {
                // player 3 missed
                Object.keys(playerList).forEach((key) => {
                    if (playerList[key].playerNumber == 3) {
                        playerList[key].score = 0;
                        io.emit('scoreUpdate', playerList[key].id, playerList[key].score);
                    }
                });
            } else if (ball.position.z < -playCubeSize.z / 2 - outOfBoundsValue) {
                // player 4 missed
                Object.keys(playerList).forEach((key) => {
                    if (playerList[key].playerNumber == 4) {
                        playerList[key].score = 0;
                        io.emit('scoreUpdate', playerList[key].id, playerList[key].score);
                    }
                });
            }
            // Reset the ball
            resetGame();
        }
    } else {
        // reset the ball if no player is in the game
        if (ball.position.x != 0 && ball.position.y != playCubeSize.y / 2 && ball.position.z != 0) {
            ball.position = { x: 0, y: playCubeSize.y / 2, z: 0 };
            resetGame();
        }
    }

    // Send the updated player list to all clients
    io.emit('serverUpdate', playerList, ball);
}, 20);

///////////////////////// End Game loop and logic /////////////////////////////

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
    });

    // Test color change for connection
    socket.on('clicked', (playerColor) => {
        changeBallColor(playerColor);
    });

    socket.on('testClick', (id) => {
        playerList[id].score += 1;
        io.emit('scoreUpdate', id, playerList[id].score);
    });
};

function changeBallColor(playerColor) {
    // if (activeColor == color1) {
    //     activeColor = color2;
    // } else {
    //     activeColor = color1;
    // }
    activeColor = playerColor;

    io.emit('colorChanged', activeColor);
}

function getRandomNumber(min, max) {
    const num = Math.random() * (max - min) + min;
    return Math.random() < 0.5 ? num : -num;
}

function getNormalizedVector(vector) {
    const length = Math.sqrt(vector.x * vector.x + vector.y * vector.y + vector.z * vector.z);
    return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
}

function resetGame() {
    ball.position = { x: 0, y: playCubeSize.y / 2, z: 0 };
    ball.direction = getNormalizedVector({ x: getRandomNumber(0.5, 2), y: getRandomNumber(0.5, 1), z: getRandomNumber(0.5, 2) });
    ball.speed = ballStartSpeed;
    ball.color = ballStartColor;
    changeBallColor(ballStartColor);
}

function calculateBallBounce(contrRPos, playerNumber) {

    const impactZ = (ball.x - contrRPos.x) / (playerPaddleSize.w / 2);  // [-1, 1]
    const impactY = (ball.y - contrRPos.y) / (playerPaddleSize.h / 2); // [-1, 1]

    // Adjust ball velocity based on impact positions
    const maxBounceAngleZ = Math.PI / 4; // 45 degrees max angle for horizontal direction
    const maxBounceAngleY = Math.PI / 4; // 45 degrees max angle for vertical direction

    const bounceAngleZ = impactZ * maxBounceAngleZ;
    const bounceAngleY = impactY * maxBounceAngleY;

    const speed = Math.sqrt(ball.vx ** 2 + ball.vy ** 2 + ball.vz ** 2); // Keep speed constant
    ball.direction.z = speed * Math.sin(bounceAngleZ);
    ball.direction.y = speed * Math.sin(bounceAngleY);
    ball.direction.x = -Math.sqrt(speed ** 2 - ball.direction.x ** 2 - ball.direction.y ** 2); // Adjust depth velocity to maintain speed
}

function ballBounce(playerNumber, isPaddle) {
    if (isPaddle == true) {
        changeBallColor(playerStartInfos[playerNumber].color);
        // make the Ball faster, if the ball hits a paddle
        ball.speed += 0.001;
    }
    io.emit('ballBounce', playerNumber, isPaddle);
}