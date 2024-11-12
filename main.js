const socket = io();

let playerID, clientPlayerColor;
let clientPlayer, clientPlayerContrR, clientPlayerContrL;

let controller1, controller2;

let updateMessage;

let playerList = {};
let playerObjList = [];

class Player {
    constructor(player) {
        this.id = player.id;
        this.position = player.position;
        this.rotation = player.rotation;
        this.contr_pos_r = player.contr_pos_r;
        this.contr_pos_l = player.contr_pos_l;
        this.contr_rot_r = player.contr_rot_r;
        this.contr_rot_l = player.contr_rot_l;
        this.color = player.color;
    }
}

let divFps = document.getElementById("fps");

const canvas = document.getElementById("renderCanvas"); // Get the canvas element
const engine = new BABYLON.Engine(canvas, true); // Generate the BABYLON 3D engine

const createScene = function () {
    // Creates a basic Babylon Scene object
    const scene = new BABYLON.Scene(engine);
    // Creates and positions a free camera
    const camera = new BABYLON.FreeCamera("camera1",
        new BABYLON.Vector3(0, 5, -10), scene);
    // Targets the camera to scene origin
    camera.setTarget(BABYLON.Vector3.Zero());
    // This attaches the camera to the canvas
    camera.attachControl(canvas, true);
    // Creates a light, aiming 0,1,0 - to the sky
    const light = new BABYLON.HemisphericLight("light",
        new BABYLON.Vector3(0, 1, 0), scene);
    // Dim the light a small amount - 0 to 1
    light.intensity = 0.7;
    // Built-in 'sphere' shape.
    const testSphere = BABYLON.MeshBuilder.CreateSphere("testSphere",
        { diameter: 2, segments: 32 }, scene);

    testSphere.material = new BABYLON.StandardMaterial("mat", scene);
    // Move the sphere upward 1/2 its height
    testSphere.position.y = 1;
    // Built-in 'ground' shape.
    const ground = BABYLON.MeshBuilder.CreateGround("ground",
        { width: 6, height: 6 }, scene);
    return scene;
};

const scene = createScene(); //Call the createScene function

// Watch for browser/canvas resize events
window.addEventListener("resize", function () {
    engine.resize();
});

(async function main() {
    // Create a WebXR experience
    var xr = await scene.createDefaultXRExperienceAsync({
        floorMeshes: [scene.getMeshByName('ground')]
        // inputOptions: {
        //     doNotLoadControllerMeshes: true
        // }
        //  xrInput: defaultXRExperience.input,
        //      floorMeshes: [environment.ground] /* Array of meshes to be used as landing points */
    });

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

    // Create a box for each controller
    xr.input.onControllerAddedObservable.add((controller) => {
        controller.onMotionControllerInitObservable.add((motionController) => {
            if (motionController.handness === 'left') {
                const xr_ids = motionController.getComponentIds();
                let triggerComponent = motionController.getComponent(xr_ids[0]);//xr-standard-trigger

                // // Get the position and rotation of the controller
                // const grip = controller.grip || controller.pointer;

                // if (grip) {
                //     // Log the position and rotation
                //     console.log(`Controller ${motionController.handness} position:`, grip.position);
                //     console.log(`Controller ${motionController.handness} rotation:`, grip.rotationQuaternion);

                //     // Create a box at the controller's position
                //     const box = BABYLON.MeshBuilder.CreateBox(`box_${motionController.handness}`, { size: 0.1 }, scene);
                //     box.position = grip.position.clone();
                //     box.rotationQuaternion = grip.rotationQuaternion.clone();

                //     // Store the box and grip for updating in the render loop
                //     controllerBoxes[motionController.handness] = { box, grip };
                // }

                // add Event Listeners for each button //

                triggerComponent.onButtonStateChangedObservable.add(() => {
                    if (triggerComponent.pressed) {
                        // Box_Left_Trigger.scaling = new BABYLON.Vector3(1.2, 1.2, 1.2);

                    } else {
                        // Box_Left_Trigger.scaling = new BABYLON.Vector3(1, 1, 1);

                    }
                });

                let squeezeComponent = motionController.getComponent(xr_ids[1]);//xr-standard-squeeze
                squeezeComponent.onButtonStateChangedObservable.add(() => {
                    if (squeezeComponent.pressed) {
                        // Box_Left_Squeeze.scaling = new BABYLON.Vector3(1.2, 1.2, 1.2);

                    } else {
                        // Box_Left_Squeeze.scaling = new BABYLON.Vector3(1, 1, 1);
                    }
                });
                let thumbstickComponent = motionController.getComponent(xr_ids[2]);//xr-standard-thumbstick
                thumbstickComponent.onButtonStateChangedObservable.add(() => {
                    if (thumbstickComponent.pressed) {
                        // Box_Left_ThumbStick.scaling = new BABYLON.Vector3(1.2, 1.2, 1.2);
                    } else {
                        // Box_Left_ThumbStick.scaling = new BABYLON.Vector3(1, 1, 1);
                    }
                    /*
                        let axes = thumbstickComponent.axes;
                        Box_Left_ThumbStick.position.x += axes.x;
                        Box_Left_ThumbStick.position.y += axes.y;
                    */
                });
                thumbstickComponent.onAxisValueChangedObservable.add((axes) => {
                    //https://playground.babylonjs.com/#INBVUY#87
                    //inactivate camera rotation : not working so far

                    /*
                    let rotationValue = 0;
                    const matrix = new BABYLON.Matrix();
                    let deviceRotationQuaternion = webXRInput.xrCamera.getDirection(BABYLON.Axis.Z).toQuaternion(); // webXRInput.xrCamera.rotationQuaternion;
                    var angle = rotationValue * (Math.PI / 8);
                    var quaternion = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, angle);
                    const move = new BABYLON.Vector3(0,0,0);
                    deviceRotationQuaternion = deviceRotationQuaternion.multiply(quaternion);
                    BABYLON.Matrix.FromQuaternionToRef(deviceRotationQuaternion, matrix);
                    const addPos = BABYLON.Vector3.TransformCoordinates(move, matrix);
                    addPos.y = 0;
 
                    webXRInput.xrCamera.position = webXRInput.xrCamera.position.add(addPos);
                   // webXRInput.xrCamera.rotationQuaternion = BABYLON.Quaternion.Identity();
                    
                    //webXRInput.xrCamera.rotation = new BABYLON.Vector3(0,0,0);
                    */
                    //Box_Left_ThumbStick is moving according to stick axes but camera rotation is also changing..
                    // Box_Left_ThumbStick.position.x += (axes.x)/100;
                    //  Box_Left_ThumbStick.position.y -= (axes.y)/100;
                    // console.log(values.x, values.y);
                });

                let xbuttonComponent = motionController.getComponent(xr_ids[3]);//x-button
                xbuttonComponent.onButtonStateChangedObservable.add(() => {
                    if (xbuttonComponent.pressed) {
                        // Sphere_Left_XButton.scaling = new BABYLON.Vector3(1.2, 1.2, 1.2);

                    } else {
                        // Sphere_Left_XButton.scaling = new BABYLON.Vector3(1, 1, 1);
                    }
                });
                let ybuttonComponent = motionController.getComponent(xr_ids[4]);//y-button
                ybuttonComponent.onButtonStateChangedObservable.add(() => {
                    if (ybuttonComponent.pressed) {
                        // Sphere_Left_YButton.scaling = new BABYLON.Vector3(1.2, 1.2, 1.2);

                    } else {
                        // Sphere_Left_YButton.scaling = new BABYLON.Vector3(1, 1, 1);
                    }
                });
                /* not worked.
                let thumbrestComponent = motionController.getComponent(xr_ids[5]);//thumrest
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
                const xr_ids = motionController.getComponentIds();
                let triggerComponent = motionController.getComponent(xr_ids[0]);//xr-standard-trigger
                triggerComponent.onButtonStateChangedObservable.add(() => {
                    if (triggerComponent.pressed) {
                        // Box_Right_Trigger.scaling = new BABYLON.Vector3(1.2, 1.2, 1.2);

                    } else {
                        // Box_Right_Trigger.scaling = new BABYLON.Vector3(1, 1, 1);

                    }
                });
                let squeezeComponent = motionController.getComponent(xr_ids[1]);//xr-standard-squeeze
                squeezeComponent.onButtonStateChangedObservable.add(() => {
                    if (squeezeComponent.pressed) {
                        // Box_Right_Squeeze.scaling = new BABYLON.Vector3(1.2, 1.2, 1.2);

                    } else {
                        // Box_Right_Squeeze.scaling = new BABYLON.Vector3(1, 1, 1);
                    }
                });
                let thumbstickComponent = motionController.getComponent(xr_ids[2]);//xr-standard-thumbstick
                thumbstickComponent.onButtonStateChangedObservable.add(() => {
                    if (thumbstickComponent.pressed) {
                        // Box_Right_ThumbStick.scaling = new BABYLON.Vector3(1.2, 1.2, 1.2);
                    } else {
                        // Box_Right_ThumbStick.scaling = new BABYLON.Vector3(1, 1, 1);
                    }

                });
                thumbstickComponent.onAxisValueChangedObservable.add((axes) => {
                    //Box_Right_ThumbStick is moving according to stick axes but camera rotation is also changing..
                    // Box_Right_ThumbStick.position.x += (axes.x)/100;
                    // Box_Right_ThumbStick.position.y += (axes.y)/100;
                    // console.log(values.x, values.y);
                });

                let abuttonComponent = motionController.getComponent(xr_ids[3]);//a-button
                abuttonComponent.onButtonStateChangedObservable.add(() => {
                    if (abuttonComponent.pressed) {
                        // Sphere_Right_AButton.scaling = new BABYLON.Vector3(1.2, 1.2, 1.2);
                    } else {
                        // Sphere_Right_AButton.scaling = new BABYLON.Vector3(1, 1, 1);
                    }
                });
                let bbuttonComponent = motionController.getComponent(xr_ids[4]);//b-button
                bbuttonComponent.onButtonStateChangedObservable.add(() => {
                    if (bbuttonComponent.pressed) {
                        // Sphere_Right_BButton.scaling = new BABYLON.Vector3(1.2, 1.2, 1.2);

                    } else {
                        // Sphere_Right_BButton.scaling = new BABYLON.Vector3(1, 1, 1);
                    }
                });
            }
        })
    });
})();

socket.on('yourPlayerInfo', (socket) => {

    // get the Connection ID of the Player
    playerID = socket.id;
    clientPlayerColor = socket.color;

    clientPlayer = new Player(socket);

    playerList[socket.id] = clientPlayer;

    // Spawn yourself Entity
    addPlayer(socket);
});

socket.on('newPlayer', (player) => {
    // console log about new player joined
    console.log('New player joined: ', player.id);

    // Add new player to the playerList
    playerList[player.id] = new Player(player);

    // Spawn new player Entity
    addPlayer(player);
});


document.addEventListener('click', () => {
    socket.emit('clicked');
});

socket.on('colorChanged', (color) => {
    // change color of the sphere
    scene.getMeshByName('testSphere').material.diffuseColor = BABYLON.Color3.FromHexString(color);
});

// get all current Player Information from the Server at the start
// and spawning all current players except yourself
socket.on('currentState', (players) => {
    Object.keys(players).forEach((id) => {
        if (id != playerID) {
            // Add new player to the playerList
            playerList[id] = new Player(players[id]);

            // Spawn new player Entity
            addPlayer(players[id]);
        }
    });
});

// update the players position and rotation from the server
socket.on('serverUpdate', (players) => {
    Object.keys(players).forEach((id) => {
        if (playerList[id]) {
            playerList[id].position = players[id].position;
            playerList[id].rotation = players[id].rotation;
            playerList[id].contr_pos_r = players[id].contr_pos_r;
            playerList[id].contr_pos_l = players[id].contr_pos_l;
            playerList[id].contr_rot_r = players[id].contr_rot_r;
            playerList[id].contr_rot_l = players[id].contr_rot_l;
        }
    });
});

// Spawn Player Entity with the Connection ID
function addPlayer(player) {
    const playerElem = BABYLON.MeshBuilder.CreateBox("player_" + player.id, { size: 1 }, scene);
    playerElem.position = player.position;
    playerElem.rotation = player.rotation;
    playerElem.color = player.color;
    playerElem.material = new BABYLON.StandardMaterial("mat_" + player.id, scene);
    playerElem.material.diffuseColor = BABYLON.Color3.FromHexString(player.color);

    const playerContrR = BABYLON.MeshBuilder.CreateBox('conR_' + player.id, { size: 0.3 }, scene);
    playerContrR.position = player.contr_pos_r;
    playerContrR.rotation = player.contr_rot_r;
    playerContrR.color = player.color;
    playerContrR.material = new BABYLON.StandardMaterial("matConR_" + player.id, scene);
    playerContrR.material.diffuseColor = BABYLON.Color3.FromHexString(player.color);

    const playerContrL = BABYLON.MeshBuilder.CreateBox('conL_' + player.id, { size: 0.3 }, scene);
    playerContrL.position = player.contr_pos_l;
    playerContrL.rotation = player.contr_rot_l;
    playerContrL.color = player.color;
    playerContrL.material = new BABYLON.StandardMaterial("matConL" + player.id, scene);
    playerContrL.material.diffuseColor = BABYLON.Color3.FromHexString(player.color);

    return playerElem, playerContrR, playerContrL;
}

socket.on('playerDisconnected', (id) => {
    const disconnectedPlayer = playerList[id];
    if (disconnectedPlayer) {
        scene.getMeshByName('player_' + id).dispose();
        scene.getMeshByName('conR_' + id).dispose();
        scene.getMeshByName('conL_' + id).dispose();
    }
});

window.addEventListener("keydown", function (event) {
    // Check if the key combination is Ctrl + I
    if (event.ctrlKey && event.key === 'i') {
        if (scene.debugLayer.isVisible()) {
            scene.debugLayer.hide();
        } else {
            scene.debugLayer.show({
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
    divFps.innerHTML = engine.getFps().toFixed() + " fps";

    // // Update the position and rotation of the controller boxes
    // for (const handness in controllerBoxes) {
    //     const grip = controllerBoxes[handness].grip;
    //     const box = controllerBoxes[handness].box;
    //     if (grip && box) {
    //         box.position.copyFrom(grip.position);
    //         box.rotationQuaternion.copyFrom(grip.rotationQuaternion);
    //     }
    // }

    scene.render();
});