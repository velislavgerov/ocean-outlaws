// mapData.js — zone definitions, progression, localStorage persistence

var STORAGE_KEY = "ocean_outlaws_map";

// --- zone definitions ---
var ZONES = [
  {
    id: "shallow_cove",
    name: "Shallow Cove",
    difficulty: 1,
    condition: "calm",
    description: "Calm waters, light resistance",
    waves: 3,
    enemyBase: 2,
    enemiesPerWave: 1,
    hpScale: 1.0,
    speedScale: 1.0,
    x: 50,
    y: 75,
    connections: ["iron_strait"]
  },
  {
    id: "iron_strait",
    name: "Iron Strait",
    difficulty: 2,
    condition: "calm",
    description: "Narrow passage, more patrols",
    waves: 4,
    enemyBase: 3,
    enemiesPerWave: 1,
    hpScale: 1.1,
    speedScale: 1.05,
    boss: "battleship",
    x: 35,
    y: 58,
    connections: ["shallow_cove", "reef_basin"]
  },
  {
    id: "reef_basin",
    name: "Reef Basin",
    difficulty: 3,
    condition: "rough",
    description: "Rough seas, armored enemies",
    waves: 5,
    enemyBase: 3,
    enemiesPerWave: 2,
    hpScale: 1.3,
    speedScale: 1.1,
    boss: "carrier",
    x: 60,
    y: 42,
    connections: ["iron_strait", "stormwall"]
  },
  {
    id: "stormwall",
    name: "Stormwall",
    difficulty: 4,
    condition: "stormy",
    description: "Stormy waters, fast attackers",
    waves: 6,
    enemyBase: 4,
    enemiesPerWave: 2,
    hpScale: 1.5,
    speedScale: 1.2,
    boss: "battleship",
    x: 40,
    y: 28,
    connections: ["reef_basin", "black_trench"]
  },
  {
    id: "black_trench",
    name: "Black Trench",
    difficulty: 5,
    condition: "stormy",
    description: "Deep waters, elite fleet",
    waves: 7,
    enemyBase: 4,
    enemiesPerWave: 3,
    hpScale: 1.8,
    speedScale: 1.3,
    boss: "kraken",
    x: 55,
    y: 15,
    connections: ["stormwall", "leviathan_maw"]
  },
  {
    id: "leviathan_maw",
    name: "Leviathan's Maw",
    difficulty: 6,
    condition: "stormy",
    description: "The final stronghold",
    waves: 8,
    enemyBase: 5,
    enemiesPerWave: 3,
    hpScale: 2.0,
    speedScale: 1.4,
    boss: "kraken",
    x: 30,
    y: 5,
    connections: ["black_trench"]
  }
];

// --- get all zone definitions ---
export function getZones() {
  return ZONES;
}

// --- get zone by id ---
export function getZone(id) {
  for (var i = 0; i < ZONES.length; i++) {
    if (ZONES[i].id === id) return ZONES[i];
  }
  return null;
}

// --- load map state from localStorage ---
export function loadMapState() {
  var saved = null;
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (raw) saved = JSON.parse(raw);
  } catch (e) {
    // ignore parse errors
  }

  if (!saved || !saved.zones) {
    // fresh state: first zone unlocked
    saved = { zones: {} };
    saved.zones[ZONES[0].id] = { unlocked: true, stars: 0 };
    for (var i = 1; i < ZONES.length; i++) {
      saved.zones[ZONES[i].id] = { unlocked: false, stars: 0 };
    }
  }

  return saved;
}

// --- save map state to localStorage ---
export function saveMapState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    // ignore storage errors
  }
}

// --- calculate star rating from HP remaining ---
// 3 stars: >= 75% HP, 2 stars: >= 40% HP, 1 star: < 40%
export function calcStars(hp, maxHp) {
  if (maxHp <= 0) return 1;
  var ratio = hp / maxHp;
  if (ratio >= 0.75) return 3;
  if (ratio >= 0.40) return 2;
  return 1;
}

// --- complete a zone: update stars, unlock next zones ---
export function completeZone(state, zoneId, stars) {
  if (!state.zones[zoneId]) {
    state.zones[zoneId] = { unlocked: true, stars: 0 };
  }
  // keep best star rating
  if (stars > state.zones[zoneId].stars) {
    state.zones[zoneId].stars = stars;
  }

  // unlock connected zones
  var zone = getZone(zoneId);
  if (zone) {
    for (var i = 0; i < zone.connections.length; i++) {
      var connId = zone.connections[i];
      if (!state.zones[connId]) {
        state.zones[connId] = { unlocked: false, stars: 0 };
      }
      state.zones[connId].unlocked = true;
    }
  }

  saveMapState(state);
  return state;
}

// --- check if a zone is unlocked ---
export function isZoneUnlocked(state, zoneId) {
  return state.zones[zoneId] && state.zones[zoneId].unlocked;
}

// --- get stars for a zone ---
export function getZoneStars(state, zoneId) {
  return (state.zones[zoneId] && state.zones[zoneId].stars) || 0;
}

// --- build wave configs for a zone (replaces global wave configs) ---
// Final wave marked as boss wave if zone has a boss
export function buildZoneWaveConfigs(zone) {
  var configs = [];
  for (var i = 1; i <= zone.waves; i++) {
    var cfg = {
      wave: i,
      enemies: zone.enemyBase + zone.enemiesPerWave * (i - 1),
      hpMult: zone.hpScale * (1.0 + (i - 1) * 0.15),
      speedMult: zone.speedScale * (1.0 + (i - 1) * 0.08),
      fireRateMult: 1.0 + (i - 1) * 0.1
    };
    // mark final wave as boss wave
    if (i === zone.waves && zone.boss) {
      cfg.boss = zone.boss;
      cfg.enemies = Math.max(1, Math.floor(cfg.enemies / 2)); // fewer regular enemies during boss
    }
    configs.push(cfg);
  }
  return configs;
}

// --- reset map progress ---
export function resetMapState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    // ignore
  }
  return loadMapState();
}
