import { io } from 'socket.io-client';

const socket = io();

// let clientID: string;
let clientStartTime = Date.now();

// !1
// Send the client's start time to the server upon connection
socket.on('connect', () => {
    socket.emit('clientStartTime', clientStartTime);
    console.log('This Client ID: ', socket.id);
    
    socket.emit('isLeaderboard');
    socket.emit('requestLeaderboard');
});

socket.on('forceReload', () => {
    console.log('Server requested reload');
    window.location.reload();
});

socket.on('sendLeaderboard', (leaderboard) => {
    console.log('Received leaderboard:', leaderboard);

    createLeaderboard(leaderboard);
});

function createLeaderboard(leaderboard: { id: string; score: number }[]) {
    const leaderboardContainer = document.getElementById('leaderboard');
    if (!leaderboardContainer) return;

    leaderboardContainer.innerHTML = ''; // Clear previous content

    leaderboard.forEach((entry) => {
        const listItem = document.createElement('li');

        const playerNameElem = document.createElement('span');
        playerNameElem.textContent = entry.id;
        playerNameElem.classList.add('player-name');
        listItem.appendChild(playerNameElem);

        const scoreElem = document.createElement('span');
        scoreElem.textContent = `${entry.score}`;
        scoreElem.classList.add('score');
        listItem.appendChild(scoreElem);
        leaderboardContainer.appendChild(listItem);
    });
}

// socket.on('leaderboardUpdate', (leaderboard) => {

// });
