// mapData.js — zone definitions and open world persistence

var STORAGE_KEY = "ocean_outlaws_map";

// Open world uses directional biome blending
export var OPEN_WORLD_TERRAIN_CONFIG = { biomeMode: "directional" };

var ZONES = [
  {
    id: "frontier_isles",
    name: "Frontier Isles",
    difficulty: 1,
    condition: "calm",
    x: 50, y: 75,
    terrainConfig: { noiseScale: 0.025, landThreshold: 0.71 }
  },
  {
    id: "iron_strait",
    name: "Iron Strait",
    difficulty: 2,
    condition: "calm",
    x: 35, y: 58,
    terrainConfig: { noiseScale: 0.013, landThreshold: 0.69 }
  },
  {
    id: "reef_basin",
    name: "Reef Basin",
    difficulty: 3,
    condition: "rough",
    x: 60, y: 42,
    terrainConfig: { noiseScale: 0.038, landThreshold: 0.65 }
  },
  {
    id: "stormwall",
    name: "Stormwall",
    difficulty: 4,
    condition: "stormy",
    x: 40, y: 28,
    terrainConfig: { noiseScale: 0.018, landThreshold: 0.67 }
  },
  {
    id: "black_trench",
    name: "Black Trench",
    difficulty: 5,
    condition: "stormy",
    x: 55, y: 15,
    terrainConfig: { noiseScale: 0.014, landThreshold: 0.72 }
  },
  {
    id: "leviathan_maw",
    name: "Leviathan's Maw",
    difficulty: 6,
    condition: "stormy",
    x: 30, y: 5,
    terrainConfig: { noiseScale: 0.010, landThreshold: 0.75 }
  }
];

export function getZone(id) {
  for (var i = 0; i < ZONES.length; i++) {
    if (ZONES[i].id === id) return ZONES[i];
  }
  return null;
}

export function loadMapState() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return { zones: {} };
}

export function resetMapState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) { /* ignore */ }
  return loadMapState();
}
