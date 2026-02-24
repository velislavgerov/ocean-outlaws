// runState.js — roguelite run state persistence
// Tracks current run progress between encounters in the voyage chart.

var RUN_KEY = "ocean_outlaws_run";

export function createRunState(seed) {
  return {
    seed: seed,
    selectedClass: null,
    gold: 0,
    upgradeLevels: null,
    crewRoster: null,
    crewAssigned: null,
    enemiesSunk: 0,
    goldLooted: 0,
    nodesCompleted: 0,
    active: true,
    hp: null,
    maxHp: null
  };
}

export function saveRunState(state) {
  try {
    localStorage.setItem(RUN_KEY, JSON.stringify(state));
  } catch (e) { /* ignore */ }
}

export function loadRunState() {
  try {
    var raw = localStorage.getItem(RUN_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return null;
}

export function hasActiveRun() {
  var state = loadRunState();
  return !!(state && state.active);
}

export function clearRunState() {
  try {
    localStorage.removeItem(RUN_KEY);
  } catch (e) { /* ignore */ }
}
