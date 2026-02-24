// music.js — procedural pirate music: shanty-style pentatonic melodies (no audio files)

var musicCtx = null;
var musicGainNode = null;
var musicState = null;

// pentatonic scale intervals for pirate feel (C D E G A)
var PENTA = [0, 2, 4, 7, 9];

// calm exploration — gentle, sparse pentatonic
var CALM_CHORDS = [
  [60, 64, 67], [65, 69, 72], [55, 59, 62],
  [57, 60, 64], [60, 64, 67], [53, 57, 60]
];

// combat — driving, more intense with minor flavor
var COMBAT_CHORDS = [
  [48, 55, 60], [53, 60, 65], [50, 57, 62],
  [48, 55, 60], [46, 53, 58], [48, 55, 60]
];

// port/tavern — relaxed, warm major chords
var PORT_CHORDS = [
  [60, 64, 67, 72], [65, 69, 72, 76], [62, 65, 69, 74],
  [55, 59, 62, 67], [60, 64, 67, 72], [57, 60, 64, 69]
];

// boss — dramatic, darker key
var BOSS_CHORDS = [
  [45, 52, 57], [43, 50, 55], [41, 48, 53],
  [40, 47, 52], [43, 50, 55], [45, 52, 57]
];

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function initMusic(ctx, gainNode) {
  musicCtx = ctx;
  musicGainNode = gainNode;
}

export function startMusic() {
  if (musicState || !musicCtx) return;
  musicState = {
    mode: "calm", chordIndex: 0,
    nextChordTime: musicCtx.currentTime + 0.5,
    chordDuration: 4.0,
    melodyIndex: 0,
    nextMelodyTime: musicCtx.currentTime + 1.0
  };
}

export function updateMusic(inCombat) {
  if (!musicCtx || !musicGainNode || !musicState) return;
  var now = musicCtx.currentTime;
  var targetMode = inCombat ? "combat" : "calm";
  if (targetMode !== musicState.mode) {
    musicState.mode = targetMode;
  }

  var chords, dur, oscType, filterFreq;
  if (musicState.mode === "combat") {
    chords = COMBAT_CHORDS; dur = 2.0; oscType = "sawtooth"; filterFreq = 600;
  } else if (musicState.mode === "port") {
    chords = PORT_CHORDS; dur = 5.0; oscType = "triangle"; filterFreq = 500;
  } else if (musicState.mode === "boss") {
    chords = BOSS_CHORDS; dur = 1.8; oscType = "sawtooth"; filterFreq = 700;
  } else {
    chords = CALM_CHORDS; dur = 4.0; oscType = "triangle"; filterFreq = 400;
  }
  musicState.chordDuration = dur;

  // play chord pads — accordion/concertina feel with detuned oscillators
  if (now >= musicState.nextChordTime) {
    var chord = chords[musicState.chordIndex % chords.length];
    musicState.chordIndex++;
    musicState.nextChordTime = now + dur;
    for (var i = 0; i < chord.length; i++) {
      for (var d = 0; d < 2; d++) {
        var osc = musicCtx.createOscillator();
        osc.type = oscType;
        var detune = (d === 0) ? -6 : 6;
        osc.frequency.value = midiToFreq(chord[i]) * Math.pow(2, detune / 1200);
        var filter = musicCtx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = filterFreq;
        filter.Q.value = 0.5;
        var g = musicCtx.createGain();
        var vol = 0.04;
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(vol, now + dur * 0.15);
        g.gain.setValueAtTime(vol, now + dur * 0.7);
        g.gain.exponentialRampToValueAtTime(0.001, now + dur);
        osc.connect(filter);
        filter.connect(g);
        g.connect(musicGainNode);
        osc.start(now);
        osc.stop(now + dur);
      }
    }

    // combat/boss: driving drum pattern
    if (musicState.mode === "combat" || musicState.mode === "boss") {
      var beatCount = Math.floor(dur / 0.5);
      for (var b = 0; b < beatCount; b++) {
        var bt = now + b * 0.5;
        var kick = musicCtx.createOscillator();
        kick.type = "sine";
        kick.frequency.setValueAtTime(80, bt);
        kick.frequency.exponentialRampToValueAtTime(25, bt + 0.12);
        var kg = musicCtx.createGain();
        kg.gain.setValueAtTime(0.14, bt);
        kg.gain.exponentialRampToValueAtTime(0.001, bt + 0.18);
        kick.connect(kg);
        kg.connect(musicGainNode);
        kick.start(bt);
        kick.stop(bt + 0.18);
        if (b % 2 === 1) {
          playMusicNoiseHit(bt, 0.06, 0.06, 3000);
        }
      }
    }
  }

  // pentatonic melody line — shanty-style
  if (now >= musicState.nextMelodyTime) {
    var baseNote = 72;
    var pIdx = musicState.melodyIndex % PENTA.length;
    var note = baseNote + PENTA[pIdx];
    if (musicState.melodyIndex % 7 === 3) note += 12;
    musicState.melodyIndex++;
    var mDur = (musicState.mode === "combat" || musicState.mode === "boss") ? 0.25 : 0.5;
    musicState.nextMelodyTime = now + mDur + Math.random() * mDur * 0.5;

    var mOsc = musicCtx.createOscillator();
    mOsc.type = "triangle";
    mOsc.frequency.value = midiToFreq(note);
    var mFilt = musicCtx.createBiquadFilter();
    mFilt.type = "lowpass";
    mFilt.frequency.value = musicState.mode === "calm" ? 800 : 1200;
    var mGn = musicCtx.createGain();
    mGn.gain.setValueAtTime(0, now);
    mGn.gain.linearRampToValueAtTime(0.05, now + 0.02);
    mGn.gain.exponentialRampToValueAtTime(0.001, now + mDur * 0.9);
    mOsc.connect(mFilt);
    mFilt.connect(mGn);
    mGn.connect(musicGainNode);
    mOsc.start(now);
    mOsc.stop(now + mDur);
  }
}

function playMusicNoiseHit(now, duration, volume, freq) {
  if (!musicCtx || !musicGainNode) return;
  var bufferSize = Math.floor(musicCtx.sampleRate * duration);
  var buffer = musicCtx.createBuffer(1, bufferSize, musicCtx.sampleRate);
  var data = buffer.getChannelData(0);
  for (var i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  var src = musicCtx.createBufferSource();
  src.buffer = buffer;
  var filter = musicCtx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = freq || 2000;
  var g = musicCtx.createGain();
  g.gain.setValueAtTime(volume, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + duration);
  src.connect(filter);
  filter.connect(g);
  g.connect(musicGainNode);
  src.start(now);
}
