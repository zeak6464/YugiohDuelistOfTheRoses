/* ========== LOCAL MULTIPLAYER SERVER ========== */
/* 
 * Simple local server for playing on the same machine with 2 browser windows.
 * 
 * To run:
 * 1. Install Node.js and npm
 * 2. Run: npm install ws
 * 3. Run: node local-server.js
 * 4. Open game.html in two browser windows
 * 5. Both connect to: ws://127.0.0.1:8082
 * 
 * This is perfect for local multiplayer - both players can see their own hands!
 */

const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8082, host: '127.0.0.1' });
const rooms = new Map(); // roomId -> { players: [], gameState: null }

console.log('Local Multiplayer Server running on ws://127.0.0.1:8082');
console.log('Open the game in two browser windows and connect!');

wss.on('connection', (ws, req) => {
  console.log('New client connected from', req.socket.remoteAddress);
  let currentRoom = null;
  let playerId = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      handleMessage(ws, data);
    } catch (error) {
      console.error('Error parsing message:', error);
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    if (currentRoom && playerId) {
      removePlayerFromRoom(currentRoom, playerId);
    }
  });

  function handleMessage(ws, data) {
    switch (data.type) {
      case 'join':
      case 'rejoin':
        // Treat rejoin the same as join for local server
        handleJoin(ws, data);
        break;

      case 'action':
        handleAction(ws, data);
        break;

      default:
        // Log unknown message types for debugging but don't send error to client
        console.log('Received unknown message type:', data.type);
        // Don't send error - just ignore it
    }
  }

  function handleJoin(ws, data) {
    // Find or create a room
    let room = null;
    for (const [roomId, roomData] of rooms.entries()) {
      if (roomData.players.length < 2) {
        room = roomId;
        break;
      }
    }

    if (!room) {
      // Create new room
      room = 'LOCAL' + Math.random().toString(36).substring(2, 6).toUpperCase();
      rooms.set(room, {
        players: [],
        gameState: null
      });
    }

    const roomData = rooms.get(room);
    playerId = generatePlayerId();
    const isHost = roomData.players.length === 0;

    roomData.players.push({
      id: playerId,
      ws: ws,
      name: data.playerName || `Player ${roomData.players.length + 1}`
    });

    currentRoom = room;

    ws.send(JSON.stringify({
      type: 'joined',
      roomId: room,
      playerId: playerId,
      isHost: isHost
    }));

    console.log(`Player ${playerId} joined room ${room} (${roomData.players.length}/2)`);

    // If room is full, start the game
    if (roomData.players.length === 2) {
      startGame(room);
    }
  }

  function handleAction(ws, data) {
    if (!currentRoom) {
      ws.send(JSON.stringify({ type: 'error', message: 'Not in a room' }));
      return;
    }

    const roomData = rooms.get(currentRoom);
    if (!roomData) {
      ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
      return;
    }

    // Handle deck leader registration
    console.log('Received action:', data.action?.type, 'from player:', data.playerId);
    if (data.action && data.action.type === 'registerDeckLeader') {
      console.log('Processing registerDeckLeader for player:', data.playerId);
      console.log('Room players:', roomData.players.map(p => ({ id: p.id, hasDeckLeader: !!p.deckLeader })));
      const playerIndex = roomData.players.findIndex(p => p.id === data.playerId);
      console.log('Found player at index:', playerIndex);
      if (playerIndex >= 0) {
        roomData.players[playerIndex].deckLeader = data.action.leader;
        console.log(`Player ${playerIndex + 1} registered deck leader: ${data.action.leader.name}`);
        
        // Check if both players have registered their deck leaders
        const bothReady = roomData.players.every(p => p.deckLeader);
        console.log('Both ready?', bothReady, 'Player count:', roomData.players.length);
        if (bothReady && roomData.players.length === 2) {
          console.log('Both players ready! Sending deck leader info...');
          
          // Send each player the opponent's deck leader
          roomData.players.forEach((player, idx) => {
            const opponentIdx = idx === 0 ? 1 : 0;
            const opponentLeader = roomData.players[opponentIdx].deckLeader;
            
            console.log(`Sending opponent deck leader to player ${idx + 1}:`, opponentLeader.name);
            if (player.ws.readyState === WebSocket.OPEN) {
              player.ws.send(JSON.stringify({
                type: 'opponentDeckLeader',
                leader: opponentLeader,
                opponentName: roomData.players[opponentIdx].name
              }));
            } else {
              console.log(`Player ${idx + 1} websocket not open, state:`, player.ws.readyState);
            }
          });
        }
      } else {
        console.log('ERROR: Player not found in room! PlayerId:', data.playerId);
      }
      return;
    }

    if (roomData.players.length < 2) {
      ws.send(JSON.stringify({ type: 'error', message: 'Waiting for opponent' }));
      return;
    }

    // Broadcast action to other player
    const otherPlayer = roomData.players.find(p => p.id !== data.playerId);
    console.log(`[handleAction] Broadcasting ${data.action.type} action. Other player found:`, !!otherPlayer);
    if (otherPlayer) {
      console.log(`[handleAction] Other player websocket state:`, otherPlayer.ws.readyState, '(OPEN =', WebSocket.OPEN, ')');
      if (otherPlayer.ws.readyState === WebSocket.OPEN) {
        console.log(`[handleAction] Sending action to player ${otherPlayer.id}`);
        otherPlayer.ws.send(JSON.stringify({
          type: 'action',
          action: data.action
        }));
        console.log(`[handleAction] Action sent successfully`);
      } else {
        console.log(`[handleAction] ERROR: Other player websocket not open!`);
      }
    } else {
      console.log(`[handleAction] ERROR: Other player not found! Room has ${roomData.players.length} players`);
      console.log(`[handleAction] Room players:`, roomData.players.map(p => p.id));
      console.log(`[handleAction] Looking for player that is NOT:`, data.playerId);
    }

    // Update game state if needed
    if (data.action && data.action.type === 'endTurn') {
      // Update active player in game state
      if (roomData.gameState) {
        roomData.gameState.activePlayer = roomData.gameState.activePlayer === 1 ? -1 : 1;
        
        // Broadcast state update
        broadcastToRoom(currentRoom, {
          type: 'stateUpdate',
          state: roomData.gameState
        });
      }
    }
  }

  function startGame(room) {
    const roomData = rooms.get(room);
    console.log(`Starting game in room ${room}`);

    // Initialize game state
    roomData.gameState = {
      activePlayer: 1, // Player 1 goes first
      units: [],
      deckLeaders: {
        player: { x: 3, y: 6, lp: 8000 },
        enemy: { x: 3, y: 0, lp: 8000 }
      },
      gameOver: false,
      terrainMap: null // Will be set by clients
    };

    // Notify both players
    broadcastToRoom(room, {
      type: 'gameStart',
      gameState: roomData.gameState
    });
  }

  function broadcastToRoom(roomId, message) {
    const roomData = rooms.get(roomId);
    if (!roomData) return;

    roomData.players.forEach(player => {
      if (player.ws.readyState === WebSocket.OPEN) {
        player.ws.send(JSON.stringify(message));
      }
    });
  }

  function removePlayerFromRoom(roomId, playerId) {
    const roomData = rooms.get(roomId);
    if (!roomData) return;

    roomData.players = roomData.players.filter(p => p.id !== playerId);
    
    if (roomData.players.length === 0) {
      rooms.delete(roomId);
      console.log(`Room ${roomId} deleted (empty)`);
    } else {
      // Notify remaining player
      const remainingPlayer = roomData.players[0];
      if (remainingPlayer.ws.readyState === WebSocket.OPEN) {
        remainingPlayer.ws.send(JSON.stringify({
          type: 'error',
          message: 'Opponent disconnected'
        }));
      }
    }
  }
});

function generatePlayerId() {
  return Math.random().toString(36).substring(2, 9);
}

