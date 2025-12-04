/* ========== MULTIPLAYER SERVER EXAMPLE ========== */
/* 
 * This is a basic Node.js WebSocket server example.
 * 
 * To run:
 * 1. Install Node.js and npm
 * 2. Run: npm install ws
 * 3. Run: node server-example.js
 * 4. Connect from the game using: ws://localhost:8080
 */

const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });
const rooms = new Map(); // roomId -> { players: [], gameState: null }

console.log('Multiplayer server running on ws://localhost:8080');

wss.on('connection', (ws) => {
  console.log('New client connected');
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
        handleJoin(ws, data);
        break;

      case 'rejoin':
        handleRejoin(ws, data);
        break;

      case 'action':
        handleAction(ws, data);
        break;

      default:
        ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
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
      room = generateRoomId();
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
      name: data.playerName || 'Player'
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

  function handleRejoin(ws, data) {
    const room = data.roomId;
    const roomData = rooms.get(room);

    if (!roomData) {
      ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
      return;
    }

    // Find existing player or add new
    let player = roomData.players.find(p => p.id === data.playerId);
    if (!player) {
      playerId = data.playerId;
      player = {
        id: playerId,
        ws: ws,
        name: 'Player'
      };
      roomData.players.push(player);
    } else {
      player.ws = ws; // Update WebSocket connection
    }

    currentRoom = room;

    ws.send(JSON.stringify({
      type: 'joined',
      roomId: room,
      playerId: playerId,
      isHost: roomData.players[0].id === playerId
    }));

    // If game already started, send current state
    if (roomData.gameState) {
      ws.send(JSON.stringify({
        type: 'gameStart',
        gameState: roomData.gameState
      }));
    }
  }

  function handleAction(ws, data) {
    if (!currentRoom) {
      ws.send(JSON.stringify({ type: 'error', message: 'Not in a room' }));
      return;
    }

    const roomData = rooms.get(currentRoom);
    if (!roomData || roomData.players.length < 2) {
      ws.send(JSON.stringify({ type: 'error', message: 'Room not ready' }));
      return;
    }

    // Broadcast action to other player
    const otherPlayer = roomData.players.find(p => p.id !== data.playerId);
    if (otherPlayer && otherPlayer.ws.readyState === WebSocket.OPEN) {
      otherPlayer.ws.send(JSON.stringify({
        type: 'action',
        action: data.action
      }));
    }

    // Update game state if needed
    if (data.action.type === 'endTurn') {
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

    // Initialize game state (simplified - in real implementation, 
    // you'd want to sync decks, terrain, etc. from clients)
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

function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function generatePlayerId() {
  return Math.random().toString(36).substring(2, 9);
}

