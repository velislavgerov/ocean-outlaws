// infamy.js — Infamy system: earn, persist, Legend Level, unlock gates

var STORAGE_KEY = "ocean_outlaws_infamy";

// --- unlock milestones ---
// { threshold, type, id, label }
var MILESTONES = [
  { threshold: 500,   type: "ship",  id: "cruiser",    label: "Brigantine" },
  { threshold: 1500,  type: "zone",  id: "reef_basin",  label: "Zone 3: Reef Basin" },
  { threshold: 3000,  type: "ship",  id: "carrier",    label: "Galleon" },
  { threshold: 6000,  type: "zone",  id: "stormwall",   label: "Zone 4: Stormwall" },
  { threshold: 10000, type: "ship",  id: "submarine",  label: "Man-o'-War" },
  { threshold: 15000, type: "boss",  id: "kraken",      label: "Kraken boss encounters" }
];

// --- Legend Level thresholds (cumulative Infamy) ---
var LEGEND_THRESHOLDS = [
  0, 200, 500, 1000, 2000, 3500, 5500, 8000, 12000, 17000, 25000
];

// --- load Infamy from localStorage ---
export function loadInfamy() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { total: 0 };
    var parsed = JSON.parse(raw);
    if (parsed && typeof parsed.total === "number") return parsed;
    return { total: 0 };
  } catch (e) {
    return { total: 0 };
  }
}

// --- save Infamy to localStorage ---
export function saveInfamy(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    // storage full or unavailable
  }
}

// --- add Infamy points and persist ---
export function addInfamy(state, amount) {
  state.total += amount;
  saveInfamy(state);
  return state;
}

// --- get total Infamy ---
export function getTotalInfamy(state) {
  return state.total;
}

// --- calculate Legend Level from total Infamy ---
export function getLegendLevel(state) {
  var total = state.total;
  for (var i = LEGEND_THRESHOLDS.length - 1; i >= 0; i--) {
    if (total >= LEGEND_THRESHOLDS[i]) return i;
  }
  return 0;
}

// --- get Legend Level progress info ---
export function getLegendProgress(state) {
  var level = getLegendLevel(state);
  var current = LEGEND_THRESHOLDS[level];
  var next = level < LEGEND_THRESHOLDS.length - 1 ? LEGEND_THRESHOLDS[level + 1] : null;
  return {
    level: level,
    current: state.total,
    threshold: current,
    next: next
  };
}

// --- calculate Infamy earned from a run ---
export function calcRunInfamy(goldLooted, enemiesSunk, zonesReached) {
  var infamy = 0;
  infamy += Math.floor(goldLooted * 0.1);
  infamy += enemiesSunk * 15;
  infamy += zonesReached * 50;
  return Math.max(0, infamy);
}

// --- check if a ship class is unlocked ---
export function isShipUnlocked(state, classKey) {
  // destroyer (Sloop) is always unlocked — it's the starter ship
  if (classKey === "destroyer") return true;
  for (var i = 0; i < MILESTONES.length; i++) {
    var m = MILESTONES[i];
    if (m.type === "ship" && m.id === classKey) {
      return state.total >= m.threshold;
    }
  }
  return true; // unknown classes default to unlocked
}

// --- get required Infamy for a ship class (0 = always unlocked) ---
export function getShipInfamyReq(classKey) {
  if (classKey === "destroyer") return 0;
  for (var i = 0; i < MILESTONES.length; i++) {
    var m = MILESTONES[i];
    if (m.type === "ship" && m.id === classKey) return m.threshold;
  }
  return 0;
}

// --- check if a zone is unlocked by Infamy ---
export function isZoneInfamyUnlocked(state, zoneId) {
  // first two zones are always available
  if (zoneId === "shallow_cove" || zoneId === "iron_strait") return true;
  for (var i = 0; i < MILESTONES.length; i++) {
    var m = MILESTONES[i];
    if (m.type === "zone" && m.id === zoneId) {
      return state.total >= m.threshold;
    }
  }
  return true; // zones without milestones are unlocked
}

// --- get required Infamy for a zone (0 = always unlocked) ---
export function getZoneInfamyReq(zoneId) {
  if (zoneId === "shallow_cove" || zoneId === "iron_strait") return 0;
  for (var i = 0; i < MILESTONES.length; i++) {
    var m = MILESTONES[i];
    if (m.type === "zone" && m.id === zoneId) return m.threshold;
  }
  return 0;
}

// --- check if kraken boss is in the encounter pool ---
export function isKrakenUnlocked(state) {
  return state.total >= 15000;
}

// --- get all milestones with unlock status ---
export function getMilestones(state) {
  var result = [];
  for (var i = 0; i < MILESTONES.length; i++) {
    var m = MILESTONES[i];
    result.push({
      threshold: m.threshold,
      type: m.type,
      id: m.id,
      label: m.label,
      unlocked: state.total >= m.threshold
    });
  }
  return result;
}
