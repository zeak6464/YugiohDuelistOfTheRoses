/* ========== P2P MULTIPLAYER CLIENT (WebRTC) ========== */
/* Peer-to-peer connection using WebRTC for direct player-to-player communication */

class P2PClient {
  constructor(gameState, onStateUpdate, onGameStart, onError) {
    this.gameState = gameState;
    this.onStateUpdate = onStateUpdate;
    this.onGameStart = onGameStart;
    this.onError = onError;
    
    this.peerConnection = null;
    this.dataChannel = null;
    this.signalingWs = null;
    this.isHost = false;
    this.roomId = null;
    this.playerId = null;
    this.connected = false;
    
    // STUN servers for NAT traversal (free public servers)
    this.iceServers = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };
  }

  // Connect via signaling server (just for initial handshake)
  connect(signalingUrl, roomId = null, playerId = null) {
    return new Promise((resolve, reject) => {
      try {
        this.signalingWs = new WebSocket(signalingUrl);
        this.roomId = roomId || this.generateRoomId();
        this.playerId = playerId || this.generatePlayerId();
        
        this.signalingWs.onopen = () => {
          console.log('Connected to signaling server');
          
          if (roomId && playerId) {
            // Rejoining existing room
            this.signalingWs.send(JSON.stringify({
              type: 'join',
              roomId: this.roomId,
              playerId: this.playerId
            }));
          } else {
            // Creating new room
            this.isHost = true;
            this.signalingWs.send(JSON.stringify({
              type: 'create',
              roomId: this.roomId,
              playerId: this.playerId
            }));
          }
        };

        this.signalingWs.onmessage = (event) => {
          const message = JSON.parse(event.data);
          this.handleSignalingMessage(message);
        };

        this.signalingWs.onerror = (error) => {
          console.error('Signaling error:', error);
          if (this.onError) this.onError('Signaling server error');
          reject(error);
        };

        this.signalingWs.onclose = () => {
          console.log('Disconnected from signaling server');
          this.connected = false;
        };

        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  handleSignalingMessage(message) {
    switch (message.type) {
      case 'created':
        console.log('Room created:', this.roomId);
        // Wait for opponent to join
        break;

      case 'joined':
        console.log('Joined room:', this.roomId);
        // If we're the host, create peer connection
        if (this.isHost) {
          this.createPeerConnection();
        }
        break;

      case 'offer':
        // Received offer from host, create answer
        this.handleOffer(message.offer);
        break;

      case 'answer':
        // Received answer from peer, set remote description
        this.handleAnswer(message.answer);
        break;

      case 'ice-candidate':
        // Received ICE candidate, add to peer connection
        this.handleIceCandidate(message.candidate);
        break;

      case 'gameStart':
        // Game is starting
        if (this.onGameStart) {
          this.onGameStart(message);
        }
        break;

      case 'error':
        console.error('Signaling error:', message.message);
        if (this.onError) {
          this.onError(message.message);
        }
        break;
    }
  }

  // Create peer connection (host side)
  async createPeerConnection() {
    this.peerConnection = new RTCPeerConnection(this.iceServers);
    
    // Create data channel for game communication
    this.dataChannel = this.peerConnection.createDataChannel('game', {
      ordered: true // Ensure messages arrive in order
    });
    
    this.setupDataChannel(this.dataChannel);
    
    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.signalingWs.send(JSON.stringify({
          type: 'ice-candidate',
          roomId: this.roomId,
          candidate: event.candidate
        }));
      }
    };

    // Handle connection state
    this.peerConnection.onconnectionstatechange = () => {
      console.log('Connection state:', this.peerConnection.connectionState);
      if (this.peerConnection.connectionState === 'connected') {
        this.connected = true;
        console.log('P2P connection established!');
      } else if (this.peerConnection.connectionState === 'disconnected' || 
                 this.peerConnection.connectionState === 'failed') {
        this.connected = false;
        if (this.onError) {
          this.onError('P2P connection lost');
        }
      }
    };

    // Create offer
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    
    this.signalingWs.send(JSON.stringify({
      type: 'offer',
      roomId: this.roomId,
      offer: offer
    }));
  }

  // Handle offer from host (peer side)
  async handleOffer(offer) {
    this.peerConnection = new RTCPeerConnection(this.iceServers);
    
    // Handle incoming data channel
    this.peerConnection.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this.setupDataChannel(this.dataChannel);
    };
    
    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.signalingWs.send(JSON.stringify({
          type: 'ice-candidate',
          roomId: this.roomId,
          candidate: event.candidate
        }));
      }
    };

    // Handle connection state
    this.peerConnection.onconnectionstatechange = () => {
      console.log('Connection state:', this.peerConnection.connectionState);
      if (this.peerConnection.connectionState === 'connected') {
        this.connected = true;
        console.log('P2P connection established!');
      } else if (this.peerConnection.connectionState === 'disconnected' || 
                 this.peerConnection.connectionState === 'failed') {
        this.connected = false;
        if (this.onError) {
          this.onError('P2P connection lost');
        }
      }
    };

    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    
    this.signalingWs.send(JSON.stringify({
      type: 'answer',
      roomId: this.roomId,
      answer: answer
    }));
  }

  // Handle answer from peer
  async handleAnswer(answer) {
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  }

  // Handle ICE candidate
  async handleIceCandidate(candidate) {
    if (this.peerConnection) {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  // Setup data channel for game messages
  setupDataChannel(channel) {
    channel.onopen = () => {
      console.log('Data channel opened');
      this.connected = true;
    };

    channel.onclose = () => {
      console.log('Data channel closed');
      this.connected = false;
    };

    channel.onerror = (error) => {
      console.error('Data channel error:', error);
      if (this.onError) {
        this.onError('Data channel error');
      }
    };

    channel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleGameMessage(message);
      } catch (error) {
        console.error('Error parsing game message:', error);
      }
    };
  }

  // Handle game messages from peer
  handleGameMessage(message) {
    switch (message.type) {
      case 'action':
        // Handle opponent's action
        if (this.onStateUpdate) {
          this.onStateUpdate({ action: message.action });
        }
        break;

      case 'stateUpdate':
        // Handle state update
        if (this.onStateUpdate) {
          this.onStateUpdate(message.state);
        }
        break;

      case 'ping':
        // Respond to ping
        this.sendGameMessage({ type: 'pong' });
        break;

      default:
        console.log('Unknown game message type:', message.type);
    }
  }

  // Send action to peer
  sendAction(action) {
    if (!this.connected || !this.dataChannel || this.dataChannel.readyState !== 'open') {
      console.error('Not connected to peer');
      return;
    }

    this.sendGameMessage({
      type: 'action',
      action: action
    });
  }

  // Send game message via data channel
  sendGameMessage(message) {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(JSON.stringify(message));
    }
  }

  // Generate room ID
  generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  // Generate player ID
  generatePlayerId() {
    return Math.random().toString(36).substring(2, 9);
  }

  // Disconnect
  disconnect() {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    if (this.signalingWs) {
      this.signalingWs.close();
      this.signalingWs = null;
    }
    this.connected = false;
  }
}

// Export for use in game
window.P2PClient = P2PClient;

