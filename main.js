const socket = io();

let playerID, thisPlayerColor;
let thisPlayer, thisPlayerContrR, thisPlayerContrL;

let controller1, controller2;

let updateMessage;

let playerList = {};

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

// scene.debugLayer.show({
//     embedMode: true,
// });

socket.on('yourPlayerInfo', (socket) => {

    // get the Connection ID of the Player
    playerID = socket.id;
    thisPlayerColor = socket.color;

    // Spawn yourself Entity
    addPlayer(socket);
});


document.addEventListener('click', () => {
    socket.emit('clicked');
});

socket.on('colorChanged', (color) => {
    console.log('colorChanged: ', color);
    scene.getMeshByName('testSphere').material.diffuseColor = BABYLON.Color3.FromHexString(color);
});

// get Player Information from the Server and calling Spawning function
socket.on('currentState', (players) => {
    // Object.keys(players).forEach((id) => {
    //     let playerByID = document.getElementById(id) || addPlayer(players[id]);
    //     let playerContrR = document.getElementById(id + '_contr_r');
    //     let playerContrL = document.getElementById(id + '_contr_l');
    //     if (playerByID) {
    //         playerByID.setAttribute('position', players[id].position);
    //         playerByID.setAttribute('rotation', players[id].rotation);

    //         //playerByID.object3D.position.set(players[id].position.x, players[id].position.y, players[id].position.z);
    //         //playerByID.object3D.rotation.set(players[id].rotation.x, players[id].rotation.y, players[id].rotation.z);
    //     }
    //     if (playerContrR) {
    //         playerContrR.setAttribute('position', players[id].contr_pos_r);
    //         playerContrR.setAttribute('rotation', players[id].contr_rot_r);
    //     }
    //     if (playerContrL) {
    //         playerContrL.setAttribute('position', players[id].contr_pos_l);
    //         playerContrL.setAttribute('rotation', players[id].contr_rot_l);
    //     }
    // });
});

// Spawn Player Entity with the Connection ID
function addPlayer(player) {
    const playerElem = BABYLON.MeshBuilder.CreateBox("box", { size: 1 }, scene);
    playerElem.id = player.id;
    playerElem.position = player.position;
    playerElem.rotation = player.rotation;
    playerElem.color = player.color;
    playerElem.material = new BABYLON.StandardMaterial("mat", scene);

    const playerContrR = BABYLON.MeshBuilder.CreateBox("box", { size: 0.3 }, scene);
    playerContrR.id = player.id + '_contr_r';
    playerContrR.position = player.contr_pos_r;
    playerContrR.rotation = player.contr_rot_r;
    playerContrR.color = player.color;
    playerContrR.material = new BABYLON.StandardMaterial("mat", scene);

    const playerContrL = BABYLON.MeshBuilder.CreateBox("box", { size: 0.3 }, scene);
    playerContrL.id = player.id + '_contr_l';
    playerContrL.position = player.contr_pos_l;
    playerContrL.rotation = player.contr_rot_l;
    playerContrL.color = player.color;
    playerContrL.material = new BABYLON.StandardMaterial("mat", scene);
}

socket.on('newPlayer', (player) => {
    console.log('New player joined: ', player.id);
    addPlayer(player);
});

socket.on('playerDisconnected', (id) => {
    const disconnectedPlayer = playerList[id];
    if (disconnectedPlayer) {
        disconnectedPlayer.remove();
    }
});

// setInterval(function () {
//     if (thisPlayer) {
//         socket.emit('update', {
//         });
//     }
// }, 20);

// Register a render loop to repeatedly render the scene
engine.runRenderLoop(function () {
    divFps.innerHTML = engine.getFps().toFixed() + " fps";
    scene.render();
});