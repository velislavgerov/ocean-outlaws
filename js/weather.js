// weather.js — weather state machine, rain particles, lightning flashes
import * as THREE from "three";

// --- weather presets ---
var PRESETS = {
  calm: {
    waveAmplitude: 1.0,
    fogDensity: 0.006,
    fogColor: 0x0a0e1a,
    waterTint: [0.0, 0.0, 0.0],   // no shift
    windX: 0,
    windZ: 0,
    rainDensity: 0,
    lightningChance: 0,
    visLabel: "CALM"
  },
  rough: {
    waveAmplitude: 1.8,
    fogDensity: 0.012,
    fogColor: 0x0c1020,
    waterTint: [0.01, 0.02, 0.04],
    windX: 3,
    windZ: 2,
    rainDensity: 0.3,
    lightningChance: 0,
    visLabel: "ROUGH"
  },
  storm: {
    waveAmplitude: 2.8,
    fogDensity: 0.022,
    fogColor: 0x080a14,
    waterTint: [0.02, 0.03, 0.06],
    windX: 7,
    windZ: 5,
    rainDensity: 1.0,
    lightningChance: 0.008,  // per-frame chance (~0.5/s at 60fps)
    visLabel: "STORM"
  }
};

// --- mid-wave weather change ---
var MID_WAVE_CHANGE_CHANCE = 0.0005; // per-frame chance (~3% per 60s)
var WEATHER_POOL = ["calm", "rough", "storm"];

// --- create weather state ---
export function createWeather(conditionKey) {
  var key = conditionKey || "calm";
  var preset = PRESETS[key] || PRESETS.calm;

  return {
    current: key,
    preset: Object.assign({}, preset),
    // lerp targets for smooth transitions
    target: Object.assign({}, preset),
    lerpSpeed: 0.5,
    // rain particle system
    rain: null,
    rainMaterial: null,
    // lightning state
    lightningActive: false,
    lightningTimer: 0,
    lightningDuration: 0.12,
    // ambient light ref (set externally)
    ambientRef: null,
    sunRef: null,
    fogRef: null
  };
}

// --- set weather by key ---
export function setWeather(state, key) {
  var preset = PRESETS[key];
  if (!preset) return;
  state.current = key;
  state.target = Object.assign({}, preset);
}

// --- get current weather key ---
export function getWeatherKey(state) {
  return state.current;
}

// --- get current preset (interpolated) ---
export function getWeatherPreset(state) {
  return state.preset;
}

// --- get weather label for HUD ---
export function getWeatherLabel(state) {
  return state.preset.visLabel || "CALM";
}

// --- maybe randomly change weather mid-wave ---
export function maybeChangeWeather(state) {
  if (Math.random() < MID_WAVE_CHANGE_CHANCE) {
    var newKey = WEATHER_POOL[Math.floor(Math.random() * WEATHER_POOL.length)];
    if (newKey !== state.current) {
      setWeather(state, newKey);
    }
  }
}

// --- create rain particle system ---
export function createRain(scene) {
  var count = 4000;
  var geometry = new THREE.BufferGeometry();
  var positions = new Float32Array(count * 3);
  var velocities = new Float32Array(count);

  for (var i = 0; i < count; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * 200;   // x
    positions[i * 3 + 1] = Math.random() * 80;             // y
    positions[i * 3 + 2] = (Math.random() - 0.5) * 200;   // z
    velocities[i] = 30 + Math.random() * 20;               // fall speed
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  var material = new THREE.PointsMaterial({
    color: 0x8899bb,
    size: 0.3,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  var points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  scene.add(points);

  return { mesh: points, geometry: geometry, material: material, velocities: velocities, count: count };
}

// --- update rain particles ---
function updateRain(rain, dt, density, shipX, shipZ) {
  if (!rain) return;

  rain.material.opacity = density * 0.35;

  if (density <= 0) return;

  var positions = rain.geometry.attributes.position.array;
  var count = rain.count;

  for (var i = 0; i < count; i++) {
    var idx = i * 3;
    positions[idx + 1] -= rain.velocities[i] * dt;

    // respawn at top when below ground
    if (positions[idx + 1] < -2) {
      positions[idx]     = shipX + (Math.random() - 0.5) * 200;
      positions[idx + 1] = 60 + Math.random() * 20;
      positions[idx + 2] = shipZ + (Math.random() - 0.5) * 200;
    }
  }

  rain.geometry.attributes.position.needsUpdate = true;
}

// --- update weather (call every frame) ---
export function updateWeather(state, dt, scene, shipX, shipZ) {
  var p = state.preset;
  var t = state.target;
  var s = state.lerpSpeed * dt;

  // lerp preset values toward target
  p.waveAmplitude += (t.waveAmplitude - p.waveAmplitude) * s;
  p.fogDensity    += (t.fogDensity - p.fogDensity) * s;
  p.rainDensity   += (t.rainDensity - p.rainDensity) * s;
  p.windX         += (t.windX - p.windX) * s;
  p.windZ         += (t.windZ - p.windZ) * s;
  p.lightningChance += (t.lightningChance - p.lightningChance) * s;

  for (var c = 0; c < 3; c++) {
    p.waterTint[c] += (t.waterTint[c] - p.waterTint[c]) * s;
  }

  p.visLabel = t.visLabel;

  // update scene fog
  if (state.fogRef) {
    state.fogRef.density = p.fogDensity;
  }

  // rain
  updateRain(state.rain, dt, p.rainDensity, shipX, shipZ);

  // lightning
  if (p.lightningChance > 0 && Math.random() < p.lightningChance) {
    state.lightningActive = true;
    state.lightningTimer = state.lightningDuration;
  }

  if (state.lightningActive) {
    state.lightningTimer -= dt;
    if (state.lightningTimer <= 0) {
      state.lightningActive = false;
    }
  }

  // apply lightning flash to ambient light
  if (state.ambientRef) {
    if (state.lightningActive) {
      state.ambientRef.intensity = 3.0;
      state.ambientRef.color.setHex(0xccddff);
    } else {
      state.ambientRef.intensity += (0.6 - state.ambientRef.intensity) * 0.1;
      state.ambientRef.color.setHex(0x1a2040);
    }
  }
}
