import { io } from 'socket.io-client';

const socket = io();

// let clientID: string;
let clientStartTime = Date.now();

// !1
// Send the client's start time to the server upon connection
socket.on('connect', () => {
    socket.emit('clientStartTime', clientStartTime, 'leaderboard');
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
    const ranksContainer = document.getElementById('ranks');
    if (!leaderboardContainer || !ranksContainer) return;

    leaderboardContainer.innerHTML = ''; // Clear previous content
    ranksContainer.innerHTML = ''; // Clear previous content

    let rankCounter = 1;

    leaderboard.forEach((entry) => {
        //create player elements
        const listItem = document.createElement('li');

        const playerNameElem = document.createElement('span');
        playerNameElem.textContent = entry.id.slice(0, 4); // Limit player name to 4 characters
        playerNameElem.classList.add('player-name');
        listItem.appendChild(playerNameElem);

        const scoreElem = document.createElement('span');
        scoreElem.textContent = `${entry.score}`;
        scoreElem.classList.add('score');
        listItem.appendChild(scoreElem);
        leaderboardContainer.appendChild(listItem);

        //create rank elements
        const rankItem = document.createElement('li');
        const rankElem = document.createElement('span');
        rankElem.textContent = rankCounter.toString();
        rankElem.classList.add('rank');
        rankItem.appendChild(rankElem);
        ranksContainer.appendChild(rankItem);
        
        rankCounter++;
    });
}