// runState.js — run state persistence

var RUN_KEY = "ocean_outlaws_run";

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

export function clearRunState() {
  try {
    localStorage.removeItem(RUN_KEY);
  } catch (e) { /* ignore */ }
}
