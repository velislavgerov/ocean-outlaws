// rng.js — seeded PRNG for deterministic multiplayer simulation
// Uses mulberry32: fast 32-bit seeded generator with good distribution.
// All gameplay randomness flows through nextRandom() so every client
// with the same seed produces the identical sequence.

var _state = 0;
var _callCount = 0;

// --- seed the PRNG (call once at game start with shared seed) ---
export function seedRNG(seed) {
  _state = seed | 0;
  _callCount = 0;
}

// --- get next random float in [0, 1) ---
// Drop-in replacement for Math.random() in gameplay code.
export function nextRandom() {
  _callCount++;
  _state = (_state + 0x6d2b79f5) | 0;
  var t = Math.imul(_state ^ (_state >>> 15), 1 | _state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// --- get current RNG call count (for checksum / debug) ---
export function getRNGCount() {
  return _callCount;
}

// --- get current RNG state (for snapshot / resync) ---
export function getRNGState() {
  return _state;
}

// --- restore RNG state from snapshot ---
export function setRNGState(state, count) {
  _state = state | 0;
  _callCount = count || 0;
}
