// daynight.js — continuous day/night cycle with sun/moon, sky gradient, lighting
import * as THREE from "three";

// full cycle duration in seconds (~3 minutes)
var CYCLE_DURATION = 180;

// time-of-day phases (0–1 normalized)
// 0.0 = midnight, 0.25 = dawn, 0.5 = noon, 0.75 = sunset, 1.0 = midnight
var PHASES = [
  { t: 0.00, sky: [0.01, 0.01, 0.04], horizon: [0.02, 0.02, 0.06], sun: [0.15, 0.15, 0.3], ambient: [0.06, 0.06, 0.12], intensity: 0.15, fogColor: [0.01, 0.01, 0.04] },
  { t: 0.20, sky: [0.02, 0.02, 0.06], horizon: [0.05, 0.03, 0.08], sun: [0.2, 0.15, 0.3], ambient: [0.08, 0.06, 0.12], intensity: 0.2, fogColor: [0.02, 0.02, 0.06] },
  { t: 0.25, sky: [0.15, 0.08, 0.12], horizon: [0.6, 0.25, 0.15], sun: [1.0, 0.6, 0.3], ambient: [0.3, 0.18, 0.12], intensity: 0.5, fogColor: [0.2, 0.1, 0.08] },
  { t: 0.30, sky: [0.25, 0.15, 0.10], horizon: [0.8, 0.4, 0.2], sun: [1.0, 0.8, 0.5], ambient: [0.4, 0.25, 0.15], intensity: 0.7, fogColor: [0.3, 0.15, 0.1] },
  { t: 0.40, sky: [0.3, 0.45, 0.7], horizon: [0.5, 0.6, 0.8], sun: [1.0, 0.95, 0.85], ambient: [0.35, 0.4, 0.55], intensity: 0.9, fogColor: [0.3, 0.4, 0.55] },
  { t: 0.50, sky: [0.35, 0.55, 0.85], horizon: [0.55, 0.7, 0.9], sun: [1.0, 1.0, 0.95], ambient: [0.4, 0.45, 0.6], intensity: 1.0, fogColor: [0.35, 0.5, 0.65] },
  { t: 0.60, sky: [0.3, 0.45, 0.7], horizon: [0.5, 0.6, 0.8], sun: [1.0, 0.95, 0.85], ambient: [0.35, 0.4, 0.55], intensity: 0.9, fogColor: [0.3, 0.4, 0.55] },
  { t: 0.70, sky: [0.25, 0.12, 0.10], horizon: [0.7, 0.3, 0.12], sun: [1.0, 0.5, 0.2], ambient: [0.35, 0.2, 0.12], intensity: 0.6, fogColor: [0.25, 0.12, 0.08] },
  { t: 0.75, sky: [0.15, 0.06, 0.10], horizon: [0.5, 0.15, 0.08], sun: [0.8, 0.3, 0.15], ambient: [0.2, 0.1, 0.1], intensity: 0.35, fogColor: [0.12, 0.06, 0.06] },
  { t: 0.80, sky: [0.04, 0.03, 0.08], horizon: [0.1, 0.05, 0.1], sun: [0.3, 0.15, 0.2], ambient: [0.1, 0.06, 0.1], intensity: 0.2, fogColor: [0.04, 0.03, 0.06] },
  { t: 1.00, sky: [0.01, 0.01, 0.04], horizon: [0.02, 0.02, 0.06], sun: [0.15, 0.15, 0.3], ambient: [0.06, 0.06, 0.12], intensity: 0.15, fogColor: [0.01, 0.01, 0.04] }
];

// water color palettes per time-of-day
var WATER_PHASES = [
  { t: 0.00, deep: [0.01, 0.02, 0.06], mid: [0.02, 0.04, 0.10], crest: [0.04, 0.06, 0.14], foam: [0.08, 0.10, 0.20] },
  { t: 0.25, deep: [0.06, 0.03, 0.04], mid: [0.12, 0.06, 0.05], crest: [0.20, 0.10, 0.06], foam: [0.35, 0.20, 0.12] },
  { t: 0.40, deep: [0.02, 0.06, 0.12], mid: [0.04, 0.10, 0.20], crest: [0.08, 0.16, 0.28], foam: [0.18, 0.28, 0.40] },
  { t: 0.50, deep: [0.02, 0.08, 0.14], mid: [0.04, 0.12, 0.22], crest: [0.08, 0.18, 0.30], foam: [0.20, 0.32, 0.45] },
  { t: 0.60, deep: [0.02, 0.06, 0.12], mid: [0.04, 0.10, 0.20], crest: [0.08, 0.16, 0.28], foam: [0.18, 0.28, 0.40] },
  { t: 0.75, deep: [0.06, 0.02, 0.04], mid: [0.12, 0.04, 0.04], crest: [0.20, 0.08, 0.05], foam: [0.35, 0.15, 0.10] },
  { t: 1.00, deep: [0.01, 0.02, 0.06], mid: [0.02, 0.04, 0.10], crest: [0.04, 0.06, 0.14], foam: [0.08, 0.10, 0.20] }
];

function lerpPhase(phases, timeOfDay) {
  var t = timeOfDay % 1.0;
  var a = phases[0];
  var b = phases[phases.length - 1];
  for (var i = 0; i < phases.length - 1; i++) {
    if (t >= phases[i].t && t <= phases[i + 1].t) {
      a = phases[i];
      b = phases[i + 1];
      break;
    }
  }
  var range = b.t - a.t;
  var f = range > 0 ? (t - a.t) / range : 0;
  return { a: a, b: b, f: f };
}

function lerpArray(a, b, f) {
  var result = [];
  for (var i = 0; i < a.length; i++) {
    result.push(a[i] + (b[i] - a[i]) * f);
  }
  return result;
}

function lerpVal(a, b, f) {
  return a + (b - a) * f;
}

export function createDayNight() {
  return {
    time: 0,               // elapsed seconds
    timeOfDay: 0.35,       // start mid-morning (0-1)
    speed: 1.0 / CYCLE_DURATION,
    // computed values (updated each frame)
    skyColor: [0.3, 0.45, 0.7],
    horizonColor: [0.5, 0.6, 0.8],
    sunColor: [1.0, 0.95, 0.85],
    ambientColor: [0.35, 0.4, 0.55],
    sunIntensity: 0.9,
    fogColor: [0.3, 0.4, 0.55],
    sunDirection: new THREE.Vector3(0, 1, 0),
    // water colors
    waterDeep: [0.02, 0.06, 0.12],
    waterMid: [0.04, 0.10, 0.20],
    waterCrest: [0.08, 0.16, 0.28],
    waterFoam: [0.18, 0.28, 0.40],
    // star field mesh
    stars: null
  };
}

export function updateDayNight(state, dt) {
  state.time += dt;
  state.timeOfDay = (state.timeOfDay + state.speed * dt) % 1.0;

  var tod = state.timeOfDay;

  // interpolate sky/lighting phases
  var lp = lerpPhase(PHASES, tod);
  state.skyColor = lerpArray(lp.a.sky, lp.b.sky, lp.f);
  state.horizonColor = lerpArray(lp.a.horizon, lp.b.horizon, lp.f);
  state.sunColor = lerpArray(lp.a.sun, lp.b.sun, lp.f);
  state.ambientColor = lerpArray(lp.a.ambient, lp.b.ambient, lp.f);
  state.sunIntensity = lerpVal(lp.a.intensity, lp.b.intensity, lp.f);
  state.fogColor = lerpArray(lp.a.fogColor, lp.b.fogColor, lp.f);

  // interpolate water colors
  var wp = lerpPhase(WATER_PHASES, tod);
  state.waterDeep = lerpArray(wp.a.deep, wp.b.deep, wp.f);
  state.waterMid = lerpArray(wp.a.mid, wp.b.mid, wp.f);
  state.waterCrest = lerpArray(wp.a.crest, wp.b.crest, wp.f);
  state.waterFoam = lerpArray(wp.a.foam, wp.b.foam, wp.f);

  // sun position orbits around the scene
  var sunAngle = tod * Math.PI * 2 - Math.PI * 0.5; // noon = overhead
  var sunHeight = Math.sin(sunAngle);
  var sunForward = Math.cos(sunAngle);
  state.sunDirection.set(sunForward * 0.3, Math.max(sunHeight, -0.2), sunForward);
  state.sunDirection.normalize();
}

// apply day/night state to scene lights and fog
export function applyDayNight(state, ambient, sun, hemi, fog, renderer, weatherDim) {
  var dim = weatherDim !== undefined ? weatherDim : 1.0;

  // ambient light
  ambient.color.setRGB(
    state.ambientColor[0] * dim,
    state.ambientColor[1] * dim,
    state.ambientColor[2] * dim
  );
  ambient.intensity = 0.6;

  // directional sun
  sun.color.setRGB(state.sunColor[0], state.sunColor[1], state.sunColor[2]);
  sun.intensity = state.sunIntensity * dim;
  sun.position.set(
    state.sunDirection.x * 80,
    state.sunDirection.y * 80,
    state.sunDirection.z * 80
  );

  // hemisphere
  hemi.color.setRGB(
    state.skyColor[0] * dim,
    state.skyColor[1] * dim,
    state.skyColor[2] * dim
  );
  hemi.groundColor.setRGB(
    state.horizonColor[0] * dim * 0.3,
    state.horizonColor[1] * dim * 0.3,
    state.horizonColor[2] * dim * 0.3
  );
  hemi.intensity = 0.3 + state.sunIntensity * 0.2;

  // fog
  fog.color.setRGB(
    state.fogColor[0] * dim,
    state.fogColor[1] * dim,
    state.fogColor[2] * dim
  );

  // renderer clear color follows fog
  renderer.setClearColor(fog.color);
}

// create a simple star field (Points)
export function createStars(scene) {
  var count = 600;
  var positions = new Float32Array(count * 3);
  for (var i = 0; i < count; i++) {
    // place on a large dome
    var theta = Math.random() * Math.PI * 2;
    var phi = Math.random() * Math.PI * 0.5; // upper hemisphere only
    var r = 300;
    positions[i * 3]     = Math.cos(theta) * Math.sin(phi) * r;
    positions[i * 3 + 1] = Math.cos(phi) * r;
    positions[i * 3 + 2] = Math.sin(theta) * Math.sin(phi) * r;
  }
  var geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  var material = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.8,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  var mesh = new THREE.Points(geometry, material);
  mesh.frustumCulled = false;
  scene.add(mesh);
  return { mesh: mesh, material: material };
}

// update star visibility based on time of day
export function updateStars(stars, timeOfDay) {
  if (!stars) return;
  // stars visible at night (0.0 midnight), fade during dawn/dusk
  var nightness = 0;
  if (timeOfDay < 0.2 || timeOfDay > 0.8) {
    nightness = 1.0;
  } else if (timeOfDay < 0.3) {
    nightness = 1.0 - (timeOfDay - 0.2) / 0.1;
  } else if (timeOfDay > 0.7) {
    nightness = (timeOfDay - 0.7) / 0.1;
  }
  stars.material.opacity = nightness * 0.7;
}
