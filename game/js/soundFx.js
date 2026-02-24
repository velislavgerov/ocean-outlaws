// soundFx.js — pirate weapon, impact, combat feedback, and UI sounds (procedural)
import { getCtx, getSfxGain, isReady, playNoiseShot } from "./sound.js";

// --- weapon sounds ---
export function playWeaponSound(weaponKey) {
  if (!isReady()) return;
  var ctx = getCtx();
  var now = ctx.currentTime;
  if (weaponKey === "turret") { playCannonFire(now); }
  else if (weaponKey === "missile") { playMusketFire(now); }
  else if (weaponKey === "torpedo") { playCannonballFlight(now); }
}

// Broadside cannon: deep boom with reverb tail — low-freq burst + noise transient
function playCannonFire(now) {
  var ctx = getCtx();
  var sfx = getSfxGain();
  // deep boom — low sine with sharp attack and long decay
  var boom = ctx.createOscillator();
  boom.type = "sine";
  boom.frequency.setValueAtTime(120, now);
  boom.frequency.exponentialRampToValueAtTime(30, now + 0.3);
  var boomGn = ctx.createGain();
  boomGn.gain.setValueAtTime(0.45, now);
  boomGn.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
  boom.connect(boomGn);
  boomGn.connect(sfx);
  boom.start(now);
  boom.stop(now + 0.5);
  // heavy noise transient for punch/smoke
  playNoiseShot(now, 0.15, 0.4, 600);
  // mid crackle layer
  var crackle = ctx.createOscillator();
  crackle.type = "sawtooth";
  crackle.frequency.setValueAtTime(300, now);
  crackle.frequency.exponentialRampToValueAtTime(60, now + 0.12);
  var cg = ctx.createGain();
  cg.gain.setValueAtTime(0.2, now);
  cg.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
  crackle.connect(cg);
  cg.connect(sfx);
  crackle.start(now);
  crackle.stop(now + 0.18);
  // reverb tail — filtered noise that lingers
  playNoiseShot(now + 0.05, 0.35, 0.12, 300);
}

// Musket/swivel gun: sharper crack, shorter decay
function playMusketFire(now) {
  var ctx = getCtx();
  var sfx = getSfxGain();
  // sharp crack
  var crack = ctx.createOscillator();
  crack.type = "square";
  crack.frequency.setValueAtTime(800, now);
  crack.frequency.exponentialRampToValueAtTime(150, now + 0.04);
  var cg = ctx.createGain();
  cg.gain.setValueAtTime(0.35, now);
  cg.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  crack.connect(cg);
  cg.connect(sfx);
  crack.start(now);
  crack.stop(now + 0.08);
  // snap noise burst
  playNoiseShot(now, 0.05, 0.35, 2000);
  // brief low thump
  var thump = ctx.createOscillator();
  thump.type = "sine";
  thump.frequency.setValueAtTime(100, now);
  thump.frequency.exponentialRampToValueAtTime(40, now + 0.06);
  var tg = ctx.createGain();
  tg.gain.setValueAtTime(0.2, now);
  tg.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  thump.connect(tg);
  tg.connect(sfx);
  thump.start(now);
  thump.stop(now + 0.1);
}

// Cannonball flight: subtle whistle with descending pitch
function playCannonballFlight(now) {
  var ctx = getCtx();
  var sfx = getSfxGain();
  // cannon boom first (lighter than broadside)
  var boom = ctx.createOscillator();
  boom.type = "sine";
  boom.frequency.setValueAtTime(100, now);
  boom.frequency.exponentialRampToValueAtTime(25, now + 0.25);
  var bg = ctx.createGain();
  bg.gain.setValueAtTime(0.3, now);
  bg.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
  boom.connect(bg);
  bg.connect(sfx);
  boom.start(now);
  boom.stop(now + 0.35);
  playNoiseShot(now, 0.1, 0.25, 500);
  // descending whistle
  var whistle = ctx.createOscillator();
  whistle.type = "sine";
  whistle.frequency.setValueAtTime(1800, now + 0.08);
  whistle.frequency.exponentialRampToValueAtTime(400, now + 0.6);
  var wFilt = ctx.createBiquadFilter();
  wFilt.type = "bandpass";
  wFilt.frequency.setValueAtTime(1600, now + 0.08);
  wFilt.frequency.exponentialRampToValueAtTime(500, now + 0.6);
  wFilt.Q.value = 2;
  var wg = ctx.createGain();
  wg.gain.setValueAtTime(0.001, now);
  wg.gain.linearRampToValueAtTime(0.08, now + 0.12);
  wg.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
  whistle.connect(wFilt);
  wFilt.connect(wg);
  wg.connect(sfx);
  whistle.start(now + 0.05);
  whistle.stop(now + 0.6);
}

// --- impact sounds: wood, water, terrain ---
export function playImpactSound(type) {
  if (!isReady()) return;
  var ctx = getCtx();
  var now = ctx.currentTime;
  if (type === "metal") { playWoodHit(now); } // metal → wood for pirate ships
  else if (type === "water") { playWaterSplash(now); }
  else if (type === "terrain") { playTerrainThud(now); }
}

// Impact on wood: splintering crack with resonant filter
function playWoodHit(now) {
  var ctx = getCtx();
  var sfx = getSfxGain();
  // splintering crack — noise burst through resonant filter
  var bufferSize = Math.floor(ctx.sampleRate * 0.12);
  var buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  var data = buffer.getChannelData(0);
  for (var i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  var src = ctx.createBufferSource();
  src.buffer = buffer;
  var filt = ctx.createBiquadFilter();
  filt.type = "bandpass";
  filt.frequency.setValueAtTime(1200, now);
  filt.frequency.exponentialRampToValueAtTime(400, now + 0.1);
  filt.Q.value = 4;
  var g = ctx.createGain();
  g.gain.setValueAtTime(0.3, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  src.connect(filt);
  filt.connect(g);
  g.connect(sfx);
  src.start(now);
  // woody thunk body
  var body = ctx.createOscillator();
  body.type = "triangle";
  body.frequency.setValueAtTime(300, now);
  body.frequency.exponentialRampToValueAtTime(80, now + 0.1);
  var bg = ctx.createGain();
  bg.gain.setValueAtTime(0.2, now);
  bg.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  body.connect(bg);
  bg.connect(sfx);
  body.start(now);
  body.stop(now + 0.15);
}

// Impact on water: splash with filtered noise and quick decay
function playWaterSplash(now) {
  var ctx = getCtx();
  var sfx = getSfxGain();
  // low plop
  var plop = ctx.createOscillator();
  plop.type = "sine";
  plop.frequency.setValueAtTime(150, now);
  plop.frequency.exponentialRampToValueAtTime(40, now + 0.12);
  var pg = ctx.createGain();
  pg.gain.setValueAtTime(0.2, now);
  pg.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  plop.connect(pg);
  pg.connect(sfx);
  plop.start(now);
  plop.stop(now + 0.2);
  // splash noise with quick decay
  playNoiseShot(now, 0.12, 0.18, 800);
}

function playTerrainThud(now) {
  var ctx = getCtx();
  var sfx = getSfxGain();
  // dull earthy thud
  var osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(60, now);
  osc.frequency.exponentialRampToValueAtTime(20, now + 0.15);
  var g = ctx.createGain();
  g.gain.setValueAtTime(0.3, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
  osc.connect(g);
  g.connect(sfx);
  osc.start(now);
  osc.stop(now + 0.25);
  // dirt noise
  playNoiseShot(now, 0.1, 0.2, 400);
}

// --- combat feedback ---
// Hit confirm: satisfying woody thunk when your shot lands on an enemy
export function playHitConfirm() {
  if (!isReady()) return;
  var ctx = getCtx();
  var sfx = getSfxGain();
  var now = ctx.currentTime;
  // woody thunk
  var osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(400, now);
  osc.frequency.exponentialRampToValueAtTime(120, now + 0.06);
  var g = ctx.createGain();
  g.gain.setValueAtTime(0.2, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  osc.connect(g);
  g.connect(sfx);
  osc.start(now);
  osc.stop(now + 0.12);
  // crunch/splinter
  playNoiseShot(now, 0.05, 0.15, 1000);
}

// Kill confirm: brief triumphant horn note
export function playKillConfirm() {
  if (!isReady()) return;
  var ctx = getCtx();
  var sfx = getSfxGain();
  var now = ctx.currentTime;
  // horn: two detuned sawtooths through lowpass for brassy tone
  var freqs = [220, 277]; // A3 + C#4 — major third, triumphant
  for (var i = 0; i < freqs.length; i++) {
    var osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = freqs[i];
    var filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.setValueAtTime(200, now);
    filt.frequency.linearRampToValueAtTime(800, now + 0.15);
    filt.frequency.linearRampToValueAtTime(300, now + 0.5);
    filt.Q.value = 1;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.1, now + 0.08);
    g.gain.setValueAtTime(0.1, now + 0.3);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc.connect(filt);
    filt.connect(g);
    g.connect(sfx);
    osc.start(now);
    osc.stop(now + 0.55);
  }
}

// --- explosion (ship sinking — wood splintering + deep boom) ---
export function playExplosion() {
  if (!isReady()) return;
  var ctx = getCtx();
  var sfx = getSfxGain();
  var now = ctx.currentTime;
  // deep cannon-like boom
  var osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(100, now);
  osc.frequency.exponentialRampToValueAtTime(18, now + 0.6);
  var g = ctx.createGain();
  g.gain.setValueAtTime(0.4, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
  osc.connect(g);
  g.connect(sfx);
  osc.start(now);
  osc.stop(now + 0.7);
  // heavy wood splintering noise
  playNoiseShot(now, 0.5, 0.35, 800);
  // cracking timbers — mid-range resonant burst
  var crack = ctx.createOscillator();
  crack.type = "sawtooth";
  crack.frequency.setValueAtTime(400, now);
  crack.frequency.exponentialRampToValueAtTime(50, now + 0.3);
  var cf = ctx.createBiquadFilter();
  cf.type = "bandpass";
  cf.frequency.value = 300;
  cf.Q.value = 3;
  var cg = ctx.createGain();
  cg.gain.setValueAtTime(0.18, now);
  cg.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
  crack.connect(cf);
  cf.connect(cg);
  cg.connect(sfx);
  crack.start(now);
  crack.stop(now + 0.4);
  // water rush as ship sinks
  playNoiseShot(now + 0.2, 0.4, 0.15, 400);
}

// Player hit: wood splintering + impact
export function playPlayerHit() {
  if (!isReady()) return;
  var ctx = getCtx();
  var sfx = getSfxGain();
  var now = ctx.currentTime;
  // wood splinter crack
  var osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(500, now);
  osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
  var filt = ctx.createBiquadFilter();
  filt.type = "bandpass";
  filt.frequency.value = 400;
  filt.Q.value = 3;
  var g = ctx.createGain();
  g.gain.setValueAtTime(0.3, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  osc.connect(filt);
  filt.connect(g);
  g.connect(sfx);
  osc.start(now);
  osc.stop(now + 0.2);
  // splintering noise
  playNoiseShot(now, 0.12, 0.3, 1200);
  // heavy thunk impact
  var thunk = ctx.createOscillator();
  thunk.type = "sine";
  thunk.frequency.setValueAtTime(80, now);
  thunk.frequency.exponentialRampToValueAtTime(25, now + 0.1);
  var tg = ctx.createGain();
  tg.gain.setValueAtTime(0.2, now);
  tg.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  thunk.connect(tg);
  tg.connect(sfx);
  thunk.start(now);
  thunk.stop(now + 0.15);
}

// --- UI sounds ---
export function playClick() {
  if (!isReady()) return;
  var ctx = getCtx();
  var sfx = getSfxGain();
  var now = ctx.currentTime;
  // wooden tap
  var osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(800, now);
  osc.frequency.exponentialRampToValueAtTime(400, now + 0.03);
  var g = ctx.createGain();
  g.gain.setValueAtTime(0.12, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
  osc.connect(g);
  g.connect(sfx);
  osc.start(now);
  osc.stop(now + 0.05);
}

export function playUpgrade() {
  if (!isReady()) return;
  var ctx = getCtx();
  var sfx = getSfxGain();
  var now = ctx.currentTime;
  // ascending pentatonic fanfare — pirate flair
  var notes = [392, 440, 523, 659]; // G4 A4 C5 E5
  for (var i = 0; i < notes.length; i++) {
    var t = now + i * 0.1;
    var osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(notes[i], t);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(g);
    g.connect(sfx);
    osc.start(t);
    osc.stop(t + 0.18);
  }
}

// Ship horn — deep foghorn for pirate ships
export function playWaveHorn() {
  if (!isReady()) return;
  var ctx = getCtx();
  var sfx = getSfxGain();
  var now = ctx.currentTime;
  var freqs = [110, 138.6, 165]; // power chord
  for (var i = 0; i < freqs.length; i++) {
    var osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(freqs[i], now);
    var filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(100, now);
    filter.frequency.linearRampToValueAtTime(500, now + 0.3);
    filter.frequency.linearRampToValueAtTime(150, now + 1.2);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.12, now + 0.2);
    g.gain.setValueAtTime(0.12, now + 0.8);
    g.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
    osc.connect(filter);
    filter.connect(g);
    g.connect(sfx);
    osc.start(now);
    osc.stop(now + 1.4);
  }
}
