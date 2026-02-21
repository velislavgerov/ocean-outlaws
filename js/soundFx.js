// soundFx.js — weapon, impact, combat feedback, and UI sounds (procedural)
import { getCtx, getSfxGain, isReady, playNoiseShot } from "./sound.js";

// --- weapon sounds ---
export function playWeaponSound(weaponKey) {
  if (!isReady()) return;
  var ctx = getCtx();
  var now = ctx.currentTime;
  if (weaponKey === "turret") { playTurretFire(now); }
  else if (weaponKey === "missile") { playMissileLaunch(now); }
  else if (weaponKey === "torpedo") { playTorpedoLaunch(now); }
}

// Turret: percussive transient click + filtered noise burst
function playTurretFire(now) {
  var ctx = getCtx();
  var sfx = getSfxGain();
  // sharp transient click
  var click = ctx.createOscillator();
  click.type = "square";
  click.frequency.setValueAtTime(1200, now);
  click.frequency.exponentialRampToValueAtTime(200, now + 0.02);
  var cg = ctx.createGain();
  cg.gain.setValueAtTime(0.35, now);
  cg.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
  click.connect(cg);
  cg.connect(sfx);
  click.start(now);
  click.stop(now + 0.03);
  // body: pitched-down thump
  var body = ctx.createOscillator();
  body.type = "square";
  body.frequency.setValueAtTime(600, now);
  body.frequency.exponentialRampToValueAtTime(80, now + 0.08);
  var bg = ctx.createGain();
  bg.gain.setValueAtTime(0.25, now);
  bg.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  body.connect(bg);
  bg.connect(sfx);
  body.start(now);
  body.stop(now + 0.12);
  // noise burst for punch
  playNoiseShot(now, 0.06, 0.3, 1200);
  // low thud for weight
  var thud = ctx.createOscillator();
  thud.type = "sine";
  thud.frequency.setValueAtTime(80, now);
  thud.frequency.exponentialRampToValueAtTime(30, now + 0.1);
  var tg = ctx.createGain();
  tg.gain.setValueAtTime(0.2, now);
  tg.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  thud.connect(tg);
  tg.connect(sfx);
  thud.start(now);
  thud.stop(now + 0.12);
}

// Missile: rising Doppler pitch + trailing off
function playMissileLaunch(now) {
  var ctx = getCtx();
  var sfx = getSfxGain();
  // whoosh with Doppler rise then fall
  var osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(180, now);
  osc.frequency.exponentialRampToValueAtTime(1400, now + 0.2);
  osc.frequency.exponentialRampToValueAtTime(600, now + 0.5);
  osc.frequency.exponentialRampToValueAtTime(200, now + 0.8);
  var filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(400, now);
  filter.frequency.exponentialRampToValueAtTime(1200, now + 0.2);
  filter.frequency.exponentialRampToValueAtTime(300, now + 0.8);
  filter.Q.value = 1.5;
  var g = ctx.createGain();
  g.gain.setValueAtTime(0.12, now);
  g.gain.linearRampToValueAtTime(0.25, now + 0.15);
  g.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
  osc.connect(filter);
  filter.connect(g);
  g.connect(sfx);
  osc.start(now);
  osc.stop(now + 0.8);
  // trailing noise
  playNoiseShot(now, 0.5, 0.15, 1500);
  // ignition pop
  var pop = ctx.createOscillator();
  pop.type = "sine";
  pop.frequency.setValueAtTime(400, now);
  pop.frequency.exponentialRampToValueAtTime(100, now + 0.05);
  var pg = ctx.createGain();
  pg.gain.setValueAtTime(0.2, now);
  pg.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
  pop.connect(pg);
  pg.connect(sfx);
  pop.start(now);
  pop.stop(now + 0.06);
}

// Torpedo: water entry ploonk + underwater travel hum
function playTorpedoLaunch(now) {
  var ctx = getCtx();
  var sfx = getSfxGain();
  // water entry "ploonk" — low sine with sharp attack
  var plonk = ctx.createOscillator();
  plonk.type = "sine";
  plonk.frequency.setValueAtTime(180, now);
  plonk.frequency.exponentialRampToValueAtTime(40, now + 0.15);
  var pg = ctx.createGain();
  pg.gain.setValueAtTime(0.35, now);
  pg.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
  plonk.connect(pg);
  pg.connect(sfx);
  plonk.start(now);
  plonk.stop(now + 0.25);
  // bubble splash noise
  playNoiseShot(now, 0.2, 0.2, 400);
  // underwater travel hum — starts after entry
  var hum = ctx.createOscillator();
  hum.type = "triangle";
  hum.frequency.setValueAtTime(65, now + 0.15);
  hum.frequency.linearRampToValueAtTime(55, now + 0.8);
  var humFilter = ctx.createBiquadFilter();
  humFilter.type = "lowpass";
  humFilter.frequency.value = 200;
  var hg = ctx.createGain();
  hg.gain.setValueAtTime(0.001, now);
  hg.gain.linearRampToValueAtTime(0.12, now + 0.2);
  hg.gain.setValueAtTime(0.12, now + 0.6);
  hg.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
  hum.connect(humFilter);
  humFilter.connect(hg);
  hg.connect(sfx);
  hum.start(now + 0.1);
  hum.stop(now + 0.9);
}

// --- impact sounds: metal, water, terrain ---
export function playImpactSound(type) {
  if (!isReady()) return;
  var ctx = getCtx();
  var now = ctx.currentTime;
  if (type === "metal") { playMetalHit(now); }
  else if (type === "water") { playWaterSplash(now); }
  else if (type === "terrain") { playTerrainThud(now); }
}

function playMetalHit(now) {
  var ctx = getCtx();
  var sfx = getSfxGain();
  // metallic clang — high sine with quick decay
  var osc = ctx.createOscillator();
  osc.type = "square";
  osc.frequency.setValueAtTime(900, now);
  osc.frequency.exponentialRampToValueAtTime(300, now + 0.08);
  var g = ctx.createGain();
  g.gain.setValueAtTime(0.25, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  osc.connect(g);
  g.connect(sfx);
  osc.start(now);
  osc.stop(now + 0.15);
  // ring resonance
  var ring = ctx.createOscillator();
  ring.type = "sine";
  ring.frequency.setValueAtTime(1800, now);
  ring.frequency.exponentialRampToValueAtTime(1200, now + 0.2);
  var rg = ctx.createGain();
  rg.gain.setValueAtTime(0.08, now);
  rg.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
  ring.connect(rg);
  rg.connect(sfx);
  ring.start(now);
  ring.stop(now + 0.25);
  playNoiseShot(now, 0.06, 0.2, 2000);
}

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
  // splash noise
  playNoiseShot(now, 0.15, 0.15, 600);
}

function playTerrainThud(now) {
  var ctx = getCtx();
  var sfx = getSfxGain();
  // dull thud
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
export function playHitConfirm() {
  if (!isReady()) return;
  var ctx = getCtx();
  var sfx = getSfxGain();
  var now = ctx.currentTime;
  // satisfying "ding"
  var osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(1200, now);
  osc.frequency.exponentialRampToValueAtTime(800, now + 0.08);
  var g = ctx.createGain();
  g.gain.setValueAtTime(0.15, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  osc.connect(g);
  g.connect(sfx);
  osc.start(now);
  osc.stop(now + 0.12);
  // subtle crunch
  playNoiseShot(now, 0.04, 0.1, 1500);
}

export function playKillConfirm() {
  if (!isReady()) return;
  var ctx = getCtx();
  var sfx = getSfxGain();
  var now = ctx.currentTime;
  // two-tone rising confirmation
  var o1 = ctx.createOscillator();
  o1.type = "triangle";
  o1.frequency.setValueAtTime(600, now);
  var g1 = ctx.createGain();
  g1.gain.setValueAtTime(0.15, now);
  g1.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  o1.connect(g1);
  g1.connect(sfx);
  o1.start(now);
  o1.stop(now + 0.1);
  var o2 = ctx.createOscillator();
  o2.type = "triangle";
  o2.frequency.setValueAtTime(900, now + 0.08);
  var g2 = ctx.createGain();
  g2.gain.setValueAtTime(0.001, now);
  g2.gain.linearRampToValueAtTime(0.18, now + 0.08);
  g2.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  o2.connect(g2);
  g2.connect(sfx);
  o2.start(now + 0.06);
  o2.stop(now + 0.2);
}

// --- explosion (enhanced) ---
export function playExplosion() {
  if (!isReady()) return;
  var ctx = getCtx();
  var sfx = getSfxGain();
  var now = ctx.currentTime;
  var osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(100, now);
  osc.frequency.exponentialRampToValueAtTime(20, now + 0.5);
  var g = ctx.createGain();
  g.gain.setValueAtTime(0.4, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
  osc.connect(g);
  g.connect(sfx);
  osc.start(now);
  osc.stop(now + 0.6);
  playNoiseShot(now, 0.4, 0.35, 600);
  var osc2 = ctx.createOscillator();
  osc2.type = "square";
  osc2.frequency.setValueAtTime(300, now);
  osc2.frequency.exponentialRampToValueAtTime(30, now + 0.3);
  var g2 = ctx.createGain();
  g2.gain.setValueAtTime(0.15, now);
  g2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
  osc2.connect(g2);
  g2.connect(sfx);
  osc2.start(now);
  osc2.stop(now + 0.35);
}

export function playPlayerHit() {
  if (!isReady()) return;
  var ctx = getCtx();
  var sfx = getSfxGain();
  var now = ctx.currentTime;
  var osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(800, now);
  osc.frequency.exponentialRampToValueAtTime(200, now + 0.15);
  var g = ctx.createGain();
  g.gain.setValueAtTime(0.3, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  osc.connect(g);
  g.connect(sfx);
  osc.start(now);
  osc.stop(now + 0.2);
  playNoiseShot(now, 0.1, 0.25, 1000);
}

// --- UI sounds ---
export function playClick() {
  if (!isReady()) return;
  var ctx = getCtx();
  var sfx = getSfxGain();
  var now = ctx.currentTime;
  var osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(1000, now);
  osc.frequency.exponentialRampToValueAtTime(600, now + 0.03);
  var g = ctx.createGain();
  g.gain.setValueAtTime(0.15, now);
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
  var notes = [440, 554, 659, 880];
  for (var i = 0; i < notes.length; i++) {
    var t = now + i * 0.08;
    var osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(notes[i], t);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(g);
    g.connect(sfx);
    osc.start(t);
    osc.stop(t + 0.15);
  }
}

export function playWaveHorn() {
  if (!isReady()) return;
  var ctx = getCtx();
  var sfx = getSfxGain();
  var now = ctx.currentTime;
  var freqs = [110, 138.6, 165];
  for (var i = 0; i < freqs.length; i++) {
    var osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(freqs[i], now);
    var filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(100, now);
    filter.frequency.linearRampToValueAtTime(600, now + 0.3);
    filter.frequency.linearRampToValueAtTime(200, now + 1.2);
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
