// sound.js — procedural audio core, engine, and ambience (no audio files)
var ctx = null;
var masterGain = null;
var musicGain = null;
var sfxGain = null;
var ambienceGain = null;
var compressor = null;
var muted = false;
var masterVolume = 0.5;
var unlocked = false;

// engine layers
var engineLayers = null;
var engineClassKey = "cruiser";
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

// low HP
var lowHpOsc = null;
var lowHpGain = null;
var lowHpActive = false;

// music
var musicState = null;

// --- per-class engine tuning ---
var ENGINE_PROFILES = {
  destroyer: { baseFreq: 55, whineFreq: 400, whineMax: 1200, rumbleVol: 0.04, chugRate: 8, chugDepth: 0.15, whineVol: 0.06, filterBase: 150 },
  cruiser:   { baseFreq: 38, whineFreq: 250, whineMax: 800, rumbleVol: 0.06, chugRate: 5, chugDepth: 0.2, whineVol: 0.04, filterBase: 120 },
  carrier:   { baseFreq: 28, whineFreq: 180, whineMax: 500, rumbleVol: 0.08, chugRate: 3, chugDepth: 0.25, whineVol: 0.03, filterBase: 90 },
  submarine: { baseFreq: 50, whineFreq: 300, whineMax: 600, rumbleVol: 0.03, chugRate: 6, chugDepth: 0.1, whineVol: 0.02, filterBase: 100 }
};

function ensureContext() {
  if (ctx) return true;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    // compressor on master output to prevent clipping
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

// --- layered engine: rumble + mechanical chug + whine + wake ---
export function setEngineClass(classKey) {
  engineClassKey = classKey || "cruiser";
  // tear down existing layers so they rebuild with new profile
  if (engineLayers) {
    try { engineLayers.rumble.osc.stop(); } catch (e) { /* ok */ }
    try { engineLayers.whine.osc.stop(); } catch (e) { /* ok */ }
    try { engineLayers.chug.lfo.stop(); } catch (e) { /* ok */ }
    engineLayers = null;
  }
}

function buildEngine() {
  var p = ENGINE_PROFILES[engineClassKey] || ENGINE_PROFILES.cruiser;

  // layer 1: bass rumble oscillator
  var rumbleOsc = ctx.createOscillator();
  rumbleOsc.type = "sawtooth";
  rumbleOsc.frequency.value = p.baseFreq;
  var rumbleFilter = ctx.createBiquadFilter();
  rumbleFilter.type = "lowpass";
  rumbleFilter.frequency.value = p.filterBase;
  rumbleFilter.Q.value = 2;
  var rumbleGain = ctx.createGain();
  rumbleGain.gain.value = 0;
  rumbleOsc.connect(rumbleFilter);
  rumbleFilter.connect(rumbleGain);
  rumbleGain.connect(ambienceGain);
  rumbleOsc.start();

  // layer 2: mechanical chug — LFO amplitude-modulating a sub-oscillator
  var chugOsc = ctx.createOscillator();
  chugOsc.type = "triangle";
  chugOsc.frequency.value = p.baseFreq * 1.5;
  var chugGain = ctx.createGain();
  chugGain.gain.value = 0;
  var chugLfo = ctx.createOscillator();
  chugLfo.type = "square";
  chugLfo.frequency.value = p.chugRate;
  var chugLfoGain = ctx.createGain();
  chugLfoGain.gain.value = 0;
  chugLfo.connect(chugLfoGain);
  chugLfoGain.connect(chugGain.gain);
  chugOsc.connect(chugGain);
  chugGain.connect(ambienceGain);
  chugOsc.start();
  chugLfo.start();

  // layer 3: high-frequency whine
  var whineOsc = ctx.createOscillator();
  whineOsc.type = "sine";
  whineOsc.frequency.value = p.whineFreq;
  var whineFilter = ctx.createBiquadFilter();
  whineFilter.type = "bandpass";
  whineFilter.frequency.value = p.whineFreq;
  whineFilter.Q.value = 3;
  var whineGain = ctx.createGain();
  whineGain.gain.value = 0;
  whineOsc.connect(whineFilter);
  whineFilter.connect(whineGain);
  whineGain.connect(ambienceGain);
  whineOsc.start();

  engineLayers = {
    rumble: { osc: rumbleOsc, filter: rumbleFilter, gain: rumbleGain },
    chug: { osc: chugOsc, gain: chugGain, lfo: chugLfo, lfoGain: chugLfoGain },
    whine: { osc: whineOsc, filter: whineFilter, gain: whineGain },
    profile: p
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

export function updateEngine(speedRatio) {
  if (!ctx || !unlocked) return;
  if (!engineLayers) buildEngine();
  if (!wakeNoise) buildWake();
  var p = engineLayers.profile;
  var ratio = Math.max(0, Math.min(1, speedRatio));

  // smooth throttle response
  smoothSpeed += (ratio - smoothSpeed) * 0.04;
  var s = smoothSpeed;

  // idle throb when stationary
  var idleVol = (1 - s) * 0.02;

  // rumble layer
  engineLayers.rumble.osc.frequency.value = p.baseFreq + s * p.baseFreq * 0.8;
  engineLayers.rumble.gain.gain.value = p.rumbleVol + s * p.rumbleVol * 2 + idleVol;
  engineLayers.rumble.filter.frequency.value = p.filterBase + s * 400;

  // chug layer — rate increases with speed
  engineLayers.chug.lfo.frequency.value = p.chugRate + s * p.chugRate;
  engineLayers.chug.lfoGain.gain.value = p.chugDepth * (0.3 + s * 0.7);
  engineLayers.chug.osc.frequency.value = p.baseFreq * 1.5 + s * 30;
  engineLayers.chug.gain.gain.value = 0.03 + s * 0.05;

  // whine layer — only at higher speeds
  var whineAmount = Math.max(0, s - 0.2) / 0.8;
  engineLayers.whine.osc.frequency.value = p.whineFreq + whineAmount * (p.whineMax - p.whineFreq);
  engineLayers.whine.filter.frequency.value = p.whineFreq + whineAmount * (p.whineMax - p.whineFreq);
  engineLayers.whine.gain.gain.value = p.whineVol * whineAmount;

  // wake/spray layer
  wakeGainNode.gain.value = s * 0.08;
  wakeFilter.frequency.value = 1500 + s * 3000;
}

// --- ocean ambience: rhythmic swells + wind gusts ---
function startAmbience() {
  if (waveNoise) return;
  var buf = makeNoise(ctx, 2);

  // wave noise with rhythmic swell LFO
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
  swellLfo.frequency.value = 0.12; // ~8 second cycle
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

export function updateAmbience(weatherKey, dt) {
  if (!ctx || !unlocked) return;
  var tw = 0.15, twd = 0, twf = 300, twdf = 800, swellAmt = 0.06;
  if (weatherKey === "storm") { tw = 0.35; twd = 0.25; twf = 500; twdf = 600; swellAmt = 0.12; }
  else if (weatherKey === "rough") { tw = 0.25; twd = 0.12; twf = 400; twdf = 700; swellAmt = 0.09; }
  if (waveGainNode) waveGainNode.gain.value += (tw - waveGainNode.gain.value) * 0.02;
  if (waveFilter) waveFilter.frequency.value += (twf - waveFilter.frequency.value) * 0.02;
  if (swellGain) swellGain.gain.value += (swellAmt - swellGain.gain.value) * 0.02;

  // intermittent wind gusts in storms
  if (weatherKey === "storm" || weatherKey === "rough") {
    gustTimer -= (dt || 0.016);
    if (gustTimer <= 0) {
      gustTarget = twd * (0.5 + Math.random() * 1.5);
      gustTimer = 2 + Math.random() * 5;
    }
  } else {
    gustTarget = twd;
  }
  if (windGainNode) windGainNode.gain.value += (gustTarget - windGainNode.gain.value) * 0.03;
  if (windFilter) windFilter.frequency.value += (twdf - windFilter.frequency.value) * 0.02;
}

// --- low HP warning: heartbeat pulse ---
export function updateLowHpWarning(hpRatio) {
  if (!ctx || !unlocked) return;
  var shouldWarn = hpRatio > 0 && hpRatio < 0.25;
  if (shouldWarn && !lowHpActive) {
    lowHpActive = true;
    lowHpOsc = ctx.createOscillator();
    lowHpOsc.type = "sine";
    lowHpOsc.frequency.value = 1.2; // heartbeat rate
    lowHpGain = ctx.createGain();
    lowHpGain.gain.value = 0;
    var pulseOsc = ctx.createOscillator();
    pulseOsc.type = "sine";
    pulseOsc.frequency.value = 60;
    var pulseGain = ctx.createGain();
    pulseGain.gain.value = 0;
    lowHpOsc.connect(pulseGain.gain);
    pulseOsc.connect(pulseGain);
    pulseGain.connect(sfxGain);
    pulseOsc.start();
    lowHpOsc.start();
    lowHpOsc._pulse = pulseOsc;
    lowHpOsc._pulseGain = pulseGain;
    lowHpGain = pulseGain;
  } else if (!shouldWarn && lowHpActive) {
    lowHpActive = false;
    if (lowHpOsc) {
      try { lowHpOsc.stop(); } catch (e) { /* ok */ }
      try { lowHpOsc._pulse.stop(); } catch (e) { /* ok */ }
      lowHpOsc = null;
    }
  }
  // scale intensity with how low HP is
  if (lowHpActive && lowHpOsc) {
    var intensity = 1 - (hpRatio / 0.25);
    lowHpOsc.frequency.value = 1.0 + intensity * 0.8;
    if (lowHpOsc._pulseGain) lowHpOsc._pulseGain.gain.value = 0.08 + intensity * 0.08;
  }
}

// --- procedural music (unchanged) ---
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
