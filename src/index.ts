import { io } from 'socket.io-client';
import { /*Camera,*/ Engine, FreeCamera, HighlightLayer, /*Material,*/ /*PBRBaseMaterial,*/ PBRMaterial, Scene } from '@babylonjs/core';
import { /*ArcRotateCamera,*/ MeshBuilder, /*ShadowGenerator,*/ GlowLayer, /*ParticleSystem,*/ Animation } from '@babylonjs/core';
import { HemisphericLight, DirectionalLight, PointLight /*SSRRenderingPipeline, Constants*/ } from '@babylonjs/core';
import { Mesh, StandardMaterial, Texture, Color3, Color4, Vector3, Quaternion, CubeTexture /*LinesMesh*/ } from '@babylonjs/core';
import { WebXRDefaultExperience, WebXRInputSource } from '@babylonjs/core/XR';
import * as GUI from '@babylonjs/gui';

import '@babylonjs/core/Materials/Textures/Loaders'; // Required for EnvironmentHelper
import '@babylonjs/loaders/glTF'; // Enable GLTF/GLB loader for loading controller models from WebXR Input registry

import { Inspector } from '@babylonjs/inspector';

const socket = io();

const rotationQuaternion = null;
if (rotationQuaternion) {
    //console.log('Rotation Quaternion: ', rotationQuaternion);
}
let clientStartTime = Date.now();
const clientRefreshRate = 20; // time between client updates in ms

let clientID: string;
let clientPlayer: Player | null = null;
let playerUsingXR: boolean = false;
// let clientStartPos: { x: number, y: number, z: number };

let playerList: { [key: string]: Player } = {};
let previousPlayer: PreviousPlayerData | null = null;
getLocalStorage();

let sceneStartInfos: SceneStartInfos;
let playerStartInfos: { [key: number]: PlayerStartInfo };

let xr: WebXRDefaultExperience;
let xrCamera: FreeCamera | null = null;
let leftController: WebXRInputSource | null = null;
let rightController: WebXRInputSource | null = null;

// store the textBlock GUI elements for updating the scores
const guiTextElements: { [key: string]: GUI.TextBlock } = {};
const guiRectElements: { [key: string]: GUI.Rectangle } = {};

let exitGameAreaInterval: NodeJS.Timer | null = null;
let enteredGameAreaInterval: NodeJS.Timer | null = null;

const ghostColor = '#bdbdbd';

// Get HTML Elements
// const divFps = document.getElementById('fps');
// const divID = document.getElementById('clientID');
const startScreen = document.getElementById('startScreen');
const continueAsPreviousPlayer = document.getElementById('continueAsPreviousPlayer');
const loadingScreen = document.getElementById('loadingScreen');
const startButtons: { [key: number]: HTMLButtonElement } = {};
for (let i = 1; i <= 4; i++) {
    let startbutton = document.getElementById(`startPos-${i}`);
    startButtons[i] = startbutton as HTMLButtonElement;
}
const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;

// Test Variables
let serverUpdateCounter = 0;
let oldServerUpdateCounter = 0;
let latencyTestArray: string[] = [];
const updateCounterArray: number[] = [];
const renderLoopTestArray: { suc: number; time: number }[] = [];

let fpsOldTime = 0;
let fpsNewTime = 0;
const fpsArray: { suc: number; time: number }[] = [];

////////////////////////////// CREATE BABYLON SCENE ETC. //////////////////////////////

// Basic Setup ---------------------------------------------------------------------------------
const engine = new Engine(canvas, true);
const scene = new Scene(engine);

// let ssr: SSRRenderingPipeline;

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

    const camera = new FreeCamera('Camera', new Vector3(0, 5, 0), scene);
    camera.rotation = new Vector3(Math.PI / 2, Math.PI, Math.PI / 4);
    //camera.detachControl();
    camera.attachControl(true);

    scene.activeCamera = camera;

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
    playBox.isVisible = false;

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
    topWall.isVisible = false;

    var bottomWall = MeshBuilder.CreateBox('player6Wall', { size: 1 }, scene);
    bottomWall.position = new Vector3(0, playCubeElevation, 0);
    bottomWall.scaling = new Vector3(playCubeSize.x, 0.01, playCubeSize.z);
    bottomWall.isVisible = false;

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
    HUDLabel.fontFamily = "loadedFont";
    HUDLabel.text = "";
    HUDLabel.color = "red";
    HUDLabel.fontSize = 40;
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
    playerStartMatPlane.alpha = 0;

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

    // var high = new HighlightLayer("highlight", scene);

    // high.addMesh(player1GroundPlane, Color3.FromHexString(playerStartInfos[1].color));
    // high.addMesh(player2GroundPlane, Color3.FromHexString(playerStartInfos[2].color));
    // high.addMesh(player3GroundPlane, Color3.FromHexString(playerStartInfos[3].color));
    // high.addMesh(player4GroundPlane, Color3.FromHexString(playerStartInfos[4].color));
    // high.addExcludedMesh(playBox);
    // high.addExcludedMesh(player1Wall);
    // high.addExcludedMesh(player2Wall);
    // high.addExcludedMesh(player3Wall);
    // high.addExcludedMesh(player4Wall);
    // high.addExcludedMesh(topWall);
    // high.addExcludedMesh(bottomWall);
    // high.addExcludedMesh(HUDMesh);
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

// interface Ball {
//     position: { x: number, y: number, z: number };
//     counter: number;
// }

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
    //HUDMesh?: Mesh | null;

    constructor(player: PlayerData, headObj?: Mesh, controllerR?: Mesh, controllerL?: Mesh, paddle?: Mesh, scoreMesh?: Mesh, paddleLight?: PointLight) {
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
        //this.HUDMesh = HUDMesh || null;
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
        }
        if (this.controllerR) {
            this.controllerR.position = new Vector3(this.contrPosR.x, this.contrPosR.y, this.contrPosR.z);
            this.controllerR.rotation = new Vector3(this.contrRotR.x, this.contrRotR.y, this.contrRotR.z);
        }
        if (this.controllerL) {
            this.controllerL.position = new Vector3(this.contrPosL.x, this.contrPosL.y, this.contrPosL.z);
            this.controllerL.rotation = new Vector3(this.contrRotL.x, this.contrRotL.y, this.contrRotL.z);
        }
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
                if (this.scoreMesh && playerUsingXR) {
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
                if (this.scoreMesh && playerUsingXR) {
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
                if (this.scoreMesh && playerUsingXR) {
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
                if (this.scoreMesh && playerUsingXR) {
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

(async function main() {
    // Create a WebXR experience
    xr = await scene.createDefaultXRExperienceAsync({
        floorMeshes: [scene.getMeshByName('ground') as Mesh],
        // uiOptions: {
        //     sessionMode: "immersive-vr",
        // },
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
        handSupportOptions: {
            jointMeshes: {
                invisible: true,
            },
        },
    });

    // Add an event listener to each button
    for (let i = 1; i <= Object.keys(startButtons).length; i++) {

        // mouse hover effect and camera position change
        startButtons[i].addEventListener('mouseover', () => {
            handleMouseOver(i);
        });
        // end mouse hover effect and camera position change to default
        startButtons[i].addEventListener('mouseout', () => {
            handleMouseOut(i);
        });

        startButtons[i].addEventListener('click', () => {
            // const htmlBtnId = (event.target as HTMLElement).id;
            // const btnPlayerNumber = Number(htmlBtnId.split('-')[]);
            // console.log(`Button with id ${htmlBtnId} clicked`);
            socket.emit('requestEnterAR', i);
            // socket.emit('requestJoinGame', i);
        });
    }

    xr.teleportation.detach();
    xr.pointerSelection.detach();

    const hasImmersiveVR = await xr.baseExperience.sessionManager.isSessionSupportedAsync('immersive-ar');

    if (hasImmersiveVR) {

        xr.baseExperience.sessionManager.onXRSessionInit.add(() => {

            xrCamera = xr.baseExperience.camera;
            playerUsingXR = true;
            scene.activeCamera = xrCamera;
            // ssr.addCamera(xrCamera);
        });

        xr.baseExperience.sessionManager.onXRSessionEnded.add(() => {
            engine.resize();
            getLocalStorage();
            playerUsingXR = false;
            console.log('Player is leaving VR');
            socket.emit('playerEndVR');
            startScreen?.style.setProperty('display', 'flex');

            // Reset Camera Position for arc camera
            // camera.alpha = -(Math.PI / 4) * 3;
            // camera.beta = Math.PI / 4;
            // camera.radius = 15;
            // camera.target = new Vector3(0, 0, 0);
        });

        window.addEventListener('keydown', function (event) {
            // exit VR Session on ESC
            if (event.key === 'Escape') {
                // console.log('Escape Key pressed');
                if (playerUsingXR) {
                    xr.baseExperience.exitXRAsync();
                    // engine.resize();
                }
            }
        });

        setInterval(function () {
            // console.log('Interval Function');
            if (clientPlayer) {
                if (playerUsingXR) {
                    if (xrCamera && leftController && rightController) {
                        // console.log('Sending Data to Server while VR');
                        clientPlayer.sendData(xrCamera, leftController, rightController);
                    }
                }
            }
        }, clientRefreshRate);
    }
})();

// !1
// Send the client's start time to the server upon connection
socket.on('connect', () => {
    socket.emit('clientStartTime', clientStartTime);
    // console.log('Previous Player Data: ', previousPlayer);
    latencyTestArray.push(`----------Client Connected----------`);
});

// !2
socket.on('ClientID', (id) => {
    console.log('This Client ID: ', id);
    latencyTestArray.push(`----------This Client ID: ${id} ----------`);
});

// !3
socket.on('reload', () => {
    console.log('Server requested reload');
    latencyTestArray.push(`----------Server requested reload----------`);
    xr.baseExperience.exitXRAsync();
    window.location.reload();
});

// set the prevoius player to available
/*socket.on('timeForPreviousPlayers', () => {
    if (previousPlayer != null) {
        let timeDiffPreviousPlayer = clientStartTime - previousPlayer.playerTime;

        console.log('Time Difference to Previous Player: ', timeDiffPreviousPlayer);

        if (timeDiffPreviousPlayer < 30000) {
            console.log(`Previous Player ${previousPlayer.playerNumber} found.`);

            if (continueAsPreviousPlayer) {
                continueAsPreviousPlayer.style.display = 'block';
                continueAsPreviousPlayer.innerHTML = `Continue as Player ${previousPlayer.playerNumber} <span id="btn-arrow-pre"></span>`;
                continueAsPreviousPlayer.style.setProperty('border-color', previousPlayer.color);
                continueAsPreviousPlayer.style.setProperty('color', previousPlayer.color);
                continueAsPreviousPlayer.style.setProperty('box-shadow', `0 0 15px ${previousPlayer.color}50, 0 0 30px ${previousPlayer.color}50, inset 0 0 10px ${previousPlayer.color}50`);
                continueAsPreviousPlayer.style.setProperty('text-shadow', `0 0 10px ${previousPlayer.color}, 0 0 20px ${previousPlayer.color}`);
                // set the color of the button arrow
                let buttonArrow = document.getElementById(`btn-arrow-pre`);
                if (buttonArrow) {
                    buttonArrow.style.setProperty('border-color', previousPlayer.color);
                }

                // click event listener for the continue as previous player button
                continueAsPreviousPlayer.addEventListener('click', () => {
                    console.log('Pressed continue as Previous Player');
                    socket.emit('continueAsPreviousPlayer', previousPlayer);
                });

                // mouse over effect for the continue as previous player button
                continueAsPreviousPlayer.addEventListener('mouseover', () => {
                    if (previousPlayer) {
                        handleMouseOver(previousPlayer.playerNumber, true);
                    }
                });

                // mouse out effect for the continue as previous player button
                continueAsPreviousPlayer.addEventListener('mouseout', () => {
                    if (previousPlayer) {
                        handleMouseOut(previousPlayer.playerNumber, true);
                    }
                });

            }
        } else {
            console.log('Previous Player found, but too late.');
            localStorage.removeItem('player');
        }
    } else {
        console.log('No Previous Player found.');
    }
});*/

// !4
socket.on('joinedWaitingRoom', () => {
    console.log(`You joined the waiting Room. Enter VR to join the Game.`);
    latencyTestArray.push(`----------Client joined Waiting Room----------`);

    if (loadingScreen) {
        loadingScreen.style.display = 'none';
    }
});

socket.on('startPosDenied', (errorCode) => {
    if (errorCode == 0) {
        console.log('AR Enter position denied. Position is alreay taken.');
    } else if (errorCode == 1) {
        console.log('Starting the Game denied. You are in no game position.');
    } else if (errorCode == 2) {
        console.log('Starting the Game denied. Position is alreay taken.');
    }
});

// !5
// get all current Player Information from the Server at the start
// and spawning all current players except yourself
socket.on('currentState', (players: { [key: string]: Player }, ballColor: string,
    playerStartInfosServer: { [key: number]: PlayerStartInfo }, sceneStartInfosServer: SceneStartInfos) => {

    latencyTestArray.push(`----------Client received currentState----------`);

    sceneStartInfos = sceneStartInfosServer;
    playerStartInfos = playerStartInfosServer;

    // Basic Stuff from the srever for the website and the scene
    // create the Basic babylonjs scene with the infos from the server
    createBasicScene(sceneStartInfos, playerStartInfos);
    // set the start button color for the players
    setStartButtonColor(playerStartInfos);

    let ballMaterial = scene.getMaterialByName('ballMaterial') as PBRMaterial;
    ballMaterial.emissiveColor = Color3.FromHexString(ballColor);

    // let ballParticleSystem = scene.getParticleSystemById('ballParticles');
    // if (ballParticleSystem) {
    //     ballParticleSystem.color1 = Color4.FromHexString(ballColor);
    //     ballParticleSystem.color2 = darkenColor4(Color4.FromHexString(ballColor), 0.5);
    // }

    // console.log('Playercount: ', Object.keys(players).length);

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

    setPlayerAvailability(playerStartInfos);
});

// !6
socket.on('clientEntersAR', (newSocketPlayer, areaEnteredTimerTime) => {
    latencyTestArray.push(`----------Client enters AR----------`);

    startScreen?.style.setProperty('display', 'none');

    // if (divID) {
    //     divID.innerHTML = `Player ID: ${newSocketPlayer.id}`;
    // }

    // Start VR Session for the client
    xr.baseExperience.enterXRAsync('immersive-ar', 'local-floor').then(() => {
        console.log('Enter AR');

        // console log the xr device


        // look for controllers and add event listeners
        xr.input.onControllerAddedObservable.add((controller) => {
            controller.onMotionControllerInitObservable.add((motionController) => {

                motionController.disableAnimation = true;
                motionController._doNotLoadControllerMesh = true;

                // let color: Color3;
                // let sphere: Mesh;
                // let material: StandardMaterial;

                if (motionController.handness === 'right') {

                    rightController = controller;

                    const xrIDs = motionController.getComponentIds();

                    let triggerComponent = motionController.getComponent(xrIDs[0]);//xr-standard-trigger
                    triggerComponent.onButtonStateChangedObservable.add(() => {
                        if (triggerComponent.pressed) {

                        }
                    });

                    let squeezeComponent = motionController.getComponent(xrIDs[1]);//xr-standard-squeeze
                    squeezeComponent.onButtonStateChangedObservable.add(() => {
                        if (squeezeComponent.pressed) {

                        }
                    });

                    let thumbstickComponent = motionController.getComponent(xrIDs[2]);//xr-standard-thumbstick
                    thumbstickComponent.onButtonStateChangedObservable.add(() => {
                        if (thumbstickComponent.pressed) {

                        }
                    });

                    let abuttonComponent = motionController.getComponent(xrIDs[3]);//a-button
                    abuttonComponent.onButtonStateChangedObservable.add(() => {
                        if (abuttonComponent.pressed) {
                            // !7
                            if (!playerList[clientID].isPlaying) {
                                socket.emit('requestJoinGame', playerList[clientID].inPosition);
                            }
                        }
                    });

                    let bbuttonComponent = motionController.getComponent(xrIDs[4]);//b-button
                    bbuttonComponent.onButtonStateChangedObservable.add(() => {
                        if (bbuttonComponent.pressed) {
                            if (playerList[clientID].isPlaying) {
                                socket.emit('clientExitsGame', playerList[clientID].playerNumber);
                            }
                        }
                    });
                }

                if (motionController.handness === 'left') {

                    leftController = controller;

                    const xrIDs = motionController.getComponentIds();

                    let triggerComponent = motionController.getComponent(xrIDs[0]); //xr-standard-trigger
                    triggerComponent.onButtonStateChangedObservable.add(() => {
                        if (triggerComponent.pressed) {

                        }
                    });

                    let squeezeComponent = motionController.getComponent(xrIDs[1]);//xr-standard-squeeze
                    squeezeComponent.onButtonStateChangedObservable.add(() => {
                        if (squeezeComponent.pressed) {

                        }
                    });

                    let thumbstickComponent = motionController.getComponent(xrIDs[2]);//xr-standard-thumbstick
                    thumbstickComponent.onButtonStateChangedObservable.add(() => {
                        if (thumbstickComponent.pressed) {
                            socket.emit('collectingTests', 'all');
                        }
                    });

                    let xbuttonComponent = motionController.getComponent(xrIDs[3]);//x-button
                    xbuttonComponent.onButtonStateChangedObservable.add(() => {
                        if (xbuttonComponent.pressed) {
                            // for testing to report a lag
                            console.log('Send Lag report');
                            socket.emit('reportLag', serverUpdateCounter);
                            latencyTestArray.push(`----------Report a Lag at or before Counter: ${serverUpdateCounter}----------`);
                        }
                    });

                    let ybuttonComponent = motionController.getComponent(xrIDs[4]);//y-button
                    ybuttonComponent.onButtonStateChangedObservable.add(() => {
                        if (ybuttonComponent.pressed) {
                            // for testing to report a lag
                            console.log('Send Lag report');
                            socket.emit('reportLag', serverUpdateCounter);
                            latencyTestArray.push(`----------Report a Lag at or before Counter: ${serverUpdateCounter}----------`);
                        }
                    });
                }
            })
        });

        // get the Connection ID of the Player
        clientID = newSocketPlayer.id;

        // get the player of this socket
        clientPlayer = new Player(newSocketPlayer);

        // remove the previous player from the local storage
        localStorage.removeItem('clientID');

        // add this socket player to the playerList
        playerList[clientID] = clientPlayer;

        // Spawn yourself Entity
        addPlayer(playerList[clientID], true);
        addPlayerGameUtils(playerList[clientID], true);
        (playerList[clientID].paddle as Mesh).isVisible = true;
        (playerList[clientID].paddleLight as PointLight).intensity = 1;
        updateHUDPosition(playerList[clientID].inPosition);
        updateHUDInfo('enteredGameArea', areaEnteredTimerTime);

        // set the xrCamera position and rotation to the player position and rotation from the server
        if (xrCamera) {
            xrCamera.position = new Vector3(playerList[clientID].position.x, playerList[clientID].position.y, playerList[clientID].position.z);
            xrCamera.rotationQuaternion = Quaternion.FromEulerAngles(playerList[clientID].rotation.x, playerList[clientID].rotation.y, playerList[clientID].rotation.z);
        }

        let playerWall = scene.getMeshByName(`player${playerList[clientID].playerNumber}Wall`) as Mesh;
        if (playerWall) {
            playerWall.isVisible = false;
        }

    }).catch((err) => {
        console.error('Failed to enter VR', err);
    });
});

// when the current player is already on the server and a new player joins
socket.on('newPlayer', (newPlayer) => {
    latencyTestArray.push(`----------New Player joined: ${newPlayer.id}----------`);
    // console log about new player joined
    console.log('New player joined: ', newPlayer.id);

    // Add new player to the playerList
    playerList[newPlayer.id] = new Player(newPlayer);

    // Spawn new player Entity
    addPlayer(playerList[newPlayer.id], false);
    addPlayerGameUtils(playerList[newPlayer.id], false);

    /*if (previousPlayer) {
        if (previousPlayer.playerNumber == newPlayer.playerNumber) {
            if (continueAsPreviousPlayer && continueAsPreviousPlayer.style.display != 'none' && !continueAsPreviousPlayer.classList.contains('unavailable')) {
                continueAsPreviousPlayer.classList.add('unavailable');
            }
        }
    }*/
});

// !8
// when the client is on the server and a new player starts playing
// can be the client itself (if in ar)
socket.on('playerStartPlaying', (newPlayerId, startPlayingNumber) => {
    latencyTestArray.push(`----------Player started playing: ${newPlayerId} as ${startPlayingNumber}----------`);
    console.log('Player started playing: ', newPlayerId, ' as ', startPlayingNumber);

    playerList[newPlayerId].isPlaying = true;
    playerList[newPlayerId].playerNumber = startPlayingNumber;

    // set the material of the player to a player material
    changePlayerColor(newPlayerId);

    if (newPlayerId == clientID) {
        showPlayerGameUtils(playerList[newPlayerId].id);
        //addPlayerGameUtils(playerList[newPlayerId], true);

        let skyBoxMesh = scene.getMeshByName('skyBoxMesh') as Mesh;
        if (skyBoxMesh) {
            skyBoxMesh.isVisible = true;
        }

        for (let i = 1; i <= 4; i++) {
            let playerGround = scene.getMeshByName(`player${i}Ground`) as Mesh;
            let playerGroundPlane = scene.getMeshByName(`player${i}GroundPlane`) as Mesh;
            if (playerGround) {
                playerGround.isVisible = true;
            }
            if (playerGroundPlane) {
                playerGroundPlane.isVisible = false;
            }
        }
    } else {
        showPlayerGameUtils(playerList[newPlayerId].id);
        //addPlayerGameUtils(playerList[newPlayerId], false);
    }

    let playerWall = scene.getMeshByName(`player${playerList[newPlayerId].playerNumber}Wall`) as Mesh;
    if (playerWall) {
        playerWall.isVisible = false;
    }
    // let playerScore = scene.getMeshByName(`player${playerList[newPlayer.id].playerNumber}ScoreMesh`) as Mesh;
    // if (playerScore) {
    //     playerScore.isVisible = true;
    // }

    updatePlayerScore(newPlayerId, playerList[newPlayerId].score);

    // set the availability of the start buttons according to the used startpositions on the server
    if (playerList[newPlayerId].isPlaying) {
        if (!startButtons[playerList[newPlayerId].playerNumber].classList.contains('unavailable')) {
            startButtons[playerList[newPlayerId].playerNumber].classList.add('unavailable');
        }
    }

    updateHUDPosition(0);
    guiTextElements['client_HUDLabel'].text = ``;
    guiTextElements['client_HUDLabel'].color = "red";
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
    // save the time when the client recieved the server update
    // pair it with the server update counter to store the specific update with the recivied time
    updateCounterArray[serverUpdateCounter] = performance.now();

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

// when the scene is first loaded this will set the color of the start buttons
// the information can so be send from the server to the client
function setStartButtonColor(startPositions: { [key: number]: PlayerStartInfo }) {
    for (let i = 1; i <= Object.keys(startButtons).length; i++) {
        let startButton = document.getElementById(`startPos-${i}`);
        if (startButton) {
            startButton.style.setProperty('border-color', startPositions[i].color);
            startButton.style.setProperty('color', startPositions[i].color);
            startButton.style.setProperty('box-shadow', `0 0 15px ${startPositions[i].color}50, 0 0 30px ${startPositions[i].color}50, inset 0 0 10px ${startPositions[i].color}50`);
            startButton.style.setProperty('text-shadow', `0 0 10px ${startPositions[i].color}, 0 0 20px ${startPositions[i].color}`);
        }
        // set the color of the button arrow
        let buttonArrow = document.getElementById(`btn-arrow-${i}`);
        if (buttonArrow) {
            buttonArrow.style.setProperty('border-color', startPositions[i].color);
        }
    }
}

// set which player positions are available for the client
// set the availability of the start buttons, the visibility of the player walls and the visibility of the player scores
function setPlayerAvailability(startPositions: { [key: number]: PlayerStartInfo }) {
    for (let i = 1; i <= Object.keys(startButtons).length; i++) {
        let playerWall = scene.getMeshByName(`player${i}Wall`) as Mesh;
        // let playerScoreMesh = scene.getMeshByName(`player${i}ScoreMesh`) as Mesh;
        if (startPositions[i].used == true) {
            if (playerWall) {
                playerWall.isVisible = false;
            }
            // if (playerScoreMesh) {
            //     playerScoreMesh.isVisible = true;
            // }
            if (!startButtons[i].classList.contains('unavailable')) {
                startButtons[i].classList.add('unavailable');
            }
            if (previousPlayer) {
                if (previousPlayer.playerNumber == i) {
                    if (continueAsPreviousPlayer && continueAsPreviousPlayer.style.display != 'none' && !continueAsPreviousPlayer.classList.contains('unavailable')) {
                        continueAsPreviousPlayer.classList.add('unavailable');
                    }
                }
            }
        } else {
            if (playerWall) {
                playerWall.isVisible = true;
            }
            // if (playerScoreMesh) {
            //     playerScoreMesh.isVisible = false;
            // }
            if (startButtons[i].classList.contains('unavailable')) {
                startButtons[i].classList.remove('unavailable');
            }
            if (previousPlayer) {
                if (previousPlayer.playerNumber == i) {
                    if (continueAsPreviousPlayer && continueAsPreviousPlayer.style.display != 'none' && continueAsPreviousPlayer.classList.contains('unavailable')) {
                        continueAsPreviousPlayer.classList.remove('unavailable');
                    }
                }
            }
        }
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

    // player.headObj.isVisible = false;
    // player.controllerL.isVisible = false;
    // player.controllerR.isVisible = false;

    playerList[player.id].headObj = player.headObj;
    playerList[player.id].controllerR = player.controllerR;
    playerList[player.id].controllerL = player.controllerL;
    //playerList[player.id].HUDMesh = player.HUDMesh;
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
    if (playerUsingXR) {
        player.scoreMesh.position = new Vector3(player.contrPosR.x, player.contrPosR.y, player.contrPosR.z);
    } else {
        if (player.playerNumber == 1) {
            player.scoreMesh.position = new Vector3(sceneStartInfos.playCubeSize.x / 2, sceneStartInfos.midPointOfPlayCube, 0);
        } else if (player.playerNumber == 2) {
            player.scoreMesh.position = new Vector3(-(sceneStartInfos.playCubeSize.x / 2), sceneStartInfos.midPointOfPlayCube, 0);
        } else if (player.playerNumber == 3) {
            player.scoreMesh.position = new Vector3(0, sceneStartInfos.midPointOfPlayCube, (sceneStartInfos.playCubeSize.z / 2));
        } else if (player.playerNumber == 4) {
            player.scoreMesh.position = new Vector3(0, sceneStartInfos.midPointOfPlayCube, -(sceneStartInfos.playCubeSize.z / 2));
        }
    }
    if (!isPlayer) {
        player.scoreMesh.billboardMode = Mesh.BILLBOARDMODE_ALL;
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
        latencyTestArray.push(`----------Player ${exitPlayer.playerNumber} left the game.----------`);

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

        // exitPlayer.paddle?.dispose();
        // exitPlayer.paddleLight?.dispose();
        // exitPlayer.scoreMesh?.dispose();

        // set the availability of the start buttons according to the used startpositions on the server
        if (!playerList[playerId].isPlaying) {
            if (startButtons[playerList[playerId].playerNumber].classList.contains('unavailable')) {
                startButtons[playerList[playerId].playerNumber].classList.remove('unavailable');
            }
        }
        playerList[playerId].playerNumber = 0;
        changePlayerColor(playerId);

        updateHUDPosition(0);
        guiTextElements['client_HUDLabel'].text = ``;
        guiTextElements['client_HUDLabel'].color = "red";
    }
});

socket.on('playerDisconnected', (id) => {
    const disconnectedPlayer = playerList[id];
    if (disconnectedPlayer) {
        console.log('Player disconnected: ', id);
        latencyTestArray.push(`----------Player ${disconnectedPlayer.playerNumber} disconnected.----------`);
        disconnectedPlayer.headObj?.dispose();
        disconnectedPlayer.controllerR?.dispose();
        disconnectedPlayer.controllerL?.dispose();
        disconnectedPlayer.paddle?.dispose();
        disconnectedPlayer.paddleLight?.dispose();
        disconnectedPlayer.scoreMesh?.dispose();
        //disconnectedPlayer.HUDMesh?.dispose();

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

        // set the availability of the start buttons according to the used startpositions on the server
        if (disconnectedPlayer.isPlaying) {
            if (startButtons[disconnectedPlayer.playerNumber].classList.contains('unavailable')) {
                startButtons[disconnectedPlayer.playerNumber].classList.remove('unavailable');
            }
        }
        if (previousPlayer) {
            if (previousPlayer.playerNumber == disconnectedPlayer.playerNumber) {
                if (continueAsPreviousPlayer && continueAsPreviousPlayer.style.display != 'none' && continueAsPreviousPlayer.classList.contains('unavailable')) {
                    continueAsPreviousPlayer.classList.remove('unavailable');
                }
            }
        }

        delete playerList[id];

        if (id == clientID) {
            let defaultCamera = scene.getCameraByName('Camera') as FreeCamera;
            scene.activeCamera = defaultCamera;
            defaultCamera.position = new Vector3(0, 5, 0);
            defaultCamera.rotation = new Vector3(Math.PI / 2, Math.PI, Math.PI / 4);
        }
    }
});

// when the playing player Exits the game area
socket.on('exitGameArea', (areaExitTimerTime) => {
    console.log('Player exit the Game Area. Timer: ', areaExitTimerTime);
    updateHUDPosition(playerList[clientID].playerNumber);
    updateHUDInfo('exitGameArea', areaExitTimerTime);
});

// when the playing player reenters the game area
socket.on('reenteredGameArea', () => {
    console.log('Player reentered the Game Area.');
    updateHUDPosition(0);
    updateHUDInfo('reenteredGameArea');
});

// when the player enters a game area to join the game
socket.on('enteredGameArea', (areaEnteredTimerTime) => {
    console.log('Player reentered the Game Area. Timer: ', areaEnteredTimerTime);
    (playerList[clientID].paddle as Mesh).isVisible = true;
    (playerList[clientID].paddleLight as PointLight).intensity = 1;
    updateHUDPosition(playerList[clientID].inPosition);
    updateHUDInfo('enteredGameArea', areaEnteredTimerTime);
});

// when the player Exits the game area while trying to join the game
socket.on('exitJoiningGameArea', () => {
    console.log('Player exit the Joining Game Area.');
    (playerList[clientID].paddle as Mesh).isVisible = false;
    (playerList[clientID].paddleLight as PointLight).intensity = 0;
    updateHUDPosition(0);
    updateHUDInfo('exitJoiningGameArea');
});

function updateHUDPosition(positionNumber: number) {
    let HUDMesh = scene.getMeshByName(`client_HUD`) as Mesh;
    if (HUDMesh) {
        if (positionNumber == 0) {
            HUDMesh.position = new Vector3(0, 0, 0);
            HUDMesh.rotation = new Vector3(0, 0, 0);
            HUDMesh.isVisible = false;
        } else {
            HUDMesh.isVisible = true;
            HUDMesh.position = scene.getMeshByName(`player${positionNumber}Wall`)?.position as Vector3;
            HUDMesh.rotation = new Vector3(playerStartInfos[positionNumber].rotation.x, playerStartInfos[positionNumber].rotation.y, playerStartInfos[positionNumber].rotation.z);
        }
    }
}

function updateHUDInfo(eventType: string, eventTimerTime: number = 0) {
    if (eventType == 'exitGameArea') {
        guiRectElements['client_HUDRect'].color = "red";
        guiTextElements['client_HUDLabel'].text = `You exited the Game Area of Position ${playerList[clientID].playerNumber}.\nExit the Game in: \n${eventTimerTime / 1000}s\nor reenter the Game Area.`;
        guiTextElements['client_HUDLabel'].color = "red";
        let timer = eventTimerTime / 1000;
        exitGameAreaInterval = setInterval(() => {
            timer -= 1;
            guiTextElements['client_HUDLabel'].text = `You exited the Game Area of Position ${playerList[clientID].playerNumber}.\nExit the Game in: \n${timer}s\nor reenter the Game Area.`;
            if (timer <= 0) {
                clearInterval(exitGameAreaInterval as NodeJS.Timeout);
                timer = eventTimerTime / 1000;
            }
        }, 1000);
    } else if (eventType == 'reenteredGameArea') {
        guiTextElements['client_HUDLabel'].text = ``;
        guiTextElements['client_HUDLabel'].color = "red";
        clearInterval(exitGameAreaInterval as NodeJS.Timeout);
    } else if (eventType == 'enteredGameArea') {
        guiRectElements['client_HUDRect'].color = playerStartInfos[playerList[clientID].inPosition].color;
        guiTextElements['client_HUDLabel'].text = `You entered the Game Area of Position ${playerList[clientID].inPosition}.\nJoin the Game in: \n${eventTimerTime / 1000}s\nor leave the Game Area.`;
        guiTextElements['client_HUDLabel'].color = playerStartInfos[playerList[clientID].inPosition].color;
        let timer = eventTimerTime / 1000;
        enteredGameAreaInterval = setInterval(() => {
            timer -= 1;
            guiTextElements['client_HUDLabel'].text = `You entered the Game Area of Position ${playerList[clientID].inPosition}.\nJoin the Game in: \n${timer}s\nor leave the Game Area.`;
            if (timer <= 0) {
                clearInterval(enteredGameAreaInterval as NodeJS.Timeout);
                timer = eventTimerTime / 1000;
            }
        }, 1000);
    } else if (eventType == 'exitJoiningGameArea') {
        guiTextElements['client_HUDLabel'].text = ``;
        guiTextElements['client_HUDLabel'].color = "red";
        clearInterval(enteredGameAreaInterval as NodeJS.Timeout);
    }
}

////////////////////////// RENDER LOOP //////////////////////////////
// Register a render loop to repeatedly render the scene
engine.runRenderLoop(function () {
    // if (divFps) {
    //     divFps.innerHTML = engine.getFps().toFixed() + ' fps';
    // }
    Object.keys(playerList).forEach((id) => {
        if (playerList[id]) {
            playerList[id].updateObj();
        }
    });

    if (serverUpdateCounter > 0) {

        // calculate the time difference between the client recieving the server update and teh client showing the update
        // this is the time it takes for the client to process the server update and show it on the screen
        if (oldServerUpdateCounter != serverUpdateCounter) {
            const renderLoopTime = performance.now();
            const deltaRenderLoopTime = renderLoopTime - updateCounterArray[serverUpdateCounter];
            const roundedDRLT = Math.round(deltaRenderLoopTime);

            // console.log('Server Update Counter: ', serverUpdateCounter);
            // latencyTestArray.push(`Server Update Counter: ${serverUpdateCounter}`);
            latencyTestArray.push(`SUC: ${serverUpdateCounter}, Delay: ${roundedDRLT}ms`);
            renderLoopTestArray.push({ suc: serverUpdateCounter, time: roundedDRLT });

        }
        oldServerUpdateCounter = serverUpdateCounter;

        // calculate the fps
        fpsNewTime = performance.now();
        const fps = Math.round(fpsNewTime - fpsOldTime);
        fpsArray.push({ suc: serverUpdateCounter, time: fps });

        fpsOldTime = fpsNewTime;
    }

    scene.render();
});

////////////////////////// END RENDER LOOP //////////////////////////////

/////////////////////////// HTML CSS Stuff //////////////////////////////

function handleMouseOver(playerNumber: number, isPreButton: boolean = false) {
    const playerStartInfo = playerStartInfos[playerNumber];
    let button, buttonArrow;
    if (isPreButton == false) {
        button = document.getElementById(`startPos-${playerNumber}`);
        buttonArrow = document.getElementById(`btn-arrow-${playerNumber}`);
    } else {
        button = document.getElementById(`continueAsPreviousPlayer`);
        buttonArrow = document.getElementById(`btn-arrow-pre`);
    }
    if (button && !button.classList.contains('unavailable')) {
        // hover effect for the start button
        button.style.backgroundColor = playerStartInfo.color;
        button.style.color = 'black';

        if (buttonArrow) {
            buttonArrow.style.setProperty('border-color', 'black');
            buttonArrow.style.setProperty('width', '10px');
            buttonArrow.style.setProperty('height', '10px');
        }

        if (playerStartInfo) {
            // change camera position to the player start position while hovering over the button
            let defaultCamera = scene.getCameraByName('Camera') as FreeCamera;

            let cameraHight = sceneStartInfos.playCubeSize.y / 1.5;

            let newRotation = new Vector3(playerStartInfo.rotation.x, playerStartInfo.rotation.y, playerStartInfo.rotation.z);
            let newPosition = new Vector3(playerStartInfo.position.x, cameraHight, playerStartInfo.position.z);

            if (playerNumber == 1) {
                newPosition = new Vector3(playerStartInfo.position.x + 2, cameraHight, playerStartInfo.position.z);
            } else if (playerNumber == 2) {
                newPosition = new Vector3(playerStartInfo.position.x - 2, cameraHight, playerStartInfo.position.z);
            } else if (playerNumber == 3) {
                newPosition = new Vector3(playerStartInfo.position.x, cameraHight, playerStartInfo.position.z + 2);
            } else if (playerNumber == 4) {
                newPosition = new Vector3(playerStartInfo.position.x, cameraHight, playerStartInfo.position.z - 2);
            }
            let oldPosition = defaultCamera.position.clone();
            let oldRotation = defaultCamera.rotation.clone();

            // defaultCamera.position = newPosition;
            // defaultCamera.rotation = newRotation;

            const positionAnimation = createCameraAnimation("position", oldPosition, newPosition, 30);
            const rotationAnimation = createCameraAnimation("rotation", oldRotation, newRotation, 30);

            defaultCamera.animations = [];
            defaultCamera.animations.push(positionAnimation);
            defaultCamera.animations.push(rotationAnimation);

            scene.beginAnimation(defaultCamera, 0, 60, false);

            // hide the specific player wall while hovering over the button
            let playerWall = scene.getMeshByName(`player${playerNumber}Wall`) as Mesh;
            if (playerWall) {
                playerWall.isVisible = false;
            }

        }
    }
}

function handleMouseOut(playerNumber: number, isPreButton: boolean = false) {
    const playerStartInfo = playerStartInfos[playerNumber];
    let button, buttonArrow;
    if (isPreButton == false) {
        button = document.getElementById(`startPos-${playerNumber}`);
        buttonArrow = document.getElementById(`btn-arrow-${playerNumber}`);
    } else {
        button = document.getElementById(`continueAsPreviousPlayer`);
        buttonArrow = document.getElementById(`btn-arrow-pre`);
    }
    if (button && !button.classList.contains('unavailable')) {
        // change colors back to default
        button.style.backgroundColor = '#00000000';
        button.style.color = playerStartInfo.color;

        // let buttonArrow = document.getElementById(`btn-arrow-${playerNumber}`);
        if (buttonArrow) {
            buttonArrow.style.setProperty('border-color', playerStartInfo.color);
            buttonArrow.style.setProperty('width', '6px');
            buttonArrow.style.setProperty('height', '6px');
        }

        if (playerStartInfo) {
            // change camera position back to default
            let defaultCamera = scene.getCameraByName('Camera') as FreeCamera;

            let newPosition = new Vector3(0, 5, 0);
            let newRotation = new Vector3(Math.PI / 2, Math.PI, Math.PI / 4);
            let oldPosition = defaultCamera.position.clone();
            let oldRotation = defaultCamera.rotation.clone();

            // defaultCamera.position = newPosition;
            // defaultCamera.rotation = newRotation;

            const positionAnimation = createCameraAnimation("position", oldPosition, newPosition, 30);
            const rotationAnimation = createCameraAnimation("rotation", oldRotation, newRotation, 30);

            defaultCamera.animations = [];
            defaultCamera.animations.push(positionAnimation);
            defaultCamera.animations.push(rotationAnimation);

            scene.beginAnimation(defaultCamera, 0, 30, false);

            // show the specific player wall again
            let playerWall = scene.getMeshByName(`player${playerNumber}Wall`) as Mesh;
            if (playerWall /*&& !playerUsingXR*/) {
                playerWall.isVisible = true;
            }
        }
    }
}

function createCameraAnimation(property: string, startValue: Vector3, endValue: Vector3, duration: number) {
    const animation = new Animation(
        `cameraAnimation_${property}`,
        property,
        60,
        Animation.ANIMATIONTYPE_VECTOR3,
        Animation.ANIMATIONLOOPMODE_CONSTANT
    );

    const keys = [
        { frame: 0, value: startValue },
        { frame: duration, value: endValue }
    ];

    animation.setKeys(keys);
    return animation;
}

/////////////////////////// END HTML CSS Stuff //////////////////////////////

/////////////////////////// LOCAL STORAGE //////////////////////////////
// set up Interval function for the local storage of the player data
setInterval(function () {
    setLocalStorage();
}, 1000);

function setLocalStorage() {
    if (playerList[clientID]) {
        let safedPreviousPlayer = {
            id: clientID,
            color: playerList[clientID].color,
            playerNumber: playerList[clientID].playerNumber,
            score: playerList[clientID].score,
            // position: playerList[clientID].position,
            position: { x: playerList[clientID].position.x, y: 0, z: playerList[clientID].position.z }, // dont save the y position (xr adds the head hight automatically)
            rotation: { x: 0, y: playerList[clientID].rotation.y, z: 0 },    //only save the y rotation
            // rotation: playerList[clientID].rotation,
            contrPosR: playerList[clientID].contrPosR,
            contrPosL: playerList[clientID].contrPosL,
            // contrRotR: playerList[clientID].contrRotR,
            contrRotR: { x: 0, y: 0, z: 0 },                                 //reset the controller rotation
            // contrRotL: playerList[clientID].contrRotL,
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
        // localStorage.setItem('clientID', `${clientID}`);
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
    // l: latency, n: network, x: end server without test results
    // if (event.key === 'x') {
    //     socket.emit('collectingTests', 'shutdown');
    // }
    if (event.key === 'l') {
        socket.emit('collectingTests', 'latency');
    }
    if (event.key === 'n') {
        socket.emit('collectingTests', 'network');
    }
    if (event.key === 'a') {
        socket.emit('collectingTests', 'all');
    }
});

socket.on('requestTestArray', () => {
    for (let i = 0; i < updateCounterArray.length; i++) {
        if (updateCounterArray[i] == undefined) {
            latencyTestArray.push(`SUC: ${i}, ERROR: Serverupdate not recieved`);
        }
    }
    socket.emit('sendTestArray', latencyTestArray, renderLoopTestArray, fpsArray);
    console.log('Test Array sent to Server');
    // latencyTestArray = [];
});

// document.addEventListener('click', () => {
//     if (playerUsingXR) {
//         socket.emit('clicked', playerList[clientID].color);
//     }
// });

// socket.on('colorChanged', (color) => {

//     // console.log('Color Changed to: ', color);
//     // change color of the sphere
//     let ballMaterial = scene.getMaterialByName('ballMaterial') as PBRMaterial;
//     ballMaterial.emissiveColor = Color3.FromHexString(color);

// });

// function debugTestclick() {
//     socket.emit('testClick', clientID);
//     console.log('XRCam Rotation Quat: ', xrCamera?.rotationQuaternion);
//     console.log('XRCam Rotation: ', xrCamera?.rotationQuaternion.toEulerAngles());
// }

socket.on('ping', (data) => {
    const clientReceiveTime = Date.now();
    // console.log('Ping received: ', data);
    socket.emit('pong', { serverSendTime: data.serverSendTime, clientReceiveTime, clientId: socket.id });
});

/*socket.on('clientPong', (serverClientSendTime) => {
    const clientSendTime = serverClientSendTime;
    const clientReceiveTime = Date.now();
    const clientRoundTripTime = clientReceiveTime - clientSendTime;
    // console.log('Client Round Trip Time: ', clientRoundTripTime);
    socket.emit('clientRoundTripTime', clientRoundTripTime, socket.id);
});*/

////////////////////////// END TESTING GROUND ////////////////////////////// 