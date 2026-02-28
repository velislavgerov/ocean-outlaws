// sound.js — procedural audio core: wind propulsion, ocean ambience (no audio files)
import { initMusic, startMusic as startMusicModule, updateMusic as updateMusicModule } from "./music.js";

var ctx = null;
var masterGain = null;
var musicGain = null;
var sfxGain = null;
var ambienceGain = null;
var compressor = null;
var muted = false;
var masterVolume = 0.5;
var unlocked = false;

// wind/sail propulsion layers
var windLayers = null;
var smoothSpeed = 0;

// wake layer
var wakeNoise = null;
var wakeFilter = null;
var wakeGainNode = null;

// ambience
var waveNoise = null;
var waveGainNode = null;
var waveFilter = null;
var windNoise = null;
var windGainNode = null;
var windFilter = null;
var swellLfo = null;
var swellGain = null;
var gustTimer = 0;
var gustTarget = 0;

// hull creaking
var hullCreakTimer = 0;

// seagull chirps
var seagullTimer = 0;

// low HP — hull stress
var lowHpOsc = null;
var lowHpGain = null;
var lowHpActive = false;

function ensureContext() {
  if (ctx) return true;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -12;
    compressor.knee.value = 10;
    compressor.ratio.value = 8;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.15;
    compressor.connect(ctx.destination);
    masterGain = ctx.createGain();
    masterGain.gain.value = masterVolume;
    masterGain.connect(compressor);
    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.6;
    sfxGain.connect(masterGain);
    ambienceGain = ctx.createGain();
    ambienceGain.gain.value = 0.3;
    ambienceGain.connect(masterGain);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.18;
    musicGain.connect(masterGain);
    initMusic(ctx, musicGain);
    return true;
  } catch (e) {
    return false;
  }
}

export function getCtx() { return ctx; }
export function getSfxGain() { return sfxGain; }
export function isReady() { return ctx && unlocked; }

export function makeNoise(audioCtx, seconds) {
  var size = Math.floor(audioCtx.sampleRate * seconds);
  var buf = audioCtx.createBuffer(1, size, audioCtx.sampleRate);
  var d = buf.getChannelData(0);
  for (var i = 0; i < size; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

export function playNoiseShot(now, duration, volume, filterFreq) {
  if (!ctx || !sfxGain) return;
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

export function unlockAudio() {
  if (unlocked) return;
  if (!ensureContext()) return;
  if (ctx.state === "suspended") ctx.resume();
  unlocked = true;
  startAmbience();
  startMusicModule();
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

// --- fade game audio for menu screens ---
var savedAmbienceVol = 0.3;
var savedMusicVol = 0.18;
var savedSfxVol = 0.6;
var gameAudioFaded = false;

export function fadeGameAudio() {
  if (gameAudioFaded) return;
  gameAudioFaded = true;
  if (ambienceGain) {
    savedAmbienceVol = ambienceGain.gain.value;
    ambienceGain.gain.value = 0;
  }
  if (musicGain) {
    savedMusicVol = musicGain.gain.value;
    musicGain.gain.value = 0;
  }
  if (sfxGain) {
    savedSfxVol = sfxGain.gain.value;
    sfxGain.gain.value = 0;
  }
}

export function resumeGameAudio() {
  if (!gameAudioFaded) return;
  gameAudioFaded = false;
  if (ambienceGain) ambienceGain.gain.value = savedAmbienceVol;
  if (musicGain) musicGain.gain.value = savedMusicVol;
  if (sfxGain) sfxGain.gain.value = savedSfxVol;
}

// --- wind/sail propulsion: filtered wind noise + canvas flapping + rigging creak ---
export function setSailClass(classKey) {
  // pirate ships share the same wind profile — kept for API compat
  if (windLayers) {
    try { windLayers.windSrc.stop(); } catch (e) { /* ok */ }
    try { windLayers.flapLfo.stop(); } catch (e) { /* ok */ }
    try { windLayers.creakOsc.stop(); } catch (e) { /* ok */ }
    windLayers = null;
  }
}

function buildWindPropulsion() {
  // layer 1: wind in sails — filtered noise with periodic gusting
  var windBuf = makeNoise(ctx, 2);
  var windSrc = ctx.createBufferSource();
  windSrc.buffer = windBuf;
  windSrc.loop = true;
  var windFilt = ctx.createBiquadFilter();
  windFilt.type = "bandpass";
  windFilt.frequency.value = 600;
  windFilt.Q.value = 0.6;
  var windGn = ctx.createGain();
  windGn.gain.value = 0;
  var gustLfo = ctx.createOscillator();
  gustLfo.type = "sine";
  gustLfo.frequency.value = 0.3;
  var gustLfoGn = ctx.createGain();
  gustLfoGn.gain.value = 0;
  gustLfo.connect(gustLfoGn);
  gustLfoGn.connect(windGn.gain);
  gustLfo.start();
  windSrc.connect(windFilt);
  windFilt.connect(windGn);
  windGn.connect(ambienceGain);
  windSrc.start();

  // layer 2: canvas flapping — rhythmic amplitude modulation
  var flapSrc = ctx.createBufferSource();
  flapSrc.buffer = windBuf;
  flapSrc.loop = true;
  var flapFilt = ctx.createBiquadFilter();
  flapFilt.type = "highpass";
  flapFilt.frequency.value = 1200;
  flapFilt.Q.value = 0.3;
  var flapGn = ctx.createGain();
  flapGn.gain.value = 0;
  var flapLfo = ctx.createOscillator();
  flapLfo.type = "square";
  flapLfo.frequency.value = 3;
  var flapLfoGn = ctx.createGain();
  flapLfoGn.gain.value = 0;
  flapLfo.connect(flapLfoGn);
  flapLfoGn.connect(flapGn.gain);
  flapSrc.connect(flapFilt);
  flapFilt.connect(flapGn);
  flapGn.connect(ambienceGain);
  flapSrc.start();
  flapLfo.start();

  // layer 3: rope/rigging creak — subtle low-frequency tone
  var creakOsc = ctx.createOscillator();
  creakOsc.type = "triangle";
  creakOsc.frequency.value = 80;
  var creakFilt = ctx.createBiquadFilter();
  creakFilt.type = "bandpass";
  creakFilt.frequency.value = 90;
  creakFilt.Q.value = 5;
  var creakGn = ctx.createGain();
  creakGn.gain.value = 0;
  creakOsc.connect(creakFilt);
  creakFilt.connect(creakGn);
  creakGn.connect(ambienceGain);
  creakOsc.start();

  windLayers = {
    windSrc: windSrc, windFilt: windFilt, windGn: windGn,
    gustLfo: gustLfo, gustLfoGn: gustLfoGn,
    flapSrc: flapSrc, flapFilt: flapFilt, flapGn: flapGn,
    flapLfo: flapLfo, flapLfoGn: flapLfoGn,
    creakOsc: creakOsc, creakFilt: creakFilt, creakGn: creakGn
  };
}

function buildWake() {
  var buf = makeNoise(ctx, 2);
  wakeNoise = ctx.createBufferSource();
  wakeNoise.buffer = buf;
  wakeNoise.loop = true;
  wakeFilter = ctx.createBiquadFilter();
  wakeFilter.type = "highpass";
  wakeFilter.frequency.value = 2000;
  wakeFilter.Q.value = 0.5;
  wakeGainNode = ctx.createGain();
  wakeGainNode.gain.value = 0;
  wakeNoise.connect(wakeFilter);
  wakeFilter.connect(wakeGainNode);
  wakeGainNode.connect(ambienceGain);
  wakeNoise.start();
}

export function updateSailing(speedRatio) {
  if (!ctx || !unlocked) return;
  if (!windLayers) buildWindPropulsion();
  if (!wakeNoise) buildWake();
  var ratio = Math.max(0, Math.min(1, speedRatio));

  smoothSpeed += (ratio - smoothSpeed) * 0.04;
  var s = smoothSpeed;

  // wind in sails — intensity scales with speed
  windLayers.windGn.gain.value = s * 0.1;
  windLayers.windFilt.frequency.value = 400 + s * 800;
  windLayers.gustLfoGn.gain.value = 0.01 + s * 0.04;
  windLayers.gustLfo.frequency.value = 0.2 + s * 0.5;

  // canvas flapping — faster when accelerating/at speed
  windLayers.flapLfo.frequency.value = 2 + s * 8;
  windLayers.flapLfoGn.gain.value = s * 0.03;
  windLayers.flapGn.gain.value = s * 0.04;

  // rigging creak
  windLayers.creakGn.gain.value = s * 0.015;
  windLayers.creakOsc.frequency.value = 70 + s * 30;

  // wake/bow spray — increases with speed
  wakeGainNode.gain.value = s * 0.08;
  wakeFilter.frequency.value = 1500 + s * 3000;
}

// --- ocean ambience: rhythmic swells + wind gusts + hull creaking + seagulls ---
function startAmbience() {
  if (waveNoise) return;
  var buf = makeNoise(ctx, 2);

  waveNoise = ctx.createBufferSource();
  waveNoise.buffer = buf;
  waveNoise.loop = true;
  waveFilter = ctx.createBiquadFilter();
  waveFilter.type = "lowpass";
  waveFilter.frequency.value = 300;
  waveFilter.Q.value = 0.5;
  waveGainNode = ctx.createGain();
  waveGainNode.gain.value = 0.15;

  // swell LFO — modulates wave volume for periodic rhythm
  swellLfo = ctx.createOscillator();
  swellLfo.type = "sine";
  swellLfo.frequency.value = 0.12;
  swellGain = ctx.createGain();
  swellGain.gain.value = 0.06;
  swellLfo.connect(swellGain);
  swellGain.connect(waveGainNode.gain);
  swellLfo.start();

  waveNoise.connect(waveFilter);
  waveFilter.connect(waveGainNode);
  waveGainNode.connect(ambienceGain);
  waveNoise.start();

  // wind noise
  var windBuf = makeNoise(ctx, 2);
  windNoise = ctx.createBufferSource();
  windNoise.buffer = windBuf;
  windNoise.loop = true;
  windFilter = ctx.createBiquadFilter();
  windFilter.type = "bandpass";
  windFilter.frequency.value = 800;
  windFilter.Q.value = 0.8;
  windGainNode = ctx.createGain();
  windGainNode.gain.value = 0;
  windNoise.connect(windFilter);
  windFilter.connect(windGainNode);
  windGainNode.connect(ambienceGain);
  windNoise.start();
}

// play a one-shot hull creak sound
function playHullCreak() {
  if (!ctx || !ambienceGain) return;
  var now = ctx.currentTime;
  var osc = ctx.createOscillator();
  osc.type = "triangle";
  var baseFreq = 60 + Math.random() * 40;
  osc.frequency.setValueAtTime(baseFreq, now);
  osc.frequency.linearRampToValueAtTime(baseFreq * 0.7, now + 0.4);
  var filt = ctx.createBiquadFilter();
  filt.type = "bandpass";
  filt.frequency.value = baseFreq;
  filt.Q.value = 8;
  var g = ctx.createGain();
  g.gain.setValueAtTime(0.001, now);
  g.gain.linearRampToValueAtTime(0.06, now + 0.05);
  g.gain.setValueAtTime(0.06, now + 0.15);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
  osc.connect(filt);
  filt.connect(g);
  g.connect(ambienceGain);
  osc.start(now);
  osc.stop(now + 0.5);
}

// play a one-shot seagull chirp
function playSeagullChirp() {
  if (!ctx || !ambienceGain) return;
  var now = ctx.currentTime;
  for (var i = 0; i < 2; i++) {
    var t = now + i * 0.15;
    var osc = ctx.createOscillator();
    osc.type = "sine";
    var freq = 2200 + Math.random() * 600;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.linearRampToValueAtTime(freq * 0.75, t + 0.1);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.025, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(g);
    g.connect(ambienceGain);
    osc.start(t);
    osc.stop(t + 0.12);
  }
}

export function updateAmbience(weatherKey, dt) {
  if (!ctx || !unlocked) return;
  var deltaT = dt || 0.016;
  var tw = 0.15, twd = 0, twf = 300, twdf = 800, swellAmt = 0.06;
  if (weatherKey === "storm") { tw = 0.35; twd = 0.25; twf = 500; twdf = 600; swellAmt = 0.12; }
  else if (weatherKey === "rough") { tw = 0.25; twd = 0.12; twf = 400; twdf = 700; swellAmt = 0.09; }
  if (waveGainNode) waveGainNode.gain.value += (tw - waveGainNode.gain.value) * 0.02;
  if (waveFilter) waveFilter.frequency.value += (twf - waveFilter.frequency.value) * 0.02;
  if (swellGain) swellGain.gain.value += (swellAmt - swellGain.gain.value) * 0.02;

  // intermittent wind gusts — whistling during storms
  if (weatherKey === "storm" || weatherKey === "rough") {
    gustTimer -= deltaT;
    if (gustTimer <= 0) {
      gustTarget = twd * (0.5 + Math.random() * 1.5);
      gustTimer = 2 + Math.random() * 5;
    }
  } else {
    gustTarget = twd;
  }
  if (windGainNode) windGainNode.gain.value += (gustTarget - windGainNode.gain.value) * 0.03;
  if (windFilter) {
    var targetWindFreq = twdf;
    if (weatherKey === "storm") targetWindFreq = 1200 + Math.random() * 400;
    windFilter.frequency.value += (targetWindFreq - windFilter.frequency.value) * 0.02;
  }

  // hull creaking — wooden groaning in rough seas
  if (weatherKey === "storm" || weatherKey === "rough") {
    hullCreakTimer -= deltaT;
    if (hullCreakTimer <= 0) {
      playHullCreak();
      hullCreakTimer = (weatherKey === "storm" ? 1.5 : 3) + Math.random() * 3;
    }
  }

  // seagull chirps — occasional in calm weather
  if (weatherKey !== "storm") {
    seagullTimer -= deltaT;
    if (seagullTimer <= 0) {
      playSeagullChirp();
      seagullTimer = 8 + Math.random() * 15;
    }
  }
}

// --- low HP warning: hull stress creaking (thematic, not alarm beep) ---
export function updateLowHpWarning(hpRatio) {
  if (!ctx || !unlocked) return;
  var shouldWarn = hpRatio > 0 && hpRatio < 0.25;
  if (shouldWarn && !lowHpActive) {
    lowHpActive = true;
    var stressOsc = ctx.createOscillator();
    stressOsc.type = "triangle";
    stressOsc.frequency.value = 50;
    var stressFilt = ctx.createBiquadFilter();
    stressFilt.type = "bandpass";
    stressFilt.frequency.value = 55;
    stressFilt.Q.value = 10;
    var stressGn = ctx.createGain();
    stressGn.gain.value = 0;
    var stressLfo = ctx.createOscillator();
    stressLfo.type = "sine";
    stressLfo.frequency.value = 1.0;
    var stressLfoGn = ctx.createGain();
    stressLfoGn.gain.value = 0.04;
    stressLfo.connect(stressLfoGn);
    stressLfoGn.connect(stressGn.gain);
    stressOsc.connect(stressFilt);
    stressFilt.connect(stressGn);
    stressGn.connect(sfxGain);
    stressOsc.start();
    stressLfo.start();
    lowHpOsc = stressOsc;
    lowHpOsc._lfo = stressLfo;
    lowHpOsc._lfoGain = stressLfoGn;
    lowHpOsc._filter = stressFilt;
    lowHpGain = stressGn;
  } else if (!shouldWarn && lowHpActive) {
    lowHpActive = false;
    if (lowHpOsc) {
      try { lowHpOsc.stop(); } catch (e) { /* ok */ }
      try { lowHpOsc._lfo.stop(); } catch (e) { /* ok */ }
      lowHpOsc = null;
    }
  }
  if (lowHpActive && lowHpOsc) {
    var intensity = 1 - (hpRatio / 0.25);
    lowHpOsc.frequency.value = 45 + intensity * 15;
    if (lowHpOsc._filter) lowHpOsc._filter.frequency.value = 50 + intensity * 20;
    if (lowHpOsc._lfo) lowHpOsc._lfo.frequency.value = 0.8 + intensity * 1.2;
    if (lowHpOsc._lfoGain) lowHpOsc._lfoGain.gain.value = 0.04 + intensity * 0.06;
    if (lowHpGain) lowHpGain.gain.value = 0.02 + intensity * 0.04;
  }
}

// --- music: delegate to music.js ---
// accepts explicit mode ("calm"|"combat"|"port"|"boss"), while still handling
// the previous boolean combat API for compatibility.
export function updateMusic(modeOrCombat) {
  if (!ctx || !unlocked) return;
  updateMusicModule(modeOrCombat);
}
