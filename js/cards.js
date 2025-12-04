/* ========== DUELIST OF THE ROSES - CARD DATABASE ========== */
/* Uses YGOPRODeck API: https://ygoprodeck.com/api-guide/ */

const API_BASE = 'https://db.ygoprodeck.com/api/v7/cardinfo.php';
const PICS_PATH = '../pics/';

// Storage keys
const STORAGE_CARDS = 'dotr_cards_cache';
const STORAGE_DECK = 'dotr_player_deck';
const STORAGE_CACHE_TIME = 'dotr_cache_time';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

/* ========== TERRAIN SYSTEM (from Duelist of the Roses) ========== */
const TERRAIN = {
  NORMAL: {
    name: 'Normal',
    image: 'https://ms.yugipedia.com/f/f2/DOR-NormalSquare-Textures.png',
    color: '#8b8b8b',
    advantage: [],
    disadvantage: [],
    effect: 'No terrain effect.'
  },
  FOREST: {
    name: 'Forest',
    image: 'https://ms.yugipedia.com/4/4f/DOR-ForestSquare-Textures.png',
    color: '#1a5c1a',
    advantage: ['Plant', 'Beast', 'Beast-Warrior', 'Insect', 'Pyro'],
    disadvantage: ['Fiend'],
    effect: '+500 ATK/DEF for Plant, Beast, Beast-Warrior, Insect, Pyro. -500 for Fiend.'
  },
  WASTELAND: {
    name: 'Wasteland',
    image: 'https://ms.yugipedia.com/6/60/DOR-WastelandSquare-Textures.png',
    color: '#8b6914',
    advantage: ['Rock', 'Dinosaur', 'Zombie', 'Machine'],
    disadvantage: ['Aqua', 'Plant', 'Sea Serpent', 'Fish'],
    effect: '+500 ATK/DEF for Rock, Dinosaur, Zombie, Machine. -500 for Aqua, Plant, Sea Serpent, Fish.'
  },
  MOUNTAIN: {
    name: 'Mountain',
    image: 'https://ms.yugipedia.com/4/4a/DOR-MountainSquare-Textures.png',
    color: '#6b4423',
    advantage: ['Fairy', 'Dragon', 'Thunder', 'Winged Beast'],
    disadvantage: ['Zombie'],
    effect: '+500 ATK/DEF for Fairy, Dragon, Thunder, Winged Beast. -500 for Zombie.'
  },
  MEADOW: {
    name: 'Meadow',
    image: 'https://ms.yugipedia.com/6/6a/DOR-MeadowSquare-Textures.png',
    color: '#3d7a3d',
    advantage: ['Warrior', 'Beast-Warrior'],
    disadvantage: ['Spellcaster'],
    effect: '+500 ATK/DEF for Warrior, Beast-Warrior. -500 for Spellcaster.'
  },
  SEA: {
    name: 'Sea',
    image: 'https://ms.yugipedia.com/9/98/DOR-SeaSquare-Textures.png',
    color: '#1a4a6b',
    advantage: ['Aqua', 'Thunder', 'Fish', 'Sea Serpent'],
    disadvantage: ['Pyro', 'Machine'],
    effect: '+500 ATK/DEF for Aqua, Thunder, Fish, Sea Serpent. -500 for Pyro, Machine.'
  },
  DARK: {
    name: 'Dark',
    image: 'https://ms.yugipedia.com/e/ee/DOR-DarkSquare-Textures.png',
    color: '#2a1a3a',
    advantage: ['Spellcaster', 'Fiend', 'Zombie'],
    disadvantage: ['Fairy'],
    effect: '+500 ATK/DEF for Spellcaster, Fiend, Zombie. -500 for Fairy.'
  },
  TOON: {
    name: 'Toon',
    image: 'https://ms.yugipedia.com/6/68/DOR-ToonSquare-Textures.png',
    color: '#c44bc4',
    advantage: ['Toon'],
    disadvantage: ['ALL'],
    effect: '+500 ATK/DEF for Toon monsters. -500 for all others.'
  },
  LABYRINTH: {
    name: 'Labyrinth',
    image: 'https://ms.yugipedia.com/8/8a/DOR-LabyrinthSquare-Textures.png',
    color: '#4a4a5a',
    advantage: [],
    disadvantage: [],
    effect: 'Cards cannot move into or be placed on this terrain.',
    impassable: true
  },
  CRUSH: {
    name: 'Crush',
    image: 'https://ms.yugipedia.com/9/9b/DOR-CrushSquare-Textures.png',
    color: '#6b1a1a',
    advantage: ['Divine-Beast'],
    disadvantage: [],
    effect: 'Monsters with 1500+ ATK are destroyed when entering. Divine-Beast gains +500.',
    crushEffect: true
  }
};

// Get terrain bonus for a card on a specific terrain
function getTerrainBonus(card, terrainType) {
  const terrain = TERRAIN[terrainType];
  if (!terrain) return { atk: 0, def: 0, movBonus: false };
  
  const race = card.race;
  const name = card.name || '';
  
  // Check for Toon terrain special case
  if (terrainType === 'TOON') {
    const isToon = name.toLowerCase().includes('toon');
    if (isToon) {
      return { atk: 500, def: 500, movBonus: true };
    } else {
      return { atk: -500, def: -500, movBonus: false };
    }
  }
  
  // Check advantage
  if (terrain.advantage.some(r => r.toLowerCase() === race.toLowerCase())) {
    return { atk: 500, def: 500, movBonus: true };
  }
  
  // Check disadvantage
  if (terrain.disadvantage.some(r => r.toLowerCase() === race.toLowerCase())) {
    return { atk: -500, def: -500, movBonus: false };
  }
  
  return { atk: 0, def: 0, movBonus: false };
}

// Check if terrain is passable for a unit
function canEnterTerrain(card, terrainType) {
  const terrain = TERRAIN[terrainType];
  if (!terrain) return true;
  
  // Labyrinth blocks movement - only monsters with "Labyrinth" in name can enter
  if (terrain.impassable) {
    const cardName = (card.name || '').toLowerCase();
    if (cardName.includes('labyrinth')) {
      return true; // Allow entry
    }
    return false; // Block entry
  }
  
  // Crush terrain destroys high ATK monsters
  if (terrain.crushEffect && card.atk >= 1500) {
    // Divine-Beast type is immune
    if (card.race === 'Divine-Beast') return true;
    return 'DESTROY'; // Signal to destroy the unit
  }
  
  return true;
}

// Export terrain for use elsewhere
window.TERRAIN = TERRAIN;
window.getTerrainBonus = getTerrainBonus;
window.canEnterTerrain = canEnterTerrain;

/* ========== CARD CLASS ========== */
class Card {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.atk = data.atk || 0;
    this.def = data.def || 0;
    this.level = data.level || 0;
    this.attr = (data.attribute || 'DARK').toUpperCase();
    this.race = data.race || 'Unknown';
    this.type = data.type || 'Monster';
    this.desc = data.desc || '';
    // Movement based on level (lower level = more mobile)
    this.mov = this.level <= 3 ? 3 : this.level <= 5 ? 2 : this.level <= 7 ? 2 : 1;
  }
  
  getImgPath() {
    return PICS_PATH + this.id + '.jpg';
  }
  
  getApiImgPath() {
    return `https://images.ygoprodeck.com/images/cards_cropped/${this.id}.jpg`;
  }
  
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      atk: this.atk,
      def: this.def,
      level: this.level,
      attribute: this.attr,
      race: this.race,
      type: this.type,
      desc: this.desc
    };
  }
}

/* ========== CARD DATABASE ========== */
class CardDatabase {
  constructor() {
    this.cards = [];
    this.cardMap = new Map();
    this.images = {};
    this.loaded = false;
  }
  
  async load(onStatus) {
    // Check cache first
    const cachedCards = this.loadFromCache();
    if (cachedCards) {
      if (onStatus) onStatus('Loading cards from cache...');
      this.cards = cachedCards.map(c => new Card(c));
      this.buildCardMap();
      this.loaded = true;
      return this.cards;
    }
    
    // Fetch from API
    if (onStatus) onStatus('Fetching cards from YGOPRODeck API...');
    
    try {
      // Fetch ALL monster types from the API
      // Using multiple queries to get different monster types
      const queries = [
        // Normal Monsters (all levels)
        `${API_BASE}?type=Normal%20Monster`,
        // Effect Monsters (all levels)
        `${API_BASE}?type=Effect%20Monster`,
        // Fusion Monsters
        `${API_BASE}?type=Fusion%20Monster`,
        // Synchro Monsters
        `${API_BASE}?type=Synchro%20Monster`,
        // XYZ Monsters
        `${API_BASE}?type=XYZ%20Monster`,
        // Link Monsters
        `${API_BASE}?type=Link%20Monster`,
        // Ritual Monsters
        `${API_BASE}?type=Ritual%20Monster`,
        // Pendulum Monsters (Normal Pendulum)
        `${API_BASE}?type=Pendulum%20Normal%20Monster`,
        // Pendulum Effect Monsters
        `${API_BASE}?type=Pendulum%20Effect%20Monster`,
        // Pendulum Fusion Monsters
        `${API_BASE}?type=Pendulum%20Effect%20Fusion%20Monster`,
        // Pendulum Synchro Monsters
        `${API_BASE}?type=Pendulum%20Effect%20Synchro%20Monster`,
        // Pendulum XYZ Monsters
        `${API_BASE}?type=Pendulum%20Effect%20XYZ%20Monster`,
        // Pendulum Link Monsters
        `${API_BASE}?type=Pendulum%20Effect%20Link%20Monster`,
      ];
      
      const allCards = [];
      
      for (let i = 0; i < queries.length; i++) {
        if (onStatus) onStatus(`Fetching cards... (${i + 1}/${queries.length})`);
        try {
          const response = await fetch(queries[i]);
          if (response.ok) {
            const data = await response.json();
            if (data.data) {
              // Filter to only include cards with valid ATK (monsters)
              // Link monsters don't have DEF, so we only require ATK
              const validMonsters = data.data.filter(card => {
                if (!card.type || !card.type.toLowerCase().includes('monster')) return false;
                if (card.atk === undefined || isNaN(card.atk)) return false;
                
                // Link monsters don't have DEF, others need valid DEF
                const isLink = card.type.toLowerCase().includes('link');
                if (isLink) {
                  return true; // Link monsters only need ATK
                }
                // Other monsters need both ATK and DEF
                return card.def !== undefined && !isNaN(card.def);
              });
              allCards.push(...validMonsters);
              console.log(`[CardDatabase] Fetched ${validMonsters.length} cards from query ${i + 1}`);
            }
          } else {
            console.warn(`[CardDatabase] Query ${i + 1} failed with status:`, response.status);
          }
        } catch (e) {
          console.warn('[CardDatabase] Query failed:', queries[i], e);
        }
        // Rate limiting - wait between requests
        await new Promise(r => setTimeout(r, 200));
      }
      
      console.log(`[CardDatabase] Total cards fetched: ${allCards.length}`);
      
      // Remove duplicates
      const seenIds = new Set();
      for (const card of allCards) {
        if (!seenIds.has(card.id) && card.atk !== undefined && card.def !== undefined) {
          seenIds.add(card.id);
          this.cards.push(new Card(card));
        }
      }
      
      // Cache the results
      this.saveToCache();
      this.buildCardMap();
      this.loaded = true;
      
      if (onStatus) onStatus(`Loaded ${this.cards.length} cards!`);
      return this.cards;
      
    } catch (error) {
      console.error('API Error:', error);
      if (onStatus) onStatus('API failed, using fallback cards...');
      this.cards = this.getFallbackCards();
      this.buildCardMap();
      this.loaded = true;
      return this.cards;
    }
  }
  
  buildCardMap() {
    this.cardMap.clear();
    for (const card of this.cards) {
      this.cardMap.set(card.id, card);
    }
  }
  
  getById(id) {
    return this.cardMap.get(id);
  }
  
  search(query, filters = {}) {
    let results = [...this.cards];
    
    // Text search
    if (query) {
      const q = query.toLowerCase();
      results = results.filter(c => 
        c.name.toLowerCase().includes(q) ||
        c.desc.toLowerCase().includes(q)
      );
    }
    
    // Attribute filter
    if (filters.attr) {
      results = results.filter(c => c.attr === filters.attr);
    }
    
    // Level filter
    if (filters.level) {
      results = results.filter(c => c.level === filters.level);
    }
    
    // Race/Type filter
    if (filters.race) {
      results = results.filter(c => c.race === filters.race);
    }
    
    // Type filter (Fusion, Synchro, XYZ, Link, etc.)
    if (filters.type) {
      results = results.filter(c => {
        if (!c.type) return false;
        const cardType = c.type.toLowerCase();
        const filterType = filters.type.toLowerCase();
        
        // Handle specific type matches
        if (filterType === 'fusion') {
          return cardType.includes('fusion');
        } else if (filterType === 'synchro') {
          return cardType.includes('synchro');
        } else if (filterType === 'xyz') {
          return cardType.includes('xyz');
        } else if (filterType === 'link') {
          return cardType.includes('link');
        } else if (filterType === 'ritual') {
          return cardType.includes('ritual');
        } else if (filterType === 'pendulum') {
          return cardType.includes('pendulum');
        } else if (filterType === 'tuner') {
          // Tuner is in the race field, not type
          return c.race && c.race.toLowerCase().includes('tuner');
        } else if (filterType === 'normal') {
          return cardType.includes('normal') && !cardType.includes('effect');
        } else if (filterType === 'effect') {
          return cardType.includes('effect') && !cardType.includes('normal');
        } else {
          // Generic type match
          return cardType.includes(filterType);
        }
      });
    }
    
    return results;
  }
  
  getImage(card) {
    if (!this.images[card.id]) {
      const img = new Image();
      img.src = card.getImgPath();
      img.onerror = () => { img.src = card.getApiImgPath(); };
      this.images[card.id] = img;
    }
    return this.images[card.id];
  }
  
  loadFromCache() {
    try {
      const cacheTime = localStorage.getItem(STORAGE_CACHE_TIME);
      if (cacheTime && Date.now() - parseInt(cacheTime) < CACHE_DURATION) {
        const data = localStorage.getItem(STORAGE_CARDS);
        if (data) {
          return JSON.parse(data);
        }
      }
    } catch (e) {
      console.warn('Cache load failed:', e);
    }
    return null;
  }
  
  saveToCache() {
    try {
      localStorage.setItem(STORAGE_CARDS, JSON.stringify(this.cards.map(c => c.toJSON())));
      localStorage.setItem(STORAGE_CACHE_TIME, Date.now().toString());
    } catch (e) {
      console.warn('Cache save failed:', e);
    }
  }
  
  getFallbackCards() {
    const fallbackData = [
      { id: 46986414, name: 'Dark Magician', atk: 2500, def: 2100, level: 7, attribute: 'DARK', race: 'Spellcaster', desc: 'The ultimate wizard in terms of attack and defense.' },
      { id: 89631139, name: 'Blue-Eyes White Dragon', atk: 3000, def: 2500, level: 8, attribute: 'LIGHT', race: 'Dragon', desc: 'Legendary dragon of destruction.' },
      { id: 74677422, name: 'Red-Eyes Black Dragon', atk: 2400, def: 2000, level: 7, attribute: 'DARK', race: 'Dragon', desc: 'A ferocious dragon with a deadly attack.' },
      { id: 6368038, name: 'Celtic Guardian', atk: 1400, def: 1200, level: 4, attribute: 'EARTH', race: 'Warrior', desc: 'An elf who learned to wield a sword.' },
      { id: 70781052, name: 'Summoned Skull', atk: 2500, def: 1200, level: 6, attribute: 'DARK', race: 'Fiend', desc: 'A fiend with dark powers.' },
      { id: 38120068, name: 'Gaia The Fierce Knight', atk: 2300, def: 2100, level: 7, attribute: 'EARTH', race: 'Warrior', desc: 'A knight whose charge is feared.' },
      { id: 1561110, name: 'Mystical Elf', atk: 800, def: 2000, level: 4, attribute: 'LIGHT', race: 'Spellcaster', desc: 'A holy elf with powerful defense.' },
      { id: 13039848, name: 'Baby Dragon', atk: 1200, def: 700, level: 3, attribute: 'WIND', race: 'Dragon', desc: 'A very young dragon.' },
      { id: 64599569, name: 'Curse of Dragon', atk: 2000, def: 1500, level: 5, attribute: 'DARK', race: 'Dragon', desc: 'A wicked dragon.' },
      { id: 76812113, name: 'Harpie Lady', atk: 1300, def: 1400, level: 4, attribute: 'WIND', race: 'Winged Beast', desc: 'A human-shaped bird creature.' },
      { id: 35809262, name: 'Flame Swordsman', atk: 1800, def: 1600, level: 5, attribute: 'FIRE', race: 'Warrior', desc: 'A warrior of flames.' },
      { id: 13945283, name: 'Giant Soldier of Stone', atk: 1300, def: 2000, level: 3, attribute: 'EARTH', race: 'Rock', desc: 'A giant warrior carved from stone.' },
      { id: 31305911, name: 'Beaver Warrior', atk: 1200, def: 1500, level: 4, attribute: 'EARTH', race: 'Beast-Warrior', desc: 'A warrior beaver.' },
      { id: 69162969, name: 'Battle Ox', atk: 1700, def: 1000, level: 4, attribute: 'EARTH', race: 'Beast-Warrior', desc: 'A beast-warrior of immense strength.' },
      { id: 66788016, name: 'Trap Master', atk: 500, def: 1100, level: 3, attribute: 'EARTH', race: 'Warrior', desc: 'Expert at trap destruction.' },
      { id: 14851496, name: 'Koumori Dragon', atk: 1500, def: 1200, level: 4, attribute: 'DARK', race: 'Dragon', desc: 'A vicious dragon.' },
      { id: 8471389, name: 'Luster Dragon', atk: 1900, def: 1600, level: 4, attribute: 'WIND', race: 'Dragon', desc: 'A dragon with sapphire brilliance.' },
      { id: 66235877, name: 'Gemini Elf', atk: 1900, def: 900, level: 4, attribute: 'EARTH', race: 'Spellcaster', desc: 'Twin elves that attack in unison.' },
      { id: 50045299, name: 'Vorse Raider', atk: 1900, def: 1200, level: 4, attribute: 'DARK', race: 'Beast-Warrior', desc: 'Fierce beast-warrior.' },
      { id: 39111158, name: 'Judge Man', atk: 2200, def: 1500, level: 6, attribute: 'EARTH', race: 'Warrior', desc: 'A strict judge of battle.' },
    ];
    return fallbackData.map(d => new Card(d));
  }
}

/* ========== DECK MANAGEMENT ========== */
const STORAGE_SAVED_DECKS = 'dotr_saved_decks';
const STORAGE_ACTIVE_DECK = 'dotr_active_deck';

class DeckManager {
  constructor(cardDb) {
    this.cardDb = cardDb;
    this.deck = [];
    this.extraDeck = [];
    this.deckName = 'Untitled Deck';
    this.deckLeader = null;
    this.maxDeckSize = 40;
    this.maxExtraDeckSize = 15;
  }
  
  // Check if a card is an Extra Deck monster
  isExtraDeckMonster(card) {
    if (!card || !card.type) return false;
    const type = card.type.toLowerCase();
    return type.includes('fusion') || 
           type.includes('synchro') || 
           type.includes('xyz') || 
           type.includes('xyz') ||
           type.includes('link') ||
           type.includes('pendulum');
  }
  
  // Load the active deck
  load() {
    try {
      const data = localStorage.getItem(STORAGE_DECK);
      if (data) {
        const saved = JSON.parse(data);
        this.deck = saved.cards.map(id => this.cardDb.getById(id)).filter(c => c);
        // Load extra deck if it exists, otherwise initialize empty
        if (saved.extraDeck) {
          this.extraDeck = saved.extraDeck.map(id => this.cardDb.getById(id)).filter(c => c);
        } else {
          this.extraDeck = [];
        }
        this.deckName = saved.name || 'Untitled Deck';
        if (saved.leader) {
          this.deckLeader = this.cardDb.getById(saved.leader);
        }
      }
    } catch (e) {
      console.warn('Deck load failed:', e);
    }
  }
  
  // Save as the active deck
  save() {
    try {
      const data = {
        name: this.deckName,
        cards: this.deck.map(c => c.id),
        extraDeck: this.extraDeck.map(c => c.id),
        leader: this.deckLeader ? this.deckLeader.id : null
      };
      localStorage.setItem(STORAGE_DECK, JSON.stringify(data));
    } catch (e) {
      console.warn('Deck save failed:', e);
    }
  }
  
  // Save deck with a specific name to the saved decks list
  saveAs(name) {
    this.deckName = name;
    const savedDecks = this.getSavedDecksList();
    
    const deckData = {
      name: name,
      cards: this.deck.map(c => c.id),
      extraDeck: this.extraDeck.map(c => c.id),
      leader: this.deckLeader ? this.deckLeader.id : null,
      savedAt: new Date().toISOString()
    };
    
    // Update or add
    const existingIndex = savedDecks.findIndex(d => d.name === name);
    if (existingIndex >= 0) {
      savedDecks[existingIndex] = deckData;
    } else {
      savedDecks.push(deckData);
    }
    
    localStorage.setItem(STORAGE_SAVED_DECKS, JSON.stringify(savedDecks));
    this.save(); // Also save as active deck
    return true;
  }
  
  // Load a specific saved deck by name
  loadDeck(name) {
    const savedDecks = this.getSavedDecksList();
    const deckData = savedDecks.find(d => d.name === name);
    
    if (deckData) {
      this.deckName = deckData.name;
      this.deck = deckData.cards.map(id => this.cardDb.getById(id)).filter(c => c);
      // Load extra deck if it exists, otherwise initialize empty
      if (deckData.extraDeck) {
        this.extraDeck = deckData.extraDeck.map(id => this.cardDb.getById(id)).filter(c => c);
      } else {
        this.extraDeck = [];
      }
      if (deckData.leader) {
        this.deckLeader = this.cardDb.getById(deckData.leader);
      }
      this.save(); // Set as active deck
      return true;
    }
    return false;
  }
  
  // Delete a saved deck
  deleteDeck(name) {
    const savedDecks = this.getSavedDecksList();
    const index = savedDecks.findIndex(d => d.name === name);
    if (index >= 0) {
      savedDecks.splice(index, 1);
      localStorage.setItem(STORAGE_SAVED_DECKS, JSON.stringify(savedDecks));
      return true;
    }
    return false;
  }
  
  // Get list of all saved decks
  getSavedDecksList() {
    try {
      const data = localStorage.getItem(STORAGE_SAVED_DECKS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }
  
  // Export deck to JSON string (for file download)
  exportToJSON() {
    return JSON.stringify({
      name: this.deckName,
      cards: this.deck.map(c => c.id),
      extraDeck: this.extraDeck.map(c => c.id),
      leader: this.deckLeader ? this.deckLeader.id : null,
      exportedAt: new Date().toISOString()
    }, null, 2);
  }
  
  // Import deck from JSON string
  importFromJSON(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (!data.cards || !Array.isArray(data.cards)) {
        throw new Error('Invalid deck format');
      }
      
      this.deckName = data.name || 'Imported Deck';
      this.deck = data.cards.map(id => this.cardDb.getById(id)).filter(c => c);
      // Load extra deck if it exists, otherwise initialize empty
      if (data.extraDeck && Array.isArray(data.extraDeck)) {
        this.extraDeck = data.extraDeck.map(id => this.cardDb.getById(id)).filter(c => c);
      } else {
        this.extraDeck = [];
      }
      if (data.leader) {
        this.deckLeader = this.cardDb.getById(data.leader);
      }
      this.save();
      return true;
    } catch (e) {
      console.error('Import failed:', e);
      return false;
    }
  }
  
  addCard(card) {
    // Check if it's an extra deck monster - route to extra deck instead
    if (this.isExtraDeckMonster(card)) {
      return this.addExtraDeckCard(card);
    }
    
    if (this.deck.length >= this.maxDeckSize) return false;
    const count = this.deck.filter(c => c.id === card.id).length;
    if (count >= 3) return false;
    this.deck.push(card);
    this.save();
    return true;
  }
  
  removeCard(index) {
    if (index >= 0 && index < this.deck.length) {
      this.deck.splice(index, 1);
      this.save();
      return true;
    }
    return false;
  }
  
  addExtraDeckCard(card) {
    if (this.extraDeck.length >= this.maxExtraDeckSize) return false;
    const count = this.extraDeck.filter(c => c.id === card.id).length;
    if (count >= 3) return false;
    this.extraDeck.push(card);
    this.save();
    return true;
  }
  
  removeExtraDeckCard(index) {
    if (index >= 0 && index < this.extraDeck.length) {
      this.extraDeck.splice(index, 1);
      this.save();
      return true;
    }
    return false;
  }
  
  setDeckLeader(card) {
    this.deckLeader = card;
    this.save();
  }
  
  clear() {
    this.deck = [];
    this.extraDeck = [];
    this.deckLeader = null;
    this.deckName = 'Untitled Deck';
    this.save();
  }
  
  getShuffledDeck() {
    const deck = [...this.deck];
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }
  
  createRandomDeck() {
    this.deck = [];
    const cards = this.cardDb.cards;
    
    const lowLevel = cards.filter(c => c.level <= 4);
    const midLevel = cards.filter(c => c.level >= 5 && c.level <= 6);
    const highLevel = cards.filter(c => c.level >= 7);
    
    const shuffle = arr => {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };
    
    const shuffledLow = shuffle(lowLevel);
    const shuffledMid = shuffle(midLevel);
    const shuffledHigh = shuffle(highLevel);
    
    for (let i = 0; i < 24 && i < shuffledLow.length; i++) this.deck.push(shuffledLow[i]);
    for (let i = 0; i < 10 && i < shuffledMid.length; i++) this.deck.push(shuffledMid[i]);
    for (let i = 0; i < 6 && i < shuffledHigh.length; i++) this.deck.push(shuffledHigh[i]);
    
    while (this.deck.length < this.maxDeckSize && shuffledLow.length > 0) {
      this.deck.push(shuffledLow[this.deck.length % shuffledLow.length]);
    }
    
    this.deckName = 'Random Deck';
    this.save();
    return this.deck;
  }
  
  isValid() {
    return this.deck.length >= 30;
  }
}

// Export for use in other modules
window.Card = Card;
window.CardDatabase = CardDatabase;
window.DeckManager = DeckManager;

