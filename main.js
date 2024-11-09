const socket = io();

let playerID, thisPlayerColor;
let thisPlayer, thisPlayerContrR, thisPlayerContrL;

let controller1, controller2;

let updateMessage;

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
    const testSphere = BABYLON.MeshBuilder.CreateSphere("sphere",
        { diameter: 2, segments: 32 }, scene);
    // Move the sphere upward 1/2 its height
    testSphere.position.y = 1;
    // Built-in 'ground' shape.
    const ground = BABYLON.MeshBuilder.CreateGround("ground",
        { width: 6, height: 6 }, scene);
    return scene;
};

const scene = createScene(); //Call the createScene function

// Register a render loop to repeatedly render the scene
engine.runRenderLoop(function () {
    scene.render();
});

// Watch for browser/canvas resize events
window.addEventListener("resize", function () {
    engine.resize();
});

scene.debugLayer.show({
    embedMode: true,
});

socket.on('yourPlayerInfo', (socket) => {

    // get the Connection ID of the Player
    playerID = socket.id;
    thisPlayerColor = socket.color;

    // Spawn yourself Entity
    addPlayer(socket);

    // // get the Player Entity
    // thisPlayer = document.getElementById(playerID);
    // thisPlayerContrR = document.getElementById(playerID + '_contr_r');
    // thisPlayerContrL = document.getElementById(playerID + '_contr_l');
    // // give yourself movement and rotation controls
    // thisPlayer.setAttribute('camera', '');
    // thisPlayer.setAttribute('look-controls', '');
    // thisPlayer.setAttribute('wasd-controls', '');
    // thisPlayer.setAttribute('controller-handler', '');
    // thisPlayer.setAttribute('net-sync', '');

    // thisPlayerContrR.setAttribute('tracked-controls', 'controller: 0');
    // thisPlayerContrL.setAttribute('tracked-controls', 'controller: 1');


    // controller1 = renderer.xr.getController(0);
    // controller2 = renderer.xr.getController(1);
    // console.log(controller1);
    // console.log(controller2);
});


document.addEventListener('click', () => {
    socket.emit('clicked');
});

socket.on('colorChanged', (color) => {
    document.getElementById('testBox').setAttribute('color', color);
});

// get Player Information from the Server and calling Spawning function
socket.on('currentState', (players) => {
    Object.keys(players).forEach((id) => {
        let playerByID = document.getElementById(id) || addPlayer(players[id]);
        let playerContrR = document.getElementById(id + '_contr_r');
        let playerContrL = document.getElementById(id + '_contr_l');
        if (playerByID) {
            playerByID.setAttribute('position', players[id].position);
            playerByID.setAttribute('rotation', players[id].rotation);

            //playerByID.object3D.position.set(players[id].position.x, players[id].position.y, players[id].position.z);
            //playerByID.object3D.rotation.set(players[id].rotation.x, players[id].rotation.y, players[id].rotation.z);
        }
        if (playerContrR) {
            playerContrR.setAttribute('position', players[id].contr_pos_r);
            playerContrR.setAttribute('rotation', players[id].contr_rot_r);
        }
        if (playerContrL) {
            playerContrL.setAttribute('position', players[id].contr_pos_l);
            playerContrL.setAttribute('rotation', players[id].contr_rot_l);
        }
    });
});

// Spawn Player Entity with the Connection ID
function addPlayer(player) {
    const playerElem = document.createElement('a-box');
    playerElem.setAttribute('id', player.id);
    playerElem.setAttribute('position', player.position);
    playerElem.setAttribute('rotation', player.rotation);
    playerElem.setAttribute('color', player.color);
    document.querySelector('a-scene').appendChild(playerElem);

    const playerContrR = document.createElement('a-box');
    playerContrR.setAttribute('id', player.id + '_contr_r');
    playerContrR.setAttribute('position', player.contr_pos_r);
    playerContrR.setAttribute('rotation', player.contr_rot_r);
    playerContrR.setAttribute('color', player.color);
    playerContrR.setAttribute('scale', '0.3 0.3 0.3');
    document.querySelector('a-scene').appendChild(playerContrR);

    const playerContrL = document.createElement('a-box');
    playerContrL.setAttribute('id', player.id + '_contr_l');
    playerContrL.setAttribute('position', player.contr_pos_l);
    playerContrL.setAttribute('rotation', player.contr_rot_l);
    playerContrL.setAttribute('color', player.color);
    playerContrL.setAttribute('scale', '0.3 0.3 0.3');
    document.querySelector('a-scene').appendChild(playerContrL);
}

socket.on('newPlayer', (player) => {
    console.log('New player joined: ', player.id);
    addPlayer(player);
});

socket.on('playerDisconnected', (id) => {
    const el = document.getElementById(id);
    if (el) {
        el.parentNode.removeChild(el);
    }
});

// Detect player movement and rotation
/*
if (thisPlayer) {
    thisPlayer.addEventListener('componentchanged', (event) => {
        console.log('player moved');
        if (event.detail.name === 'position' || event.detail.name === 'rotation') {
            console.log('Player moved');
            socket.emit('playerMoved', {
                id: socket.id,
                position: player.getAttribute('position'),
                rotation: player.getAttribute('rotation')
            });
        }
    });
} */

setInterval(function () {
    if (thisPlayer) {
        socket.emit('update', {
            position: thisPlayer.getAttribute('position'),
            rotation: thisPlayer.getAttribute('rotation'),
            contr_pos_r: thisPlayerContrR.getAttribute('position'),
            contr_pos_l: thisPlayerContrL.getAttribute('position'),
            contr_rot_r: thisPlayerContrR.getAttribute('rotation'),
            contr_rot_l: thisPlayerContrL.getAttribute('rotation')
        });
    }
}, 20);