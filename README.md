# WebXRBabylonIO

# About

This project is about the development of a co-located multiplayer VR-Game using webXR.
The server runs with Socket.IO and the 3D-Representation is done in Babylonjs.

# Installation

## Prerequisites

You must have Node.js and git Bash installed, to run the project.
Node.js is requiered to run the server and git Bash ist used to create the ssl certrificates needed for https.
The Setup is only tested on Windows 10 and 11.

## Set up

Clone the git repository

```bash
git clone https://github.com/felixChB/WebXRBabylonIO.git
```
### Create ssl certificates and keys for https

1. create a folder called sslcerts in the main folder (WebXRBabylonIO) of the repository
2. open git bash
3. in git bash navigate to the main folder
4. to create the self-signed certificate and key, run the following command:
```bash
openssl req -x509 -sha256 -nodes -days 365 -newkey rsa:2048 -keyout sslcerts/selfsigned.key -out sslcerts/selfsigned.cert
```

### Install dependencies

Open the main folder of the repository in a coding software (e.x. Visual Studio Code) and open the terminal.
To install all required dependencies, type:
```bash
npm install
```
It should create a folder called node_modules with all dependencies.

## Starting the Server

To start the application, the `ipAdress` variable in the `server.js` file has to be changed to your individual ip adress.
Type the following in the terminal to build the bundle.js file:
```bash
npm run build
```
After that type the following to start the server and the application:
```bash
npm run dev
```
This will start the https server on your ip Adress on port 3000.
It will also start webpack in watch mode and nodemon to watch for file changes and pack and restart the server accordingly.

## Playing and Testing


### As a player
To join the server and play, open an internet browser on your XR-device.
Type the following and replace `ipAdress` with your server ip adress:
```bash
https://ipAdress:3000
```
As a player you can select one of 4 positions or the position 0 if you want to spawn outside of a play position.
With the selection you will be placed in the AR scene and now can join the game and play.


### As an operator
To join the server as an operator, type on the desktop browser, which is hosting the server:
```bash
https://ipAdress:3000/monitor.html
```
As an operator you will see the game and all connected clients and players.
You can perform actions to observe the game and collect data:
- toggle interface (toggle the interface to see the play area and move it around)
- reset camera position (reset the camera position of the game view to default)
- clear server arrays (clear all performance test arrays of the server)
- collect tests (collect all performance test from the palyers and the server and write them to the files)

You can perform different actions for the other connected clients:
- force reload (force a specific client to reload his webpage)
- disconnect (Disconnect a client from the server)

You can perform actions for clients, which are playing (players):
- join (if a client is in an empty player position, you join him to the game through this position)
- kick (kick the player out of the game)
- reload (force the player to reload his webpage)
- clear array (clear the specific performance test array of this player)