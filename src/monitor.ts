import { io } from 'socket.io-client';
import { /*Camera,*/ Engine, FreeCamera, /*Material,*/ /*PBRBaseMaterial,*/ PBRMaterial, Scene } from '@babylonjs/core';
import { ArcRotateCamera, MeshBuilder, GlowLayer } from '@babylonjs/core';
import { DirectionalLight, PointLight /*SSRRenderingPipeline, Constants*/ } from '@babylonjs/core';
import { Mesh, StandardMaterial, Texture, Color3, Color4, Vector3, CubeTexture /*LinesMesh*/ } from '@babylonjs/core';
import { WebXRInputSource } from '@babylonjs/core/XR';
import * as GUI from '@babylonjs/gui';

//import '@babylonjs/core/Materials/Textures/Loaders'; // Required for EnvironmentHelper
import '@babylonjs/loaders/glTF'; // Enable GLTF/GLB loader for loading controller models from WebXR Input registry

import { Inspector } from '@babylonjs/inspector';

const socket = io();

const rotationQuaternion = null;
if (rotationQuaternion) {
    //console.log('Rotation Quaternion: ', rotationQuaternion);
}
let clientID: string;
let clientStartTime = Date.now();

let playerList: { [key: string]: Player } = {};

let sceneStartInfos: SceneStartInfos;
let playerStartInfos: { [key: number]: PlayerStartInfo };

// store the textBlock GUI elements for updating the scores
const guiTextElements: { [key: string]: GUI.TextBlock } = {};
const guiRectElements: { [key: string]: GUI.Rectangle } = {};

const ghostColor = '#bdbdbd';

// Get HTML Elements
const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;

const gameMonitorInterface = document.getElementById('game-monitor-interface') as HTMLDivElement;

const toggleInterfaceBtn = document.getElementById('toggle-interface') as HTMLButtonElement;
const resetCamBtn = document.getElementById('reset-cam') as HTMLButtonElement;
// const clearServerArrayBtn = document.getElementById('clear-server-array') as HTMLButtonElement;
// const collectTestsBtn = document.getElementById('collect-tests') as HTMLButtonElement;
const startButtons: { [key: number]: HTMLButtonElement } = {};
const kickButtons: { [key: number]: HTMLButtonElement } = {};
const reloadButtons: { [key: number]: HTMLButtonElement } = {};
const recenterButtons: { [key: number]: HTMLButtonElement } = {};
for (let i = 1; i <= 4; i++) {
    let startbutton = document.getElementById(`start-${i}`);
    startButtons[i] = startbutton as HTMLButtonElement;

    let kickbutton = document.getElementById(`kick-${i}`);
    kickButtons[i] = kickbutton as HTMLButtonElement;

    let reloadButton = document.getElementById(`reload-${i}`);
    reloadButtons[i] = reloadButton as HTMLButtonElement;

    let recenterButton = document.getElementById(`recenter-${i}`);
    recenterButtons[i] = recenterButton as HTMLButtonElement;
}

const clientsList = document.getElementById('clients-list');

const clientWrapper = document.getElementById('clients-wrapper') as HTMLDivElement;
const clientHeader = document.getElementById('clients-header') as HTMLDivElement;

// Test Variables
let serverUpdateCounter = 0;

////////////////////////////// CREATE BABYLON SCENE ETC. //////////////////////////////

// Basic Setup ---------------------------------------------------------------------------------
const engine = new Engine(canvas, true);
const scene = new Scene(engine);

var camera = new ArcRotateCamera('Camera', (Math.PI / 4) * 3, 0, 7, new Vector3(0, 0, 0), scene);
camera.attachControl(true);

scene.activeCamera = camera;

function createBasicScene(sceneStartInfos: SceneStartInfos, playerStartInfos: { [key: number]: PlayerStartInfo }) {

    const playCubeSize = sceneStartInfos.playCubeSize;
    const playCubeElevation = sceneStartInfos.playCubeElevation;
    const playerAreaDepth = sceneStartInfos.playerAreaDepth;
    const ballSize = sceneStartInfos.ballSize;
    const ballStartPos = sceneStartInfos.ballStartPos;
    const ballColor = sceneStartInfos.ballColor;
    const calculatedCubeHeight = sceneStartInfos.calculatedCubeHeight;
    const midPointOfPlayCube = sceneStartInfos.midPointOfPlayCube;
    // let playerPaddleSize = sceneStartInfos.playerPaddleSize;

    // Camera --------------------------------------------------------------------------------------
    // Add a camera for the non-VR view in browser
    // var camera = new ArcRotateCamera('Camera', -(Math.PI / 4) * 3, Math.PI / 4, 6, new Vector3(0, 0, 0), scene);
    // camera.attachControl(true); //debug



    // Lights --------------------------------------------------------------------------------------
    // Creates a light, aiming 0,1,0 - to the sky
    // var hemiLight = new HemisphericLight('hemiLight', new Vector3(0, 1, 0), scene);
    // hemiLight.intensity = 0.1;

    var dirLight = new DirectionalLight("DirectionalLight", new Vector3(-0.7, -0.5, 0.4), scene);
    dirLight.position = new Vector3(9, 11, -17);
    dirLight.intensity = 0.2;
    dirLight.shadowMaxZ = 130;
    dirLight.shadowMinZ = 10;

    const ballLight = new PointLight('ballLight', new Vector3(ballStartPos.x, ballStartPos.y, ballStartPos.z), scene);
    ballLight.diffuse = Color3.FromHexString('#1f53ff');
    ballLight.intensity = 2;
    ballLight.radius = ballSize;

    var hdrTexture = new CubeTexture('./assets/abstract_blue.env', scene);
    var skyBoxMesh = scene.createDefaultSkybox(hdrTexture, true, 1000, 0.5);
    if (skyBoxMesh) {
        skyBoxMesh.name = 'skyBoxMesh';
        skyBoxMesh.isVisible = false;
    }

    // Meshes --------------------------------------------------------------------------------------

    let edgeWidth = 0.3;
    let planeEdgeWidth = 0.5;

    var ballSphere = MeshBuilder.CreateSphere('ballSphere', { diameter: 2, segments: 32 }, scene);
    ballSphere.position = new Vector3(ballStartPos.x, ballStartPos.y, ballStartPos.z);
    ballSphere.scaling = new Vector3(ballSize, ballSize, ballSize);

    // Built-in 'ground' shape.
    var ground = MeshBuilder.CreateGround('ground', { width: 60, height: 60 }, scene);

    var playBox = MeshBuilder.CreateBox('playBox', { size: 1 }, scene);
    playBox.position = new Vector3(0, midPointOfPlayCube, 0);
    playBox.scaling = new Vector3(playCubeSize.x, calculatedCubeHeight, playCubeSize.z);
    playBox.enableEdgesRendering();
    playBox.edgesWidth = edgeWidth;
    playBox.edgesColor = new Color4(1, 1, 1, 1);
    // playBox.isVisible = false;

    // make another smaller ground as a recenter ground
    // only show for debugging to check if it is aligned correctly
    var recenterGround = MeshBuilder.CreateGround('recenterGround', { width: 1, height: 1 }, scene);
    recenterGround.position = new Vector3(playerStartInfos[0].position.x, playerStartInfos[0].position.y, playerStartInfos[0].position.z);
    recenterGround.rotation = new Vector3(playerStartInfos[0].rotation.x, playerStartInfos[0].rotation.y, playerStartInfos[0].rotation.z);
    recenterGround.scaling = new Vector3(1, 1, 1);
    recenterGround.enableEdgesRendering();
    recenterGround.edgesWidth = edgeWidth;
    recenterGround.edgesColor = Color4.FromHexString(playerStartInfos[0].color);
    recenterGround.isVisible = true; // show the ground for debugging and testing on the monitor html

    // Grounds for the Player Start Positions
    var player1Ground = MeshBuilder.CreateBox('player1Ground', { size: 1 }, scene);
    player1Ground.position = new Vector3(playerStartInfos[1].position.x, -25, 0);
    player1Ground.scaling = new Vector3(playerAreaDepth, 50, playCubeSize.z);
    player1Ground.enableEdgesRendering();
    player1Ground.edgesWidth = edgeWidth;
    player1Ground.edgesColor = Color4.FromHexString(playerStartInfos[1].color);

    var player2Ground = MeshBuilder.CreateBox('player2Ground', { size: 1 }, scene);
    player2Ground.position = new Vector3(playerStartInfos[2].position.x, -25, 0);
    player2Ground.scaling = new Vector3(playerAreaDepth, 50, playCubeSize.z);
    player2Ground.enableEdgesRendering();
    player2Ground.edgesWidth = edgeWidth;
    player2Ground.edgesColor = Color4.FromHexString(playerStartInfos[2].color);

    var player3Ground = MeshBuilder.CreateBox('player3Ground', { size: 1 }, scene);
    player3Ground.position = new Vector3(0, -25, playerStartInfos[3].position.z);
    player3Ground.scaling = new Vector3(playCubeSize.x, 50, playerAreaDepth);
    player3Ground.enableEdgesRendering();
    player3Ground.edgesWidth = edgeWidth;
    player3Ground.edgesColor = Color4.FromHexString(playerStartInfos[3].color);

    var player4Ground = MeshBuilder.CreateBox('player4Ground', { size: 1 }, scene);
    player4Ground.position = new Vector3(0, -25, playerStartInfos[4].position.z);
    player4Ground.scaling = new Vector3(playCubeSize.x, 50, playerAreaDepth);
    player4Ground.enableEdgesRendering();
    player4Ground.edgesWidth = edgeWidth;
    player4Ground.edgesColor = Color4.FromHexString(playerStartInfos[4].color);

    player1Ground.isVisible = player2Ground.isVisible = player3Ground.isVisible = player4Ground.isVisible = false;

    var player1GroundPlane = MeshBuilder.CreateBox('player1GroundPlane', { size: 1 }, scene);
    player1GroundPlane.position = new Vector3(playerStartInfos[1].position.x, 0, 0);
    player1GroundPlane.scaling = new Vector3(playerAreaDepth, 0.001, playCubeSize.z);
    //player1GroundPlane.scaling = new Vector3(playerAreaDepth, playCubeSize.z, 1);
    //player1GroundPlane.rotation = new Vector3(-Math.PI / 2, 0, playerStartInfos[1].rotation.z);
    player1GroundPlane.enableEdgesRendering();
    player1GroundPlane.edgesWidth = planeEdgeWidth;
    player1GroundPlane.edgesColor = Color4.FromHexString(playerStartInfos[1].color);

    var player2GroundPlane = MeshBuilder.CreateBox('player2GroundPlane', { size: 1 }, scene);
    player2GroundPlane.position = new Vector3(playerStartInfos[2].position.x, 0, 0);
    player2GroundPlane.scaling = new Vector3(playerAreaDepth, 0.001, playCubeSize.z);
    //player2GroundPlane.scaling = new Vector3(playerAreaDepth, playCubeSize.z, 1);
    //player2GroundPlane.rotation = new Vector3(-Math.PI / 2, 0, playerStartInfos[2].rotation.z);
    player2GroundPlane.enableEdgesRendering();
    player2GroundPlane.edgesWidth = planeEdgeWidth;
    player2GroundPlane.edgesColor = Color4.FromHexString(playerStartInfos[2].color);

    var player3GroundPlane = MeshBuilder.CreateBox('player3GroundPlane', { size: 1 }, scene);
    player3GroundPlane.position = new Vector3(0, 0, playerStartInfos[3].position.z);
    player3GroundPlane.scaling = new Vector3(playCubeSize.x, 0.001, playerAreaDepth);
    //player3GroundPlane.scaling = new Vector3(playCubeSize.x, playerAreaDepth, 1);
    //player3GroundPlane.rotation = new Vector3(-Math.PI / 2, 0, playerStartInfos[3].rotation.x);
    player3GroundPlane.enableEdgesRendering();
    player3GroundPlane.edgesWidth = planeEdgeWidth;
    player3GroundPlane.edgesColor = Color4.FromHexString(playerStartInfos[3].color);

    var player4GroundPlane = MeshBuilder.CreateBox('player4GroundPlane', { size: 1 }, scene);
    player4GroundPlane.position = new Vector3(0, 0, playerStartInfos[4].position.z);
    player4GroundPlane.scaling = new Vector3(playCubeSize.x, 0.001, playerAreaDepth);
    //player4GroundPlane.scaling = new Vector3(playCubeSize.x, playerAreaDepth, 1);
    //player4GroundPlane.rotation = new Vector3(-Math.PI / 2, 0, playerStartInfos[4].rotation.x);
    player4GroundPlane.enableEdgesRendering();
    player4GroundPlane.edgesWidth = planeEdgeWidth;
    player4GroundPlane.edgesColor = Color4.FromHexString(playerStartInfos[4].color);

    var player1Wall = MeshBuilder.CreateBox('player1Wall', { size: 1 }, scene);
    player1Wall.position = new Vector3(playCubeSize.x / 2 + 0, midPointOfPlayCube, 0);
    player1Wall.scaling = new Vector3(0.01, calculatedCubeHeight, playCubeSize.z);

    var player2Wall = MeshBuilder.CreateBox('player2Wall', { size: 1 }, scene);
    player2Wall.position = new Vector3(-playCubeSize.x / 2 - 0, midPointOfPlayCube, 0);
    player2Wall.scaling = new Vector3(0.01, calculatedCubeHeight, playCubeSize.z);

    var player3Wall = MeshBuilder.CreateBox('player3Wall', { size: 1 }, scene);
    player3Wall.position = new Vector3(0, midPointOfPlayCube, playCubeSize.z / 2 + 0);
    player3Wall.scaling = new Vector3(playCubeSize.x, calculatedCubeHeight, 0.01);

    var player4Wall = MeshBuilder.CreateBox('player4Wall', { size: 1 }, scene);
    player4Wall.position = new Vector3(0, midPointOfPlayCube, -playCubeSize.z / 2 - 0);
    player4Wall.scaling = new Vector3(playCubeSize.x, calculatedCubeHeight, 0.01);

    // create walls for the top and the bottom of the playcube
    var topWall = MeshBuilder.CreateBox('player5Wall', { size: 1 }, scene);
    topWall.position = new Vector3(0, playCubeSize.y, 0);
    topWall.scaling = new Vector3(playCubeSize.x, 0.01, playCubeSize.z);

    var bottomWall = MeshBuilder.CreateBox('player6Wall', { size: 1 }, scene);
    bottomWall.position = new Vector3(0, playCubeElevation, 0);
    bottomWall.scaling = new Vector3(playCubeSize.x, 0.01, playCubeSize.z);

    let HUDMesh = MeshBuilder.CreatePlane(`client_HUD`, { size: 1 }, scene);
    HUDMesh.position = new Vector3(0, 2.5, 0);
    HUDMesh.rotation = new Vector3(0, 0, 0);
    HUDMesh.scaling = new Vector3(playCubeSize.x, calculatedCubeHeight, 1);
    HUDMesh.isVisible = false;

    // GUI --------------------------------------------------------------------------------------

    var playerHUDTex = GUI.AdvancedDynamicTexture.CreateForMesh(HUDMesh);
    // Player Score
    var HUDRect = new GUI.Rectangle();
    HUDRect.width = "95%";
    HUDRect.height = "95%";
    HUDRect.thickness = 5;
    HUDRect.color = "red";
    HUDRect.alpha = 1;
    HUDRect.zIndex = 1;
    //HUDRect.isVisible = false;
    playerHUDTex.addControl(HUDRect);

    var HUDLabel = new GUI.TextBlock();
    HUDLabel.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
    HUDLabel.fontFamily = "loadedFont";
    HUDLabel.text = "";
    HUDLabel.color = "red";
    HUDLabel.fontSize = 50;
    HUDRect.addControl(HUDLabel);
    // add to guiTextElements
    guiRectElements[`client_HUDRect`] = HUDRect;
    guiTextElements[`client_HUDLabel`] = HUDLabel;

    // Materials --------------------------------------------------------------------------------------

    var wireframeTexture = new Texture('./assets/figma_grid_wireframe_white.png', scene);
    wireframeTexture.uScale = 1;
    wireframeTexture.vScale = 1;
    wireframeTexture.hasAlpha = true;
    // const simpleGridTexture = new Texture('./assets/figma_grid_wireframe_blue.png', scene);

    var wireframeMat = new StandardMaterial('wireframeMat', scene);
    wireframeMat.roughness = 1;
    wireframeMat.diffuseTexture = wireframeTexture;
    wireframeMat.diffuseTexture.hasAlpha = true;
    wireframeMat.emissiveTexture = wireframeTexture;
    wireframeMat.emissiveTexture.hasAlpha = true;
    wireframeMat.useAlphaFromDiffuseTexture = true;
    wireframeMat.backFaceCulling = false;
    wireframeMat.emissiveColor = Color3.Red();
    wireframeMat.diffuseColor = Color3.FromHexString('#ffffff');
    wireframeMat.alpha = 0.5;

    var playBoxMat = new StandardMaterial('playBoxMat', scene);
    playBoxMat.diffuseColor = Color3.FromHexString('#ffffff');
    playBoxMat.alpha = 0;
    playBoxMat.specularColor = new Color3(0, 0, 0);

    var ballMaterial = new PBRMaterial('ballMaterial', scene);
    ballMaterial.emissiveColor = Color3.FromHexString(ballColor);
    ballMaterial.metallic = 0.0;
    ballMaterial.emissiveIntensity = 10;

    var playerStartMat = new PBRMaterial('playerStartMat', scene);
    playerStartMat.albedoColor = Color3.FromHexString('#141414');
    playerStartMat.metallic = 1.0;
    playerStartMat.roughness = 0.0;

    var playerStartMatPlane = new PBRMaterial('playerStartMatPlane', scene);
    playerStartMat.albedoColor = Color3.FromHexString('#141414');
    playerStartMatPlane.alpha = 0.4;
    playerStartMatPlane.backFaceCulling = true;

    var playerWallMat = new PBRMaterial('playerWallMat', scene);
    playerWallMat.albedoColor = Color3.FromHexString('#000000');
    playerWallMat.alpha = 0.3;
    playerWallMat.metallic = 0;
    playerWallMat.roughness = 0.5;
    playerWallMat.backFaceCulling = false;

    var wallBounceMat = new PBRMaterial('wallBounceMat', scene);
    wallBounceMat.albedoColor = Color3.FromHexString('#575757');
    //wallBounceMat.emissiveColor = Color3.FromHexString('#ffffff');
    wallBounceMat.alpha = 0.3;
    wallBounceMat.metallic = 0;
    wallBounceMat.roughness = 0.5;
    wallBounceMat.backFaceCulling = false;

    // creating the player 0 Material if the player has no position yet
    var player0Mat = new PBRMaterial(`player0_mat`, scene);
    player0Mat.emissiveColor = Color3.FromHexString(ghostColor);
    player0Mat.alpha = 0.2;
    player0Mat.disableLighting = true;
    player0Mat.backFaceCulling = false;

    // creating the Materials for the players
    var player1Mat = new PBRMaterial(`player1_mat`, scene);
    player1Mat.emissiveColor = Color3.FromHexString(playerStartInfos[1].color);
    player1Mat.alpha = 0.2;
    player1Mat.disableLighting = true;
    player1Mat.backFaceCulling = false;
    var player1PaddleMat = new PBRMaterial(`player1_paddle_mat`, scene);
    player1PaddleMat.emissiveColor = Color3.FromHexString(playerStartInfos[1].color);
    player1PaddleMat.alpha = 0.2;
    player1PaddleMat.disableLighting = true;
    player1PaddleMat.backFaceCulling = false;

    var player2Mat = new PBRMaterial(`player2_mat`, scene);
    player2Mat.emissiveColor = Color3.FromHexString(playerStartInfos[2].color);
    player2Mat.alpha = 0.2;
    player2Mat.disableLighting = true;
    player2Mat.backFaceCulling = false;
    var player2PaddleMat = new PBRMaterial(`player2_paddle_mat`, scene);
    player2PaddleMat.emissiveColor = Color3.FromHexString(playerStartInfos[2].color);
    player2PaddleMat.alpha = 0.2;
    player2PaddleMat.disableLighting = true;
    player2PaddleMat.backFaceCulling = false;

    var player3Mat = new PBRMaterial(`player3_mat`, scene);
    player3Mat.emissiveColor = Color3.FromHexString(playerStartInfos[3].color);
    player3Mat.alpha = 0.2;
    player3Mat.disableLighting = true;
    player3Mat.backFaceCulling = false;
    var player3PaddleMat = new PBRMaterial(`player3_paddle_mat`, scene);
    player3PaddleMat.emissiveColor = Color3.FromHexString(playerStartInfos[3].color);
    player3PaddleMat.alpha = 0.2;
    player3PaddleMat.disableLighting = true;
    player3PaddleMat.backFaceCulling = false;

    var player4Mat = new PBRMaterial(`player4_mat`, scene);
    player4Mat.emissiveColor = Color3.FromHexString(playerStartInfos[4].color);
    player4Mat.alpha = 0.2;
    player4Mat.disableLighting = true;
    player4Mat.backFaceCulling = false;
    var player4PaddleMat = new PBRMaterial(`player4_paddle_mat`, scene);
    player4PaddleMat.emissiveColor = Color3.FromHexString(playerStartInfos[4].color);
    player4PaddleMat.alpha = 0.2;
    player4PaddleMat.disableLighting = true;
    player4PaddleMat.backFaceCulling = false;

    // Setting Materials
    ground.material = wireframeMat;
    ballSphere.material = ballMaterial;

    playBox.material = playBoxMat;

    for (let i = 1; i <= 4; i++) {
        let playerGround = scene.getMeshByName(`player${i}Ground`) as Mesh;
        let playerGroundPlane = scene.getMeshByName(`player${i}GroundPlane`) as Mesh;
        let playerWall = scene.getMeshByName(`player${i}Wall`) as Mesh;
        if (playerGround) {
            playerGround.material = playerStartMat;
            // playerGround.material = wireframeMat;
        }
        if (playerGroundPlane) {
            playerGroundPlane.material = playerStartMatPlane;
            // playerGroundPlane.material = wireframeMat;
        }
        if (playerWall) {
            playerWall.material = playerWallMat;
            // playerWall.material = wireframeMat;
        }
    }

    recenterGround.material = playerStartMat;

    topWall.material = playerWallMat;
    bottomWall.material = playerWallMat;

    ground.isVisible = false;

    // Processing --------------------------------------------------------------------------------------

    // add a Glowlayer to let emissive materials glow
    var gl = new GlowLayer("glow", scene, {
        mainTextureFixedSize: 1024,
        blurKernelSize: 64,
    });
    gl.intensity = 0.5;
}

////////////////////////////// END CREATE BABYLON SCENE ETC. //////////////////////////////

interface PlayerStartInfo {
    playerNumber: number;
    position: { x: number, y: number, z: number };
    rotation: { x: number, y: number, z: number };
    color: string;
    used: boolean;
}

interface SceneStartInfos {
    playCubeSize: { x: number, y: number, z: number };
    playCubeElevation: number;
    playerAreaDepth: number;
    playerPaddleSize: { w: number, h: number };
    ballSize: number;
    ballStartPos: { x: number, y: number, z: number };
    ballColor: string;
    calculatedCubeHeight: number;
    midPointOfPlayCube: number;
}

interface PlayerGameData {
    id: string;
    position: { x: number, y: number, z: number };
    rotation: { x: number, y: number, z: number };
    contrPosR: { x: number, y: number, z: number };
    contrPosL: { x: number, y: number, z: number };
    contrRotR: { x: number, y: number, z: number };
    contrRotL: { x: number, y: number, z: number };
}

interface PlayerData {
    id: string;
    color: string;
    playerNumber: number;
    score: number;
    isPlaying: boolean;
    inPosition: number;
    position: { x: number, y: number, z: number };
    rotation: { x: number, y: number, z: number };
    contrPosR: { x: number, y: number, z: number };
    contrPosL: { x: number, y: number, z: number };
    contrRotR: { x: number, y: number, z: number };
    contrRotL: { x: number, y: number, z: number };
}

class Player implements PlayerData {
    id: string;
    color: string;
    playerNumber: number;
    score: number;
    isPlaying: boolean;
    inPosition: number;
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
    scoreMesh?: Mesh | null;
    paddleLight?: PointLight | null;
    idMesh?: Mesh | null;

    constructor(player: PlayerData, headObj?: Mesh, controllerR?: Mesh, controllerL?: Mesh, paddle?: Mesh, scoreMesh?: Mesh, paddleLight?: PointLight, idMesh?: Mesh) {
        this.id = player.id;
        this.color = player.color;
        this.playerNumber = player.playerNumber;
        this.score = player.score;
        this.isPlaying = player.isPlaying;
        this.inPosition = player.inPosition;
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
        this.scoreMesh = scoreMesh || null;
        this.paddleLight = paddleLight || null;
        this.idMesh = idMesh || null;
    }

    setData(playerGameData: PlayerGameData) {
        this.position = { x: playerGameData.position.x, y: playerGameData.position.y, z: playerGameData.position.z };
        this.rotation = { x: playerGameData.rotation.x, y: playerGameData.rotation.y, z: playerGameData.rotation.z };
        this.contrPosR = { x: playerGameData.contrPosR.x, y: playerGameData.contrPosR.y, z: playerGameData.contrPosR.z };
        this.contrPosL = { x: playerGameData.contrPosL.x, y: playerGameData.contrPosL.y, z: playerGameData.contrPosL.z };
        this.contrRotR = { x: playerGameData.contrRotR.x, y: playerGameData.contrRotR.y, z: playerGameData.contrRotR.z };
        this.contrRotL = { x: playerGameData.contrRotL.x, y: playerGameData.contrRotL.y, z: playerGameData.contrRotL.z };
    }

    updateObj() {
        if (this.headObj) {
            this.headObj.position = new Vector3(this.position.x, this.position.y, this.position.z);
            this.headObj.rotation = new Vector3(this.rotation.x, this.rotation.y, this.rotation.z);

            if (this.idMesh) {
                this.idMesh.position = new Vector3(this.position.x, this.position.y + 0.5, this.position.z);
                // this.idMesh.rotation = new Vector3(this.rotation.x, this.rotation.y, this.rotation.z);
            }
        }
        if (this.controllerR) {
            this.controllerR.position = new Vector3(this.contrPosR.x, this.contrPosR.y, this.contrPosR.z);
            this.controllerR.rotation = new Vector3(this.contrRotR.x, this.contrRotR.y, this.contrRotR.z);
        }
        if (this.controllerL) {
            this.controllerL.position = new Vector3(this.contrPosL.x, this.contrPosL.y, this.contrPosL.z);
            this.controllerL.rotation = new Vector3(this.contrRotL.x, this.contrRotL.y, this.contrRotL.z);
        }
        //}
        // if (this.HUDMesh) {
        //     this.HUDMesh.position = new Vector3(this.position.x, this.position.y, this.position.z - 0.5);
        //     this.HUDMesh.rotation = new Vector3(this.rotation.x, this.rotation.y, this.rotation.z);
        // }
        // clamp the paddle position to the play area
        if (this.paddle) {
            if (this.playerNumber == 1 || this.inPosition == 1) {
                let paddleY, paddleZ;
                if (this.contrPosR.y + sceneStartInfos.playerPaddleSize.h / 2 > sceneStartInfos.playCubeSize.y) {
                    paddleY = sceneStartInfos.playCubeSize.y - sceneStartInfos.playerPaddleSize.h / 2;
                } else if (this.contrPosR.y - sceneStartInfos.playerPaddleSize.h / 2 < sceneStartInfos.playCubeElevation) {
                    paddleY = sceneStartInfos.playCubeElevation + sceneStartInfos.playerPaddleSize.h / 2;
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
                if (this.scoreMesh /*&& playerUsingXR*/) {
                    this.scoreMesh.position = this.paddle.position;
                }
                if (this.paddleLight) {
                    this.paddleLight.position = this.paddle.position;
                }
            } else if (this.playerNumber == 2 || this.inPosition == 2) {
                let paddleY, paddleZ;
                if (this.contrPosR.y + sceneStartInfos.playerPaddleSize.h / 2 > sceneStartInfos.playCubeSize.y) {
                    paddleY = sceneStartInfos.playCubeSize.y - sceneStartInfos.playerPaddleSize.h / 2;
                } else if (this.contrPosR.y - sceneStartInfos.playerPaddleSize.h / 2 < sceneStartInfos.playCubeElevation) {
                    paddleY = sceneStartInfos.playCubeElevation + sceneStartInfos.playerPaddleSize.h / 2;
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
                if (this.scoreMesh /*&& playerUsingXR*/) {
                    this.scoreMesh.position = this.paddle.position;
                }
                if (this.paddleLight) {
                    this.paddleLight.position = this.paddle.position;
                }
            } else if (this.playerNumber == 3 || this.inPosition == 3) {
                let paddleY, paddleX;
                if (this.contrPosR.y + sceneStartInfos.playerPaddleSize.h / 2 > sceneStartInfos.playCubeSize.y) {
                    paddleY = sceneStartInfos.playCubeSize.y - sceneStartInfos.playerPaddleSize.h / 2;
                } else if (this.contrPosR.y - sceneStartInfos.playerPaddleSize.h / 2 < sceneStartInfos.playCubeElevation) {
                    paddleY = sceneStartInfos.playCubeElevation + sceneStartInfos.playerPaddleSize.h / 2;
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
                if (this.scoreMesh /*&& playerUsingXR*/) {
                    this.scoreMesh.position = this.paddle.position;
                }
                if (this.paddleLight) {
                    this.paddleLight.position = this.paddle.position;
                }
            } else if (this.playerNumber == 4 || this.inPosition == 4) {
                let paddleY, paddleX;
                if (this.contrPosR.y + sceneStartInfos.playerPaddleSize.h / 2 > sceneStartInfos.playCubeSize.y) {
                    paddleY = sceneStartInfos.playCubeSize.y - sceneStartInfos.playerPaddleSize.h / 2;
                } else if (this.contrPosR.y - sceneStartInfos.playerPaddleSize.h / 2 < sceneStartInfos.playCubeElevation) {
                    paddleY = sceneStartInfos.playCubeElevation + sceneStartInfos.playerPaddleSize.h / 2;
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
                if (this.scoreMesh /*&& playerUsingXR*/) {
                    this.scoreMesh.position = this.paddle.position;
                }
                if (this.paddleLight) {
                    this.paddleLight.position = this.paddle.position;
                }
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
                clientSendTime: Date.now()
            });
        }
    }
}

// Watch for browser/canvas resize events
window.addEventListener('resize', function () {
    engine.resize();
});

// !1
// Send the client's start time to the server upon connection
socket.on('connect', () => {
    socket.emit('clientStartTime', clientStartTime);
    console.log('This Client ID: ', socket.id);
    if (socket.id) {
        clientID = socket.id;
    }
});

// !2
// socket.on('ClientID', (id) => {
//     console.log('This Client ID: ', id);
//     clientID = id;
// });

// !3
socket.on('forceReload', () => {
    console.log('Server requested reload');
    window.location.reload();
});

// !5
// get all current Player Information from the Server at the start
// and spawning all current players except yourself
socket.on('currentState', (players: { [key: string]: Player }, ballColor: string,
    playerStartInfosServer: { [key: number]: PlayerStartInfo }, sceneStartInfosServer: SceneStartInfos) => {

    sceneStartInfos = sceneStartInfosServer;
    playerStartInfos = playerStartInfosServer;

    // color the borders of the player divs
    setPlayerCSSColors(playerStartInfos);

    // Basic Stuff from the srever for the website and the scene
    // create the Basic babylonjs scene with the infos from the server
    createBasicScene(sceneStartInfos, playerStartInfos);

    let ballMaterial = scene.getMaterialByName('ballMaterial') as PBRMaterial;
    ballMaterial.emissiveColor = Color3.FromHexString(ballColor);

    Object.keys(players).forEach((id) => {

        // Add new player to the playerList
        playerList[id] = new Player(players[id]);

        // Spawn new player Entity
        addPlayer(playerList[id], false);
        addPlayerGameUtils(playerList[id], false);
        if (playerList[id].isPlaying) {
            showPlayerGameUtils(playerList[id].id);
            //addPlayerGameUtils(playerList[id], false);
        }
    });

    // requesting all connected client ids from the server
    socket.emit('requestAllClients', true);
});

// when the current player is already on the server and a new player joins
socket.on('newPlayer', (newPlayer) => {
    // console log about new player joined
    console.log('New player joined: ', newPlayer.id);

    // Add new player to the playerList
    playerList[newPlayer.id] = new Player(newPlayer);

    // Spawn new player Entity
    addPlayer(playerList[newPlayer.id], false);
    addPlayerGameUtils(playerList[newPlayer.id], false);
});

// !8
// when the client is on the server and a new player starts playing
// can be the client itself (if in ar)
socket.on('playerStartPlaying', (newPlayerId, startPlayingNumber) => {
    console.log('Player started playing: ', newPlayerId, ' as ', startPlayingNumber);

    playerList[newPlayerId].isPlaying = true;
    playerList[newPlayerId].playerNumber = startPlayingNumber;

    // set the material of the player to a player material
    changePlayerColor(newPlayerId);
    showPlayerGameUtils(playerList[newPlayerId].id);

    updatePlayerScore(newPlayerId, playerList[newPlayerId].score);
});

// update the players position and rotation from the server
socket.on('serverUpdate', (playerGameDataList, ballPosition, serverSendTime, serverUpdateCounterServer) => {
    Object.keys(playerGameDataList).forEach((id) => {
        if (playerList[id]) {
            // set the new data from the server to the player
            playerList[id].setData(playerGameDataList[id]);
            // update the player object in the scene
            // playerList[id].updateObj();
        }
    });
    // console.log('Server Update Counter: ', serverUpdateCounter);

    serverUpdateCounter = serverUpdateCounterServer;

    updateBall(ballPosition);

    // send the pong back to the server to calculate the ServerRoundTrip Time
    socket.emit('ServerPong', serverSendTime, socket.id, serverUpdateCounter);
});

// recieve a score update from the server
socket.on('scoreUpdate', (scoredPlayerID, newScore) => {
    if (playerList[scoredPlayerID]) {
        playerList[scoredPlayerID].score = newScore;

        updatePlayerScore(scoredPlayerID, newScore);
    }
});

socket.on('inPosChange', (playerId, newInPos) => {
    console.log(`${playerId}: InPos change from ${playerList[playerId].inPosition} to ${newInPos}`);
    if (playerList[playerId]) {
        playerList[playerId].inPosition = newInPos;
    }

    if (newInPos != 0) {
        (playerList[playerId].paddle as Mesh).rotation = new Vector3(playerStartInfos[playerList[playerId].inPosition].rotation.x, playerStartInfos[playerList[playerId].inPosition].rotation.y, playerStartInfos[playerList[playerId].inPosition].rotation.z);
        if (playerList[playerId].inPosition == 1) {
            (playerList[playerId].paddle as Mesh).position = new Vector3(sceneStartInfos.playCubeSize.x / 2, playerList[playerId].contrPosR.y, playerList[playerId].contrPosR.z);
        } else if (playerList[playerId].inPosition == 2) {
            (playerList[playerId].paddle as Mesh).position = new Vector3(-sceneStartInfos.playCubeSize.x / 2, playerList[playerId].contrPosR.y, playerList[playerId].contrPosR.z);
        } else if (playerList[playerId].inPosition == 3) {
            (playerList[playerId].paddle as Mesh).position = new Vector3(playerList[playerId].contrPosR.x, playerList[playerId].contrPosR.y, sceneStartInfos.playCubeSize.z / 2);
        } else if (playerList[playerId].inPosition == 4) {
            (playerList[playerId].paddle as Mesh).position = new Vector3(playerList[playerId].contrPosR.x, playerList[playerId].contrPosR.y, -sceneStartInfos.playCubeSize.z / 2);
        }
    }
});

socket.on('isLeaderboard', (id) => {
    console.log(`Setting Leaderboard Client with ID: ${id}`);

    let leaderboardClient = document.getElementById(id);
    if (leaderboardClient) {
        leaderboardClient.classList.add('leaderboard');
    } else {
        console.log(`Leaderboard Client with ID ${id} not found.`);
    }
});

function changePlayerColor(playerId: string) {
    (playerList[playerId].headObj as Mesh).material = scene.getMaterialByName(`player${playerList[playerId].playerNumber}_mat`) as PBRMaterial;
    (playerList[playerId].controllerL as Mesh).material = scene.getMaterialByName(`player${playerList[playerId].playerNumber}_mat`) as PBRMaterial;
    (playerList[playerId].controllerR as Mesh).material = scene.getMaterialByName(`player${playerList[playerId].playerNumber}_mat`) as PBRMaterial;
}

function updateBall(ballPosition: { x: number, y: number, z: number }) {
    let ballSphere = scene.getMeshByName('ballSphere') as Mesh;
    ballSphere.position = new Vector3(ballPosition.x, ballPosition.y, ballPosition.z);

    let ballLight = scene.getLightByName('ballLight') as PointLight;
    ballLight.position = new Vector3(ballPosition.x, ballPosition.y, ballPosition.z);
}

// update the score gui element for the specific player
function updatePlayerScore(scoredPlayerID: string, newScore: number) {
    // if (guiTextElements[`score${playerList[scoredPlayerID].playerNumber}Label`]) {
    //     guiTextElements[`score${playerList[scoredPlayerID].playerNumber}Label`].text = newScore.toString();
    // }
    if (guiTextElements[`player_${scoredPlayerID}_scoreLabel`]) {
        guiTextElements[`player_${scoredPlayerID}_scoreLabel`].text = newScore.toString();
    }
}

// Spawn Player Entity with the Connection ID
function addPlayer(player: Player, isPlayer: boolean) {
    console.log(`Spawning Player: ${player.id} as Player ${player.inPosition}`);

    let headScaling = 0.3;
    let controllerScaling = 0.1;

    // add the players head
    player.headObj = MeshBuilder.CreateBox(`player_${player.id}_head`, { size: 1 }, scene);
    player.headObj.scaling = new Vector3(headScaling, headScaling, headScaling);
    player.headObj.position = new Vector3(player.position.x, player.position.y, player.position.z);
    player.headObj.rotation = new Vector3(player.rotation.x, player.rotation.y, player.rotation.z);
    player.headObj.material = scene.getMaterialByName(`player${player.playerNumber}_mat`) as PBRMaterial;

    // dont show the players head, if it is the player itself
    if (isPlayer) {
        player.headObj.isVisible = false;
    }

    // add the players right and left controller
    player.controllerR = MeshBuilder.CreateBox(`player_${player.id}_contrR`, { size: 1 });
    player.controllerR.scaling = new Vector3(controllerScaling, controllerScaling, controllerScaling);
    player.controllerR.position = new Vector3(player.contrPosR.x, player.contrPosR.y, player.contrPosR.z);
    player.controllerR.rotation = new Vector3(player.contrRotR.x, player.contrRotR.y, player.contrRotR.z);
    player.controllerR.material = player.headObj.material;

    player.controllerL = MeshBuilder.CreateBox(`player_${player.id}_contrL`, { size: 1 });
    player.controllerL.scaling = new Vector3(controllerScaling, controllerScaling, controllerScaling);
    player.controllerL.position = new Vector3(player.contrPosL.x, player.contrPosL.y, player.contrPosL.z);
    player.controllerL.rotation = new Vector3(player.contrRotL.x, player.contrRotL.y, player.contrRotL.z);
    player.controllerL.material = player.headObj.material;

    player.idMesh = MeshBuilder.CreatePlane(`player_${player.id}_idMesh`, { size: 1 }, scene);
    player.idMesh.position = new Vector3(player.position.x, player.position.y + 0.5, player.position.z);
    //player.idMesh.rotation = new Vector3(0, 0, 0);

    player.idMesh.billboardMode = Mesh.BILLBOARDMODE_ALL;

    var playerIdTex = GUI.AdvancedDynamicTexture.CreateForMesh(player.idMesh);
    // Player Score
    var idRect = new GUI.Rectangle();
    idRect.thickness = 0;
    playerIdTex.addControl(idRect);
    var idLabel = new GUI.TextBlock();
    //idLabel.fontFamily = "loadedFont";
    idLabel.text = player.id;
    idLabel.color = ghostColor;
    //idLabel.color = playerStartInfos[player.playerNumber].color;
    idLabel.fontSize = 80;
    idRect.addControl(idLabel);
    // add to guiTextElements
    guiTextElements[`player_${player.id}_idLabel`] = idLabel;

    // player.headObj.isVisible = false;
    // player.controllerL.isVisible = false;
    // player.controllerR.isVisible = false;

    playerList[player.id].headObj = player.headObj;
    playerList[player.id].controllerR = player.controllerR;
    playerList[player.id].controllerL = player.controllerL;
    playerList[player.id].idMesh = player.idMesh;
}

// spawn the stuff for playing for the player
function addPlayerGameUtils(player: Player, isPlayer: boolean) {
    console.log(`Spawning Player Game Utils of Player: ${player.id} as Player ${player.playerNumber}`);

    let paddleThickness = 0.01;

    // add the players paddle
    player.paddle = MeshBuilder.CreateBox(`player_${player.id}_paddle`, { size: 1 });
    player.paddle.scaling = new Vector3(sceneStartInfos.playerPaddleSize.w, sceneStartInfos.playerPaddleSize.h, paddleThickness);
    player.paddle.rotation = new Vector3(playerStartInfos[player.inPosition].rotation.x, playerStartInfos[player.inPosition].rotation.y, playerStartInfos[player.inPosition].rotation.z);
    if (player.inPosition == 1) {
        //player.paddle.scaling = new Vector3(paddleThickness, sceneStartInfos.playerPaddleSize.h, sceneStartInfos.playerPaddleSize.w);
        player.paddle.position = new Vector3(sceneStartInfos.playCubeSize.x / 2, player.contrPosR.y, player.contrPosR.z);
    } else if (player.inPosition == 2) {
        //player.paddle.scaling = new Vector3(paddleThickness, sceneStartInfos.playerPaddleSize.h, sceneStartInfos.playerPaddleSize.w);
        player.paddle.position = new Vector3(-sceneStartInfos.playCubeSize.x / 2, player.contrPosR.y, player.contrPosR.z);
    } else if (player.inPosition == 3) {
        //player.paddle.scaling = new Vector3(sceneStartInfos.playerPaddleSize.w, sceneStartInfos.playerPaddleSize.h, paddleThickness);
        player.paddle.position = new Vector3(player.contrPosR.x, player.contrPosR.y, sceneStartInfos.playCubeSize.z / 2);
    } else if (player.inPosition == 4) {
        //player.paddle.scaling = new Vector3(sceneStartInfos.playerPaddleSize.w, sceneStartInfos.playerPaddleSize.h, paddleThickness);
        player.paddle.position = new Vector3(player.contrPosR.x, player.contrPosR.y, -sceneStartInfos.playCubeSize.z / 2);
    } else if (player.inPosition == 0) {
        player.paddle.position = new Vector3(player.contrPosR.x, player.contrPosR.y, player.contrPosR.z);
    }
    // player.paddle.position = new Vector3(player.contrPosR.x, player.contrPosR.y, player.contrPosR.z);
    player.paddle.material = scene.getMaterialByName(`player0_mat`) as PBRMaterial;
    // player.paddle.material = scene.getMaterialByName(`player_${player.id}_paddle_mat`) as PBRMaterial;
    player.paddle.isVisible = false;

    // add a light to the paddle
    player.paddleLight = new PointLight(`player_${player.id}_paddelLight`, player.paddle.position, scene);
    player.paddleLight.diffuse = Color3.FromHexString(ghostColor);
    //player.paddleLight.diffuse = Color3.FromHexString(playerStartInfos[player.playerNumber].color);
    player.paddleLight.intensity = 0;

    // add the score Mesh to the player
    player.scoreMesh = MeshBuilder.CreatePlane(`player_${player.id}_scoreMesh`, { size: 1 }, scene);
    //if (playerUsingXR) {
    //player.scoreMesh.position = new Vector3(player.contrPosR.x, player.contrPosR.y, player.contrPosR.z);
    //} else {
    if (player.playerNumber == 1) {
        player.scoreMesh.position = new Vector3(sceneStartInfos.playCubeSize.x / 2, sceneStartInfos.midPointOfPlayCube, 0);
    } else if (player.playerNumber == 2) {
        player.scoreMesh.position = new Vector3(-(sceneStartInfos.playCubeSize.x / 2), sceneStartInfos.midPointOfPlayCube, 0);
    } else if (player.playerNumber == 3) {
        player.scoreMesh.position = new Vector3(0, sceneStartInfos.midPointOfPlayCube, (sceneStartInfos.playCubeSize.z / 2));
    } else if (player.playerNumber == 4) {
        player.scoreMesh.position = new Vector3(0, sceneStartInfos.midPointOfPlayCube, -(sceneStartInfos.playCubeSize.z / 2));
    } else if (player.playerNumber == 0) {
        player.scoreMesh.position = new Vector3(player.contrPosR.x, player.contrPosR.y, player.contrPosR.z);
    }
    //}
    if (!isPlayer) {
        // player.scoreMesh.billboardMode = Mesh.BILLBOARDMODE_ALL;
    } else {
        player.scoreMesh.rotation = new Vector3(0, 0, 0);
        //player.scoreMesh.rotation = new Vector3(playerStartInfos[player.playerNumber].rotation.x, playerStartInfos[player.playerNumber].rotation.y, playerStartInfos[player.playerNumber].rotation.z);
    }
    player.scoreMesh.isVisible = false;

    var playerScoreTex = GUI.AdvancedDynamicTexture.CreateForMesh(player.scoreMesh);
    // Player Score
    var scoreRect = new GUI.Rectangle();
    scoreRect.thickness = 0;
    playerScoreTex.addControl(scoreRect);
    var scoreLabel = new GUI.TextBlock();
    scoreLabel.fontFamily = "loadedFont";
    scoreLabel.text = "0";
    scoreLabel.color = ghostColor;
    //scoreLabel.color = playerStartInfos[player.playerNumber].color;
    scoreLabel.fontSize = 100;
    scoreRect.addControl(scoreLabel);
    // add to guiTextElements
    guiTextElements[`player_${player.id}_scoreLabel`] = scoreLabel;

    playerList[player.id].paddle = player.paddle;
    playerList[player.id].paddleLight = player.paddleLight;
    playerList[player.id].scoreMesh = player.scoreMesh;
}

function showPlayerGameUtils(playerId: string) {
    console.log(`Showing Player Game Utils of Player: ${playerId}`);
    if (playerList[playerId].paddle) {
        playerList[playerId].paddle.material = scene.getMaterialByName(`player${playerList[playerId].playerNumber}_paddle_mat`) as PBRMaterial;
        playerList[playerId].paddle.isVisible = true;
    }
    if (playerList[playerId].paddleLight) {
        playerList[playerId].paddleLight.diffuse = Color3.FromHexString(playerStartInfos[playerList[playerId].playerNumber].color);
        playerList[playerId].paddleLight.intensity = 1;
    }
    if (playerList[playerId].scoreMesh) {
        guiTextElements[`player_${playerId}_scoreLabel`].color = playerStartInfos[playerList[playerId].playerNumber].color;
        playerList[playerId].scoreMesh.rotation = new Vector3(playerStartInfos[playerList[playerId].playerNumber].rotation.x, playerStartInfos[playerList[playerId].playerNumber].rotation.y, playerStartInfos[playerList[playerId].playerNumber].rotation.z);
        playerList[playerId].scoreMesh.isVisible = true;
    }
}

function hidePlayerGameUtils(playerId: string) {
    console.log(`Hiding Player Game Utils of Player: ${playerId}`);
    if (playerList[playerId].paddle) {
        playerList[playerId].paddle.material = scene.getMaterialByName(`player0_mat`) as PBRMaterial;
        playerList[playerId].paddle.isVisible = false;
    }
    if (playerList[playerId].paddleLight) {
        playerList[playerId].paddleLight.diffuse = Color3.FromHexString(ghostColor);
        playerList[playerId].paddleLight.intensity = 0;
    }
    if (playerList[playerId].scoreMesh) {
        guiTextElements[`player_${playerId}_scoreLabel`].color = ghostColor;
        playerList[playerId].scoreMesh.rotation = new Vector3(0, 0, 0);
        playerList[playerId].scoreMesh.isVisible = false;
    }
}

// visual effect if the ball bounces on a paddle or wall
socket.on('ballBounce', (whichPlayer: number, isPaddle: boolean) => {

    Object.keys(playerList).forEach((id) => {
        if (playerList[id].playerNumber == whichPlayer) {
            if (isPaddle) {

                (playerList[id].paddle?.material as PBRMaterial).emissiveColor = Color3.White();
                //(playerList[id].paddle?.material as StandardMaterial).emissiveColor = darkenColor3(Color3.FromHexString(playerList[id].color), 1.5);
                setTimeout(function () {
                    (playerList[id].paddle?.material as PBRMaterial).emissiveColor = Color3.FromHexString(playerStartInfos[whichPlayer].color);
                }, 150);
            }
        }
    });

    (scene.getMeshByName(`player${whichPlayer}Wall`) as Mesh).material;

    if (!isPaddle) {
        (scene.getMeshByName(`player${whichPlayer}Wall`) as Mesh).material = scene.getMaterialByName('wallBounceMat') as StandardMaterial;
        setTimeout(function () {
            (scene.getMeshByName(`player${whichPlayer}Wall`) as Mesh).material = scene.getMaterialByName('playerWallMat') as StandardMaterial;
        }, 150);
    }
});

socket.on('playerExitGame', (playerId) => {
    const exitPlayer = playerList[playerId];
    if (exitPlayer) {
        console.log(`Player ${exitPlayer.playerNumber} left the game.`);

        let playerWall = scene.getMeshByName(`player${exitPlayer.playerNumber}Wall`) as Mesh;
        if (playerWall) {
            playerWall.isVisible = true;
        }

        let skyBoxMesh = scene.getMeshByName('skyBoxMesh') as Mesh;
        if (skyBoxMesh) {
            skyBoxMesh.isVisible = false;
        }

        for (let i = 1; i <= 4; i++) {
            let playerGround = scene.getMeshByName(`player${i}Ground`) as Mesh;
            let playerGroundPlane = scene.getMeshByName(`player${i}GroundPlane`) as Mesh;
            if (playerGround) {
                playerGround.isVisible = false;
            }
            if (playerGroundPlane) {
                playerGroundPlane.isVisible = true;
            }
        }
        // let playerScore = scene.getMeshByName(`player${exitPlayer.playerNumber}ScoreMesh`) as Mesh;
        // if (playerScore) {
        //     playerScore.isVisible = false;
        // }

        playerList[playerId].isPlaying = false;

        hidePlayerGameUtils(playerId);

        playerList[playerId].playerNumber = 0;
        changePlayerColor(playerId);
    }
});

socket.on('playerDisconnected', (id) => {
    deleteClientElement(id);

    const disconnectedPlayer = playerList[id];
    if (disconnectedPlayer) {
        console.log('Player disconnected: ', id);
        disconnectedPlayer.headObj?.dispose();
        disconnectedPlayer.controllerR?.dispose();
        disconnectedPlayer.controllerL?.dispose();
        disconnectedPlayer.paddle?.dispose();
        disconnectedPlayer.paddleLight?.dispose();
        disconnectedPlayer.scoreMesh?.dispose();
        disconnectedPlayer.idMesh?.dispose();

        let playerWall = scene.getMeshByName(`player${disconnectedPlayer.playerNumber}Wall`) as Mesh;
        if (playerWall) {
            playerWall.isVisible = true;
        }
        let playerScore = scene.getMeshByName(`player_${disconnectedPlayer.id}ScoreMesh`) as Mesh;
        if (playerScore) {
            playerScore.isVisible = false;

            // player score back to normal position
            if (disconnectedPlayer.playerNumber == 1) {
                playerScore.position = new Vector3((sceneStartInfos.playCubeSize.x / 2), sceneStartInfos.playCubeSize.x / 2, 0);
            } else if (disconnectedPlayer.playerNumber == 2) {
                playerScore.position = new Vector3(-(sceneStartInfos.playCubeSize.x / 2), sceneStartInfos.playCubeSize.x / 2, 0);
            } else if (disconnectedPlayer.playerNumber == 3) {
                playerScore.position = new Vector3(0, sceneStartInfos.playCubeSize.x / 2, (sceneStartInfos.playCubeSize.z / 2));
            } else if (disconnectedPlayer.playerNumber == 4) {
                playerScore.position = new Vector3(0, sceneStartInfos.playCubeSize.x / 2, -(sceneStartInfos.playCubeSize.z / 2));
            }
        }

        delete playerList[id];
    }
});

// when the scene is first loaded this will set the color of the player divs
function setPlayerCSSColors(startPositions: { [key: number]: PlayerStartInfo }) {
    for (let i = 1; i <= 4; i++) {
        let playerDiv = document.getElementById(`player-${i}`);
        if (playerDiv) {
            playerDiv.style.setProperty('border-color', startPositions[i].color);
            playerDiv.style.setProperty('color', startPositions[i].color);
        }
    }
}

socket.on('newClientMonitor', (newClientId) => {
    console.log('New client connected: ', newClientId);
    // check if the client is already in the list of clients
    let allreadyClient = document.getElementById(newClientId);
    if (!allreadyClient) {
        let clientElement = createClientElement(newClientId);
        if (clientsList) {
            clientsList.appendChild(clientElement);
        }
    }
});

function createClientElement(clientId: string): HTMLElement {
    const clientWrapper = document.createElement('div');
    clientWrapper.classList.add('client');
    clientWrapper.id = clientId;

    const clientInfos = document.createElement('div');
    clientInfos.classList.add('client-infos');

    const clientIdElem = document.createElement('p');
    clientIdElem.textContent = `Client ID: ${clientId}`;
    clientInfos.appendChild(clientIdElem);

    if (clientId === clientID) {
        console.log('This is the current client!');
        clientWrapper.classList.add('this-client');

        const thisClientElem = document.createElement('p');
        thisClientElem.textContent = `You!`;
        clientInfos.appendChild(thisClientElem);
    } else {
        // Add the "Force Reload" button
        const forceReloadButton = document.createElement('button');
        forceReloadButton.textContent = 'Force Reload';
        forceReloadButton.addEventListener('click', () => {
            console.log(`Force Reload clicked for Client ID: ${clientId}`);
            socket.emit('requestClientReload', clientId, true);
        });
        clientInfos.appendChild(forceReloadButton);

        // Add the "Kick from Server" button
        const kickButton = document.createElement('button');
        kickButton.textContent = 'Disconnect from Server';
        kickButton.addEventListener('click', () => {
            console.log(`Disconnect from Server clicked for Client ID: ${clientId}`);
            socket.emit('requestDisconnectClient', clientId, true);
        });
        clientInfos.appendChild(kickButton);
    }

    // Append the client info div to the wrapper
    clientWrapper.appendChild(clientInfos);

    return clientWrapper;
}

function deleteClientElement(clientId: string) {
    const clientElement = document.getElementById(clientId);
    if (clientElement) {
        clientElement.remove();
    }
}

////////////////////////// RENDER LOOP //////////////////////////////
// Register a render loop to repeatedly render the scene
engine.runRenderLoop(function () {
    Object.keys(playerList).forEach((id) => {
        if (playerList[id]) {
            playerList[id].updateObj();
        }
    });

    scene.render();
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

    // add an event listener for ending the server und get the test results
    // c: client, n: network, x: end server without test results
    // if (event.key === 'x') {
    //     socket.emit('collectingTests', 'shutdown');
    // }
    if (event.key === 'c') {
        socket.emit('collectingTests', 'client');
    }
    if (event.key === 'n') {
        socket.emit('collectingTests', 'network');
    }
    if (event.key === 'a') {
        socket.emit('collectingTests', 'all');
    }
});

/*socket.on('clientPong', (serverClientSendTime) => {
    const clientSendTime = serverClientSendTime;
    const clientReceiveTime = Date.now();
    const clientRoundTripTime = clientReceiveTime - clientSendTime;
    // console.log('Client Round Trip Time: ', clientRoundTripTime);
    socket.emit('clientRoundTripTime', clientRoundTripTime, socket.id);
});*/

////////////////////////// END TESTING GROUND ////////////////////////////// 

toggleInterfaceBtn.addEventListener('click', function () {
    if (gameMonitorInterface.style.display === 'none') {
        gameMonitorInterface.style.display = 'block';
    } else {
        gameMonitorInterface.style.display = 'none';
    }
});

resetCamBtn.addEventListener('click', function () {
    camera.alpha = (Math.PI / 4) * 3;
    camera.beta = 0;
    camera.radius = 7;
    camera.target = new Vector3(0, 0, 0);
});

// clearServerArrayBtn.addEventListener('click', function () {
//     socket.emit('requestClearServerArray', true);
// });

// collectTestsBtn.addEventListener('click', function () {
//     socket.emit('collectingTests', 'all');
// });

// force the player in the position to join the game
for (let i = 1; i <= Object.keys(startButtons).length; i++) {
    startButtons[i].addEventListener('click', () => {
        socket.emit('requestJoinGame', i, true);
    });
}

// kick the specific player out of the game
for (let i = 1; i <= Object.keys(kickButtons).length; i++) {
    kickButtons[i].addEventListener('click', () => {
        socket.emit('clientExitsGame', i, true);
    });
}

// force the specific players site to reload
for (let i = 1; i <= Object.keys(reloadButtons).length; i++) {
    reloadButtons[i].addEventListener('click', () => {
        socket.emit('requestPlayerReload', i, true);
    });
}

// clear the specific player arrays
for (let i = 1; i <= Object.keys(recenterButtons).length; i++) {
    recenterButtons[i].addEventListener('click', () => {
        socket.emit('requestRecenterXR', i, true);
    });
}

// client list expandable
clientHeader.addEventListener('click', () => {
    console.log('Client Header clicked');
    if (window.screen.width < 900) {
        if (clientWrapper.classList.contains('expanded')) {
            clientWrapper.classList.remove('expanded');
        } else {
            clientWrapper.classList.add('expanded');
        }
    }
});