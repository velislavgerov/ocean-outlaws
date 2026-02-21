// save.js — save/load system: auto-save, export/import, new game

var SAVE_KEY = "ocean_outlaws_save";
var SAVE_VERSION = 1;

// --- build a save snapshot from current game state ---
export function buildSave(data) {
  return {
    version: SAVE_VERSION,
    timestamp: Date.now(),
    zone: data.zone || null,
    selectedClass: data.selectedClass || null,
    upgrades: data.upgrades || null,
    techTree: data.techTree || null,
    officers: data.officers || null,
    currency: data.currency || 0,
    skins: data.skins || [],
    mapState: data.mapState || null
  };
}

// --- auto-save to localStorage ---
export function autoSave(data) {
  try {
    var blob = buildSave(data);
    localStorage.setItem(SAVE_KEY, JSON.stringify(blob));
  } catch (e) {
    // storage full or unavailable
  }
}

// --- load save from localStorage (returns null if none) ---
export function loadSave() {
  try {
    var raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    var parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.version !== "number") return null;
    return parsed;
  } catch (e) {
    return null;
  }
}

// --- check if a save exists ---
export function hasSave() {
  try {
    return localStorage.getItem(SAVE_KEY) !== null;
  } catch (e) {
    return false;
  }
}

// --- delete save ---
export function deleteSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (e) {
    // ignore
  }
}

// --- export save as JSON string ---
export function exportSave() {
  try {
    var raw = localStorage.getItem(SAVE_KEY);
    return raw || null;
  } catch (e) {
    return null;
  }
}

// --- import save from JSON string; returns true on success ---
export function importSave(jsonString) {
  try {
    var parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed.version !== "number") return false;
    localStorage.setItem(SAVE_KEY, JSON.stringify(parsed));
    return true;
  } catch (e) {
    return false;
  }
}
