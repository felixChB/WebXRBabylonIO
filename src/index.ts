import { io } from 'socket.io-client';
import { /*Camera,*/ Engine, FreeCamera, Scene } from '@babylonjs/core';
import { ArcRotateCamera, HemisphericLight, MeshBuilder } from '@babylonjs/core';
import { Mesh, StandardMaterial, Color3, Vector3 } from '@babylonjs/core';
import { WebXRDefaultExperience, WebXRInputSource } from '@babylonjs/core/XR';
import { Inspector } from '@babylonjs/inspector';

import '@babylonjs/core/Materials/Textures/Loaders'; // Required for EnvironmentHelper
import '@babylonjs/loaders/glTF'; // Enable GLTF/GLB loader for loading controller models from WebXR Input registry
// import './style.css'

const socket = io();

let clientStartTime = Date.now();

const rotationQuaternion = null;
if (rotationQuaternion) {
    //console.log('Rotation Quaternion: ', rotationQuaternion);
}

let playerID: string;
let clientPlayer: Player | null = null;
let playerUsingVR: boolean = false;
let clientStartPos: { x: number, y: number, z: number };

// let oldPlayerData = localStorage.getItem('playerID');
let oldPlayer: OldPlayerData | null = null;
getLocalStorage();

let xr: WebXRDefaultExperience;
let xrCamera: FreeCamera | null = null;
let leftController: WebXRInputSource | null = null;
let rightController: WebXRInputSource | null = null;

// Get HTML Elements
let divFps = document.getElementById('fps');
const startPosButtons = document.querySelectorAll('.posSelection');
const startScreen = document.getElementById('startScreen');
const continueAsOldPlayer = document.getElementById('continueAsOldPlayer');

////////////////////////////// CREATE BABYLON SCENE ETC. //////////////////////////////

// Create a canvas element for rendering
const canvas = document.createElement('canvas');
canvas.id = 'renderCanvas';
document.body.appendChild(canvas);

// Create engine and a scene
const engine = new Engine(canvas, true);
const scene = new Scene(engine);

// Add a camera for the non-VR view in browser
const camera = new ArcRotateCamera('Camera', -(Math.PI / 4) * 3, Math.PI / 4, 10, new Vector3(0, 0, 0), scene);
camera.attachControl(true);

// Creates a light, aiming 0,1,0 - to the sky
const light = new HemisphericLight('light',
    new Vector3(0, 1, 0), scene);
// Dim the light a small amount - 0 to 1
light.intensity = 0.7;

// Built-in 'sphere' shape.
const testSphere = MeshBuilder.CreateSphere('testSphere',
    { diameter: 2, segments: 32 }, scene);
testSphere.material = new StandardMaterial('mat', scene);

// Move the sphere upward 1/2 its height
testSphere.position.y = 1;

// Built-in 'ground' shape.
const ground = MeshBuilder.CreateGround('ground',
    { width: 6, height: 6 }, scene);

ground.material = new StandardMaterial('matGround', scene);

let playerList: { [key: string]: Player } = {};

interface PlayerStartInfo {
    playerNumber: number;
    position: { x: number, y: number, z: number };
    rotation: { x: number, y: number, z: number };
    color: string;
    used: boolean;
}

interface PlayerData {
    id: string;
    color: string;
    playerNumber: number;
    position: { x: number, y: number, z: number };
    rotation: { x: number, y: number, z: number };
    contrPosR: { x: number, y: number, z: number };
    contrPosL: { x: number, y: number, z: number };
    contrRotR: { x: number, y: number, z: number };
    contrRotL: { x: number, y: number, z: number };

    // setData(player: PlayerData): void;
    // updateObj(): void;
    // sendData(): void;
}

interface OldPlayerData {
    id: string;
    color: string;
    playerNumber: number;
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
    position: { x: number, y: number, z: number };
    rotation: { x: number, y: number, z: number };
    contrPosR: { x: number, y: number, z: number };
    contrPosL: { x: number, y: number, z: number };
    contrRotR: { x: number, y: number, z: number };
    contrRotL: { x: number, y: number, z: number };
    headObj?: Mesh | null;
    controllerR?: Mesh | null;
    controllerL?: Mesh | null;

    constructor(player: PlayerData, headObj?: Mesh, controllerR?: Mesh, controllerL?: Mesh) {
        this.id = player.id;
        this.color = player.color;
        this.playerNumber = player.playerNumber;
        this.position = { x: player.position.x, y: player.position.y, z: player.position.z };
        this.rotation = { x: player.rotation.x, y: player.rotation.y, z: player.rotation.z };
        this.contrPosR = { x: player.contrPosR.x, y: player.contrPosR.y, z: player.contrPosR.z };
        this.contrPosL = { x: player.contrPosL.x, y: player.contrPosL.y, z: player.contrPosL.z };
        this.contrRotR = { x: player.contrRotR.x, y: player.contrRotR.y, z: player.contrRotR.z };
        this.contrRotL = { x: player.contrRotL.x, y: player.contrRotL.y, z: player.contrRotL.z };
        this.headObj = headObj || null;
        this.controllerR = controllerR || null;
        this.controllerL = controllerL || null;
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
            // disableControllerAnimation: true,
            // disableOnlineControllerRepository: true,
            doNotLoadControllerMeshes: true, // move, but hide controllers
            // forceInputProfile: 'generic-trigger-squeeze-thumbstick',
        },
    });

    // Add an event listener to each button
    for (let i = 0; i < startPosButtons.length; i++) {
        startPosButtons[i].addEventListener('click', (event) => {
            const htmlBtnId = (event.target as HTMLElement).id;
            const btnPlayerNumber = Number(htmlBtnId.split('-')[1]);
            console.log(`Button with id ${htmlBtnId} clicked`);
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
        });

        window.addEventListener('keydown', function (event) {
            // exit VR Session on ESC
            if (event.key === 'Escape') {
                // console.log('Escape Key pressed');
                if (playerUsingVR) {
                    xr.baseExperience.exitXRAsync()
                }
            }
        });

        // Create a box for each controller
        xr.input.onControllerAddedObservable.add((controller) => {
            controller.onMotionControllerInitObservable.add((motionController) => {

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
                            socket.emit('clicked');

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
                            socket.emit('clicked');

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
            // console.log('XrCamera Position: ', xrCamera?.position);
        }, 20);
    }
})();

// Send the client's start time to the server upon connection
socket.on('connect', () => {
    socket.emit('clientStartTime', clientStartTime);
    // console.log('Old Player Data: ', oldPlayer);
});

socket.on('reload', () => {
    console.log('Server requested reload');
    window.location.reload();
});

socket.on('timeForOldPlayers', (serverStartTime) => {
    if (oldPlayer) {
        let timeDiffOldPlayer = serverStartTime - oldPlayer.playerTime;

        if (timeDiffOldPlayer < 20000) {
            console.log('Old Player found.');

            if (continueAsOldPlayer) {
                continueAsOldPlayer.style.display = 'block';
                continueAsOldPlayer.innerHTML = `Continue as Player ${oldPlayer.playerNumber}`;
                continueAsOldPlayer.addEventListener('click', () => {
                    console.log('Pressed continue as Old Player');
                    socket.emit('continueAsOldPlayer', oldPlayer);
                });
            }
        } else {
            localStorage.removeItem('player');
        }
    }
});

socket.on('joinedWaitingRoom', () => {
    console.log('You joined the waiting Room. Enter VR to join the Game.');
});

socket.on('startPosDenied', () => {
    console.log('Start Position denied. Select another one.');
});

// get all current Player Information from the Server at the start
// and spawning all current players except yourself
socket.on('currentState', (players: { [key: string]: Player }, testColor: string, playerStartInfos: { [key: number]: PlayerStartInfo }) => {

    console.log('Get the Current State');

    if (testSphere) {
        (testSphere.material as StandardMaterial).diffuseColor = Color3.FromHexString(testColor);
    }

    Object.keys(players).forEach((id) => {
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

    // Start VR Session for the client
    xr.baseExperience.enterXRAsync('immersive-vr', 'local-floor').then(() => {
        console.log('Starting VR from startClientGame');

        // get the Connection ID of the Player
        playerID = newSocketPlayer.id;
        clientStartPos = newSocketPlayer.startPosition;

        clientPlayer = new Player(newSocketPlayer);

        localStorage.setItem('playerID', `${playerID}`);

        playerList[playerID] = clientPlayer;

        camera.position = new Vector3(clientStartPos.x, clientStartPos.y, clientStartPos.z);
        camera.setTarget(Vector3.Zero());

        // Spawn yourself Entity
        addPlayer(playerList[playerID], true);

        if (xrCamera) {
            xrCamera.position = new Vector3(playerList[playerID].position.x, playerList[playerID].position.y, playerList[playerID].position.z);
            camera.setTarget(Vector3.Zero());
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

    // set the availability of the start buttons according to the used startpositions on the server
    if (!startPosButtons[newPlayer.playerNumber - 1].classList.contains('unavailable')) {
        startPosButtons[newPlayer.playerNumber - 1].classList.add('unavailable');
    }
});

// update the players position and rotation from the server
socket.on('serverUpdate', (players) => {
    Object.keys(players).forEach((id) => {
        if (playerList[id]) {
            playerList[id].setData(players[id]);
        }
    });
});

// set the availability of the start buttons according to the used startpositions on the server
function setStartButtonAvailability(startPositions: { [key: number]: PlayerStartInfo }) {
    for (let i = 0; i < startPosButtons.length; i++) {
        if (startPositions[i + 1].used == true) {
            if (!startPosButtons[i].classList.contains('unavailable')) {
                startPosButtons[i].classList.add('unavailable');
            }
        } else {
            if (startPosButtons[i].classList.contains('unavailable')) {
                startPosButtons[i].classList.remove('unavailable');
            }
        }
    }
}

// Spawn Player Entity with the Connection ID
function addPlayer(player: Player, isPlayer: boolean) {
    console.log('Spawning player: ', player.id);

    player.headObj = MeshBuilder.CreateBox('player_' + player.id, { size: 1 }, scene);
    player.headObj.position = new Vector3(player.position.x, player.position.y, player.position.z);
    player.headObj.rotation = new Vector3(player.rotation.x, player.rotation.y, player.rotation.z);
    player.headObj.material = new StandardMaterial('mat_' + player.id, scene);
    (player.headObj.material as StandardMaterial).diffuseColor = Color3.FromHexString(player.color);

    if (isPlayer) {
        player.headObj.isVisible = false;
    }

    player.controllerR = MeshBuilder.CreateBox('conR_' + player.id, { size: 0.2 });
    player.controllerR.position = new Vector3(player.contrPosR.x, player.contrPosR.y, player.contrPosR.z);
    player.controllerR.rotation = new Vector3(player.contrRotR.x, player.contrRotR.y, player.contrRotR.z);
    player.controllerR.material = new StandardMaterial('matConR_' + player.id, scene);
    (player.controllerR.material as StandardMaterial).diffuseColor = Color3.FromHexString(player.color);

    player.controllerL = MeshBuilder.CreateBox('conL_' + player.id, { size: 0.2 });
    player.controllerL.position = new Vector3(player.contrPosL.x, player.contrPosL.y, player.contrPosL.z);
    player.controllerL.rotation = new Vector3(player.contrRotL.x, player.contrRotL.y, player.contrRotL.z);
    player.controllerL.material = new StandardMaterial('matConL' + player.id, scene);
    (player.controllerL.material as StandardMaterial).diffuseColor = Color3.FromHexString(player.color);


    playerList[player.id].headObj = player.headObj;
    playerList[player.id].controllerR = player.controllerR;
    playerList[player.id].controllerL = player.controllerL;
}

socket.on('playerDisconnected', (id) => {
    const disconnectedPlayer = playerList[id];
    if (disconnectedPlayer) {
        console.log('Player disconnected: ', id);
        disconnectedPlayer.headObj?.dispose();
        disconnectedPlayer.controllerR?.dispose();
        disconnectedPlayer.controllerL?.dispose();

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
    if (testSphere) {
        (testSphere.material as StandardMaterial).diffuseColor = Color3.FromHexString(color);
    }
});

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

    scene.render();
});

// set up Interval function for the local storage of the player data
setInterval(function () {
    setLocalStorage();
}, 10000);

function setLocalStorage() {
    if (playerList[playerID]) {
        let safedOldPlayer = {
            id: playerID,
            color: playerList[playerID].color,
            playerNumber: playerList[playerID].playerNumber,
            position: playerList[playerID].position,
            rotation: playerList[playerID].rotation,
            contrPosR: playerList[playerID].contrPosR,
            contrPosL: playerList[playerID].contrPosL,
            contrRotR: playerList[playerID].contrRotR,
            contrRotL: playerList[playerID].contrRotL,
            playerTime: Date.now()
        };
        let jsonOldPlayer = JSON.stringify(safedOldPlayer);
        // console.log(`Old safed Player: ${jsonOldPlayer}`);

        if (typeof (Storage) !== "undefined") {
            localStorage.setItem('player', jsonOldPlayer);
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
            let parsedJsonOldPlayer = JSON.parse(localStorage.getItem('player') || '{}');
            oldPlayer = {
                id: parsedJsonOldPlayer.id,
                color: parsedJsonOldPlayer.color,
                playerNumber: Number(parsedJsonOldPlayer.playerNumber),
                position:
                {
                    x: Number(parsedJsonOldPlayer.position.x),
                    y: Number(parsedJsonOldPlayer.position.y),
                    z: Number(parsedJsonOldPlayer.position.z)
                },
                rotation:
                {
                    x: Number(parsedJsonOldPlayer.rotation.x),
                    y: Number(parsedJsonOldPlayer.rotation.y),
                    z: Number(parsedJsonOldPlayer.rotation.z)
                },
                contrPosR:
                {
                    x: Number(parsedJsonOldPlayer.contrPosR.x),
                    y: Number(parsedJsonOldPlayer.contrPosR.y),
                    z: Number(parsedJsonOldPlayer.contrPosR.z)
                },
                contrPosL:
                {
                    x: Number(parsedJsonOldPlayer.contrPosL.x),
                    y: Number(parsedJsonOldPlayer.contrPosL.y),
                    z: Number(parsedJsonOldPlayer.contrPosL.z)
                },
                contrRotR:
                {
                    x: Number(parsedJsonOldPlayer.contrRotR.x),
                    y: Number(parsedJsonOldPlayer.contrRotR.y),
                    z: Number(parsedJsonOldPlayer.contrRotR.z)
                },
                contrRotL:
                {
                    x: Number(parsedJsonOldPlayer.contrRotL.x),
                    y: Number(parsedJsonOldPlayer.contrRotL.y),
                    z: Number(parsedJsonOldPlayer.contrRotL.z)
                },
                playerTime: Number(parsedJsonOldPlayer.playerTime)
            }

            console.log('Old Player Data: ', oldPlayer);
        } else {
            oldPlayer = null;
        }
    } else {
        // Sorry! No Web Storage support..
        console.log('No Web Storage support');
    }
}