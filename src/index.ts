import { io } from 'socket.io-client';
import { /*Camera,*/ Engine, FreeCamera, Scene } from '@babylonjs/core';
import { ArcRotateCamera, MeshBuilder, /*ShadowGenerator,*/ GlowLayer } from '@babylonjs/core';
import { HemisphericLight, DirectionalLight } from '@babylonjs/core';
import { Mesh, StandardMaterial, Texture, Color3, Vector3, Quaternion, LinesMesh } from '@babylonjs/core';
import { WebXRDefaultExperience, WebXRInputSource } from '@babylonjs/core/XR';
import { Inspector } from '@babylonjs/inspector';
// import * as GUI from '@babylonjs/gui'

import '@babylonjs/core/Materials/Textures/Loaders'; // Required for EnvironmentHelper
import '@babylonjs/loaders/glTF'; // Enable GLTF/GLB loader for loading controller models from WebXR Input registry

const socket = io();

const rotationQuaternion = null;
if (rotationQuaternion) {
    //console.log('Rotation Quaternion: ', rotationQuaternion);
}
let clientStartTime = Date.now();

let playerID: string;
let clientPlayer: Player | null = null;
let playerUsingVR: boolean = false;
// let clientStartPos: { x: number, y: number, z: number };

let playerList: { [key: string]: Player } = {};
let previousPlayer: PreviousPlayerData | null = null;
getLocalStorage();

let sceneStartInfos: SceneStartInfos;

let xr: WebXRDefaultExperience;
let xrCamera: FreeCamera | null = null;
let leftController: WebXRInputSource | null = null;
let rightController: WebXRInputSource | null = null;

// Get HTML Elements
const divFps = document.getElementById('fps');
const divID = document.getElementById('playerID');
const startPosButtons = document.querySelectorAll('.posSelection');
const startScreen = document.getElementById('startScreen');
const continueAsPreviousPlayer = document.getElementById('continueAsPreviousPlayer');
const loadingScreen = document.getElementById('loadingScreen');

// Create HTML Elements
const canvas = document.createElement('canvas'); // Create a canvas element for rendering
canvas.id = 'renderCanvas';
document.body.appendChild(canvas);


////////////////////////////// CREATE BABYLON SCENE ETC. //////////////////////////////

// Basic Setup ---------------------------------------------------------------------------------
const engine = new Engine(canvas, true);
const scene = new Scene(engine);

// Camera --------------------------------------------------------------------------------------
// Add a camera for the non-VR view in browser
var camera = new ArcRotateCamera('Camera', -(Math.PI / 4) * 3, Math.PI / 4, 10, new Vector3(0, 0, 0), scene);
camera.attachControl(true); //debug

function createBasicScene(sceneStartInfos: SceneStartInfos) {

    let playCubeSize = sceneStartInfos.playCubeSize;
    let playerAreaDepth = sceneStartInfos.playerAreaDepth;
    let ballSize = sceneStartInfos.ballSize;
    let ballStartPos = sceneStartInfos.ballStartPos;
    // let playerPaddleSize = sceneStartInfos.playerPaddleSize;

    // Lights --------------------------------------------------------------------------------------
    // Creates a light, aiming 0,1,0 - to the sky
    var hemiLight = new HemisphericLight('hemiLight', new Vector3(0, 1, 0), scene);
    hemiLight.intensity = 0.1;

    var dirLight = new DirectionalLight("DirectionalLight", new Vector3(-0.7, -0.5, 0.4), scene);
    dirLight.position = new Vector3(9, 11, -17);
    dirLight.intensity = 0.2;
    dirLight.shadowMaxZ = 130;
    dirLight.shadowMinZ = 10;

    // const pointLight = new PointLight('pointLight', new Vector3(0, 10, 0), scene);
    // pointLight.intensity = 0.3;
    // pointLight.position = new Vector3(12, 3, -6);
    // pointLight.diffuse = new Color3(1, 0.09, 0.043);

    // const pointLight2 = new PointLight('pointLight2', new Vector3(0, 10, 0), scene);
    // pointLight2.intensity = 0.3;
    // pointLight2.position = new Vector3(-12, 3, -6);
    // pointLight2.diffuse = new Color3(0.459, 0.047, 1);

    // add a Glowlayer to let emissive materials glow
    var gl = new GlowLayer("glow", scene, {
        mainTextureFixedSize: 1024,
        blurKernelSize: 64,
    });
    gl.intensity = 0.5;

    // Meshes --------------------------------------------------------------------------------------
    // Built-in 'sphere' shape.
    var testSphere = MeshBuilder.CreateSphere('testSphere', { diameter: 2, segments: 32 }, scene);
    testSphere.position = new Vector3(ballStartPos.x, ballStartPos.y, ballStartPos.z);
    testSphere.scaling = new Vector3(ballSize, ballSize, ballSize);

    // Built-in 'ground' shape.
    var ground = MeshBuilder.CreateGround('ground', { width: 60, height: 60 }, scene);

    var playBox = MeshBuilder.CreateBox('playBox', { size: 1 }, scene);
    playBox.position = new Vector3(0, playCubeSize.y / 2, 0);
    playBox.scaling = new Vector3(playCubeSize.x, playCubeSize.y, playCubeSize.z);

    // playBox.isVisible = false;

    // Grounds for the Player Start Positions
    var player1Ground = MeshBuilder.CreateBox('player1Ground', { size: 1 }, scene);
    player1Ground.position = new Vector3((playCubeSize.x / 2 + playerAreaDepth / 2) + 0.01, -25.001, 0);
    player1Ground.scaling = new Vector3(playerAreaDepth, 50, playCubeSize.z);

    var player2Ground = MeshBuilder.CreateBox('player2Ground', { size: 1 }, scene);
    player2Ground.position = new Vector3(-(playCubeSize.x / 2 + playerAreaDepth / 2) - 0.01, -25.001, 0);
    player2Ground.scaling = new Vector3(playerAreaDepth, 50, playCubeSize.z);

    var player3Ground = MeshBuilder.CreateBox('player3Ground', { size: 1 }, scene);
    player3Ground.position = new Vector3(0, -25.001, (playCubeSize.z / 2 + playerAreaDepth / 2) + 0.01);
    player3Ground.scaling = new Vector3(playCubeSize.x, 50, playerAreaDepth);

    var player4Ground = MeshBuilder.CreateBox('player4Ground', { size: 1 }, scene);
    player4Ground.position = new Vector3(0, -25.001, -(playCubeSize.z / 2 + playerAreaDepth / 2) - 0.01);
    player4Ground.scaling = new Vector3(playCubeSize.x, 50, playerAreaDepth);

    var player1Wall = MeshBuilder.CreateBox('player1Wall', { size: 1 }, scene);
    player1Wall.position = new Vector3(playCubeSize.x / 2 + 0.01, playCubeSize.y / 2, 0);
    player1Wall.scaling = new Vector3(0.01, playCubeSize.y, playCubeSize.z);

    var player2Wall = MeshBuilder.CreateBox('player2Wall', { size: 1 }, scene);
    player2Wall.position = new Vector3(-playCubeSize.x / 2 - 0.01, playCubeSize.y / 2, 0);
    player2Wall.scaling = new Vector3(0.01, playCubeSize.y, playCubeSize.z);

    var player3Wall = MeshBuilder.CreateBox('player3Wall', { size: 1 }, scene);
    player3Wall.position = new Vector3(0, playCubeSize.y / 2, playCubeSize.z / 2 + 0.01);
    player3Wall.scaling = new Vector3(playCubeSize.x, playCubeSize.y, 0.01);

    var player4Wall = MeshBuilder.CreateBox('player4Wall', { size: 1 }, scene);
    player4Wall.position = new Vector3(0, playCubeSize.y / 2, -playCubeSize.z / 2 - 0.01);
    player4Wall.scaling = new Vector3(playCubeSize.x, playCubeSize.y, 0.01);

    // Materials --------------------------------------------------------------------------------------

    var wireframeTexture = new Texture('./assets/figma_grid_thin_white.png', scene);
    wireframeTexture.uScale = 1;
    wireframeTexture.vScale = 1;
    // const simpleGridTexture = new Texture('./assets/figma_grid_wireframe_blue.png', scene);

    var wireframeMat = new StandardMaterial('wireframeMat', scene);
    wireframeMat.roughness = 1;
    wireframeMat.diffuseTexture = wireframeTexture;
    wireframeMat.emissiveTexture = wireframeTexture;
    wireframeMat.diffuseTexture.hasAlpha = true;
    wireframeMat.useAlphaFromDiffuseTexture = true;
    wireframeMat.backFaceCulling = false;

    var testMaterial = new StandardMaterial('testMaterial', scene);
    testMaterial.emissiveColor = Color3.White();

    var staticBlocksMat = new StandardMaterial('staticBlocksMat', scene);
    staticBlocksMat.diffuseColor = Color3.FromHexString('#f7b705'); // orange

    var playerStartMat = new StandardMaterial('playerStartMat', scene);
    // playerStartMat.diffuseTexture = simpleGridTexture;
    playerStartMat.diffuseColor = Color3.FromHexString('#2b2b2b');
    // playerStartMat.emissiveTexture = simpleGridTexture;
    // playerStartMat.diffuseTexture.hasAlpha = true;
    // playerStartMat.useAlphaFromDiffuseTexture = true;
    // playerStartMat.backFaceCulling = false;

    // Setting Materials
    ground.material = wireframeMat;
    testSphere.material = testMaterial;

    playBox.material = wireframeMat;

    for (let i = 1; i <= 4; i++) {
        let playerGround = scene.getMeshByName(`player${i}Ground`) as Mesh;
        let playerWall = scene.getMeshByName(`player${i}Wall`) as Mesh;
        if (playerGround) {
            playerGround.material = playerStartMat;
        }
        if (playerWall) {
            playerWall.material = playerStartMat;
        }
    }

    ground.isVisible = false;
}

var allLineMesh: LinesMesh;

////////////////////////////// END CREATE BABYLON SCENE ETC. //////////////////////////////

interface PlayerStartInfo {
    playerNumber: number;
    position: { x: number, y: number, z: number };
    rotation: { x: number, y: number, z: number };
    color: string;
    used: boolean;
}

interface SceneStartInfos {
    playCubeSize: { x: number, y: number, z: number },
    playerAreaDepth: number,
    ballSize: number,
    ballStartPos: { x: number, y: number, z: number },
    playerPaddleSize: { w: number, h: number }
}

interface PlayerData {
    id: string;
    color: string;
    playerNumber: number;
    score: number;
    position: { x: number, y: number, z: number };
    rotation: { x: number, y: number, z: number };
    contrPosR: { x: number, y: number, z: number };
    contrPosL: { x: number, y: number, z: number };
    contrRotR: { x: number, y: number, z: number };
    contrRotL: { x: number, y: number, z: number };
}

interface PreviousPlayerData {
    id: string;
    color: string;
    playerNumber: number;
    score: number;
    position: { x: number, y: number, z: number };
    rotation: { x: number, y: number, z: number };
    contrPosR: { x: number, y: number, z: number };
    contrPosL: { x: number, y: number, z: number };
    contrRotR: { x: number, y: number, z: number };
    contrRotL: { x: number, y: number, z: number };
    playerTime: number;
}

class Player implements PlayerData {
    id: string;
    color: string;
    playerNumber: number;
    score: number;
    position: { x: number, y: number, z: number };
    rotation: { x: number, y: number, z: number };
    contrPosR: { x: number, y: number, z: number };
    contrPosL: { x: number, y: number, z: number };
    contrRotR: { x: number, y: number, z: number };
    contrRotL: { x: number, y: number, z: number };
    headObj?: Mesh | null;
    controllerR?: Mesh | null;
    controllerL?: Mesh | null;
    paddle?: Mesh | null;

    constructor(player: PlayerData, headObj?: Mesh, controllerR?: Mesh, controllerL?: Mesh, paddle?: Mesh) {
        this.id = player.id;
        this.color = player.color;
        this.playerNumber = player.playerNumber;
        this.score = player.score;
        this.position = { x: player.position.x, y: player.position.y, z: player.position.z };
        this.rotation = { x: player.rotation.x, y: player.rotation.y, z: player.rotation.z };
        this.contrPosR = { x: player.contrPosR.x, y: player.contrPosR.y, z: player.contrPosR.z };
        this.contrPosL = { x: player.contrPosL.x, y: player.contrPosL.y, z: player.contrPosL.z };
        this.contrRotR = { x: player.contrRotR.x, y: player.contrRotR.y, z: player.contrRotR.z };
        this.contrRotL = { x: player.contrRotL.x, y: player.contrRotL.y, z: player.contrRotL.z };
        this.headObj = headObj || null;
        this.controllerR = controllerR || null;
        this.controllerL = controllerL || null;
        this.paddle = paddle || null;
    }

    setData(player: Player) {
        this.position = { x: player.position.x, y: player.position.y, z: player.position.z };
        this.rotation = { x: player.rotation.x, y: player.rotation.y, z: player.rotation.z };
        this.contrPosR = { x: player.contrPosR.x, y: player.contrPosR.y, z: player.contrPosR.z };
        this.contrPosL = { x: player.contrPosL.x, y: player.contrPosL.y, z: player.contrPosL.z };
        this.contrRotR = { x: player.contrRotR.x, y: player.contrRotR.y, z: player.contrRotR.z };
        this.contrRotL = { x: player.contrRotL.x, y: player.contrRotL.y, z: player.contrRotL.z };
    }

    updateObj() {
        if (this.headObj) {
            this.headObj.position = new Vector3(this.position.x, this.position.y, this.position.z);
            this.headObj.rotation = new Vector3(this.rotation.x, this.rotation.y, this.rotation.z);
        }
        if (this.controllerR) {
            this.controllerR.position = new Vector3(this.contrPosR.x, this.contrPosR.y, this.contrPosR.z);
            this.controllerR.rotation = new Vector3(this.contrRotR.x, this.contrRotR.y, this.contrRotR.z);
        }
        if (this.controllerL) {
            this.controllerL.position = new Vector3(this.contrPosL.x, this.contrPosL.y, this.contrPosL.z);
            this.controllerL.rotation = new Vector3(this.contrRotL.x, this.contrRotL.y, this.contrRotL.z);
        }
        if (this.paddle) {
            if (this.playerNumber == 1) {
                let paddleY, paddleZ;
                if (this.contrPosR.y + sceneStartInfos.playerPaddleSize.h / 2 > sceneStartInfos.playCubeSize.y) {
                    paddleY = sceneStartInfos.playCubeSize.y - sceneStartInfos.playerPaddleSize.h / 2;
                } else if (this.contrPosR.y - sceneStartInfos.playerPaddleSize.h / 2 < 0) {
                    paddleY = 0 + sceneStartInfos.playerPaddleSize.h / 2;
                } else {
                    paddleY = this.contrPosR.y;
                }
                if (this.contrPosR.z + sceneStartInfos.playerPaddleSize.w / 2 > sceneStartInfos.playCubeSize.z / 2) {
                    paddleZ = sceneStartInfos.playCubeSize.z / 2 - sceneStartInfos.playerPaddleSize.w / 2;
                } else if (this.contrPosR.z - sceneStartInfos.playerPaddleSize.w / 2 < -sceneStartInfos.playCubeSize.z / 2) {
                    paddleZ = -sceneStartInfos.playCubeSize.z / 2 + sceneStartInfos.playerPaddleSize.w / 2;
                } else {
                    paddleZ = this.contrPosR.z;
                }
                this.paddle.position = new Vector3(sceneStartInfos.playCubeSize.x / 2, paddleY, paddleZ);
            } else if (this.playerNumber == 2) {
                let paddleY, paddleZ;
                if (this.contrPosR.y + sceneStartInfos.playerPaddleSize.h / 2 > sceneStartInfos.playCubeSize.y) {
                    paddleY = sceneStartInfos.playCubeSize.y - sceneStartInfos.playerPaddleSize.h / 2;
                } else if (this.contrPosR.y - sceneStartInfos.playerPaddleSize.h / 2 < 0) {
                    paddleY = 0 + sceneStartInfos.playerPaddleSize.h / 2;
                } else {
                    paddleY = this.contrPosR.y;
                }
                if (this.contrPosR.z + sceneStartInfos.playerPaddleSize.w / 2 > sceneStartInfos.playCubeSize.z / 2) {
                    paddleZ = sceneStartInfos.playCubeSize.z / 2 - sceneStartInfos.playerPaddleSize.w / 2;
                } else if (this.contrPosR.z - sceneStartInfos.playerPaddleSize.w / 2 < -sceneStartInfos.playCubeSize.z / 2) {
                    paddleZ = -sceneStartInfos.playCubeSize.z / 2 + sceneStartInfos.playerPaddleSize.w / 2;
                } else {
                    paddleZ = this.contrPosR.z;
                }
                this.paddle.position = new Vector3(-sceneStartInfos.playCubeSize.x / 2, paddleY, paddleZ);
            } else if (this.playerNumber == 3) {
                let paddleY, paddleX;
                if (this.contrPosR.y + sceneStartInfos.playerPaddleSize.h / 2 > sceneStartInfos.playCubeSize.y) {
                    paddleY = sceneStartInfos.playCubeSize.y - sceneStartInfos.playerPaddleSize.h / 2;
                } else if (this.contrPosR.y - sceneStartInfos.playerPaddleSize.h / 2 < 0) {
                    paddleY = 0 + sceneStartInfos.playerPaddleSize.h / 2;
                } else {
                    paddleY = this.contrPosR.y;
                }
                if (this.contrPosR.x + sceneStartInfos.playerPaddleSize.w / 2 > sceneStartInfos.playCubeSize.x / 2) {
                    paddleX = sceneStartInfos.playCubeSize.x / 2 - sceneStartInfos.playerPaddleSize.w / 2;
                } else if (this.contrPosR.x - sceneStartInfos.playerPaddleSize.w / 2 < -sceneStartInfos.playCubeSize.x / 2) {
                    paddleX = -sceneStartInfos.playCubeSize.x / 2 + sceneStartInfos.playerPaddleSize.w / 2;
                } else {
                    paddleX = this.contrPosR.x;
                }
                this.paddle.position = new Vector3(paddleX, paddleY, sceneStartInfos.playCubeSize.z / 2);
            } else if (this.playerNumber == 4) {
                let paddleY, paddleX;
                if (this.contrPosR.y + sceneStartInfos.playerPaddleSize.h / 2 > sceneStartInfos.playCubeSize.y) {
                    paddleY = sceneStartInfos.playCubeSize.y - sceneStartInfos.playerPaddleSize.h / 2;
                } else if (this.contrPosR.y - sceneStartInfos.playerPaddleSize.h / 2 < 0) {
                    paddleY = 0 + sceneStartInfos.playerPaddleSize.h / 2;
                } else {
                    paddleY = this.contrPosR.y;
                }
                if (this.contrPosR.x + sceneStartInfos.playerPaddleSize.w / 2 > sceneStartInfos.playCubeSize.x / 2) {
                    paddleX = sceneStartInfos.playCubeSize.x / 2 - sceneStartInfos.playerPaddleSize.w / 2;
                } else if (this.contrPosR.x - sceneStartInfos.playerPaddleSize.w / 2 < -sceneStartInfos.playCubeSize.x / 2) {
                    paddleX = -sceneStartInfos.playCubeSize.x / 2 + sceneStartInfos.playerPaddleSize.w / 2;
                } else {
                    paddleX = this.contrPosR.x;
                }
                this.paddle.position = new Vector3(paddleX, paddleY, -sceneStartInfos.playCubeSize.z / 2);
            }
        }
    }

    sendData(xrCamera?: FreeCamera, leftController?: WebXRInputSource, rightController?: WebXRInputSource) {
        if (xrCamera && leftController && rightController) {
            const headPos = {
                x: xrCamera?.position.x,
                y: xrCamera?.position.y,
                z: xrCamera?.position.z
            };
            const headRot = {
                x: xrCamera?.rotationQuaternion.toEulerAngles().x,
                y: xrCamera?.rotationQuaternion.toEulerAngles().y,
                z: xrCamera?.rotationQuaternion.toEulerAngles().z
            };
            const contrPosR = {
                x: rightController?.grip?.position.x,
                y: rightController?.grip?.position.y,
                z: rightController?.grip?.position.z
            };
            const contrPosL = {
                x: leftController?.grip?.position.x,
                y: leftController?.grip?.position.y,
                z: leftController?.grip?.position.z
            };
            const contrRotR = {
                x: rightController?.grip?.rotationQuaternion?.toEulerAngles().x,
                y: rightController?.grip?.rotationQuaternion?.toEulerAngles().y,
                z: rightController?.grip?.rotationQuaternion?.toEulerAngles().z
            };
            const contrRotL = {
                x: leftController?.grip?.rotationQuaternion?.toEulerAngles().x,
                y: leftController?.grip?.rotationQuaternion?.toEulerAngles().y,
                z: leftController?.grip?.rotationQuaternion?.toEulerAngles().z
            };

            socket.emit('clientUpdate', {
                position: headPos,
                rotation: headRot,
                contrPosR: contrPosR,
                contrPosL: contrPosL,
                contrRotR: contrRotR,
                contrRotL: contrRotL,
            });
        }
    }
}

// Watch for browser/canvas resize events
window.addEventListener('resize', function () {
    engine.resize();
});

(async function main() {
    // Create a WebXR experience
    xr = await scene.createDefaultXRExperienceAsync({
        floorMeshes: [scene.getMeshByName('ground') as Mesh],
        inputOptions: {
            controllerOptions: {
                // disableMotionControllerAnimation: true,
                // doNotLoadControllerMesh: true,
                // forceControllerProfile: <string>,
                // renderingGroupId: <number>
            },
            // customControllersRepositoryURL: <string>,
            disableControllerAnimation: true,
            disableOnlineControllerRepository: true,
            doNotLoadControllerMeshes: true, // move, but hide controllers
            // forceInputProfile: 'generic-trigger-squeeze-thumbstick',
        },
    });

    // Add an event listener to each button
    for (let i = 0; i < startPosButtons.length; i++) {
        startPosButtons[i].addEventListener('click', (event) => {
            const htmlBtnId = (event.target as HTMLElement).id;
            const btnPlayerNumber = Number(htmlBtnId.split('-')[1]);
            // console.log(`Button with id ${htmlBtnId} clicked`);
            socket.emit('requestGameStart', btnPlayerNumber);
        });
    }

    xr.teleportation.detach();
    xr.pointerSelection.detach();

    const hasImmersiveVR = await xr.baseExperience.sessionManager.isSessionSupportedAsync('immersive-vr');

    if (hasImmersiveVR) {

        xr.baseExperience.sessionManager.onXRSessionInit.add(() => {

            xrCamera = xr.baseExperience.camera;
            playerUsingVR = true;
        });

        xr.baseExperience.sessionManager.onXRSessionEnded.add(() => {
            playerUsingVR = false;
            console.log('Player is leaving VR');
            socket.emit('playerEndVR');
            startScreen?.style.setProperty('display', 'flex');

            // Reset Camera Position
            camera.alpha = -(Math.PI / 4) * 3;
            camera.beta = Math.PI / 4;
            camera.radius = 15;
            camera.target = new Vector3(0, 0, 0);
        });

        window.addEventListener('keydown', function (event) {
            // exit VR Session on ESC
            if (event.key === 'Escape') {
                // console.log('Escape Key pressed');
                if (playerUsingVR) {
                    xr.baseExperience.exitXRAsync();
                }
            }
        });

        setInterval(function () {
            // console.log('Interval Function');
            if (clientPlayer) {
                if (playerUsingVR) {
                    if (xrCamera && leftController && rightController) {
                        // console.log('Sending Data to Server while VR');
                        clientPlayer.sendData(xrCamera, leftController, rightController);
                    }
                }
            }
            // if (leftController && rightController) {
            //     console.log('LeftController Pointer Position: ', leftController.pointer.position);
            //     console.log('LeftController Grip Position: ', leftController.grip?.position);
            //     console.log('leftController Pointer Rotation: ', leftController.pointer.rotationQuaternion?.toEulerAngles());
            // }
        }, 20);
    }
})();

// Send the client's start time to the server upon connection
socket.on('connect', () => {
    socket.emit('clientStartTime', clientStartTime);
    // console.log('Previous Player Data: ', previousPlayer);
});

socket.on('reload', () => {
    console.log('Server requested reload');
    xr.baseExperience.exitXRAsync();
    window.location.reload();
});

socket.on('timeForPreviousPlayers', () => {
    if (previousPlayer != null) {
        let timeDiffPreviousPlayer = clientStartTime - previousPlayer.playerTime;

        console.log('Time Difference to Previous Player: ', timeDiffPreviousPlayer);

        if (timeDiffPreviousPlayer < 30000) {
            console.log(`Previous Player ${previousPlayer.playerNumber} found.`);

            if (continueAsPreviousPlayer) {
                continueAsPreviousPlayer.style.display = 'block';
                continueAsPreviousPlayer.innerHTML = `Continue as Player ${previousPlayer.playerNumber}`;
                continueAsPreviousPlayer.addEventListener('click', () => {
                    console.log('Pressed continue as Previous Player');
                    socket.emit('continueAsPreviousPlayer', previousPlayer);
                });
            }
        } else {
            console.log('Previous Player found, but too late.');
            localStorage.removeItem('player');
        }
    } else {
        console.log('No Previous Player found.');
    }
});

socket.on('joinedWaitingRoom', () => {
    console.log('You joined the waiting Room. Enter VR to join the Game.');

    if (loadingScreen) {
        loadingScreen.style.display = 'none';
    }
});

socket.on('startPosDenied', () => {
    console.log('Start Position denied. Select another one.');
});

// get all current Player Information from the Server at the start
// and spawning all current players except yourself
socket.on('currentState', (players: { [key: string]: Player }, testColor: string,
    playerStartInfos: { [key: number]: PlayerStartInfo }, sceneStartInfosServer: SceneStartInfos) => {

    sceneStartInfos = sceneStartInfosServer;

    createBasicScene(sceneStartInfos);

    console.log('Get the Current State');

    let testMaterial = scene.getMaterialByName('testMaterial') as StandardMaterial;
    testMaterial.emissiveColor = Color3.FromHexString(testColor);

    console.log('Playercount: ', Object.keys(players).length);

    Object.keys(players).forEach((id) => {

        console.log('Found a Player')
        // Add new player to the playerList
        playerList[id] = new Player(players[id]);

        // Spawn new player Entity
        addPlayer(playerList[id], false);
    });

    setStartButtonAvailability(playerStartInfos);
});

// when the current player is already on the server and starts the game
socket.on('startClientGame', (newSocketPlayer) => {

    startScreen?.style.setProperty('display', 'none');

    if (divID) {
        divID.innerHTML = `Player ID: ${newSocketPlayer.id}`;
    }

    // Start VR Session for the client
    xr.baseExperience.enterXRAsync('immersive-vr', 'local-floor').then(() => {
        console.log('Starting VR');

        // Create a box for each controller
        xr.input.onControllerAddedObservable.add((controller) => {
            controller.onMotionControllerInitObservable.add((motionController) => {

                motionController.disableAnimation = true;
                motionController._doNotLoadControllerMesh = true;

                // let color: Color3;
                // let sphere: Mesh;
                // let material: StandardMaterial;

                if (motionController.handness === 'left') {

                    leftController = controller;

                    // sphere = leftSphere;
                    // material = leftMaterial;
                    // color = leftColor;

                    const xrIDs = motionController.getComponentIds();

                    let triggerComponent = motionController.getComponent(xrIDs[0]); //xr-standard-trigger
                    triggerComponent.onButtonStateChangedObservable.add(() => {
                        if (triggerComponent.pressed) {
                            // socket.emit('clicked');
                            xr.baseExperience.exitXRAsync();
                        } else {
                        }
                    });

                    let squeezeComponent = motionController.getComponent(xrIDs[1]);//xr-standard-squeeze
                    squeezeComponent.onButtonStateChangedObservable.add(() => {
                        if (squeezeComponent.pressed) {
                            socket.emit('clicked');

                        } else {

                        }
                    });

                    let thumbstickComponent = motionController.getComponent(xrIDs[2]);//xr-standard-thumbstick
                    thumbstickComponent.onButtonStateChangedObservable.add(() => {
                        if (thumbstickComponent.pressed) {
                            socket.emit('clicked');
                            debugTestclick();
                        } else {

                        }
                    });

                    let xbuttonComponent = motionController.getComponent(xrIDs[3]);//x-button
                    xbuttonComponent.onButtonStateChangedObservable.add(() => {
                        if (xbuttonComponent.pressed) {
                            socket.emit('clicked');

                        } else {

                        }
                    });

                    let ybuttonComponent = motionController.getComponent(xrIDs[4]);//y-button
                    ybuttonComponent.onButtonStateChangedObservable.add(() => {
                        if (ybuttonComponent.pressed) {
                            socket.emit('clicked');

                        } else {

                        }
                    });
                    /* not worked.
                    let thumbrestComponent = motionController.getComponent(xrIDs[5]);//thumrest
                    thumbrestComponent.onButtonStateChangedObservable.add(() => {
                        //not worked
                        if ((thumbrestComponent.value>0.1&&thumbrestComponent.value<0.6) {
                            sphere1.position.y=10;
                        }
                        if(thumbrestComponent.touched){
                             sphere1.position.y=10;
                        }
     
                    });  
                    */
                }
                if (motionController.handness === 'right') {

                    rightController = controller;
                    // sphere = rightSphere;
                    // material = rightMaterial;
                    // color = rightColor;

                    const xrIDs = motionController.getComponentIds();

                    let triggerComponent = motionController.getComponent(xrIDs[0]);//xr-standard-trigger
                    triggerComponent.onButtonStateChangedObservable.add(() => {
                        if (triggerComponent.pressed) {
                            // socket.emit('clicked');
                            xr.baseExperience.exitXRAsync();
                        } else {

                        }
                    });

                    let squeezeComponent = motionController.getComponent(xrIDs[1]);//xr-standard-squeeze
                    squeezeComponent.onButtonStateChangedObservable.add(() => {
                        if (squeezeComponent.pressed) {
                            socket.emit('clicked');

                        } else {

                        }
                    });

                    let thumbstickComponent = motionController.getComponent(xrIDs[2]);//xr-standard-thumbstick
                    thumbstickComponent.onButtonStateChangedObservable.add(() => {
                        if (thumbstickComponent.pressed) {
                            socket.emit('clicked');
                            debugTestclick();
                        } else {

                        }

                    });

                    let abuttonComponent = motionController.getComponent(xrIDs[3]);//a-button
                    abuttonComponent.onButtonStateChangedObservable.add(() => {
                        if (abuttonComponent.pressed) {
                            socket.emit('clicked');

                        } else {

                        }
                    });

                    let bbuttonComponent = motionController.getComponent(xrIDs[4]);//b-button
                    bbuttonComponent.onButtonStateChangedObservable.add(() => {
                        if (bbuttonComponent.pressed) {
                            socket.emit('clicked');

                        } else {

                        }
                    });
                }
            })
        });

        // get the Connection ID of the Player
        playerID = newSocketPlayer.id;
        // clientStartPos = newSocketPlayer.startPosition;

        clientPlayer = new Player(newSocketPlayer);

        localStorage.removeItem('playerID');

        playerList[playerID] = clientPlayer;

        // camera.position = new Vector3(clientStartPos.x, clientStartPos.y, clientStartPos.z);
        // camera.rotation = new Vector3(0, 0, 0);
        // camera.setTarget(Vector3.Zero());

        let playerWall = scene.getMeshByName(`player${playerList[playerID].playerNumber}Wall`) as Mesh;
        if (playerWall) {
            playerWall.isVisible = false;
        }

        // Spawn yourself Entity
        addPlayer(playerList[playerID], true);

        if (xrCamera) {
            xrCamera.position = new Vector3(playerList[playerID].position.x, playerList[playerID].position.y, playerList[playerID].position.z);
            xrCamera.rotationQuaternion = Quaternion.FromEulerAngles(playerList[playerID].rotation.x, playerList[playerID].rotation.y, playerList[playerID].rotation.z);

            console.log('XrCamera Rotation: ', xrCamera.rotationQuaternion);
        }
    }).catch((err) => {
        console.error('Failed to enter VR', err);
    });
});

// when the current player is already on the server and a new player joins
socket.on('newPlayer', (newPlayer) => {
    // console log about new player joined
    console.log('New player joined: ', newPlayer.id);

    // Add new player to the playerList
    playerList[newPlayer.id] = new Player(newPlayer);

    // Spawn new player Entity
    addPlayer(playerList[newPlayer.id], false);

    let playerWall = scene.getMeshByName(`player${playerList[newPlayer.id].playerNumber}Wall`) as Mesh;
    if (playerWall) {
        playerWall.isVisible = false;
    }

    // set the availability of the start buttons according to the used startpositions on the server
    if (!startPosButtons[newPlayer.playerNumber - 1].classList.contains('unavailable')) {
        startPosButtons[newPlayer.playerNumber - 1].classList.add('unavailable');
    }
});

// update the players position and rotation from the server
socket.on('serverUpdate', (players, ball) => {
    Object.keys(players).forEach((id) => {
        if (playerList[id]) {
            playerList[id].setData(players[id]);
        }
    });

    let testSphere = scene.getMeshByName('testSphere') as Mesh;
    testSphere.position = new Vector3(ball.position.x, ball.position.y, ball.position.z);
});

// set the availability of the start buttons according to the used startpositions on the server
function setStartButtonAvailability(startPositions: { [key: number]: PlayerStartInfo }) {
    for (let i = 0; i < startPosButtons.length; i++) {
        let playerWall = scene.getMeshByName(`player${i + 1}Wall`) as Mesh;
        if (startPositions[i + 1].used == true) {
            if (playerWall) {
                playerWall.isVisible = false;
            }
            if (!startPosButtons[i].classList.contains('unavailable')) {
                startPosButtons[i].classList.add('unavailable');
            }
        } else {
            if (playerWall) {
                playerWall.isVisible = true;
            }
            if (startPosButtons[i].classList.contains('unavailable')) {
                startPosButtons[i].classList.remove('unavailable');
            }
        }
    }
}

// Spawn Player Entity with the Connection ID
function addPlayer(player: Player, isPlayer: boolean) {
    console.log(`Spawning Player: ${player.id} as Player ${player.playerNumber}`);

    let headScaling = 0.3;
    let controllerScaling = 0.1;
    let paddleThickness = 0.01;

    player.headObj = MeshBuilder.CreateBox('player_' + player.id, { size: 1 }, scene);
    player.headObj.scaling = new Vector3(headScaling, headScaling, headScaling);
    player.headObj.position = new Vector3(player.position.x, player.position.y, player.position.z);
    player.headObj.rotation = new Vector3(player.rotation.x, player.rotation.y, player.rotation.z);
    player.headObj.material = new StandardMaterial('mat_' + player.id, scene);
    (player.headObj.material as StandardMaterial).emissiveColor = Color3.FromHexString(player.color);

    if (isPlayer) {
        player.headObj.isVisible = false;
    }

    player.controllerR = MeshBuilder.CreateBox('conR_' + player.id, { size: 1 });
    player.controllerR.scaling = new Vector3(controllerScaling, controllerScaling, controllerScaling);
    player.controllerR.position = new Vector3(player.contrPosR.x, player.contrPosR.y, player.contrPosR.z);
    player.controllerR.rotation = new Vector3(player.contrRotR.x, player.contrRotR.y, player.contrRotR.z);
    player.controllerR.material = player.headObj.material;
    //(player.controllerR.material as StandardMaterial).emissiveColor = Color3.FromHexString(player.color);

    player.controllerL = MeshBuilder.CreateBox('conL_' + player.id, { size: 1 });
    player.controllerL.scaling = new Vector3(controllerScaling, controllerScaling, controllerScaling);
    player.controllerL.position = new Vector3(player.contrPosL.x, player.contrPosL.y, player.contrPosL.z);
    player.controllerL.rotation = new Vector3(player.contrRotL.x, player.contrRotL.y, player.contrRotL.z);
    player.controllerL.material = player.headObj.material;
    //(player.controllerL.material as StandardMaterial).emissiveColor = Color3.FromHexString(player.color);

    player.paddle = MeshBuilder.CreateBox('paddle_' + player.id, { size: 1 });
    if (player.playerNumber == 1) {
        player.paddle.scaling = new Vector3(paddleThickness, sceneStartInfos.playerPaddleSize.h, sceneStartInfos.playerPaddleSize.w);
        player.paddle.position = new Vector3(sceneStartInfos.playCubeSize.x / 2, player.contrPosR.y, player.contrPosR.z);
    } else if (player.playerNumber == 2) {
        player.paddle.scaling = new Vector3(paddleThickness, sceneStartInfos.playerPaddleSize.h, sceneStartInfos.playerPaddleSize.w);
        player.paddle.position = new Vector3(-sceneStartInfos.playCubeSize.x / 2, player.contrPosR.y, player.contrPosR.z);
    } else if (player.playerNumber == 3) {
        player.paddle.scaling = new Vector3(sceneStartInfos.playerPaddleSize.w, sceneStartInfos.playerPaddleSize.h, paddleThickness);
        player.paddle.position = new Vector3(player.contrPosR.x, player.contrPosR.y, sceneStartInfos.playCubeSize.z / 2);
    } else if (player.playerNumber == 4) {
        player.paddle.scaling = new Vector3(sceneStartInfos.playerPaddleSize.w, sceneStartInfos.playerPaddleSize.h, paddleThickness);
        player.paddle.position = new Vector3(player.contrPosR.x, player.contrPosR.y, -sceneStartInfos.playCubeSize.z / 2);
    }
    player.paddle.position = new Vector3(player.contrPosR.x, player.contrPosR.y, player.contrPosR.z);
    player.paddle.material = player.controllerR.material;



    // player.controllerL.isVisible = false;

    playerList[player.id].headObj = player.headObj;
    playerList[player.id].controllerR = player.controllerR;
    playerList[player.id].controllerL = player.controllerL;
    playerList[player.id].paddle = player.paddle;
}

socket.on('playerDisconnected', (id) => {
    const disconnectedPlayer = playerList[id];
    if (disconnectedPlayer) {
        console.log('Player disconnected: ', id);
        disconnectedPlayer.headObj?.dispose();
        disconnectedPlayer.controllerR?.dispose();
        disconnectedPlayer.controllerL?.dispose();
        disconnectedPlayer.paddle?.dispose();

        let playerWall = scene.getMeshByName(`player${disconnectedPlayer.playerNumber}Wall`) as Mesh;
        if (playerWall) {
            playerWall.isVisible = true;
        }

        // set the availability of the start buttons according to the used startpositions on the server
        if (startPosButtons[playerList[id].playerNumber - 1].classList.contains('unavailable')) {
            startPosButtons[playerList[id].playerNumber - 1].classList.remove('unavailable');
        }

        delete playerList[id];
    }
});

///////////////////////////// TESTING GROUND ////////////////////////////

window.addEventListener('keydown', function (event) {
    // Check if the key combination is Ctrl + I
    if (event.ctrlKey && event.key === 'i') {
        if (Inspector.IsVisible) {
            Inspector.Hide();
        } else {
            Inspector.Show(scene, {
                embedMode: true,
            });
        }
    }
});

document.addEventListener('click', () => {
    if (playerUsingVR) {
        socket.emit('clicked');
    }
});

socket.on('colorChanged', (color) => {
    // change color of the sphere
    let testMaterial = scene.getMaterialByName('testMaterial') as StandardMaterial;
    testMaterial.emissiveColor = Color3.FromHexString(color);
});

function debugTestclick() {
    socket.emit('testClick', playerID);
    console.log('XRCam Rotation Quat: ', xrCamera?.rotationQuaternion);
    console.log('XRCam Rotation: ', xrCamera?.rotationQuaternion.toEulerAngles());
}

////////////////////////// END TESTING GROUND //////////////////////////////            

// Register a render loop to repeatedly render the scene
engine.runRenderLoop(function () {
    if (divFps) {
        divFps.innerHTML = engine.getFps().toFixed() + ' fps';
    }

    // Direct controller movement
    // if (leftController && rightController) {
    //     leftSphere.position = leftController.pointer.position;
    //     rightSphere.position = rightController.pointer.position;
    //     leftSphere.rotation = leftController.pointer.rotationQuaternion?.toEulerAngles() || new Vector3(0, 0, 0);
    //     rightSphere.rotation = rightController.pointer.rotationQuaternion?.toEulerAngles() || new Vector3(0, 0, 0);
    // }

    Object.keys(playerList).forEach((id) => {
        if (playerList[id]) {
            // console.log('Updating Player: ', id);
            playerList[id].updateObj();
        }
    });

    renderPlayerLines();

    scene.render();
});

function renderPlayerLines() {
    let linePoints: Vector3[] = [];
    allLineMesh?.dispose();
    if (Object.keys(playerList).length > 1) {
        Object.keys(playerList).forEach((id) => {
            if (playerList[id]) {
                linePoints.push(new Vector3(playerList[id].contrPosR.x, playerList[id].contrPosR.y, playerList[id].contrPosR.z));
            }
        });
        if (Object.keys(playerList).length > 2) {
            linePoints.push(new Vector3(playerList[Object.keys(playerList)[0]].contrPosR.x, playerList[Object.keys(playerList)[0]].contrPosR.y, playerList[Object.keys(playerList)[0]].contrPosR.z));
        }
        allLineMesh = MeshBuilder.CreateLines("allLine", {
            points: linePoints,
        }, scene);
        allLineMesh.color = new Color3(0, 1, 0);
    }
}

/////////////////////////// LOCAL STORAGE //////////////////////////////
// set up Interval function for the local storage of the player data
setInterval(function () {
    setLocalStorage();
}, 1000);

function setLocalStorage() {
    if (playerList[playerID]) {
        let safedPreviousPlayer = {
            id: playerID,
            color: playerList[playerID].color,
            playerNumber: playerList[playerID].playerNumber,
            score: playerList[playerID].score,
            // position: playerList[playerID].position,
            position: { x: playerList[playerID].position.x, y: 0, z: playerList[playerID].position.z }, // dont save the y position (xr adds the head hight automatically)
            rotation: { x: 0, y: playerList[playerID].rotation.y, z: 0 },    //only save the y rotation
            // rotation: playerList[playerID].rotation,
            contrPosR: playerList[playerID].contrPosR,
            contrPosL: playerList[playerID].contrPosL,
            // contrRotR: playerList[playerID].contrRotR,
            contrRotR: { x: 0, y: 0, z: 0 },                                 //reset the controller rotation
            // contrRotL: playerList[playerID].contrRotL,
            contrRotL: { x: 0, y: 0, z: 0 },                                 //reset the controller rotation
            playerTime: Date.now()
        };
        let jsonPreviousPlayer = JSON.stringify(safedPreviousPlayer);
        // console.log(`Previous safed Player: ${jsonPreviousPlayer}`);

        if (typeof (Storage) !== "undefined") {
            localStorage.setItem('player', jsonPreviousPlayer);
        } else {
            console.log('No Web Storage support');
        }
    }
}

function getLocalStorage() {
    if (typeof (Storage) !== "undefined") {
        // Code for localStorage/sessionStorage.
        // localStorage.setItem('playerID', `${playerID}`);
        if (localStorage.getItem('player') != null) {
            let parsedJsonPreviousPlayer = JSON.parse(localStorage.getItem('player') || '{}');
            previousPlayer = {
                id: parsedJsonPreviousPlayer.id,
                color: parsedJsonPreviousPlayer.color,
                playerNumber: Number(parsedJsonPreviousPlayer.playerNumber),
                score: Number(parsedJsonPreviousPlayer.score),
                position:
                {
                    x: Number(parsedJsonPreviousPlayer.position.x),
                    y: Number(parsedJsonPreviousPlayer.position.y),
                    z: Number(parsedJsonPreviousPlayer.position.z)
                },
                rotation:
                {
                    x: Number(parsedJsonPreviousPlayer.rotation.x),
                    y: Number(parsedJsonPreviousPlayer.rotation.y),
                    z: Number(parsedJsonPreviousPlayer.rotation.z)
                },
                contrPosR:
                {
                    x: Number(parsedJsonPreviousPlayer.contrPosR.x),
                    y: Number(parsedJsonPreviousPlayer.contrPosR.y),
                    z: Number(parsedJsonPreviousPlayer.contrPosR.z)
                },
                contrPosL:
                {
                    x: Number(parsedJsonPreviousPlayer.contrPosL.x),
                    y: Number(parsedJsonPreviousPlayer.contrPosL.y),
                    z: Number(parsedJsonPreviousPlayer.contrPosL.z)
                },
                contrRotR:
                {
                    x: Number(parsedJsonPreviousPlayer.contrRotR.x),
                    y: Number(parsedJsonPreviousPlayer.contrRotR.y),
                    z: Number(parsedJsonPreviousPlayer.contrRotR.z)
                },
                contrRotL:
                {
                    x: Number(parsedJsonPreviousPlayer.contrRotL.x),
                    y: Number(parsedJsonPreviousPlayer.contrRotL.y),
                    z: Number(parsedJsonPreviousPlayer.contrRotL.z)
                },
                playerTime: Number(parsedJsonPreviousPlayer.playerTime)
            }

            console.log('Previous Player Data: ', previousPlayer);
        } else {
            previousPlayer = null;
        }
    } else {
        // Sorry! No Web Storage support..
        console.log('No Web Storage support');
    }
}
/////////////////////////// END LOCAL STORAGE //////////////////////////////
