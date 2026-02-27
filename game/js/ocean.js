// ocean.js — low-poly legacy ocean with optional Water Pro runtime adapter.
import * as THREE from "three";

var BASE_DEEP = new THREE.Color("#2a5577");
var BASE_SHALLOW = new THREE.Color("#4ea3c4");
var TMP_COLOR = new THREE.Color();

var OCEAN_SIZE = 400;
var OCEAN_TILE_RADIUS = 1; // 3x3 tiles around camera anchor

var activeOceanUniforms = null;
var waterQueryConfig = null;
var waterProModulePromise = null;

function getWaterQueryConfig() {
  if (waterQueryConfig) return waterQueryConfig;
  var params = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search)
    : new URLSearchParams();

  var mode = (params.get("water") || "legacy").toLowerCase();
  if (mode !== "pro") mode = "legacy";

  var visualMode = (params.get("waterVisual") || "legacy").toLowerCase();
  if (visualMode !== "pro") visualMode = "legacy";

  var preset = params.get("waterPreset");
  var libPath = params.get("waterLib");

  waterQueryConfig = {
    mode: mode,
    visualMode: visualMode,
    preset: preset ? String(preset) : null,
    libPath: libPath ? String(libPath) : null
  };
  return waterQueryConfig;
}

function normalizeQualityHint(input) {
  if (!input) return "high";
  var q = String(input).toLowerCase();
  if (q === "low") return "low";
  if (q === "medium" || q === "mid") return "medium";
  return "high";
}

function createCompatUniforms() {
  return {
    uWaveAmp: { value: 1.0 },
    uWaveSteps: { value: 0.0 },
    uWaterTint: { value: new THREE.Vector3(0, 0, 0) },
    uShaderDetail: { value: 1.0 }
  };
}

function buildOceanGeometry(size, segments) {
  var geo = new THREE.PlaneGeometry(size, size, segments, segments);
  var colors = new Float32Array(geo.attributes.position.count * 3);
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geo;
}

function buildOceanTile(size, segments, material) {
  var geometry = buildOceanGeometry(size, segments);
  var mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 0;
  return { mesh: mesh, geometry: geometry };
}

function createLegacyOcean(segments) {
  var segs = Math.max(8, Math.floor(segments || 56));
  var size = OCEAN_SIZE;

  var tileMaterial = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
    flatShading: true,
    vertexColors: true
  });

  var group = new THREE.Group();
  var tiles = [];

  for (var tz = -OCEAN_TILE_RADIUS; tz <= OCEAN_TILE_RADIUS; tz++) {
    for (var tx = -OCEAN_TILE_RADIUS; tx <= OCEAN_TILE_RADIUS; tx++) {
      var tile = buildOceanTile(size, segs, tileMaterial);
      tile.gridX = tx;
      tile.gridZ = tz;
      group.add(tile.mesh);
      tiles.push(tile);
    }
  }

  var uniforms = createCompatUniforms();
  uniforms.__oceanMesh = group;
  uniforms.__oceanGeo = tiles[0].geometry;
  uniforms.__size = size;
  uniforms.__segments = segs;
  uniforms.__tiles = tiles;
  uniforms.__tileRadius = OCEAN_TILE_RADIUS;

  return { mesh: group, uniforms: uniforms };
}

function getLegacyWaveHeight(worldX, worldZ, time, waveAmp, waveSteps) {
  var amp = waveAmp !== undefined ? waveAmp : 1.0;
  var h = 0;
  h += Math.sin(worldX * 0.22 + time * 0.9) * 0.8 * amp;
  h += Math.sin(worldZ * 0.18 + time * 0.7) * 0.65 * amp;
  h += Math.sin(worldX * 0.55 + worldZ * 0.4 + time * 1.1) * 0.25 * amp;
  if (waveSteps !== undefined && waveSteps > 0.5) h = Math.floor(h * waveSteps) / waveSteps;
  return h;
}

function updateTileHeights(tile, elapsed, amp, steps, deepColor, shallowColor) {
  var pos = tile.geometry.attributes.position;
  var cols = tile.geometry.attributes.color;
  var tileX = tile.mesh.position.x;
  var tileZ = tile.mesh.position.z;

  var safeAmp = Math.max(0.01, amp);
  for (var i = 0; i < pos.count; i++) {
    var worldX = pos.getX(i) + tileX;
    // PlaneGeometry is in XY before mesh rotation. With -PI/2 around X, world Z = -local Y.
    var worldZ = -pos.getY(i) + tileZ;

    var h = getWaveHeight(worldX, worldZ, elapsed, amp, steps);
    pos.setZ(i, h);

    var t = THREE.MathUtils.clamp((h / (safeAmp * 1.6) + 1) * 0.5, 0, 1);
    TMP_COLOR.copy(deepColor).lerp(shallowColor, t);
    cols.setXYZ(i, TMP_COLOR.r, TMP_COLOR.g, TMP_COLOR.b);
  }

  pos.needsUpdate = true;
  cols.needsUpdate = true;
  tile.geometry.computeVertexNormals();
}

function positionTilesAroundCamera(uniforms, camera) {
  var tiles = uniforms.__tiles;
  if (!tiles || tiles.length === 0) return;

  var size = uniforms.__size || OCEAN_SIZE;
  var anchorX = camera ? Math.round(camera.position.x / size) * size : 0;
  var anchorZ = camera ? Math.round(camera.position.z / size) * size : 0;

  for (var i = 0; i < tiles.length; i++) {
    var tile = tiles[i];
    tile.mesh.position.x = anchorX + tile.gridX * size;
    tile.mesh.position.z = anchorZ + tile.gridZ * size;
  }
}

function updateLegacyOcean(uniforms, elapsed, waveAmplitude, waveSteps, waterTint, dayNight, camera, weatherDim) {
  if (!uniforms || !uniforms.__tiles || uniforms.__tiles.length === 0) return;

  var amp = waveAmplitude !== undefined ? waveAmplitude : uniforms.uWaveAmp.value;
  uniforms.uWaveAmp.value = amp;

  var steps = waveSteps !== undefined ? waveSteps : uniforms.uWaveSteps.value;
  uniforms.uWaveSteps.value = steps;

  if (waterTint) uniforms.uWaterTint.value.set(waterTint[0], waterTint[1], waterTint[2]);

  var tint = uniforms.uWaterTint.value;
  var dim = weatherDim !== undefined ? weatherDim : 1.0;

  var deepColor = BASE_DEEP.clone();
  var shallowColor = BASE_SHALLOW.clone();

  if (dayNight && dayNight.waterDeep && dayNight.waterCrest) {
    deepColor.setRGB(dayNight.waterDeep[0], dayNight.waterDeep[1], dayNight.waterDeep[2]);
    shallowColor.setRGB(dayNight.waterCrest[0], dayNight.waterCrest[1], dayNight.waterCrest[2]);
  }

  deepColor.multiplyScalar(dim);
  shallowColor.multiplyScalar(dim);
  deepColor.offsetHSL(0, 0, tint.z * 0.25 + tint.y * 0.1);
  shallowColor.offsetHSL(0, 0, tint.z * 0.25 + tint.y * 0.1);

  positionTilesAroundCamera(uniforms, camera);

  for (var i = 0; i < uniforms.__tiles.length; i++) {
    updateTileHeights(uniforms.__tiles[i], elapsed, amp, steps, deepColor, shallowColor);
  }
}

function syncWindowWaterState(uniforms) {
  if (typeof window === "undefined") return;
  window.__ooWaterRequested = uniforms ? uniforms.__waterRequested : "legacy";
  window.__ooWaterBackend = uniforms ? uniforms.__waterBackend : "legacy";
  window.__ooWaterFallbackReason = uniforms ? (uniforms.__waterFallbackReason || null) : null;
}

function getWaterLibCandidates() {
  var cfg = getWaterQueryConfig();
  var candidates = [];
  if (cfg.libPath) candidates.push(cfg.libPath);
  candidates.push("/lib/threejs-water-pro.js");
  candidates.push("/water/threejs-water-pro.js");
  candidates.push("/vendor/threejs-water-pro.js");
  candidates.push("/threejs-water-pro.js");
  return candidates;
}

function getWaterSystemCtor(moduleNs) {
  if (!moduleNs) return null;
  if (moduleNs.WaterSystem) return moduleNs.WaterSystem;
  if (moduleNs.default && moduleNs.default.WaterSystem) return moduleNs.default.WaterSystem;
  if (typeof moduleNs.default === "function") return moduleNs.default;
  return null;
}

async function loadWaterProModule() {
  if (waterProModulePromise) return waterProModulePromise;
  waterProModulePromise = (async function () {
    var candidates = getWaterLibCandidates();
    var lastError = null;
    for (var i = 0; i < candidates.length; i++) {
      var path = candidates[i];
      try {
        var mod = await import(/* @vite-ignore */ path);
        if (mod) return mod;
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError || new Error("Water Pro module was not found.");
  })();
  return waterProModulePromise;
}

async function instantiateWaterSystem(WaterSystem, renderer, scene, camera, qualityHint) {
  var attempts = [];
  if (typeof WaterSystem.create === "function") {
    attempts.push(function () { return WaterSystem.create(renderer, scene, camera, qualityHint); });
    attempts.push(function () { return WaterSystem.create(renderer, scene, camera); });
    attempts.push(function () { return WaterSystem.create({ renderer: renderer, scene: scene, camera: camera, quality: qualityHint }); });
    attempts.push(function () { return WaterSystem.create({ renderer: renderer, scene: scene, camera: camera }); });
  }
  if (typeof WaterSystem === "function") {
    attempts.push(function () { return new WaterSystem(renderer, scene, camera, qualityHint); });
    attempts.push(function () { return new WaterSystem({ renderer: renderer, scene: scene, camera: camera, quality: qualityHint }); });
    attempts.push(function () { return new WaterSystem(); });
  }

  var lastError = null;
  for (var i = 0; i < attempts.length; i++) {
    try {
      var instance = await attempts[i]();
      if (instance) return instance;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error("Water Pro factory did not return an instance.");
}

function detectRuntimeRoot(instance) {
  if (!instance) return null;
  return instance.object3d || instance.object || instance.mesh || instance.group || instance.surface || null;
}

function updateWaterRuntime(uniforms, elapsed, waveAmplitude, waveSteps, waterTint, dayNight, weatherDim, foamIntensity, cloudShadow) {
  var runtime = uniforms.__waterRuntime;
  if (!runtime || !runtime.instance || runtime.updateFailed) return;

  var dt = uniforms.__lastWaterElapsed === null
    ? 0
    : Math.max(0, Math.min(0.1, elapsed - uniforms.__lastWaterElapsed));
  uniforms.__lastWaterElapsed = elapsed;

  try {
    if (typeof runtime.instance.update === "function") {
      runtime.instance.update(dt);
    }
    if (typeof runtime.instance.setWeather === "function") {
      runtime.instance.setWeather({
        waveAmplitude: waveAmplitude,
        waveSteps: waveSteps,
        waterTint: waterTint,
        weatherDim: weatherDim,
        foamIntensity: foamIntensity,
        cloudShadow: cloudShadow,
        dayNight: dayNight
      });
    }
  } catch (error) {
    runtime.updateFailed = true;
    uniforms.__waterFallbackReason = "water-pro-update-failed";
    console.warn("[water] Water Pro update failed, keeping legacy ocean active", error);
    syncWindowWaterState(uniforms);
  }
}

function tryWaterRuntimeHeight(uniforms, worldX, worldZ, time) {
  if (!uniforms || uniforms.__waterBackend !== "water-pro" || !uniforms.__waterRuntime) return null;
  var runtime = uniforms.__waterRuntime.instance;
  if (!runtime || typeof runtime.getHeightAt !== "function") return null;
  try {
    var sampled = runtime.getHeightAt(worldX, worldZ, time);
    if (typeof sampled === "number" && Number.isFinite(sampled)) return sampled;
  } catch (error) {
    uniforms.__waterFallbackReason = "water-pro-height-sample-failed";
    syncWindowWaterState(uniforms);
  }
  return null;
}

function maybeInitWaterPro(uniforms, camera) {
  if (!uniforms || uniforms.__waterRequested !== "pro" || uniforms.__waterInitStarted) return;
  if (!camera) return;

  var renderer = uniforms.__renderer || (typeof window !== "undefined" ? window.__ooRendererObject : null);
  var scene = uniforms.__container ? uniforms.__container.parent : null;
  if (!renderer || !scene) return;

  var backend = typeof window !== "undefined" ? window.__ooRendererBackend : null;
  var rendererName = renderer && renderer.constructor ? renderer.constructor.name : "";
  var webgpuActive = backend === "webgpu" || rendererName.indexOf("WebGPU") !== -1;
  if (!webgpuActive) {
    uniforms.__waterFallbackReason = "water-pro-needs-webgpu";
    syncWindowWaterState(uniforms);
    return;
  }

  uniforms.__waterInitStarted = true;
  uniforms.__waterInitPromise = (async function () {
    try {
      var moduleNs = await loadWaterProModule();
      var WaterSystem = getWaterSystemCtor(moduleNs);
      if (!WaterSystem) throw new Error("WaterSystem export is missing.");

      var instance = await instantiateWaterSystem(
        WaterSystem,
        renderer,
        scene,
        camera,
        uniforms.__waterQualityHint
      );
      if (!instance) throw new Error("Water Pro returned an empty instance.");

      if (uniforms.__waterPreset && typeof instance.loadPreset === "function") {
        await instance.loadPreset(uniforms.__waterPreset);
      }

      var root = detectRuntimeRoot(instance);
      if (root && root.isObject3D && !root.parent) {
        scene.add(root);
      }

      uniforms.__waterRuntime = {
        instance: instance,
        root: root,
        updateFailed: false
      };
      uniforms.__waterBackend = "water-pro";
      uniforms.__waterFallbackReason = null;

      if (root && root.isObject3D && uniforms.__waterVisualMode !== "pro") {
        root.visible = false;
      }
      if (uniforms.__waterVisualMode === "pro" && uniforms.__oceanMesh) {
        uniforms.__oceanMesh.visible = false;
      }

      syncWindowWaterState(uniforms);
      console.info("[water] Water Pro initialized", {
        visualMode: uniforms.__waterVisualMode,
        quality: uniforms.__waterQualityHint
      });
    } catch (error) {
      uniforms.__waterBackend = "legacy";
      uniforms.__waterRuntime = null;
      uniforms.__waterFallbackReason = "water-pro-load-failed";
      syncWindowWaterState(uniforms);
      console.warn("[water] Water Pro unavailable, continuing with legacy ocean", error);
    }
  })();
}

export function createOcean(segments, options) {
  var legacy = createLegacyOcean(segments);
  var group = new THREE.Group();
  group.add(legacy.mesh);

  var query = getWaterQueryConfig();
  var uniforms = legacy.uniforms;
  uniforms.__container = group;
  uniforms.__renderer = options && options.renderer ? options.renderer : null;
  uniforms.__waterRequested = query.mode;
  uniforms.__waterBackend = "legacy";
  uniforms.__waterFallbackReason = null;
  uniforms.__waterVisualMode = query.visualMode;
  uniforms.__waterPreset = query.preset;
  uniforms.__waterQualityHint = normalizeQualityHint(options && options.qualityHint ? options.qualityHint : "high");
  uniforms.__waterRuntime = null;
  uniforms.__waterInitStarted = false;
  uniforms.__waterInitPromise = null;
  uniforms.__lastWaterElapsed = null;
  uniforms.__setQualityHint = function (nextQualityHint) {
    uniforms.__waterQualityHint = normalizeQualityHint(nextQualityHint);
  };

  activeOceanUniforms = uniforms;
  syncWindowWaterState(uniforms);

  return { mesh: group, uniforms: uniforms };
}

export function updateOcean(uniforms, elapsed, waveAmplitude, waveSteps, waterTint, dayNight, camera, weatherDim, foamIntensity, cloudShadow) {
  if (!uniforms) return;

  maybeInitWaterPro(uniforms, camera);

  var useLegacyVisual = uniforms.__waterVisualMode !== "pro" || uniforms.__waterBackend !== "water-pro";
  if (useLegacyVisual) {
    updateLegacyOcean(uniforms, elapsed, waveAmplitude, waveSteps, waterTint, dayNight, camera, weatherDim);
  }

  if (uniforms.__waterBackend === "water-pro" && uniforms.__waterRuntime) {
    updateWaterRuntime(uniforms, elapsed, waveAmplitude, waveSteps, waterTint, dayNight, weatherDim, foamIntensity, cloudShadow);
  }
}

export function getWaveHeight(worldX, worldZ, time, waveAmp, waveSteps) {
  var runtimeHeight = tryWaterRuntimeHeight(activeOceanUniforms, worldX, worldZ, time);
  if (runtimeHeight !== null) {
    var ampScale = waveAmp !== undefined ? waveAmp : 1.0;
    var shaped = runtimeHeight * ampScale;
    if (waveSteps !== undefined && waveSteps > 0.5) {
      shaped = Math.floor(shaped * waveSteps) / waveSteps;
    }
    return shaped;
  }
  return getLegacyWaveHeight(worldX, worldZ, time, waveAmp, waveSteps);
}
