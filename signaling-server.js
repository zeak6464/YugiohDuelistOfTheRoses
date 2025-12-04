/* ========== P2P SIGNALING SERVER ========== */
/* 
 * This is a minimal WebSocket server that only helps players find each other.
 * Once connected, players communicate directly (P2P) - no game data goes through this server!
 * 
 * To run:
 * 1. Install Node.js and npm
 * 2. Run: npm install ws
 * 3. Run: node signaling-server.js
 * 4. Connect from the game using: ws://localhost:8081
 * 
 * This server is MUCH simpler than a game server because it only:
 * - Helps players exchange WebRTC connection info (offers, answers, ICE candidates)
 * - Doesn't handle any game logic or state
 * - Doesn't validate moves or prevent cheating
 * - Just passes messages between players in the same room
 */

const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8081 });
const rooms = new Map(); // roomId -> { host: ws, peer: ws }

console.log('P2P Signaling server running on ws://localhost:8081');
console.log('This server only helps players connect - all game data is P2P!');

wss.on('connection', (ws) => {
  console.log('New client connected');
  let currentRoom = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      handleMessage(ws, data);
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    if (currentRoom) {
      removeFromRoom(currentRoom, ws);
    }
  });

  function handleMessage(ws, data) {
    switch (data.type) {
      case 'create':
        handleCreate(ws, data);
        break;

      case 'join':
        handleJoin(ws, data);
        break;

      case 'offer':
      case 'answer':
      case 'ice-candidate':
        // Forward WebRTC signaling messages to the other player
        forwardToPeer(data.roomId, ws, data);
        break;

      default:
        console.log('Unknown message type:', data.type);
    }
  }

  function handleCreate(ws, data) {
    const roomId = data.roomId;
    if (rooms.has(roomId)) {
      ws.send(JSON.stringify({ type: 'error', message: 'Room already exists' }));
      return;
    }

    rooms.set(roomId, {
      host: ws,
      peer: null
    });

    currentRoom = roomId;
    console.log(`Room ${roomId} created by host`);

    ws.send(JSON.stringify({
      type: 'created',
      roomId: roomId
    }));
  }

  function handleJoin(ws, data) {
    const roomId = data.roomId;
    const room = rooms.get(roomId);

    if (!room) {
      ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
      return;
    }

    if (room.peer) {
      ws.send(JSON.stringify({ type: 'error', message: 'Room is full' }));
      return;
    }

    room.peer = ws;
    currentRoom = roomId;
    console.log(`Peer joined room ${roomId}`);

    // Notify both players that they're connected
    room.host.send(JSON.stringify({
      type: 'joined',
      roomId: roomId
    }));

    ws.send(JSON.stringify({
      type: 'joined',
      roomId: roomId
    }));

    // Notify both that game can start
    room.host.send(JSON.stringify({
      type: 'gameStart'
    }));

    room.peer.send(JSON.stringify({
      type: 'gameStart'
    }));
  }

  function forwardToPeer(roomId, sender, message) {
    const room = rooms.get(roomId);
    if (!room) return;

    // Find the other player
    const recipient = room.host === sender ? room.peer : 
                      room.peer === sender ? room.host : null;

    if (recipient && recipient.readyState === WebSocket.OPEN) {
      // Forward the message (but remove roomId to avoid confusion)
      const { roomId: _, ...forwardMessage } = message;
      recipient.send(JSON.stringify(forwardMessage));
    }
  }

  function removeFromRoom(roomId, ws) {
    const room = rooms.get(roomId);
    if (!room) return;

    if (room.host === ws) {
      // Host disconnected
      if (room.peer && room.peer.readyState === WebSocket.OPEN) {
        room.peer.send(JSON.stringify({
          type: 'error',
          message: 'Host disconnected'
        }));
      }
      rooms.delete(roomId);
    } else if (room.peer === ws) {
      // Peer disconnected
      room.peer = null;
      if (room.host && room.host.readyState === WebSocket.OPEN) {
        room.host.send(JSON.stringify({
          type: 'error',
          message: 'Peer disconnected'
        }));
      }
    }
  }
});

