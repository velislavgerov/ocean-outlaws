// runState.js — roguelite run state persistence
// Tracks current run progress between encounters in the voyage chart.

import { createStoryState, hydrateStoryState } from "./storyState.js";

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
    maxHp: null,
    weaponTiers: null,
    storyState: createStoryState(seed)
  };
}

export function hydrateRunState(state) {
  if (!state || typeof state !== "object") return null;
  if (!state.storyState) {
    state.storyState = createStoryState(state.seed || 0);
    return state;
  }
  state.storyState = hydrateStoryState(state.storyState, state.seed || 0);
  return state;
}

export function saveRunState(state) {
  try {
    localStorage.setItem(RUN_KEY, JSON.stringify(state));
  } catch (e) { /* ignore */ }
}

export function loadRunState() {
  try {
    var raw = localStorage.getItem(RUN_KEY);
    if (raw) return hydrateRunState(JSON.parse(raw));
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
