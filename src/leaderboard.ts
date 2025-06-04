import { io } from 'socket.io-client';

const socket = io();



// !1
// Send the client's start time to the server upon connection
socket.on('connect', () => {
    console.log('Connected to server');
    
    socket.emit('isLeaderboard');
    socket.emit('requestLeaderboard');
});

socket.on('forceReload', () => {
    console.log('Server requested reload');
    window.location.reload();
});