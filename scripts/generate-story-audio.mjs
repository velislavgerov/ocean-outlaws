#!/usr/bin/env node
// generate-story-audio.mjs — deterministic placeholder WAV cues for narrative events

import fs from "node:fs";
import path from "node:path";

const SAMPLE_RATE = 44100;
const OUT_DIR = path.resolve("game/assets/audio/story");

const CUES = {
  "event-open.wav": { dur: 0.42, tones: [[260, 0.2], [390, 0.22]], noise: 0.02, env: "soft" },
  "event-hover.wav": { dur: 0.12, tones: [[680, 0.08]], noise: 0.005, env: "pluck" },
  "event-confirm.wav": { dur: 0.14, tones: [[520, 0.12], [760, 0.08]], noise: 0.01, env: "pluck" },
  "event-positive.wav": { dur: 0.28, tones: [[420, 0.16], [540, 0.16], [720, 0.12]], noise: 0.01, env: "rise" },
  "event-negative.wav": { dur: 0.32, tones: [[420, 0.14], [280, 0.2]], noise: 0.02, env: "fall" },
  "reputation-up.wav": { dur: 0.24, tones: [[480, 0.16], [700, 0.14]], noise: 0.008, env: "rise" },
  "reputation-down.wav": { dur: 0.24, tones: [[480, 0.12], [260, 0.18]], noise: 0.012, env: "fall" },
  "region-transition.wav": { dur: 0.62, tones: [[180, 0.14], [260, 0.14], [390, 0.14]], noise: 0.03, env: "soft" },
  "journal-update.wav": { dur: 0.2, tones: [[560, 0.09], [840, 0.07]], noise: 0.005, env: "pluck" },
  "boss-omen.wav": { dur: 0.9, tones: [[92, 0.26], [138, 0.14]], noise: 0.04, env: "dark" }
};

function hashNoise(i) {
  let x = i | 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return ((x >>> 0) / 0xffffffff) * 2 - 1;
}

function envFactor(t, dur, kind) {
  const a = Math.max(0.005, Math.min(0.25, dur * 0.15));
  const r = Math.max(0.02, Math.min(0.35, dur * 0.25));
  if (kind === "pluck") {
    const attack = Math.min(1, t / Math.max(0.002, a * 0.35));
    const decay = Math.exp(-5 * t / Math.max(0.001, dur));
    return attack * decay;
  }
  if (kind === "rise") {
    const core = Math.min(1, t / Math.max(0.001, dur * 0.45));
    const tail = t > dur - r ? Math.max(0, (dur - t) / r) : 1;
    return core * tail;
  }
  if (kind === "fall") {
    const start = t < a ? Math.min(1, t / a) : 1;
    const fall = 1 - t / Math.max(0.001, dur);
    return Math.max(0, start * fall);
  }
  if (kind === "dark") {
    const start = t < a ? Math.min(1, t / a) : 1;
    const pulse = 0.7 + 0.3 * Math.sin(t * Math.PI * 2.4);
    const tail = t > dur - r ? Math.max(0, (dur - t) / r) : 1;
    return start * pulse * tail;
  }
  // soft
  const start = t < a ? Math.min(1, t / a) : 1;
  const tail = t > dur - r ? Math.max(0, (dur - t) / r) : 1;
  return start * tail;
}

function synthCue(spec) {
  const len = Math.max(1, Math.floor(spec.dur * SAMPLE_RATE));
  const samples = new Float32Array(len);

  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    let v = 0;
    for (let j = 0; j < spec.tones.length; j++) {
      const [freq, amp] = spec.tones[j];
      const fm = 1 + 0.003 * Math.sin(t * (8 + j * 3));
      v += Math.sin(t * Math.PI * 2 * freq * fm) * amp;
    }
    if (spec.noise > 0) v += hashNoise(i + len) * spec.noise;
    v *= envFactor(t, spec.dur, spec.env);
    samples[i] = Math.max(-1, Math.min(1, v));
  }
  return samples;
}

function floatTo16BitPCM(samples) {
  const out = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    out.writeInt16LE(s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff), i * 2);
  }
  return out;
}

function buildWav(samples) {
  const data = floatTo16BitPCM(samples);
  const header = Buffer.alloc(44);
  const byteRate = SAMPLE_RATE * 2;
  const blockAlign = 2;
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

let created = 0;
for (const [name, spec] of Object.entries(CUES)) {
  const samples = synthCue(spec);
  const wav = buildWav(samples);
  fs.writeFileSync(path.join(OUT_DIR, name), wav);
  created++;
}

console.log(`Generated ${created} story cue files in ${OUT_DIR}`);
