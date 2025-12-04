# Multiplayer Guide

## Overview

The game supports multiple modes:
1. **Single Player** - Play against AI
2. **Local Network Multiplayer** - Two browser windows on the same machine (BEST for local play!)
3. **Local Multiplayer (Hotseat)** - Two players take turns on the same device
4. **Online Multiplayer** - Play against other players over the internet via WebSocket
5. **P2P Multiplayer** - Peer-to-peer connection (recommended for online)

## Local Network Multiplayer (Same Machine, Two Windows) ⭐ RECOMMENDED FOR LOCAL PLAY

**Best option for playing on the same computer!** Each player gets their own browser window and can see their own hand.

### Setup:

1. **Start the local server:**
   ```bash
   npm install ws
   node local-server.js
   ```
   The server will run on `ws://127.0.0.1:8082`

2. **Open the game in two browser windows/tabs:**
   - Window 1: Open `game.html` or go to Multiplayer
   - Window 2: Open `game.html` or go to Multiplayer

3. **Connect both windows:**
   - In both windows, go to **Multiplayer**
   - Click **"Connect to Local Server"**
   - Enter your name in each window
   - The first window will wait, the second window will start the game automatically

4. **Play!** Each player sees their own hand and can play simultaneously.

## Local Multiplayer (Hotseat)

The simplest way to play - no server needed, but players must take turns.

1. Go to **Multiplayer** from the main menu
2. Click **"Start Local Game"**
3. Players take turns on the same device
4. The game will indicate whose turn it is

## Online Multiplayer

### Quick Start (Using Example Server)

1. **Install Node.js** (if not already installed)
   - Download from https://nodejs.org/

2. **Install WebSocket library**
   ```bash
   npm install ws
   ```

3. **Start the server**
   ```bash
   node server-example.js
   ```
   The server will run on `ws://localhost:8080`

4. **Connect from the game**
   - Go to **Multiplayer** from the main menu
   - Enter server URL: `ws://localhost:8080`
   - Enter your name
   - Click **Connect**
   - Wait for an opponent to join
   - The game will start automatically when 2 players are connected

### How It Works

- **Room System**: Players are automatically matched into rooms (2 players per room)
- **Room Code**: Each room gets a unique code that you can share with friends
- **Reconnection**: If you disconnect, you can reconnect using the room code

### Server Architecture

The example server (`server-example.js`) is a basic implementation that:
- Manages WebSocket connections
- Creates and manages game rooms
- Broadcasts actions between players
- Handles player disconnections

### Production Server Considerations

For a production server, you'll want to:
- Add authentication/authorization
- Implement proper game state validation
- Add rate limiting
- Use a proper database for persistent rooms
- Add SSL/TLS (wss://) for secure connections
- Implement anti-cheat measures
- Add matchmaking/queue system
- Handle reconnection more robustly

### Message Protocol

The client and server communicate using JSON messages:

**Client → Server:**
- `{ type: 'join', playerName: '...' }` - Join a room
- `{ type: 'rejoin', roomId: '...', playerId: '...' }` - Reconnect to room
- `{ type: 'action', roomId: '...', playerId: '...', action: {...} }` - Send game action

**Server → Client:**
- `{ type: 'joined', roomId: '...', playerId: '...', isHost: true/false }` - Joined room
- `{ type: 'gameStart', gameState: {...} }` - Game starting
- `{ type: 'action', action: {...} }` - Opponent's action
- `{ type: 'stateUpdate', state: {...} }` - Game state update
- `{ type: 'error', message: '...' }` - Error occurred

### Game Actions

Actions sent from client:
- `{ type: 'summon', card: {...}, x: 3, y: 4, position: 'ATK', faceUp: true }`
- `{ type: 'move', unitId: '...', x: 3, y: 4 }`
- `{ type: 'attack', attackerId: '...', defenderId: '...' }`
- `{ type: 'flip', unitId: '...' }`
- `{ type: 'endTurn' }`

## Troubleshooting

**"Connection error. Is the server running?"**
- Make sure the server is running
- Check that the server URL is correct
- For localhost, use `ws://localhost:8080`
- For remote servers, use `wss://your-server.com` (secure) or `ws://your-server.com`

**"Not your turn!"**
- Wait for your opponent to finish their turn
- The turn indicator shows whose turn it is

**"Disconnected from server"**
- Check your internet connection
- The server may have crashed or restarted
- Try reconnecting using the room code

## Future Enhancements

Potential improvements:
- Spectator mode
- Replay system
- Tournament brackets
- Chat system
- Friend lists
- Custom game settings (LP, starting hand size, etc.)
- Deck validation/sharing
- Ranked matchmaking

