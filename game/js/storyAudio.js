// storyAudio.js — sampled story cues with procedural fallback

import { getCtx, getSfxGain, isReady, playNoiseShot } from "./sound.js";

var CUE_PATHS = {
  event_open: "assets/audio/story/event-open.wav",
  event_hover: "assets/audio/story/event-hover.wav",
  event_confirm: "assets/audio/story/event-confirm.wav",
  event_positive: "assets/audio/story/event-positive.wav",
  event_negative: "assets/audio/story/event-negative.wav",
  reputation_up: "assets/audio/story/reputation-up.wav",
  reputation_down: "assets/audio/story/reputation-down.wav",
  region_transition: "assets/audio/story/region-transition.wav",
  journal_update: "assets/audio/story/journal-update.wav",
  boss_omen: "assets/audio/story/boss-omen.wav"
};

var _bufferPromises = {};
var _decodedBuffers = {};

function sanitizeCueId(cueId) {
  if (!cueId) return "event_confirm";
  var key = String(cueId).trim().toLowerCase().replace(/[^a-z0-9_\\-]/g, "_");
  return CUE_PATHS[key] ? key : "event_confirm";
}

function decodeCue(cueId) {
  var id = sanitizeCueId(cueId);
  if (_decodedBuffers[id]) return Promise.resolve(_decodedBuffers[id]);
  if (_bufferPromises[id]) return _bufferPromises[id];

  if (!isReady() || !getCtx()) {
    return Promise.resolve(null);
  }

  var path = CUE_PATHS[id];
  _bufferPromises[id] = fetch(path)
    .then(function (res) {
      if (!res.ok) throw new Error("story cue fetch failed");
      return res.arrayBuffer();
    })
    .then(function (arr) {
      var ctx = getCtx();
      if (!ctx) return null;
      return ctx.decodeAudioData(arr.slice(0));
    })
    .then(function (buf) {
      _decodedBuffers[id] = buf || null;
      return _decodedBuffers[id];
    })
    .catch(function () {
      _decodedBuffers[id] = null;
      return null;
    });

  return _bufferPromises[id];
}

function playBufferNow(buffer, volume, rate) {
  var ctx = getCtx();
  var sfx = getSfxGain();
  if (!ctx || !sfx || !buffer) return false;

  var now = ctx.currentTime;
  var src = ctx.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = rate;

  var g = ctx.createGain();
  g.gain.setValueAtTime(Math.max(0.001, volume), now);
  g.gain.exponentialRampToValueAtTime(0.001, now + Math.max(0.08, buffer.duration * 1.2));
  src.connect(g);
  g.connect(sfx);
  src.start(now);
  return true;
}

function fallbackTone(cueId, volume) {
  if (!isReady()) return;
  var ctx = getCtx();
  var sfx = getSfxGain();
  if (!ctx || !sfx) return;

  var now = ctx.currentTime;
  var id = sanitizeCueId(cueId);
  var f0 = 360;
  var f1 = 240;
  var dur = 0.18;

  if (id === "event_open") { f0 = 300; f1 = 220; dur = 0.24; }
  else if (id === "event_hover") { f0 = 640; f1 = 540; dur = 0.09; }
  else if (id === "event_confirm") { f0 = 720; f1 = 460; dur = 0.12; }
  else if (id === "event_positive" || id === "reputation_up" || id === "journal_update") { f0 = 520; f1 = 760; dur = 0.15; }
  else if (id === "event_negative" || id === "reputation_down") { f0 = 420; f1 = 220; dur = 0.18; }
  else if (id === "region_transition") { f0 = 260; f1 = 460; dur = 0.28; }
  else if (id === "boss_omen") { f0 = 120; f1 = 64; dur = 0.42; }

  var osc = ctx.createOscillator();
  osc.type = id === "boss_omen" ? "sawtooth" : "triangle";
  osc.frequency.setValueAtTime(f0, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), now + dur);

  var g = ctx.createGain();
  g.gain.setValueAtTime(Math.max(0.001, volume), now);
  g.gain.exponentialRampToValueAtTime(0.001, now + dur);

  osc.connect(g);
  g.connect(sfx);
  osc.start(now);
  osc.stop(now + dur);

  if (id === "boss_omen") {
    playNoiseShot(now, 0.2, Math.max(0.06, volume * 0.6), 260);
  }
}

export function preloadStoryAudio() {
  if (!isReady()) return;
  var keys = Object.keys(CUE_PATHS);
  for (var i = 0; i < keys.length; i++) {
    decodeCue(keys[i]);
  }
}

export function playStoryCue(cueId, opts) {
  if (!isReady()) return;
  var options = opts || {};
  var volume = Math.max(0.001, Math.min(1, options.volume !== undefined ? options.volume : 0.4));
  var rate = Math.max(0.5, Math.min(2.0, options.rate !== undefined ? options.rate : 1));
  var id = sanitizeCueId(cueId);

  decodeCue(id).then(function (buffer) {
    if (!playBufferNow(buffer, volume, rate)) {
      fallbackTone(id, volume);
    }
  }).catch(function () {
    fallbackTone(id, volume);
  });
}

export function getStoryCuePaths() {
  return Object.assign({}, CUE_PATHS);
}
