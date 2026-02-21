// weather.js — weather state machine, rain particles, lightning flashes, rain splashes
import * as THREE from "three";

// --- weather presets ---
var PRESETS = {
  calm: {
    waveAmplitude: 1.0,
    fogDensity: 0.006,
    fogColor: 0x0a0e1a,
    waterTint: [0.0, 0.0, 0.0],
    windX: 0,
    windZ: 0,
    rainDensity: 0,
    lightningChance: 0,
    dimFactor: 1.0,          // 1.0 = full brightness
    foamIntensity: 0.3,      // base foam
    cloudShadow: 0.0,        // no cloud shadows
    visLabel: "CALM"
  },
  rough: {
    waveAmplitude: 1.3,
    fogDensity: 0.008,
    fogColor: 0x0c1020,
    waterTint: [0.01, 0.02, 0.04],
    windX: 1.0,
    windZ: 0.7,
    rainDensity: 0.3,
    lightningChance: 0,
    dimFactor: 0.85,
    foamIntensity: 0.6,
    cloudShadow: 0.3,
    visLabel: "ROUGH"
  },
  storm: {
    waveAmplitude: 1.6,
    fogDensity: 0.013,
    fogColor: 0x080a14,
    waterTint: [0.02, 0.03, 0.06],
    windX: 2.0,
    windZ: 1.5,
    rainDensity: 1.0,
    lightningChance: 0.008,
    dimFactor: 0.55,
    foamIntensity: 1.0,
    cloudShadow: 0.7,
    visLabel: "STORM"
  }
};

// --- mid-wave weather change ---
var MID_WAVE_CHANGE_CHANCE = 0.0005;
var WEATHER_POOL = ["calm", "rough", "storm"];

// --- create weather state ---
export function createWeather(conditionKey) {
  var key = conditionKey || "calm";
  var preset = PRESETS[key] || PRESETS.calm;

  return {
    current: key,
    preset: Object.assign({}, preset),
    target: Object.assign({}, preset),
    lerpSpeed: 0.5,
    rain: null,
    rainMaterial: null,
    splashes: null,
    lightningActive: false,
    lightningTimer: 0,
    lightningDuration: 0.12,
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

// --- get weather dim factor (for day/night integration) ---
// floor prevents storm + night from creating total blindness
var MIN_DIM_FACTOR = 0.45;
export function getWeatherDim(state) {
  var dim = state.preset.dimFactor !== undefined ? state.preset.dimFactor : 1.0;
  return Math.max(MIN_DIM_FACTOR, dim);
}

// --- get foam intensity ---
export function getWeatherFoam(state) {
  return state.preset.foamIntensity !== undefined ? state.preset.foamIntensity : 0.3;
}

// --- get cloud shadow intensity ---
export function getWeatherCloudShadow(state) {
  return state.preset.cloudShadow !== undefined ? state.preset.cloudShadow : 0.0;
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
export function createRain(scene, particleCount) {
  var count = particleCount || 4000;
  var geometry = new THREE.BufferGeometry();
  var positions = new Float32Array(count * 3);
  var velocities = new Float32Array(count);

  for (var i = 0; i < count; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * 200;
    positions[i * 3 + 1] = Math.random() * 80;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 200;
    velocities[i] = 30 + Math.random() * 20;
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

// --- create rain splash particles (small rings on water surface) ---
export function createSplashes(scene, particleCount) {
  var count = particleCount || 200;
  var geometry = new THREE.BufferGeometry();
  var positions = new Float32Array(count * 3);
  var scales = new Float32Array(count);
  var lifetimes = new Float32Array(count);

  for (var i = 0; i < count; i++) {
    positions[i * 3]     = 0;
    positions[i * 3 + 1] = -100; // hidden below
    positions[i * 3 + 2] = 0;
    scales[i] = 0;
    lifetimes[i] = 0;
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  var material = new THREE.PointsMaterial({
    color: 0xaabbdd,
    size: 0.6,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  var points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  scene.add(points);

  return { mesh: points, geometry: geometry, material: material, lifetimes: lifetimes, count: count, nextIdx: 0 };
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

    if (positions[idx + 1] < -2) {
      positions[idx]     = shipX + (Math.random() - 0.5) * 200;
      positions[idx + 1] = 60 + Math.random() * 20;
      positions[idx + 2] = shipZ + (Math.random() - 0.5) * 200;
    }
  }

  rain.geometry.attributes.position.needsUpdate = true;
}

// --- update splash particles ---
function updateSplashes(splashes, dt, density, shipX, shipZ) {
  if (!splashes) return;

  splashes.material.opacity = density * 0.4;

  if (density <= 0) return;

  var positions = splashes.geometry.attributes.position.array;
  var lifetimes = splashes.lifetimes;
  var count = splashes.count;

  // spawn new splashes
  var spawnRate = density * 80; // splashes per second
  var toSpawn = Math.floor(spawnRate * dt + Math.random());
  for (var s = 0; s < toSpawn; s++) {
    var si = splashes.nextIdx;
    splashes.nextIdx = (splashes.nextIdx + 1) % count;
    positions[si * 3]     = shipX + (Math.random() - 0.5) * 120;
    positions[si * 3 + 1] = 0.3;
    positions[si * 3 + 2] = shipZ + (Math.random() - 0.5) * 120;
    lifetimes[si] = 0.3 + Math.random() * 0.2;
  }

  // age and fade
  for (var i = 0; i < count; i++) {
    if (lifetimes[i] > 0) {
      lifetimes[i] -= dt;
      if (lifetimes[i] <= 0) {
        positions[i * 3 + 1] = -100;
      }
    }
  }

  splashes.geometry.attributes.position.needsUpdate = true;
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
  p.dimFactor     += (t.dimFactor - p.dimFactor) * s;
  p.foamIntensity += (t.foamIntensity - p.foamIntensity) * s;
  p.cloudShadow   += (t.cloudShadow - p.cloudShadow) * s;

  for (var c = 0; c < 3; c++) {
    p.waterTint[c] += (t.waterTint[c] - p.waterTint[c]) * s;
  }

  p.visLabel = t.visLabel;

  // update scene fog density (color handled by daynight)
  if (state.fogRef) {
    state.fogRef.density = p.fogDensity;
  }

  // rain
  updateRain(state.rain, dt, p.rainDensity, shipX, shipZ);

  // splashes
  updateSplashes(state.splashes, dt, p.rainDensity, shipX, shipZ);

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
}
