// Campaign Mode - Duelist Kingdom Arc
// Based on Yu-Gi-Oh! Season 1

class CampaignManager {
  constructor(cardDb) {
    this.cardDb = cardDb;
    this.campaignData = this.loadCampaignProgress();
  }

  // Campaign structure - Duelist Kingdom Arc
  getCampaignStructure() {
    return [
      {
        id: 'intro',
        name: 'Prologue: The Invitation',
        description: 'You receive an invitation to Duelist Kingdom...',
        opponent: null,
        isStory: true,
        unlocked: true
      },
      {
        id: 'weevil',
        name: 'Duel 1: Weevil Underwood',
        description: 'Face the insect duelist in the forest!',
        opponent: {
          name: 'Weevil Underwood',
          avatar: '🪲',
          deck: 'insect',
          difficulty: 1,
          dialogue: {
            pre: "Hahaha! You're just another stepping stone to victory! My insects will crush you!",
            win: "No! How could my perfect insects lose?!",
            lose: "As expected! My insects are unbeatable!"
          }
        },
        unlocked: true,
        terrain: 'FOREST'
      },
      {
        id: 'rex',
        name: 'Duel 2: Rex Raptor',
        description: 'Challenge the dinosaur master!',
        opponent: {
          name: 'Rex Raptor',
          avatar: '🦖',
          deck: 'dinosaur',
          difficulty: 1,
          dialogue: {
            pre: "Rawr! My dinosaurs will tear you apart! No one beats Rex Raptor!",
            win: "Impossible! My dinosaurs were supposed to be the strongest!",
            lose: "Hah! My dinosaurs are the kings of the field!"
          }
        },
        unlocked: false,
        terrain: 'WASTELAND'
      },
      {
        id: 'mai',
        name: 'Duel 3: Mai Valentine',
        description: 'Duel the Harpie Lady duelist!',
        opponent: {
          name: 'Mai Valentine',
          avatar: '🦅',
          deck: 'harpie',
          difficulty: 2,
          dialogue: {
            pre: "Let's see if you can handle my Harpie Ladies! They're not just pretty faces!",
            win: "You're stronger than I thought... Well played!",
            lose: "My Harpie Ladies never fail me!"
          }
        },
        unlocked: false,
        terrain: 'MEADOW'
      },
      {
        id: 'mako',
        name: 'Duel 4: Mako Tsunami',
        description: 'Battle on the high seas!',
        opponent: {
          name: 'Mako Tsunami',
          avatar: '🌊',
          deck: 'water',
          difficulty: 2,
          dialogue: {
            pre: "The ocean is my domain! My sea creatures will drag you to the depths!",
            win: "You've bested me on my own turf... Impressive!",
            lose: "The sea always wins in the end!"
          }
        },
        unlocked: false,
        terrain: 'SEA'
      },
      {
        id: 'bandit',
        name: 'Duel 5: Bandit Keith',
        description: 'Face the American duelist!',
        opponent: {
          name: 'Bandit Keith',
          avatar: '🤠',
          deck: 'machine',
          difficulty: 3,
          dialogue: {
            pre: "Time to show you what real dueling is! My machines don't mess around!",
            win: "You got lucky this time, but I'll be back!",
            lose: "That's how a pro does it! Machines rule!"
          }
        },
        unlocked: false,
        terrain: 'NORMAL'
      },
      {
        id: 'pegasus',
        name: 'Final Duel: Maximillion Pegasus',
        description: 'The ultimate challenge! Face the creator of Duel Monsters!',
        opponent: {
          name: 'Maximillion Pegasus',
          avatar: '👁️',
          deck: 'toon',
          difficulty: 5,
          dialogue: {
            pre: "Welcome to my castle! Let's see if you can handle my Toon World!",
            win: "Incredible... You've truly mastered the game I created...",
            lose: "As expected! My Toon monsters are invincible!"
          }
        },
        unlocked: false,
        terrain: 'NORMAL'
      }
    ];
  }

  // Get deck for opponent based on theme (Duelist Kingdom Arc cards)
  getOpponentDeck(opponent) {
    if (!opponent || !opponent.deck) return null;

    const allCards = this.cardDb.cards;
    let deck = [];
    const usedIds = new Set();

    // Helper to add card if not already used
    const addCard = (card) => {
      if (card && !usedIds.has(card.id)) {
        deck.push(card);
        usedIds.add(card.id);
      }
    };

    // Helper to find cards by name (case-insensitive partial match)
    const findCardsByName = (names) => {
      const found = [];
      for (const name of names) {
        const matches = allCards.filter(c => 
          c.name && c.name.toLowerCase().includes(name.toLowerCase())
        );
        matches.forEach(c => {
          if (!usedIds.has(c.id)) {
            found.push(c);
            usedIds.add(c.id);
          }
        });
      }
      return found;
    };

    switch(opponent.deck) {
      case 'insect': // Weevil Underwood - Duelist Kingdom
        // Priority: Specific insect cards from the arc
        const insectPriority = findCardsByName([
          'Great Moth', 'Perfectly Ultimate Great Moth', 'Insect Queen',
          'Cocoon of Evolution', 'Petit Moth', 'Larvae Moth',
          'Hercules Beetle', 'Basic Insect', 'Pinch Hopper'
        ]);
        deck = deck.concat(insectPriority);
        
        // Fill with other insects
        const insects = allCards.filter(c => 
          c.race && c.race.toLowerCase().includes('insect') && !usedIds.has(c.id)
        );
        deck = deck.concat(insects.slice(0, 40 - deck.length));
        break;
        
      case 'dinosaur': // Rex Raptor - Duelist Kingdom
        // Priority: Specific dinosaur cards from the arc
        const dinoPriority = findCardsByName([
          'Two-Headed King Rex', 'Tyranno Infinity', 'Black Tyranno',
          'Ultimate Conductor Tyranno', 'Giant Rex', 'Megalosmasher X',
          'Babycerasaurus', 'Petiteranodon', 'Soul-Eating Oviraptor'
        ]);
        deck = deck.concat(dinoPriority);
        
        // Fill with other dinosaurs
        const dinosaurs = allCards.filter(c => 
          c.race && c.race.toLowerCase().includes('dinosaur') && !usedIds.has(c.id)
        );
        deck = deck.concat(dinosaurs.slice(0, 40 - deck.length));
        break;
        
      case 'harpie': // Mai Valentine - Duelist Kingdom
        // Priority: Harpie cards from the arc
        const harpiePriority = findCardsByName([
          'Harpie Lady', 'Harpie Lady Sisters', 'Harpie Lady 1',
          'Harpie Lady 2', 'Harpie Lady 3', 'Harpie\'s Pet Dragon',
          'Elegant Egotist', 'Harpie\'s Feather Duster', 'Harpie\'s Hunting Ground'
        ]);
        deck = deck.concat(harpiePriority);
        
        // Fill with WIND monsters (especially Winged Beast)
        const windMonsters = allCards.filter(c => 
          c.attr === 'WIND' && 
          (c.race && c.race.toLowerCase().includes('winged beast')) &&
          !usedIds.has(c.id)
        );
        deck = deck.concat(windMonsters.slice(0, 40 - deck.length));
        
        // If still not enough, add any WIND monsters
        if (deck.length < 40) {
          const moreWind = allCards.filter(c => 
            c.attr === 'WIND' && !usedIds.has(c.id)
          );
          deck = deck.concat(moreWind.slice(0, 40 - deck.length));
        }
        break;
        
      case 'water': // Mako Tsunami - Duelist Kingdom
        // Priority: Water/Sea Serpent cards from the arc
        const waterPriority = findCardsByName([
          'Fortress Whale', 'Levia-Dragon - Daedalus', 'The Legendary Fisherman',
          'Amphibian Beast', 'Terrorking Salmon', '7 Colored Fish',
          'Aqua Madoor', 'Water Omotics', 'Tatsunootoshigo'
        ]);
        deck = deck.concat(waterPriority);
        
        // Fill with WATER attribute or Aqua/Fish/Sea Serpent monsters
        const waterMonsters = allCards.filter(c => 
          (c.attr === 'WATER' || 
           (c.race && (c.race.toLowerCase().includes('aqua') || 
                       c.race.toLowerCase().includes('fish') ||
                       c.race.toLowerCase().includes('sea serpent')))) &&
          !usedIds.has(c.id)
        );
        deck = deck.concat(waterMonsters.slice(0, 40 - deck.length));
        break;
        
      case 'machine': // Bandit Keith - Duelist Kingdom
        // Priority: Machine cards from the arc
        const machinePriority = findCardsByName([
          'Slot Machine', 'Barrel Dragon', '7 Completed',
          'Blast Sphere', 'Machine King', 'Perfect Machine King',
          'Cyber-Tech Alligator', 'Machine Conversion Factory', 'Blast Juggler'
        ]);
        deck = deck.concat(machinePriority);
        
        // Fill with other Machine monsters
        const machines = allCards.filter(c => 
          c.race && c.race.toLowerCase().includes('machine') && !usedIds.has(c.id)
        );
        deck = deck.concat(machines.slice(0, 40 - deck.length));
        break;
        
      case 'toon': // Maximillion Pegasus - Duelist Kingdom
        // Priority: Toon cards from the arc
        const toonPriority = findCardsByName([
          'Toon World', 'Toon Summoned Skull', 'Toon Dark Magician',
          'Toon Blue-Eyes White Dragon', 'Toon Mermaid', 'Toon Gemini Elf',
          'Toon Masked Sorcerer', 'Toon Goblin Attack Force', 'Toon Cannon Soldier'
        ]);
        deck = deck.concat(toonPriority);
        
        // Fill with high-level monsters (Pegasus used powerful monsters)
        const highLevel = allCards.filter(c => 
          c.level >= 6 && !usedIds.has(c.id)
        );
        deck = deck.concat(highLevel.slice(0, 40 - deck.length));
        
        // If still not enough, add any monsters
        if (deck.length < 40) {
          const anyMonsters = allCards.filter(c => 
            !usedIds.has(c.id) && c.atk !== undefined
          );
          deck = deck.concat(anyMonsters.slice(0, 40 - deck.length));
        }
        break;
        
      default:
        // Random deck
        deck = allCards.slice(0, 40);
    }

    // Ensure deck has at least 30 cards (add generic monsters if needed)
    if (deck.length < 30) {
      const filler = allCards.filter(c => 
        !usedIds.has(c.id) && c.atk !== undefined
      ).slice(0, 30 - deck.length);
      deck = deck.concat(filler);
    }

    // Shuffle deck
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    return deck.slice(0, 40);
  }

  // Get deck leader for opponent (specific monsters they used in the anime)
  getOpponentDeckLeader(opponent, deck) {
    if (!opponent || !deck || deck.length === 0) return null;

    const allCards = this.cardDb.cards;
    
    // Define specific deck leader monsters for each opponent (from the anime)
    const leaderNames = {
      'insect': [
        'Perfectly Ultimate Great Moth',  // Weevil's ultimate monster
        'Great Moth',                      // Fallback
        'Insect Queen'                     // Alternative
      ],
      'dinosaur': [
        'Two-Headed King Rex',            // Rex's signature monster
        'Tyranno Infinity',               // Fallback
        'Black Tyranno'                   // Alternative
      ],
      'harpie': [
        'Harpie Lady Sisters',            // Mai's signature monster
        'Harpie Lady',                    // Fallback
        'Harpie Lady 1'                   // Alternative
      ],
      'water': [
        'Levia-Dragon - Daedalus',        // Mako's ultimate monster
        'Fortress Whale',                 // Fallback
        'The Legendary Fisherman'         // Alternative
      ],
      'machine': [
        'Barrel Dragon',                  // Keith's signature monster
        'Slot Machine',                   // Fallback
        'Machine King'                   // Alternative
      ],
      'toon': [
        'Toon Summoned Skull',            // Pegasus's signature Toon
        'Toon Dark Magician',             // Fallback
        'Toon Blue-Eyes White Dragon'     // Alternative
      ]
    };

    // Try to find the specific leader monster
    const preferredLeaders = leaderNames[opponent.deck];
    if (preferredLeaders) {
      for (const leaderName of preferredLeaders) {
        // First, check if it's in the deck
        const inDeck = deck.find(card => 
          card && card.name && card.name.toLowerCase().includes(leaderName.toLowerCase())
        );
        if (inDeck) {
          console.log(`[Campaign] Found deck leader in deck: ${inDeck.name}`);
          return inDeck;
        }
        
        // If not in deck, try to find it in the card database
        const fromDb = allCards.find(card => 
          card && card.name && card.name.toLowerCase().includes(leaderName.toLowerCase())
        );
        if (fromDb) {
          console.log(`[Campaign] Found deck leader in database: ${fromDb.name}`);
          return fromDb;
        }
      }
    }

    // Fallback: Find highest level/ATK monster in deck
    console.log('[Campaign] Using fallback: highest level/ATK monster');
    let leader = deck[0];
    for (const card of deck) {
      if (card && card.level && card.atk) {
        if (card.level > leader.level || 
            (card.level === leader.level && card.atk > leader.atk)) {
          leader = card;
        }
      }
    }

    return leader;
  }

  // Load campaign progress
  loadCampaignProgress() {
    try {
      const data = localStorage.getItem('dotr_campaign_progress');
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.warn('Failed to load campaign progress:', e);
    }
    
    // Default progress
    return {
      currentDuel: 'intro',
      completedDuels: [],
      unlockedDuels: ['intro', 'weevil'],
      wins: 0,
      losses: 0
    };
  }

  // Save campaign progress
  saveCampaignProgress() {
    try {
      localStorage.setItem('dotr_campaign_progress', JSON.stringify(this.campaignData));
    } catch (e) {
      console.warn('Failed to save campaign progress:', e);
    }
  }

  // Complete a duel
  completeDuel(duelId, won) {
    if (!this.campaignData.completedDuels.includes(duelId)) {
      this.campaignData.completedDuels.push(duelId);
    }

    if (won) {
      this.campaignData.wins++;
      // Unlock next duel
      this.unlockNextDuel(duelId);
    } else {
      this.campaignData.losses++;
    }

    this.saveCampaignProgress();
  }

  // Unlock next duel after victory
  unlockNextDuel(completedDuelId) {
    const structure = this.getCampaignStructure();
    const currentIndex = structure.findIndex(d => d.id === completedDuelId);
    
    if (currentIndex >= 0 && currentIndex < structure.length - 1) {
      const nextDuel = structure[currentIndex + 1];
      if (!this.campaignData.unlockedDuels.includes(nextDuel.id)) {
        this.campaignData.unlockedDuels.push(nextDuel.id);
      }
    }
  }

  // Check if duel is unlocked
  isDuelUnlocked(duelId) {
    return this.campaignData.unlockedDuels.includes(duelId);
  }

  // Get current duel
  getCurrentDuel() {
    return this.campaignData.currentDuel;
  }

  // Set current duel
  setCurrentDuel(duelId) {
    this.campaignData.currentDuel = duelId;
    this.saveCampaignProgress();
  }

  // Reset campaign
  resetCampaign() {
    this.campaignData = {
      currentDuel: 'intro',
      completedDuels: [],
      unlockedDuels: ['intro', 'weevil'],
      wins: 0,
      losses: 0
    };
    this.saveCampaignProgress();
  }

  // Get campaign statistics
  getStats() {
    return {
      wins: this.campaignData.wins,
      losses: this.campaignData.losses,
      completed: this.campaignData.completedDuels.length,
      total: this.getCampaignStructure().filter(d => !d.isStory).length
    };
  }
}

