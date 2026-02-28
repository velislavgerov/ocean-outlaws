// mapData.js — zone definitions and open world persistence

var STORAGE_KEY = "ocean_outlaws_map";

var ZONES = [
  {
    id: "frontier_isles",
    name: "Frontier Isles",
    difficulty: 1,
    condition: "calm",
    x: 50, y: 75
  },
  {
    id: "iron_strait",
    name: "Iron Strait",
    difficulty: 2,
    condition: "calm",
    x: 35, y: 58
  },
  {
    id: "reef_basin",
    name: "Reef Basin",
    difficulty: 3,
    condition: "rough",
    x: 60, y: 42
  },
  {
    id: "stormwall",
    name: "Stormwall",
    difficulty: 4,
    condition: "stormy",
    x: 40, y: 28
  },
  {
    id: "black_trench",
    name: "Black Trench",
    difficulty: 5,
    condition: "stormy",
    x: 55, y: 15
  },
  {
    id: "leviathan_maw",
    name: "Leviathan's Maw",
    difficulty: 6,
    condition: "stormy",
    x: 30, y: 5
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
