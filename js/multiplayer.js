/* ========== MULTIPLAYER CLIENT ========== */
/* WebSocket client for online multiplayer */

class MultiplayerClient {
  constructor(gameState, onStateUpdate, onGameStart, onError) {
    this.ws = null;
    this.gameState = gameState;
    this.onStateUpdate = onStateUpdate;
    this.onGameStart = onGameStart;
    this.onError = onError;
    this.roomId = null;
    this.playerId = null;
    this.isHost = false;
    this.connected = false;
    this.onOpponentDeckLeader = null;
    this.pendingOpponentLeader = null; // Queue if received before callback is set
  }
  
  // Set the opponent deck leader callback - also process any pending leader
  setOpponentDeckLeaderCallback(callback) {
    this.onOpponentDeckLeader = callback;
    // If we already received the opponent's leader, process it now
    if (this.pendingOpponentLeader) {
      console.log('[MultiplayerClient] Processing pending opponent deck leader...');
      callback(this.pendingOpponentLeader.leader, this.pendingOpponentLeader.opponentName);
      this.pendingOpponentLeader = null;
    }
  }

  connect(serverUrl, roomId = null, playerId = null) {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(serverUrl);
        let resolved = false;
        
        this.ws.onopen = () => {
          this.connected = true;
          console.log('Connected to multiplayer server');
          
          // Send join/join-room message
          if (roomId && playerId) {
            // Reconnecting to existing room
            this.roomId = roomId;
            this.playerId = playerId;
            this.ws.send(JSON.stringify({
              type: 'rejoin',
              roomId: roomId,
              playerId: playerId
            }));
          } else {
            // New connection - always send fresh join
            this.ws.send(JSON.stringify({
              type: 'join'
            }));
          }
          // Don't resolve yet - wait for 'joined' response
        };

        this.ws.onmessage = (event) => {
          const message = JSON.parse(event.data);
          
          // Handle 'joined' message specially to resolve the connect promise
          if (message.type === 'joined' && !resolved) {
            this.roomId = message.roomId;
            this.playerId = message.playerId;
            this.isHost = message.isHost || false;
            console.log('Joined room:', this.roomId, 'as player:', this.playerId, 'isHost:', this.isHost);
            
            // Store the new playerId in localStorage for future reconnects
            localStorage.setItem('dotr_player_id', this.playerId);
            localStorage.setItem('dotr_room_id', this.roomId);
            
            resolved = true;
            resolve();
          }
          
          this.handleMessage(message);
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          if (this.onError) {
            this.onError('Connection error');
          }
          if (!resolved) {
            resolved = true;
            reject(error);
          }
        };

        this.ws.onclose = () => {
          this.connected = false;
          console.log('Disconnected from server');
          if (this.onError) {
            this.onError('Disconnected from server');
          }
        };

        // Timeout after 10 seconds
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            reject(new Error('Connection timeout - no joined response'));
          }
        }, 10000);
      } catch (error) {
        reject(error);
      }
    });
  }

  handleMessage(message) {
    switch (message.type) {
      case 'joined':
        // Already handled in connect() - just log for debugging
        console.log('[handleMessage] Received joined message (already processed in connect)');
        break;

      case 'gameStart':
        // Game is starting, receive initial state
        // Don't sync state if we already have units (our deck leader is created)
        // Only sync if server state has meaningful data
        if (message.gameState && this.gameState.units.length === 0) {
          console.log('[handleMessage] gameStart - syncing initial state (we have no units yet)');
          this.syncGameState(message.gameState);
        } else if (message.gameState) {
          console.log('[handleMessage] gameStart - skipping state sync (we already have', this.gameState.units.length, 'units)');
        }
        if (this.onGameStart) {
          this.onGameStart(message);
        }
        break;

      case 'stateUpdate':
        // Receive state update from opponent
        // Always sync, but syncGameState now preserves our units
        console.log('[handleMessage] stateUpdate - syncing opponent state');
        this.syncGameState(message.state);
        if (this.onStateUpdate) {
          this.onStateUpdate(message.state);
        }
        break;

      case 'action':
        // Receive action from opponent
        console.log('[handleMessage] Received action from opponent:', message.action?.type, message.action);
        if (message.action) {
          this.handleOpponentAction(message.action);
          // Trigger state update callback to render the changes
          if (this.onStateUpdate) {
            console.log('[handleMessage] Triggering onStateUpdate callback after action');
            this.onStateUpdate(this.gameState);
          } else {
            console.warn('[handleMessage] No onStateUpdate callback registered!');
          }
        } else {
          console.error('[handleMessage] Received action message but action is missing!', message);
        }
        break;

      case 'opponentDeckLeader':
        // Receive opponent's deck leader info
        console.log('[MultiplayerClient] Received opponentDeckLeader message:', message);
        console.log('[MultiplayerClient] onOpponentDeckLeader callback exists:', !!this.onOpponentDeckLeader);
        if (this.onOpponentDeckLeader) {
          console.log('[MultiplayerClient] Calling onOpponentDeckLeader callback...');
          this.onOpponentDeckLeader(message.leader, message.opponentName);
        } else {
          // Queue for later - callback will be set after connect resolves
          console.log('[MultiplayerClient] Callback not set yet, queuing opponent deck leader for later...');
          this.pendingOpponentLeader = {
            leader: message.leader,
            opponentName: message.opponentName
          };
        }
        break;

      case 'error':
        // Don't treat "Unknown message type" as a critical error
        if (message.message && message.message.includes('Unknown message type')) {
          console.log('Server received unknown message type (ignored):', message.message);
        } else {
          console.error('Server error:', message.message);
          if (this.onError) {
            this.onError(message.message);
          }
        }
        break;

      default:
        // Log unknown message types for debugging, but don't treat as error
        console.log('Received message with unknown type:', message.type, message);
    }
  }

  // Send action to server
  sendAction(action) {
    if (!this.connected || !this.ws) {
      console.error('[sendAction] Not connected to server');
      return;
    }

    if (this.ws.readyState !== WebSocket.OPEN) {
      console.error('[sendAction] WebSocket not open, state:', this.ws.readyState);
      return;
    }

    const message = {
      type: 'action',
      roomId: this.roomId,
      playerId: this.playerId,
      action: action
    };
    
    console.log('[sendAction] Sending action:', action.type, 'to server. Room:', this.roomId, 'Player:', this.playerId);
    this.ws.send(JSON.stringify(message));
    console.log('[sendAction] Action sent successfully');
  }

  // Sync game state from server
  syncGameState(serverState) {
    // Update local state with server state
    // Only sync non-local data (opponent's units, LP, etc.)
    // IMPORTANT: Only sync units if server state has meaningful unit data
    // If server state has empty units array, it likely means server doesn't track units
    // In that case, preserve all local units (they were added via actions)
    if (serverState.units !== undefined) {
      // Server sent units data - but if it's empty, preserve local units
      if (Array.isArray(serverState.units) && serverState.units.length === 0) {
        console.log('[syncGameState] Server sent empty units array - preserving all local units');
        // Don't sync units, just preserve what we have
      } else if (Array.isArray(serverState.units) && serverState.units.length > 0) {
      // Merge units - keep local player's units, update opponent's
      // Determine which player we are based on isHost (more reliable than activePlayer)
      const localPlayerId = this.isHost ? 1 : -1;
      const opponentId = this.isHost ? -1 : 1;
      
      console.log('[syncGameState] Syncing units. Local player:', localPlayerId, 'Opponent:', opponentId);
      console.log('[syncGameState] BEFORE - local units:', this.gameState.units.length, this.gameState.units.map(u => ({name: u.card?.name, owner: u.owner, isDeckLeader: u.isDeckLeader})));
      console.log('[syncGameState] Server units:', serverState.units?.length || 0);
      
      // CRITICAL: Preserve ALL our own units (including deck leaders)
      // Also preserve opponent units that we already have locally (they might have been added via actions)
      const ourUnits = this.gameState.units.filter(u => u.owner === localPlayerId);
      const existingOpponentUnits = this.gameState.units.filter(u => u.owner === opponentId);
      
      // CRITICAL: Always preserve deck leaders, even if server state doesn't have them
      const ourDeckLeaders = ourUnits.filter(u => u.isDeckLeader);
      const opponentDeckLeaders = existingOpponentUnits.filter(u => u.isDeckLeader);
      
      console.log('[syncGameState] Our units to preserve:', ourUnits.length, '(deck leaders:', ourDeckLeaders.length, ')');
      console.log('[syncGameState] Existing opponent units:', existingOpponentUnits.length, '(deck leaders:', opponentDeckLeaders.length, ')');
      
      // Start with our units
      this.gameState.units = [...ourUnits];
      
      // Track which opponent units we've processed from server
      const processedOpponentUnits = new Set();
      
      // Merge opponent units: update existing ones, add new ones from server
      if (Array.isArray(serverState.units)) {
        serverState.units.forEach(unitData => {
          if (unitData.owner === opponentId) {
            // Check if we already have this unit (by uid or position for deck leaders)
            const existingUnit = existingOpponentUnits.find(u => {
              if (u.uid && unitData.uid && u.uid === unitData.uid) return true;
              if (u.isDeckLeader && unitData.isDeckLeader && u.x === unitData.x && u.y === unitData.y) return true;
              return false;
            });
            
            if (existingUnit) {
              // Update existing unit
              console.log('[syncGameState] Updating existing opponent unit:', unitData.card?.name);
              existingUnit.card = new Card(unitData.card);
              existingUnit.x = unitData.x;
              existingUnit.y = unitData.y;
              existingUnit.position = unitData.position;
              existingUnit.faceUp = unitData.faceUp;
              existingUnit.hasMoved = unitData.hasMoved;
              existingUnit.hasActed = unitData.hasActed;
              existingUnit.isDeckLeader = unitData.isDeckLeader;
              if (unitData.uid) existingUnit.uid = unitData.uid;
              this.gameState.units.push(existingUnit);
              processedOpponentUnits.add(existingUnit.uid || `${existingUnit.x},${existingUnit.y}`);
            } else {
              // Add new unit from server
              console.log('[syncGameState] Adding new opponent unit from server:', unitData.card?.name);
              const card = new Card(unitData.card);
              const unit = new Unit(card, unitData.owner, unitData.x, unitData.y, unitData.position, unitData.faceUp);
              unit.hasMoved = unitData.hasMoved;
              unit.hasActed = unitData.hasActed;
              unit.isDeckLeader = unitData.isDeckLeader;
              unit.uid = unitData.uid;
              this.gameState.units.push(unit);
              if (unit.uid) processedOpponentUnits.add(unit.uid);
            }
          }
        });
      }
      
      // CRITICAL: Also preserve any opponent units that were added via actions but aren't in server state yet
      // (This can happen if actions are processed before state sync, or if server state is incomplete)
      existingOpponentUnits.forEach(existingUnit => {
        const unitKey = existingUnit.uid || `${existingUnit.x},${existingUnit.y}`;
        if (!processedOpponentUnits.has(unitKey)) {
          console.log('[syncGameState] Preserving opponent unit added via action (not in server state):', existingUnit.card?.name);
          this.gameState.units.push(existingUnit);
        }
      });
      
      console.log('[syncGameState] AFTER - total units:', this.gameState.units.length, this.gameState.units.map(u => ({name: u.card?.name, owner: u.owner, isDeckLeader: u.isDeckLeader})));
      } else {
        // Server sent empty units array - don't sync, preserve all local units
        console.log('[syncGameState] Server sent empty units - preserving all', this.gameState.units.length, 'local units');
      }
    } else {
      // Server didn't send units data at all - preserve local state
      console.log('[syncGameState] Server did not send units data - preserving local state');
    }

    // Update LP - but preserve local LP values since server may have outdated values
    // LP changes are handled via actions (attackDeckLeader), not state sync
    // Only update LP if server state has meaningful changes (not just initial values)
    // For now, we preserve local LP and only sync from actions
    // This prevents LP from resetting when server sends state updates
    console.log('[syncGameState] Preserving local LP values. Local:', {
      player: this.gameState.deckLeaders.player.lp,
      enemy: this.gameState.deckLeaders.enemy.lp
    }, 'Server:', serverState.deckLeaders ? {
      player: serverState.deckLeaders.player?.lp,
      enemy: serverState.deckLeaders.enemy?.lp
    } : 'none');
    // Don't sync LP from server state - LP is managed via actions only

    // Update active player
    if (serverState.activePlayer !== undefined) {
      this.gameState.activePlayer = serverState.activePlayer;
    }

    // Update game over state
    if (serverState.gameOver !== undefined) {
      this.gameState.gameOver = serverState.gameOver;
    }
  }

  // Handle opponent's action
  handleOpponentAction(action) {
    console.log('[handleOpponentAction] Processing action:', action.type, action);
    switch (action.type) {
      case 'summon':
        // Opponent summoned a card
        console.log('[handleOpponentAction] Summoning unit:', action.card.name, 'at', action.x, action.y);
        const summonCard = new Card(action.card);
        const summonUnit = new Unit(summonCard, action.owner, action.x, action.y, action.position, action.faceUp);
        // Use the unitId from action if provided (for consistency)
        if (action.unitId) {
          summonUnit.uid = action.unitId;
        }
        
        // Attach XYZ materials if provided
        if (action.xyzMaterials && Array.isArray(action.xyzMaterials) && action.xyzMaterials.length > 0) {
          summonUnit.xyzMaterials = action.xyzMaterials.map(cardData => new Card(cardData));
          console.log('[handleOpponentAction] XYZ materials attached:', summonUnit.xyzMaterials.length);
        }
        
        this.gameState.units.push(summonUnit);
        console.log('[handleOpponentAction] Unit added. Total units:', this.gameState.units.length);
        break;

      case 'move':
        // Opponent moved a unit
        const moveUnit = this.gameState.units.find(u => u.uid === action.unitId);
        if (moveUnit) {
          moveUnit.x = action.x;
          moveUnit.y = action.y;
          moveUnit.hasMoved = true;
          if (action.positionChange) {
            moveUnit.position = action.newPosition;
          }
        }
        break;

      case 'attack':
        // Opponent attacked - apply combat resolution
        console.log('[handleOpponentAction] Processing attack:', action);
        const attacker = this.gameState.units.find(u => u.uid === action.attackerId);
        const defender = this.gameState.units.find(u => u.uid === action.defenderId);
        
        if (!attacker) {
          console.warn('[handleOpponentAction] Attacker not found:', action.attackerId);
          break;
        }
        
        // Flip defender if it was face-down and got flipped
        if (action.defenderWasFlipped && defender) {
          defender.faceUp = true;
          console.log('[handleOpponentAction] Defender flipped face-up');
        }
        
        // Remove destroyed units FIRST (before moving attacker) and send to graveyard
        if (action.defenderDestroyed && defender) {
          const defenderIndex = this.gameState.units.findIndex(u => u.uid === action.defenderId);
          if (defenderIndex >= 0) {
            // Add to graveyard before removing
            const defenderOwner = defender.owner;
            if (defenderOwner === 1) {
              // Player 1's unit - add to graveyard
              if (!this.gameState.graveyard) this.gameState.graveyard = [];
              this.gameState.graveyard.push(defender.card);
            } else {
              // Player 2's unit - add to enemyGraveyard
              if (!this.gameState.enemyGraveyard) this.gameState.enemyGraveyard = [];
              this.gameState.enemyGraveyard.push(defender.card);
            }
            this.gameState.units.splice(defenderIndex, 1);
            console.log('[handleOpponentAction] Defender destroyed and sent to graveyard');
          }
        }
        
        let attackerStillExists = true;
        if (action.attackerDestroyed) {
          const attackerIndex = this.gameState.units.findIndex(u => u.uid === action.attackerId);
          if (attackerIndex >= 0) {
            // Add to graveyard before removing
            const attackerOwner = attacker.owner;
            if (attackerOwner === 1) {
              // Player 1's unit - add to graveyard
              if (!this.gameState.graveyard) this.gameState.graveyard = [];
              this.gameState.graveyard.push(attacker.card);
            } else {
              // Player 2's unit - add to enemyGraveyard
              if (!this.gameState.enemyGraveyard) this.gameState.enemyGraveyard = [];
              this.gameState.enemyGraveyard.push(attacker.card);
            }
            this.gameState.units.splice(attackerIndex, 1);
            console.log('[handleOpponentAction] Attacker destroyed and sent to graveyard');
            attackerStillExists = false;
          }
        }
        
        // Update attacker position if it moved (only if attacker still exists)
        if (attackerStillExists) {
          // Re-find attacker in case array was modified
          const currentAttacker = this.gameState.units.find(u => u.uid === action.attackerId);
          if (currentAttacker && action.attackerMoved && action.attackerX !== undefined && action.attackerY !== undefined) {
            console.log('[handleOpponentAction] Moving attacker from', currentAttacker.x, currentAttacker.y, 'to', action.attackerX, action.attackerY);
            currentAttacker.x = action.attackerX;
            currentAttacker.y = action.attackerY;
          }
          
          // Mark attacker as having acted
          if (currentAttacker) {
            currentAttacker.hasActed = true;
            currentAttacker.hasMoved = true;
          }
        }
        
        console.log('[handleOpponentAction] Attack complete. Units remaining:', this.gameState.units.length);
        break;

      case 'flip':
        // Opponent flipped a card
        const flipUnit = this.gameState.units.find(u => u.uid === action.unitId);
        if (flipUnit) {
          flipUnit.faceUp = true;
          flipUnit.hasActed = true;
        }
        break;

      case 'togglePosition':
        // Opponent toggled unit position
        const toggleUnit = this.gameState.units.find(u => u.uid === action.unitId);
        if (toggleUnit && action.newPosition) {
          toggleUnit.position = action.newPosition;
          console.log('[handleOpponentAction] Unit position toggled to', action.newPosition);
        }
        break;

      case 'attackDeckLeader':
        // Opponent attacked a deck leader
        console.log('[handleOpponentAction] Processing deck leader attack:', action);
        const leaderOwner = action.leaderOwner;
        const isPlayer1Leader = leaderOwner === 1;
        
        console.log('[handleOpponentAction] attackDeckLeader - isHost:', this.isHost, 'leaderOwner:', leaderOwner, 'isPlayer1Leader:', isPlayer1Leader);
        console.log('[handleOpponentAction] attackDeckLeader - LP before:', {
          player: this.gameState.deckLeaders.player.lp,
          enemy: this.gameState.deckLeaders.enemy.lp
        });
        
        // Update LP based on which leader was attacked
        // LP storage is consistent: player = Player 1's LP, enemy = Player 2's LP
        if (isPlayer1Leader) {
          // Player 1's leader was attacked - update player LP
          this.gameState.deckLeaders.player.lp = action.newLP;
          console.log('[handleOpponentAction] Updated Player 1 LP to', action.newLP);
        } else {
          // Player 2's leader was attacked - update enemy LP
          this.gameState.deckLeaders.enemy.lp = action.newLP;
          console.log('[handleOpponentAction] Updated Player 2 LP to', action.newLP);
        }
        
        console.log('[handleOpponentAction] attackDeckLeader - LP after:', {
          player: this.gameState.deckLeaders.player.lp,
          enemy: this.gameState.deckLeaders.enemy.lp
        });
        
        // Mark attacker as having acted
        const leaderAttacker = this.gameState.units.find(u => u.uid === action.attackerId);
        if (leaderAttacker) {
          leaderAttacker.hasActed = true;
          leaderAttacker.hasMoved = true;
        } else {
          console.warn('[handleOpponentAction] attackDeckLeader - Attacker unit not found:', action.attackerId);
        }
        
        // Handle game over
        if (action.gameOver) {
          this.gameState.gameOver = true;
          console.log('[handleOpponentAction] attackDeckLeader - Game over!');
        }
        break;

      case 'specialSummon':
        // Opponent performed a special summon
        console.log('[handleOpponentAction] Processing special summon:', action.summonType, action.card.name);
        
        // Handle materials based on summon type
        if (action.summonType === 'XYZ' && action.xyzMaterials) {
          // XYZ: Materials become overlays (don't send to graveyard)
          // Store for attachment when unit is created
          if (action.materialIds) {
            action.materialIds.forEach((materialId) => {
              const materialIndex = this.gameState.units.findIndex(u => u.uid === materialId);
              if (materialIndex >= 0) {
                this.gameState.units.splice(materialIndex, 1);
              }
            });
          }
          // XYZ materials will be attached when the summon action is received
        } else {
          // Fusion, Synchro, Link: Materials go to graveyard
          if (action.materialIds && action.materialCards) {
            action.materialIds.forEach((materialId, index) => {
              const materialUnit = this.gameState.units.find(u => u.uid === materialId);
              if (materialUnit) {
                // Send to graveyard
                const materialCard = action.materialCards[index];
                if (materialCard) {
                  const materialOwner = materialCard.owner;
                  if (materialOwner === 1) {
                    if (!this.gameState.graveyard) this.gameState.graveyard = [];
                    this.gameState.graveyard.push(materialCard.card);
                  } else {
                    if (!this.gameState.enemyGraveyard) this.gameState.enemyGraveyard = [];
                    this.gameState.enemyGraveyard.push(materialCard.card);
                  }
                }
                // Remove from field
                const materialIndex = this.gameState.units.findIndex(u => u.uid === materialId);
                if (materialIndex >= 0) {
                  this.gameState.units.splice(materialIndex, 1);
                }
              }
            });
          }
        }
        
        // Remove card from opponent's extra deck
        const opponentExtraDeck = this.isHost ? this.gameState.enemyExtraDeck : this.gameState.extraDeck;
        if (opponentExtraDeck) {
          const cardIndex = opponentExtraDeck.findIndex(c => c.id === action.card.id);
          if (cardIndex >= 0) {
            opponentExtraDeck.splice(cardIndex, 1);
          }
        }
        
        console.log('[handleOpponentAction] Special summon processed. Materials removed, card ready to summon.');
        break;

      case 'endTurn':
        // Opponent ended turn
        const oldActivePlayer = this.gameState.activePlayer;
        this.gameState.activePlayer = this.gameState.activePlayer === 1 ? -1 : 1;
        console.log('[handleOpponentAction] endTurn - Active player changed from', oldActivePlayer, 'to', this.gameState.activePlayer);
        // Reset flags for all units
        this.gameState.units.forEach(u => {
          if (u.owner === this.gameState.activePlayer) {
            u.hasMoved = false;
            u.hasActed = false;
          }
        });
        this.gameState.hasSummoned.player = false;
        this.gameState.hasSummoned.enemy = false;
        break;
    }
  }

  // Serialize game state for sending
  serializeState() {
    return {
      units: this.gameState.units.map(u => ({
        uid: u.uid,
        card: {
          id: u.card.id,
          name: u.card.name,
          atk: u.card.atk,
          def: u.card.def,
          level: u.card.level,
          attribute: u.card.attr,
          race: u.card.race,
          type: u.card.type,
          desc: u.card.desc
        },
        owner: u.owner,
        x: u.x,
        y: u.y,
        position: u.position,
        faceUp: u.faceUp,
        hasMoved: u.hasMoved,
        hasActed: u.hasActed,
        isDeckLeader: u.isDeckLeader
      })),
      deckLeaders: this.gameState.deckLeaders,
      activePlayer: this.gameState.activePlayer,
      gameOver: this.gameState.gameOver,
      terrainMap: this.gameState.terrainMap
    };
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }
}

// Export for use in game
window.MultiplayerClient = MultiplayerClient;

