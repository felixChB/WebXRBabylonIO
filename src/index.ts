import { io } from 'socket.io-client';
import { /*Camera,*/ Engine, FreeCamera, Scene } from '@babylonjs/core';
import { ArcRotateCamera, HemisphericLight, MeshBuilder } from '@babylonjs/core';
import { Mesh, StandardMaterial, Color3, Vector3 } from '@babylonjs/core';
import { WebXRInputSource } from '@babylonjs/core/XR';
import { Inspector } from '@babylonjs/inspector';

import '@babylonjs/core/Materials/Textures/Loaders'; // Required for EnvironmentHelper
import '@babylonjs/loaders/glTF'; // Enable GLTF/GLB loader for loading controller models from WebXR Input registry
import './style.css'

const socket = io();

const rotationQuaternion = null;
if (rotationQuaternion) {
    //console.log('Rotation Quaternion: ', rotationQuaternion);
}

let playerID: string;
let clientPlayer: Player | null = null;
let playerUsingVR: boolean = false;
let clientStartPos = {x: 0, y: 0, z: 0};

let xrCamera: FreeCamera | null = null;
let leftController: WebXRInputSource | null = null;
let rightController: WebXRInputSource | null = null;
let leftColor = new Color3(0, 0, 0);
let rightColor = new Color3(0, 0, 0);

let divFps = document.getElementById('fps');

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

const leftSphere = MeshBuilder.CreateBox('xBox', { size: 0.3 }, scene);
const rightSphere = MeshBuilder.CreateBox('xBox', { size: 0.3 }, scene);
const leftMaterial = new StandardMaterial('matR', scene);
const rightMaterial = new StandardMaterial('matR', scene);

leftMaterial.diffuseColor = leftColor;
rightMaterial.diffuseColor = rightColor;

leftMaterial.alpha = 0.5;
rightMaterial.alpha = 0.5;

leftSphere.position.x = -0.5;
rightSphere.position.x = 0.5;

leftSphere.material = leftMaterial;
rightSphere.material = rightMaterial;

let playerList: { [key: string]: Player } = {};

interface PlayerData {
    id: string;
    position: { x: number, y: number, z: number };
    rotation: { x: number, y: number, z: number };
    contrPosR: { x: number, y: number, z: number };
    contrPosL: { x: number, y: number, z: number };
    contrRotR: { x: number, y: number, z: number };
    contrRotL: { x: number, y: number, z: number };
    color: string;

    setData(player: PlayerData): void;
    updateObj(): void;
    sendData(): void;
}

class Player implements PlayerData {
    id: string;
    // position: Vector3;
    // rotation: Vector3;
    // contrPosR: Vector3;
    // contrPosL: Vector3;
    // contrRotR: Vector3;
    // contrRotL: Vector3;
    position: { x: number, y: number, z: number };
    rotation: { x: number, y: number, z: number };
    contrPosR: { x: number, y: number, z: number };
    contrPosL: { x: number, y: number, z: number };
    contrRotR: { x: number, y: number, z: number };
    contrRotL: { x: number, y: number, z: number };
    color: string;
    headObj?: Mesh | null;
    controllerR?: Mesh | null;
    controllerL?: Mesh | null;

    constructor(player: PlayerData, headObj?: Mesh, controllerR?: Mesh, controllerL?: Mesh) {
        this.id = player.id;
        // this.position = new Vector3(player.position.x, player.position.y, player.position.z);
        // this.rotation = new Vector3(player.rotation.x, player.rotation.y, player.rotation.z);
        // this.contrPosR = new Vector3(player.contrPosR.x, player.contrPosR.y, player.contrPosR.z);
        // this.contrPosL = new Vector3(player.contrPosL.x, player.contrPosL.y, player.contrPosL.z);
        // this.contrRotR = new Vector3(player.contrRotR.x, player.contrRotR.y, player.contrRotR.z);
        // this.contrRotL = new Vector3(player.contrRotL.x, player.contrRotL.y, player.contrRotL.z);
        this.position = { x: player.position.x, y: player.position.y, z: player.position.z };
        this.rotation = { x: player.rotation.x, y: player.rotation.y, z: player.rotation.z };
        this.contrPosR = { x: player.contrPosR.x, y: player.contrPosR.y, z: player.contrPosR.z };
        this.contrPosL = { x: player.contrPosL.x, y: player.contrPosL.y, z: player.contrPosL.z };
        this.contrRotR = { x: player.contrRotR.x, y: player.contrRotR.y, z: player.contrRotR.z };
        this.contrRotL = { x: player.contrRotL.x, y: player.contrRotL.y, z: player.contrRotL.z };
        this.color = player.color;
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
        //console.log('Updating player Mesh');
        if (this.headObj) {
            // onsole.log('Updating Head Object');
            this.headObj.position = new Vector3(this.position.x, this.position.y, this.position.z);
            this.headObj.rotation = new Vector3(this.rotation.x, this.rotation.y, this.rotation.z);
        }

        if (this.controllerR) {
            // console.log('Updating Controller Right');
            this.controllerR.position = new Vector3(this.contrPosR.x, this.contrPosR.y, this.contrPosR.z);
            this.controllerR.rotation = new Vector3(this.contrRotR.x, this.contrRotR.y, this.contrRotR.z);
        }

        if (this.controllerL) {
            // console.log('Updating Controller Left');
            this.controllerL.position = new Vector3(this.contrPosL.x, this.contrPosL.y, this.contrPosL.z);
            this.controllerL.rotation = new Vector3(this.contrRotL.x, this.contrRotL.y, this.contrRotL.z);
        }
    }

    sendData(xrCamera?: FreeCamera, leftController?: WebXRInputSource, rightController?: WebXRInputSource) {

        // console.log('Sending Data to Server');
        // console.log('Player ID: ', this.id);
        // console.log('Position: ', xrCamera?.position);
        // console.log('Rotation: ', xrCamera?.rotation);
        // console.log('Controller Position Right: ', rightController?.grip?.position);
        // console.log('Controller Position Left: ', leftController?.grip?.position);
        // console.log('Controller Rotation Right: ', rightController?.grip?.rotation);
        // console.log('Controller Rotation Left: ', leftController?.grip?.rotation);

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

            // console.log('Sending Data to Server');
            // console.log('headPos: ', headPos);
            // console.log('headRot: ', headRot);

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
    var xr = await scene.createDefaultXRExperienceAsync({
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

    // const playerRef = scene.getMeshByName('player_' + playerID);
    // playerRef.position = new Vector3(0, 0, 0);
    // playerRef.rotation = new Vector3(xrCamera.rotation.x, xrCamera.rotation.y, xrCamera.rotation.z);

    // const defaultXRExperience = await scene.createDefaultXRExperienceAsync({
    //     floorMeshes: [scene.getMeshByName('ground')],
    //     inputOptions: {
    //         controllerOptions: {
    //             // disableMotionControllerAnimation: true,
    //             // doNotLoadControllerMesh: true,
    //             // forceControllerProfile: <string>,
    //             // renderingGroupId: <number>
    //         },
    //         // customControllersRepositoryURL: <string>,
    //         // disableControllerAnimation: true,
    //         // disableOnlineControllerRepository: true,
    //         doNotLoadControllerMeshes: true, // move, but hide controllers
    //         // forceInputProfile: 'generic-trigger-squeeze-thumbstick',
    //     },
    // });

    xr.teleportation.detach();
    xr.pointerSelection.detach();

    xrCamera = xr.baseExperience.camera;
    if (clientStartPos) {
        xrCamera.position = new Vector3(clientStartPos.x, clientStartPos.y, clientStartPos.z);
    }


    const hasImmersiveVR = await xr.baseExperience.sessionManager.isSessionSupportedAsync('immersive-vr');

    if (hasImmersiveVR) {

        xr.baseExperience.sessionManager.onXRSessionInit.add(() => {
            playerUsingVR = true;
            console.log('Player is starting VR');
            socket.emit('playerStartVR', playerUsingVR);
        });

        xr.baseExperience.sessionManager.onXRSessionEnded.add(() => {
            playerUsingVR = false;
            console.log('Player is leaving VR');
            socket.emit('playerEndVR', playerUsingVR);
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
                            // Box_Left_Trigger.scaling = new Vector3(1.2, 1.2, 1.2);

                        } else {
                            // Box_Left_Trigger.scaling = new Vector3(1, 1, 1);

                        }
                    });

                    let squeezeComponent = motionController.getComponent(xrIDs[1]);//xr-standard-squeeze
                    squeezeComponent.onButtonStateChangedObservable.add(() => {
                        if (squeezeComponent.pressed) {
                            socket.emit('clicked');
                            // Box_Left_Squeeze.scaling = new Vector3(1.2, 1.2, 1.2);

                        } else {
                            // Box_Left_Squeeze.scaling = new Vector3(1, 1, 1);
                        }
                    });

                    let thumbstickComponent = motionController.getComponent(xrIDs[2]);//xr-standard-thumbstick
                    thumbstickComponent.onButtonStateChangedObservable.add(() => {
                        if (thumbstickComponent.pressed) {
                            socket.emit('clicked');
                            // Box_Left_ThumbStick.scaling = new Vector3(1.2, 1.2, 1.2);
                        } else {
                            // Box_Left_ThumbStick.scaling = new Vector3(1, 1, 1);
                        }
                        /*
                            let axes = thumbstickComponent.axes;
                            Box_Left_ThumbStick.position.x += axes.x;
                            Box_Left_ThumbStick.position.y += axes.y;
                        */
                    });

                    let xbuttonComponent = motionController.getComponent(xrIDs[3]);//x-button
                    xbuttonComponent.onButtonStateChangedObservable.add(() => {
                        if (xbuttonComponent.pressed) {
                            socket.emit('clicked');
                            // Sphere_Left_XButton.scaling = new Vector3(1.2, 1.2, 1.2);

                        } else {
                            // Sphere_Left_XButton.scaling = new Vector3(1, 1, 1);
                        }
                    });

                    let ybuttonComponent = motionController.getComponent(xrIDs[4]);//y-button
                    ybuttonComponent.onButtonStateChangedObservable.add(() => {
                        if (ybuttonComponent.pressed) {
                            socket.emit('clicked');
                            // Sphere_Left_YButton.scaling = new Vector3(1.2, 1.2, 1.2);

                        } else {
                            // Sphere_Left_YButton.scaling = new Vector3(1, 1, 1);
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
                            // Box_Right_Trigger.scaling = new Vector3(1.2, 1.2, 1.2);

                        } else {
                            // Box_Right_Trigger.scaling = new Vector3(1, 1, 1);

                        }
                    });

                    let squeezeComponent = motionController.getComponent(xrIDs[1]);//xr-standard-squeeze
                    squeezeComponent.onButtonStateChangedObservable.add(() => {
                        if (squeezeComponent.pressed) {
                            socket.emit('clicked');
                            // Box_Right_Squeeze.scaling = new Vector3(1.2, 1.2, 1.2);

                        } else {
                            // Box_Right_Squeeze.scaling = new Vector3(1, 1, 1);
                        }
                    });

                    let thumbstickComponent = motionController.getComponent(xrIDs[2]);//xr-standard-thumbstick
                    thumbstickComponent.onButtonStateChangedObservable.add(() => {
                        if (thumbstickComponent.pressed) {
                            socket.emit('clicked');
                            // Box_Right_ThumbStick.scaling = new Vector3(1.2, 1.2, 1.2);
                        } else {
                            // Box_Right_ThumbStick.scaling = new Vector3(1, 1, 1);
                        }

                    });

                    let abuttonComponent = motionController.getComponent(xrIDs[3]);//a-button
                    abuttonComponent.onButtonStateChangedObservable.add(() => {
                        if (abuttonComponent.pressed) {
                            socket.emit('clicked');
                            // Sphere_Right_AButton.scaling = new Vector3(1.2, 1.2, 1.2);
                        } else {
                            // Sphere_Right_AButton.scaling = new Vector3(1, 1, 1);
                        }
                    });

                    let bbuttonComponent = motionController.getComponent(xrIDs[4]);//b-button
                    bbuttonComponent.onButtonStateChangedObservable.add(() => {
                        if (bbuttonComponent.pressed) {
                            socket.emit('clicked');
                            // Sphere_Right_BButton.scaling = new Vector3(1.2, 1.2, 1.2);

                        } else {
                            // Sphere_Right_BButton.scaling = new Vector3(1, 1, 1);
                        }
                    });
                }
            })
        });

        setInterval(function () {
            console.log('Interval Function');
            if (clientPlayer) {
                if (playerUsingVR) {
                    if (xrCamera && leftController && rightController) {
                        clientPlayer.sendData(xrCamera, leftController, rightController);
                    }
                }
            }
            // if (leftController && rightController) {
            //     console.log('LeftController Pointer Position: ', leftController.pointer.position);
            //     console.log('LeftController Grip Position: ', leftController.grip?.position);
            //     console.log('leftController Pointer Rotation: ', leftController.pointer.rotationQuaternion?.toEulerAngles());
            // }
        }, 1000);
    }
})();

socket.on('joinedWaitingRoom', () => {
    console.log('You joined the waiting Room. Enter VR to join the Game.');
});

socket.on('yourPlayerInfo', (socket) => {

    // get the Connection ID of the Player
    playerID = socket.id;

    clientPlayer = new Player(socket);

    clientStartPos = {x: socket.position.x, y: socket.position.y, z: socket.position.z};

    console.log('Your Player Object before spawn');
    console.log(clientPlayer);

    // console.log('Socket Object')
    // console.log(socket);

    // console.log('Client Player Object')
    // console.log(clientPlayer);

    playerList[playerID] = clientPlayer;
    //playerList.push({ IdKey: playerID, player: clientPlayer });


    camera.position = new Vector3(clientStartPos.x, clientStartPos.y, clientStartPos.z);
    camera.setTarget(Vector3.Zero());

    // Spawn yourself Entity
    addPlayer(socket, true);

    console.log('Your Player Object after spawn');
    console.log(clientPlayer);
});

// when the current player is already on the server and a new player joins
socket.on('newPlayer', (player) => {
    // console log about new player joined
    console.log('New player joined: ', player.id);

    // Add new player to the playerList
    //playerList.push({ IdKey: player.id, player: new Player(player) });
    playerList[player.id] = new Player(player);

    // Spawn new player Entity
    addPlayer(player, false);
});

// get all current Player Information from the Server at the start
// and spawning all current players except yourself
socket.on('currentState', (players: { [key: string]: Player }, testColor: string) => {

    if (testSphere) {
        (testSphere.material as StandardMaterial).diffuseColor = Color3.FromHexString(testColor);
    }

    Object.keys(players).forEach((id) => {
        if (id != playerID) {
            // Add new player to the playerList
            //playerList.push({ IdKey: id, player: new Player(players[id]) });
            playerList[id] = new Player(players[id]);

            // Spawn new player Entity
            addPlayer(players[id], false);
        }
    });
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

// update the players position and rotation from the server
socket.on('serverUpdate', (players) => {
    // console.log('Server Update');
    // console.log(players);
    Object.keys(players).forEach((id) => {
        if (playerList[id]) {
            // console.log('Old player');
            // console.log(playerList[id]);
            playerList[id].setData(players[id]);
            // console.log('updated Player');
            // console.log(playerList[id]);
        }
    });
});

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
    // console.log('Player Object')
    // console.log(player);
}

socket.on('playerDisconnected', (id) => {
    const disconnectedPlayer = playerList[id];
    if (disconnectedPlayer) {
        console.log('Player disconnected: ', id);
        disconnectedPlayer.headObj?.dispose();
        disconnectedPlayer.controllerR?.dispose();
        disconnectedPlayer.controllerL?.dispose();
    }
});

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

// Register a render loop to repeatedly render the scene
engine.runRenderLoop(function () {
    if (divFps) {
        divFps.innerHTML = engine.getFps().toFixed() + ' fps';
    }

    if (leftController && rightController) {
        leftSphere.position = leftController.pointer.position;
        rightSphere.position = rightController.pointer.position;
        leftSphere.rotation = leftController.pointer.rotationQuaternion?.toEulerAngles() || new Vector3(0, 0, 0);
        rightSphere.rotation = rightController.pointer.rotationQuaternion?.toEulerAngles() || new Vector3(0, 0, 0);
    }

    Object.keys(playerList).forEach((id) => {
        if (playerList[id]) {
            //console.log('Updating Player: ', id);
            playerList[id].updateObj();
        }
    });

    scene.render();
});