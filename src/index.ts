import { io } from "socket.io-client";
import { Engine, Scene } from "@babylonjs/core";
import { ArcRotateCamera, HemisphericLight, MeshBuilder } from "@babylonjs/core";
import { Mesh, StandardMaterial, Color3, Vector3 } from "@babylonjs/core";
import { WebXRInputSource } from "@babylonjs/core/XR";
import { Inspector } from "@babylonjs/inspector";

import '@babylonjs/core/Materials/Textures/Loaders'; // Required for EnvironmentHelper
import '@babylonjs/loaders/glTF'; // Enable GLTF/GLB loader for loading controller models from WebXR Input registry
import './style.css'

const socket = io();

let playerID: string;
let clientPlayer;

let leftController: WebXRInputSource | null = null;
let rightController: WebXRInputSource | null = null;
let leftColor = new Color3(0, 0, 0);
let rightColor = new Color3(0, 0, 0);

let divFps = document.getElementById("fps");

////////////////////////////// CREATE BABYLON SCENE ETC. //////////////////////////////

// Create a canvas element for rendering
const canvas = document.createElement('canvas');
canvas.id = 'renderCanvas';
document.body.appendChild(canvas);

// Create engine and a scene
const engine = new Engine(canvas, true);
const scene = new Scene(engine);

// Add a camera for the non-VR view in browser
const camera = new ArcRotateCamera("Camera", -(Math.PI / 4) * 3, Math.PI / 4, 10, new Vector3(0, 0, 0), scene);
camera.attachControl(true);

// Creates a light, aiming 0,1,0 - to the sky
const light = new HemisphericLight("light",
    new Vector3(0, 1, 0), scene);
// Dim the light a small amount - 0 to 1
light.intensity = 0.7;

// Built-in 'sphere' shape.
const testSphere = MeshBuilder.CreateSphere("testSphere",
    { diameter: 2, segments: 32 }, scene);
testSphere.material = new StandardMaterial("mat", scene);

// Move the sphere upward 1/2 its height
testSphere.position.y = 1;

// Built-in 'ground' shape.
const ground = MeshBuilder.CreateGround("ground",
    { width: 6, height: 6 }, scene);

ground.material = new StandardMaterial("matGround", scene);

const leftSphere = MeshBuilder.CreateSphere('xSphere', { segments: 16, diameter: 0.1 }, scene);
const rightSphere = MeshBuilder.CreateSphere('xSphere', { segments: 16, diameter: 0.1 }, scene);
const leftMaterial = new StandardMaterial("matR", scene);
const rightMaterial = new StandardMaterial("matR", scene);

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
}

class Player {
    id: string;
    position: Vector3;
    rotation: Vector3;
    contrPosR: Vector3;
    contrPosL: Vector3;
    contrRotR: Vector3;
    contrRotL: Vector3;
    color: string;
    headObj?: Mesh;
    controllerR?: Mesh | null;
    controllerL?: Mesh | null;

    constructor(player: PlayerData) {
        this.id = player.id;
        this.position = new Vector3(player.position.x, player.position.y, player.position.z);
        this.rotation = new Vector3(player.rotation.x, player.rotation.y, player.rotation.z);
        this.contrPosR = new Vector3(player.contrPosR.x, player.contrPosR.y, player.contrPosR.z);
        this.contrPosL = new Vector3(player.contrPosL.x, player.contrPosL.y, player.contrPosL.z);
        this.contrRotR = new Vector3(player.contrRotR.x, player.contrRotR.y, player.contrRotR.z);
        this.contrRotL = new Vector3(player.contrRotL.x, player.contrRotL.y, player.contrRotL.z);
        this.color = player.color;
        //this.headObj = scene.getMeshByName('player_' + player.id);
        //this.controllerR = scene.getMeshByName('conR_' + player.id);
        //this.controllerL = scene.getMeshByName('conL_' + player.id);
    }
}

// Watch for browser/canvas resize events
window.addEventListener("resize", function () {
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

    // const xrCamera = xr.baseExperience.camera;

    // xrCamera.setTransformationFromNonVRCamera(camera);

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

    const hasImmersiveVR = await xr.baseExperience.sessionManager.isSessionSupportedAsync('immersive-vr');

    if (hasImmersiveVR) {
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
    }
})();

socket.on('yourPlayerInfo', (socket) => {

    // get the Connection ID of the Player
    playerID = socket.id;

    clientPlayer = new Player(socket);

    playerList[socket.id] = clientPlayer;

    camera.position = new Vector3(socket.position.x, socket.position.y, socket.position.z);
    camera.setTarget(Vector3.Zero());

    // Spawn yourself Entity
    addPlayer(socket, true);
});

socket.on('newPlayer', (player) => {
    // console log about new player joined
    console.log('New player joined: ', player.id);

    // Add new player to the playerList
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
            playerList[id] = new Player(players[id]);

            // Spawn new player Entity
            addPlayer(players[id], false);
        }
    });
});

document.addEventListener('click', () => {
    socket.emit('clicked');
});

socket.on('colorChanged', (color) => {
    // change color of the sphere
    if (testSphere) {
        (testSphere.material as StandardMaterial).diffuseColor = Color3.FromHexString(color);
    }
});

// update the players position and rotation from the server
socket.on('serverUpdate', (players) => {
    Object.keys(players).forEach((id) => {
        if (playerList[id]) {
            playerList[id].position = players[id].position;
            playerList[id].rotation = players[id].rotation;
            playerList[id].contrPosR = players[id].contrPosR;
            playerList[id].contrPosL = players[id].contrPosL;
            playerList[id].contrRotR = players[id].contrRotR;
            playerList[id].contrRotL = players[id].contrRotL;
        }
    });
});

// Spawn Player Entity with the Connection ID
function addPlayer(player: Player, isPlayer: boolean) {
    console.log('Spawning player: ', player.id);

    console.log('Playercolor: ', player.color);

    const playerElem = MeshBuilder.CreateBox("player_" + player.id, { size: 1 }, scene);
    if (isPlayer) {
        playerElem.parent = camera;
    } else {
        playerElem.position = new Vector3(player.position.x, player.position.y, player.position.z);
        playerElem.rotation = new Vector3(player.rotation.x, player.rotation.y, player.rotation.z);
    }

    playerElem.material = new StandardMaterial("mat_" + player.id, scene);
    (playerElem.material as StandardMaterial).diffuseColor = Color3.FromHexString(player.color);

    const playerContrR = MeshBuilder.CreateBox('conR_' + player.id, { size: 0.2 });
    playerContrR.position = new Vector3(player.contrPosR.x, player.contrPosR.y, player.contrPosR.z);
    playerContrR.rotation = new Vector3(player.contrRotR.x, player.contrRotR.y, player.contrRotR.z);
    playerContrR.material = new StandardMaterial("matConR_" + player.id, scene);
    (playerContrR.material as StandardMaterial).diffuseColor = Color3.FromHexString(player.color);

    const playerContrL = MeshBuilder.CreateBox('conL_' + player.id, { size: 0.2 });
    playerContrL.position = new Vector3(player.contrPosL.x, player.contrPosL.y, player.contrPosL.z);
    playerContrL.rotation = new Vector3(player.contrRotL.x, player.contrRotL.y, player.contrRotL.z);
    playerContrL.material = new StandardMaterial("matConL" + player.id, scene);
    (playerContrL.material as StandardMaterial).diffuseColor = Color3.FromHexString(player.color);
}

socket.on('playerDisconnected', (id) => {
    const disconnectedPlayer = playerList[id];
    if (disconnectedPlayer) {
        // scene.getMeshByName('player_' + id).dispose();
        // scene.getMeshByName('conR_' + id).dispose();
        // scene.getMeshByName('conL_' + id).dispose();
    }
});

window.addEventListener("keydown", function (event) {
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

// setInterval(function () {
//     if (clientPlayer) {
//         socket.emit('clientUpdate', {
//         });
//     }
// }, 20);

// Register a render loop to repeatedly render the scene
engine.runRenderLoop(function () {
    if (divFps) {
        divFps.innerHTML = engine.getFps().toFixed() + " fps";
    }

    if (leftController && rightController) {
        leftSphere.position = leftController.pointer.position;
        rightSphere.position = rightController.pointer.position;
    }

    // Object.keys(playerList).forEach((id) => {
    //     if (playerList[id]) {
    //         if (id != playerID) {
    //             const playerElem = scene.getMeshByName('player_' + id);
    //             const playerContrR = scene.getMeshByName('conR_' + id);
    //             const playerContrL = scene.getMeshByName('conL_' + id);

    //             playerElem.position = new Vector3(playerList[id].position.x, playerList[id].position.y, playerList[id].position.z);
    //             playerElem.rotation = new Vector3(playerList[id].rotation.x, playerList[id].rotation.y, playerList[id].rotation.z);

    //             playerContrR.position = new Vector3(playerList[id].contrPosR.x, playerList[id].contrPosR.y, playerList[id].contrPosR.z);
    //             playerContrR.rotation = new Vector3(playerList[id].contrRotR.x, playerList[id].contrRotR.y, playerList[id].contrRotR.z);

    //             playerContrL.position = new Vector3(playerList[id].contrPosL.x, playerList[id].contrPosL.y, playerList[id].contrPosL.z);
    //             playerContrL.rotation = new Vector3(playerList[id].contrRotL.x, playerList[id].contrRotL.y, playerList[id].contrRotL.z);
    //         }
    //     }
    // });

    scene.render();
});