// sound.js — procedural audio via Web Audio API (no audio files)
var ctx = null;
var masterGain = null;
var musicGain = null;
var sfxGain = null;
var ambienceGain = null;
var muted = false;
var masterVolume = 0.5;
var unlocked = false;
var engineOsc = null;
var engineGain = null;
var windNoise = null;
var windGain = null;
var waveOsc = null;
var waveGain = null;
var musicState = null;

function ensureContext() {
  if (ctx) return true;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = masterVolume;
    masterGain.connect(ctx.destination);
    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.6;
    sfxGain.connect(masterGain);
    ambienceGain = ctx.createGain();
    ambienceGain.gain.value = 0.3;
    ambienceGain.connect(masterGain);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.18;
    musicGain.connect(masterGain);
    return true;
  } catch (e) {
    return false;
  }
}

export function unlockAudio() {
  if (unlocked) return;
  if (!ensureContext()) return;
  if (ctx.state === "suspended") ctx.resume();
  unlocked = true;
  startAmbience();
  startMusic();
}

export function setMasterVolume(v) {
  masterVolume = Math.max(0, Math.min(1, v));
  if (masterGain) masterGain.gain.value = muted ? 0 : masterVolume;
}

export function getMasterVolume() { return masterVolume; }

export function setMuted(val) {
  muted = val;
  if (masterGain) masterGain.gain.value = muted ? 0 : masterVolume;
}

export function isMuted() { return muted; }

export function toggleMute() {
  setMuted(!muted);
  return muted;
}

// --- engine hum: pitch rises with speed ---
export function updateEngine(speedRatio) {
  if (!ctx || !unlocked) return;
  if (!engineOsc) {
    engineOsc = ctx.createOscillator();
    engineOsc.type = "sawtooth";
    engineOsc.frequency.value = 40;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    var ef = ctx.createBiquadFilter();
    ef.type = "lowpass";
    ef.frequency.value = 200;
    ef.Q.value = 2;
    engineOsc.connect(ef);
    ef.connect(engineGain);
    engineGain.connect(ambienceGain);
    engineOsc.start();
    engineOsc._filter = ef;
  }
  var ratio = Math.max(0, Math.min(1, speedRatio));
  engineOsc.frequency.value = 40 + ratio * 80;
  engineGain.gain.value = 0.05 + ratio * 0.2;
  engineOsc._filter.frequency.value = 120 + ratio * 400;
}

// --- weapon sounds ---
export function playWeaponSound(weaponKey) {
  if (!ctx || !unlocked) return;
  var now = ctx.currentTime;
  if (weaponKey === "turret") { playTurretPop(now); }
  else if (weaponKey === "missile") { playMissileWhoosh(now); }
  else if (weaponKey === "torpedo") { playTorpedoSplash(now); }
}

function playTurretPop(now) {
  var osc = ctx.createOscillator();
  osc.type = "square";
  osc.frequency.setValueAtTime(600, now);
  osc.frequency.exponentialRampToValueAtTime(100, now + 0.08);
  var g = ctx.createGain();
  g.gain.setValueAtTime(0.3, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  osc.connect(g);
  g.connect(sfxGain);
  osc.start(now);
  osc.stop(now + 0.12);
  playNoiseShot(now, 0.06, 0.25, 800);
}

function playMissileWhoosh(now) {
  var osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(200, now);
  osc.frequency.exponentialRampToValueAtTime(1200, now + 0.15);
  osc.frequency.exponentialRampToValueAtTime(400, now + 0.4);
  var g = ctx.createGain();
  g.gain.setValueAtTime(0.15, now);
  g.gain.linearRampToValueAtTime(0.25, now + 0.1);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
  var filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 600;
  filter.Q.value = 1.5;
  osc.connect(filter);
  filter.connect(g);
  g.connect(sfxGain);
  osc.start(now);
  osc.stop(now + 0.4);
  playNoiseShot(now, 0.2, 0.2, 1200);
}

function playTorpedoSplash(now) {
  var osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(120, now);
  osc.frequency.exponentialRampToValueAtTime(40, now + 0.2);
  var g = ctx.createGain();
  g.gain.setValueAtTime(0.3, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  osc.connect(g);
  g.connect(sfxGain);
  osc.start(now);
  osc.stop(now + 0.3);
  playNoiseShot(now, 0.25, 0.2, 500);
}

function playNoiseShot(now, duration, volume, filterFreq) {
  var bufferSize = Math.floor(ctx.sampleRate * duration);
  var buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  var data = buffer.getChannelData(0);
  for (var i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  var src = ctx.createBufferSource();
  src.buffer = buffer;
  var filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = filterFreq || 800;
  var g = ctx.createGain();
  g.gain.setValueAtTime(volume || 0.2, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + duration);
  src.connect(filter);
  filter.connect(g);
  g.connect(sfxGain);
  src.start(now);
}

// --- explosions ---
export function playExplosion() {
  if (!ctx || !unlocked) return;
  var now = ctx.currentTime;
  var osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(100, now);
  osc.frequency.exponentialRampToValueAtTime(20, now + 0.5);
  var g = ctx.createGain();
  g.gain.setValueAtTime(0.4, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
  osc.connect(g);
  g.connect(sfxGain);
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
  g2.connect(sfxGain);
  osc2.start(now);
  osc2.stop(now + 0.35);
}

export function playPlayerHit() {
  if (!ctx || !unlocked) return;
  var now = ctx.currentTime;
  var osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(800, now);
  osc.frequency.exponentialRampToValueAtTime(200, now + 0.15);
  var g = ctx.createGain();
  g.gain.setValueAtTime(0.3, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  osc.connect(g);
  g.connect(sfxGain);
  osc.start(now);
  osc.stop(now + 0.2);
  playNoiseShot(now, 0.1, 0.25, 1000);
}

// --- ocean ambience: waves + wind ---
function startAmbience() {
  if (waveOsc) return;
  var bufferSize = ctx.sampleRate * 2;
  var noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  var nd = noiseBuffer.getChannelData(0);
  for (var i = 0; i < bufferSize; i++) nd[i] = Math.random() * 2 - 1;
  waveOsc = ctx.createBufferSource();
  waveOsc.buffer = noiseBuffer;
  waveOsc.loop = true;
  var wf = ctx.createBiquadFilter();
  wf.type = "lowpass";
  wf.frequency.value = 300;
  wf.Q.value = 0.5;
  waveGain = ctx.createGain();
  waveGain.gain.value = 0.15;
  waveOsc.connect(wf);
  wf.connect(waveGain);
  waveGain.connect(ambienceGain);
  waveOsc.start();
  waveOsc._filter = wf;
  // wind noise
  var windBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  var wd = windBuffer.getChannelData(0);
  for (var i = 0; i < bufferSize; i++) wd[i] = Math.random() * 2 - 1;
  windNoise = ctx.createBufferSource();
  windNoise.buffer = windBuffer;
  windNoise.loop = true;
  var wdf = ctx.createBiquadFilter();
  wdf.type = "bandpass";
  wdf.frequency.value = 800;
  wdf.Q.value = 0.8;
  windGain = ctx.createGain();
  windGain.gain.value = 0;
  windNoise.connect(wdf);
  wdf.connect(windGain);
  windGain.connect(ambienceGain);
  windNoise.start();
  windNoise._filter = wdf;
}

export function updateAmbience(weatherKey) {
  if (!ctx || !unlocked) return;
  var tw = 0.15, twd = 0, twf = 300, twdf = 800;
  if (weatherKey === "storm") { tw = 0.35; twd = 0.4; twf = 500; twdf = 600; }
  else if (weatherKey === "rough") { tw = 0.25; twd = 0.2; twf = 400; twdf = 700; }
  if (waveGain) waveGain.gain.value += (tw - waveGain.gain.value) * 0.02;
  if (waveOsc && waveOsc._filter) waveOsc._filter.frequency.value += (twf - waveOsc._filter.frequency.value) * 0.02;
  if (windGain) windGain.gain.value += (twd - windGain.gain.value) * 0.02;
  if (windNoise && windNoise._filter) windNoise._filter.frequency.value += (twdf - windNoise._filter.frequency.value) * 0.02;
}

// --- UI sounds ---
export function playClick() {
  if (!ctx || !unlocked) return;
  var now = ctx.currentTime;
  var osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(1000, now);
  osc.frequency.exponentialRampToValueAtTime(600, now + 0.03);
  var g = ctx.createGain();
  g.gain.setValueAtTime(0.15, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
  osc.connect(g);
  g.connect(sfxGain);
  osc.start(now);
  osc.stop(now + 0.05);
}

export function playUpgrade() {
  if (!ctx || !unlocked) return;
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
    g.connect(sfxGain);
    osc.start(t);
    osc.stop(t + 0.15);
  }
}

export function playWaveHorn() {
  if (!ctx || !unlocked) return;
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
    g.connect(sfxGain);
    osc.start(now);
    osc.stop(now + 1.4);
  }
}

// --- procedural music: calm vs combat ---
var CALM_NOTES = [
  [48, 52, 55], [53, 57, 60], [43, 47, 50],
  [55, 58, 62], [50, 53, 57], [48, 52, 55]
];
var COMBAT_NOTES = [
  [36, 43, 48], [41, 48, 53], [43, 50, 55],
  [39, 46, 51], [36, 43, 48], [34, 41, 46]
];

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function startMusic() {
  if (musicState) return;
  musicState = {
    mode: "calm", chordIndex: 0,
    nextChordTime: ctx.currentTime + 0.5,
    chordDuration: 4.0
  };
}

export function updateMusic(inCombat) {
  if (!ctx || !unlocked || !musicState) return;
  var now = ctx.currentTime;
  var targetMode = inCombat ? "combat" : "calm";
  if (targetMode !== musicState.mode) {
    musicState.mode = targetMode;
    musicState.chordDuration = inCombat ? 2.0 : 4.0;
  }
  if (now < musicState.nextChordTime) return;
  var chords = musicState.mode === "combat" ? COMBAT_NOTES : CALM_NOTES;
  var chord = chords[musicState.chordIndex % chords.length];
  musicState.chordIndex++;
  var dur = musicState.chordDuration;
  musicState.nextChordTime = now + dur;
  for (var i = 0; i < chord.length; i++) {
    var osc = ctx.createOscillator();
    osc.type = musicState.mode === "combat" ? "sawtooth" : "sine";
    osc.frequency.value = midiToFreq(chord[i]);
    var filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = musicState.mode === "combat" ? 800 : 400;
    filter.Q.value = 0.5;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.08, now + dur * 0.15);
    g.gain.setValueAtTime(0.08, now + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(filter);
    filter.connect(g);
    g.connect(musicGain);
    osc.start(now);
    osc.stop(now + dur);
  }
  if (musicState.mode === "combat") {
    var beatCount = Math.floor(dur / 0.5);
    for (var b = 0; b < beatCount; b++) {
      var bt = now + b * 0.5;
      var kick = ctx.createOscillator();
      kick.type = "sine";
      kick.frequency.setValueAtTime(80, bt);
      kick.frequency.exponentialRampToValueAtTime(30, bt + 0.1);
      var kg = ctx.createGain();
      kg.gain.setValueAtTime(0.12, bt);
      kg.gain.exponentialRampToValueAtTime(0.001, bt + 0.15);
      kick.connect(kg);
      kg.connect(musicGain);
      kick.start(bt);
      kick.stop(bt + 0.15);
    }
  }
}
