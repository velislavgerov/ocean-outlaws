import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";

var STORAGE_KEY = "ocean_outlaws_test_lab_v1";
var CATALOG_URL = "data/testLabModelCatalog.json";
var SHIP_SLOT_FALLBACK = [
  "destroyer",
  "cruiser",
  "carrier",
  "submarine",
  "enemy_patrol",
  "boss_battleship",
  "boss_carrier",
  "boss_kraken"
];

var LIB = {
  ship: [
    { label: "Ship Small 3", path: "assets/models/ships-palmov/small/ship-small-3.fbx", fit: 8 },
    { label: "Ship Medium 2", path: "assets/models/ships-palmov/medium/ship-medium-2.fbx", fit: 10 },
    { label: "Ship Large 2", path: "assets/models/ships-palmov/large/ship-large-2.fbx", fit: 12 },
    { label: "Pirate Large 1", path: "assets/models/ships-palmov/large/pirate-ship-large-1.fbx", fit: 13 },
    { label: "Pirate Large 2", path: "assets/models/ships-palmov/large/pirate-ship-large-2.fbx", fit: 13 }
  ],
  tree: [
    { label: "Palm Large", path: "assets/models/trees/palm/palm-tree-large.fbx", fit: 11 },
    { label: "Palm Bent", path: "assets/models/trees/palm/palm-tree-bent.fbx", fit: 9 },
    { label: "Palm Small", path: "assets/models/trees/palm/palm-tree-small.fbx", fit: 7 }
  ],
  island: [
    { label: "Stone Large 2", path: "assets/models/stones/large/stone-large-2.fbx", fit: 10 },
    { label: "Stone Small 6", path: "assets/models/stones/small/stone-small-6.fbx", fit: 6 },
    { label: "Island Arch", path: "assets/models/islands/island-mountain-arch.fbx", fit: 20 },
    { label: "Island Lighthouse Pier", path: "assets/models/islands/island-lighthouse-pier.fbx", fit: 22 }
  ],
  port: [
    { label: "Trade Port Land", path: "assets/models/lands/land-trade-port.fbx", fit: 18 },
    { label: "Pirate Seaport Land", path: "assets/models/lands/land-pirate-seaport.fbx", fit: 18 },
    { label: "Wooden Pier", path: "assets/models/environment/wooden-piers/wooden-pier.fbx", fit: 18 },
    { label: "Wooden Pier 2", path: "assets/models/environment/wooden-piers/wooden-pier-2.fbx", fit: 18 },
    { label: "Wooden Pier 3", path: "assets/models/environment/wooden-piers/wooden-pier-3.fbx", fit: 18 },
    { label: "Wooden Pier 4", path: "assets/models/environment/wooden-piers/wooden-pier-4.fbx", fit: 18 },
    { label: "Wooden Pier 5", path: "assets/models/environment/wooden-piers/wooden-pier-5.fbx", fit: 18 },
    { label: "Destroyed Wooden Pier", path: "assets/models/environment/destroyed-wooden-pier.fbx", fit: 18 }
  ],
  water: [
    { label: "Cartoon Water", path: "assets/models/ships-palmov/water.fbx", fit: 26 },
    { label: "Trade Port Water", path: "assets/models/waters/water-location-trade-port.fbx", fit: 26 },
    { label: "Pirate Seaport Water", path: "assets/models/waters/water-location-pirate-seaport.fbx", fit: 26 }
  ]
};

var SHIP_SLOTS = SHIP_SLOT_FALLBACK.slice();

function normalizeCatalog(catalog) {
  if (!catalog || typeof catalog !== "object") return null;
  ["ship", "tree", "island", "port", "water"].forEach(function (k) {
    if (Array.isArray(catalog[k]) && catalog[k].length) LIB[k] = catalog[k];
  });
  if (Array.isArray(catalog.shipSlots) && catalog.shipSlots.length) SHIP_SLOTS = catalog.shipSlots.slice();
  return catalog;
}

async function loadCatalog() {
  try {
    var res = await fetch(CATALOG_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("catalog not found");
    var json = await res.json();
    normalizeCatalog(json);
  } catch (e) {
    // keep fallback library if catalog isn't available
  }
}

var PRESETS = {
  calm: { fogDensity: 0.005, ambientInt: 0.8, sunInt: 1.0, rainDensity: 0.0 },
  rough: { fogDensity: 0.009, ambientInt: 0.65, sunInt: 0.9, rainDensity: 0.25 },
  storm: { fogDensity: 0.015, ambientInt: 0.45, sunInt: 0.55, rainDensity: 1.0 }
};

function defaultState() {
  var shipOverrides = {};
  for (var i = 0; i < SHIP_SLOTS.length; i++) shipOverrides[SHIP_SLOTS[i]] = LIB.ship[0].path;
  return {
    ship: { modelPath: LIB.ship[0].path, scale: 1, rotYDeg: 0 },
    weather: { preset: "calm", fogDensity: PRESETS.calm.fogDensity, ambientInt: PRESETS.calm.ambientInt, sunInt: PRESETS.calm.sunInt, rainDensity: PRESETS.calm.rainDensity },
    water: {
      modelPath: "",
      modelScale: 1,
      modelY: 0,
      size: 400,
      segments: 56,
      waveAmp: 1.0,
      waveSteps: 7,
      waveWeight1: 0.8,
      waveFreqX1: 0.22,
      waveSpeed1: 0.9,
      waveWeight2: 0.65,
      waveFreqZ2: 0.18,
      waveSpeed2: 0.7,
      waveWeight3: 0.25,
      waveFreqX3: 0.55,
      waveFreqZ3: 0.4,
      waveSpeed3: 1.1,
      colorDeep: "#2a5577",
      colorShallow: "#4ea3c4"
    },
    shipOverrides: shipOverrides,
    props: [],
    composites: []
  };
}

function loadState() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    var parsed = JSON.parse(raw);
    return normalizeImportedState(parsed);
  } catch (e) {
    return defaultState();
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function sanitizeColor(value, fallback) {
  var s = String(value || "");
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s;
  return fallback;
}

function remapTextureUrl(url, sourcePath) {
  var lower = String(url).toLowerCase();
  var isMain = lower.indexOf("texture%20main.png") >= 0 || lower.indexOf("texture main.png") >= 0;
  if (!isMain) return url;
  var sp = String(sourcePath).toLowerCase();
  if (sp.indexOf("models/ships") >= 0) {
    return "assets/textures/ships.png";
  }
  return "assets/textures/locations.png";
}

var cache = {};
function loadTemplate(path) {
  if (cache[path]) return cache[path];
  cache[path] = new Promise(function (resolve, reject) {
    var loader = new FBXLoader();
    loader.manager.setURLModifier(function (url) {
      return remapTextureUrl(url, path);
    });
    loader.load(encodeURI(path), resolve, undefined, reject);
  });
  return cache[path];
}

function applyFlat(root) {
  root.traverse(function (o) {
    if (!o.isMesh || !o.material) return;
    o.castShadow = false;
    o.receiveShadow = false;
    if (Array.isArray(o.material)) return;
    o.material.flatShading = true;
    o.material.needsUpdate = true;
  });
}

function fitToSize(root, target) {
  var box = new THREE.Box3().setFromObject(root);
  var size = new THREE.Vector3();
  var center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  var maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim > 0.0001) root.scale.setScalar(target / maxDim);
  box.setFromObject(root);
  box.getCenter(center);
  root.position.x -= center.x;
  root.position.z -= center.z;
  root.position.y -= box.min.y;
}

function optionByPath(type, path) {
  var arr = LIB[type] || [];
  for (var i = 0; i < arr.length; i++) if (arr[i].path === path) return arr[i];
  return arr[0] || null;
}

function getCompositeDef(name) {
  if (!name) return null;
  for (var i = 0; i < state.composites.length; i++) {
    if (state.composites[i].name === name) return state.composites[i];
  }
  return null;
}

function refreshCompositeList() {
  var opts = [];
  for (var i = 0; i < state.composites.length; i++) {
    opts.push({ value: state.composites[i].name, label: state.composites[i].name });
  }
  if (opts.length === 0) opts.push({ value: "", label: "(none)" });
  fillSelect(ui.compositeList, opts, ui.compositeList.value || opts[0].value);
}

function deleteCompositeByName(name) {
  if (!name) return 0;
  state.composites = state.composites.filter(function (c) { return c.name !== name; });
  var removedInstances = 0;
  var toRemove = [];
  for (var i = 0; i < state.props.length; i++) {
    if (state.props[i].type === "composite" && state.props[i].compositeName === name) {
      toRemove.push(state.props[i].id);
    }
  }
  for (var j = 0; j < toRemove.length; j++) {
    removePropById(toRemove[j]);
    removedInstances++;
  }
  if (selectedPropId) {
    var p = selectedProp();
    if (!p) selectedPropId = null;
  }
  refreshObjectList();
  transform.detach();
  return removedInstances;
}

var state = loadState();
var ui = {
  shipModel: document.getElementById("shipModel"),
  shipScale: document.getElementById("shipScale"),
  shipRotY: document.getElementById("shipRotY"),
  shipOverrideClass: document.getElementById("shipOverrideClass"),
  shipOverrideModel: document.getElementById("shipOverrideModel"),
  saveShipOverrideBtn: document.getElementById("saveShipOverrideBtn"),
  weatherPreset: document.getElementById("weatherPreset"),
  fogDensity: document.getElementById("fogDensity"),
  ambientInt: document.getElementById("ambientInt"),
  sunInt: document.getElementById("sunInt"),
  rainDensity: document.getElementById("rainDensity"),
  waterModel: document.getElementById("waterModel"),
  waterModelScale: document.getElementById("waterModelScale"),
  waterModelY: document.getElementById("waterModelY"),
  waterSize: document.getElementById("waterSize"),
  waterSegments: document.getElementById("waterSegments"),
  waterWaveAmp: document.getElementById("waterWaveAmp"),
  waterWaveSteps: document.getElementById("waterWaveSteps"),
  waterWaveWeight1: document.getElementById("waterWaveWeight1"),
  waterWaveFreqX1: document.getElementById("waterWaveFreqX1"),
  waterWaveSpeed1: document.getElementById("waterWaveSpeed1"),
  waterWaveWeight2: document.getElementById("waterWaveWeight2"),
  waterWaveFreqZ2: document.getElementById("waterWaveFreqZ2"),
  waterWaveSpeed2: document.getElementById("waterWaveSpeed2"),
  waterWaveWeight3: document.getElementById("waterWaveWeight3"),
  waterWaveFreqX3: document.getElementById("waterWaveFreqX3"),
  waterWaveFreqZ3: document.getElementById("waterWaveFreqZ3"),
  waterWaveSpeed3: document.getElementById("waterWaveSpeed3"),
  waterColorDeep: document.getElementById("waterColorDeep"),
  waterColorShallow: document.getElementById("waterColorShallow"),
  newType: document.getElementById("newType"),
  newModel: document.getElementById("newModel"),
  addObjectBtn: document.getElementById("addObjectBtn"),
  compositeName: document.getElementById("compositeName"),
  createCompositeBtn: document.getElementById("createCompositeBtn"),
  compositeList: document.getElementById("compositeList"),
  spawnCompositeBtn: document.getElementById("spawnCompositeBtn"),
  exportCompositeBtn: document.getElementById("exportCompositeBtn"),
  deleteCompositeBtn: document.getElementById("deleteCompositeBtn"),
  objectList: document.getElementById("objectList"),
  gizmoTranslateBtn: document.getElementById("gizmoTranslateBtn"),
  gizmoRotateBtn: document.getElementById("gizmoRotateBtn"),
  gizmoScaleBtn: document.getElementById("gizmoScaleBtn"),
  objectModel: document.getElementById("objectModel"),
  objX: document.getElementById("objX"),
  objY: document.getElementById("objY"),
  objZ: document.getElementById("objZ"),
  objScale: document.getElementById("objScale"),
  objRotY: document.getElementById("objRotY"),
  deleteObjectBtn: document.getElementById("deleteObjectBtn"),
  saveBtn: document.getElementById("saveBtn"),
  resetBtn: document.getElementById("resetBtn"),
  presetJson: document.getElementById("presetJson"),
  exportJsonBtn: document.getElementById("exportJsonBtn"),
  exportObjectsBtn: document.getElementById("exportObjectsBtn"),
  exportWaterBtn: document.getElementById("exportWaterBtn"),
  exportWeatherBtn: document.getElementById("exportWeatherBtn"),
  exportShipOverridesBtn: document.getElementById("exportShipOverridesBtn"),
  importJsonBtn: document.getElementById("importJsonBtn"),
  applyToGameBtn: document.getElementById("applyToGameBtn"),
  status: document.getElementById("status")
};

function fillSelect(select, options, selectedPath) {
  select.innerHTML = "";
  for (var i = 0; i < options.length; i++) {
    var o = document.createElement("option");
    var v = options[i].path !== undefined ? options[i].path : options[i].value;
    o.value = v;
    o.textContent = options[i].label;
    if (v === selectedPath) o.selected = true;
    select.appendChild(o);
  }
}

function setStatus(msg) {
  ui.status.textContent = msg;
}

var scene = new THREE.Scene();
scene.background = new THREE.Color(0x6fa4d4);
scene.fog = new THREE.FogExp2(0x6fa4d4, 0.005);

var renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById("app").appendChild(renderer.domElement);

var camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(50, 38, 55);
var controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 2, 0);
controls.enableDamping = true;
var transform = new TransformControls(camera, renderer.domElement);
transform.setSpace("world");
transform.setSize(0.8);
scene.add(transform);
transform.addEventListener("dragging-changed", function (e) {
  controls.enabled = !e.value;
});

var ambient = new THREE.AmbientLight(0xddeeff, 0.8);
scene.add(ambient);
var sun = new THREE.DirectionalLight(0xffffff, 1.0);
sun.position.set(60, 90, 20);
scene.add(sun);


var oceanGeo = null;
var oceanMat = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide, flatShading: true, vertexColors: true });
var ocean = new THREE.Mesh(new THREE.PlaneGeometry(2, 2, 1, 1), oceanMat);
ocean.rotation.x = -Math.PI / 2;
scene.add(ocean);
var waterModelHolder = new THREE.Group();
scene.add(waterModelHolder);
var waterModelVisual = null;

function rebuildOceanGeometry() {
  var seg = Math.max(1, Math.floor(state.water.segments || 56));
  var size = Math.max(20, state.water.size || 400);
  if (ocean.geometry) ocean.geometry.dispose();
  oceanGeo = new THREE.PlaneGeometry(size, size, seg, seg);
  var oceanColors = new Float32Array(oceanGeo.attributes.position.count * 3);
  oceanGeo.setAttribute("color", new THREE.BufferAttribute(oceanColors, 3));
  ocean.geometry = oceanGeo;
}
rebuildOceanGeometry();

var rainGeo = new THREE.BufferGeometry();
var rainCount = 1800;
var rainPos = new Float32Array(rainCount * 3);
var rainVel = new Float32Array(rainCount);
for (var r = 0; r < rainCount; r++) {
  rainPos[r * 3] = (Math.random() - 0.5) * 180;
  rainPos[r * 3 + 1] = Math.random() * 70 + 10;
  rainPos[r * 3 + 2] = (Math.random() - 0.5) * 180;
  rainVel[r] = 22 + Math.random() * 16;
}
rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPos, 3));
var rainMat = new THREE.PointsMaterial({ color: 0xaec8de, size: 0.25, transparent: true, opacity: 0, depthWrite: false });
var rain = new THREE.Points(rainGeo, rainMat);
scene.add(rain);

var shipHolder = new THREE.Group();
scene.add(shipHolder);
var shipVisual = null;

var propMap = {};
var selectedPropId = null;

transform.addEventListener("objectChange", function () {
  var p = selectedProp();
  var live = p ? propMap[p.id] : null;
  if (!p || !live) return;
  p.x = parseFloat(live.holder.position.x.toFixed(2));
  p.y = parseFloat(live.holder.position.y.toFixed(2));
  p.z = parseFloat(live.holder.position.z.toFixed(2));
  p.scale = parseFloat(live.holder.scale.x.toFixed(3));
  p.rotYDeg = parseFloat(THREE.MathUtils.radToDeg(live.holder.rotation.y).toFixed(1));
  applySelectedToInputs();
  scheduleSave();
});

async function loadVisual(path, targetFit) {
  var tpl = await loadTemplate(path);
  var visual = tpl.clone(true);
  fitToSize(visual, targetFit);
  applyFlat(visual);
  return visual;
}

async function rebuildShip() {
  var opt = optionByPath("ship", state.ship.modelPath);
  if (!opt) return;
  if (shipVisual) shipHolder.remove(shipVisual);
  setStatus("Loading ship...");
  try {
    shipVisual = await loadVisual(opt.path, opt.fit);
    shipHolder.add(shipVisual);
    shipHolder.scale.setScalar(state.ship.scale);
    shipHolder.rotation.y = THREE.MathUtils.degToRad(state.ship.rotYDeg);
    setStatus("Ship loaded");
  } catch (e) {
    setStatus("Ship load failed");
  }
}

function applyWeather() {
  var w = state.weather;
  scene.fog.density = w.fogDensity;
  ambient.intensity = w.ambientInt;
  sun.intensity = w.sunInt;
  rainMat.opacity = 0.42 * w.rainDensity;
  var sky = new THREE.Color().setHSL(0.56, 0.45, Math.max(0.16, 0.68 - w.fogDensity * 18));
  scene.background = sky;
  scene.fog.color = sky;
}

function applyWaterSurface() {
  state.water.colorDeep = sanitizeColor(state.water.colorDeep, "#2a5577");
  state.water.colorShallow = sanitizeColor(state.water.colorShallow, "#4ea3c4");
  ui.waterColorDeep.value = state.water.colorDeep;
  ui.waterColorShallow.value = state.water.colorShallow;
}

async function rebuildWaterModel() {
  if (waterModelVisual) {
    waterModelHolder.remove(waterModelVisual);
    waterModelVisual = null;
  }
  if (!state.water.modelPath) return;
  var opt = optionByPath("water", state.water.modelPath);
  if (!opt) return;
  setStatus("Loading water model...");
  try {
    waterModelVisual = await loadVisual(opt.path, opt.fit || 26);
    waterModelHolder.add(waterModelVisual);
    waterModelHolder.position.set(0, state.water.modelY, 0);
    waterModelHolder.scale.setScalar(state.water.modelScale);
    setStatus("Water model loaded");
  } catch (e) {
    setStatus("Water model load failed");
  }
}

async function addProp(prop, shouldSelect) {
  if (prop.type === "composite") {
    var comp = getCompositeDef(prop.compositeName);
    if (!comp || !Array.isArray(comp.items) || comp.items.length === 0) {
      setStatus("Composite not found");
      return;
    }
    setStatus("Loading composite...");
    try {
      var holder = new THREE.Group();
      for (var ci = 0; ci < comp.items.length; ci++) {
        var item = comp.items[ci];
        var libItemC = optionByPath(item.type, item.modelPath);
        if (!libItemC) continue;
        var visualC = await loadVisual(libItemC.path, libItemC.fit);
        var part = new THREE.Group();
        part.add(visualC);
        part.position.set(item.x || 0, item.y || 0, item.z || 0);
        part.rotation.y = THREE.MathUtils.degToRad(item.rotYDeg || 0);
        part.scale.setScalar(item.scale || 1);
        holder.add(part);
      }
      holder.position.set(prop.x, prop.y, prop.z);
      holder.rotation.y = THREE.MathUtils.degToRad(prop.rotYDeg);
      holder.scale.setScalar(prop.scale);
      scene.add(holder);
      propMap[prop.id] = { holder: holder, visual: holder };
      if (shouldSelect) {
        selectedPropId = prop.id;
        refreshObjectList();
        applySelectedToInputs();
      }
      setStatus("Loaded composite");
    } catch (e) {
      setStatus("Failed to load composite");
    }
    return;
  }

  var libItem = optionByPath(prop.type, prop.modelPath);
  if (!libItem) return;
  setStatus("Loading " + prop.type + "...");
  try {
    var visual = await loadVisual(libItem.path, libItem.fit);
    var holder = new THREE.Group();
    holder.add(visual);
    holder.position.set(prop.x, prop.y, prop.z);
    holder.rotation.y = THREE.MathUtils.degToRad(prop.rotYDeg);
    holder.scale.setScalar(prop.scale);
    scene.add(holder);
    propMap[prop.id] = { holder: holder, visual: visual };
    if (shouldSelect) {
      selectedPropId = prop.id;
      refreshObjectList();
      applySelectedToInputs();
    }
    setStatus("Loaded " + prop.type);
  } catch (e) {
    setStatus("Failed to load " + prop.type);
  }
}

function removePropById(id) {
  var p = propMap[id];
  if (p) {
    scene.remove(p.holder);
    delete propMap[id];
  }
  state.props = state.props.filter(function (x) { return x.id !== id; });
}

function refreshObjectList() {
  ui.objectList.innerHTML = "";
  var none = document.createElement("option");
  none.value = "";
  none.textContent = "(none)";
  ui.objectList.appendChild(none);
  for (var i = 0; i < state.props.length; i++) {
    var p = state.props[i];
    var o = document.createElement("option");
    o.value = p.id;
    o.textContent = p.type === "composite" ? (p.type + ":" + (p.compositeName || "?") + " #" + (i + 1)) : (p.type + " #" + (i + 1));
    if (selectedPropId === p.id) o.selected = true;
    ui.objectList.appendChild(o);
  }
}

function selectedProp() {
  for (var i = 0; i < state.props.length; i++) if (state.props[i].id === selectedPropId) return state.props[i];
  return null;
}

function fillModelSelectForType(select, type, selectedPath) {
  if (type === "composite") {
    var comps = [];
    for (var i = 0; i < state.composites.length; i++) {
      comps.push({ value: state.composites[i].name, label: state.composites[i].name });
    }
    if (comps.length === 0) comps.push({ value: "", label: "(no composites)" });
    fillSelect(select, comps, selectedPath);
    return;
  }
  fillSelect(select, LIB[type] || [], selectedPath);
}

function applySelectedToInputs() {
  var p = selectedProp();
  if (!p) {
    transform.detach();
    return;
  }
  fillModelSelectForType(ui.objectModel, p.type, p.type === "composite" ? p.compositeName : p.modelPath);
  ui.objX.value = String(p.x);
  ui.objY.value = String(p.y);
  ui.objZ.value = String(p.z);
  ui.objScale.value = String(p.scale);
  ui.objRotY.value = String(p.rotYDeg);
  var live = propMap[p.id];
  if (live) transform.attach(live.holder);
}

function applySelectedTransform() {
  var p = selectedProp();
  if (!p) return;
  var live = propMap[p.id];
  if (!live) return;
  live.holder.position.set(p.x, p.y, p.z);
  live.holder.rotation.y = THREE.MathUtils.degToRad(p.rotYDeg);
  live.holder.scale.setScalar(p.scale);
}

function setGizmoMode(mode) {
  transform.setMode(mode);
  ui.gizmoTranslateBtn.className = mode === "translate" ? "" : "secondary";
  ui.gizmoRotateBtn.className = mode === "rotate" ? "" : "secondary";
  ui.gizmoScaleBtn.className = mode === "scale" ? "" : "secondary";
}

function nextId() {
  return "p_" + Date.now() + "_" + Math.floor(Math.random() * 999999);
}

fillSelect(ui.shipModel, LIB.ship, state.ship.modelPath);
ui.shipScale.value = String(state.ship.scale);
ui.shipRotY.value = String(state.ship.rotYDeg);
var slotOptions = SHIP_SLOTS.map(function (slot) { return { value: slot, label: slot.toUpperCase() }; });
fillSelect(ui.shipOverrideClass, slotOptions, SHIP_SLOTS[0]);
fillSelect(ui.shipOverrideModel, LIB.ship, state.shipOverrides[ui.shipOverrideClass.value] || state.ship.modelPath);

for (var k in PRESETS) {
  var opt = document.createElement("option");
  opt.value = k;
  opt.textContent = k.toUpperCase();
  if (k === state.weather.preset) opt.selected = true;
  ui.weatherPreset.appendChild(opt);
}
ui.fogDensity.value = String(state.weather.fogDensity);
ui.ambientInt.value = String(state.weather.ambientInt);
ui.sunInt.value = String(state.weather.sunInt);
ui.rainDensity.value = String(state.weather.rainDensity);
var waterOptions = [{ value: "", label: "(none)" }].concat(LIB.water);
fillSelect(ui.waterModel, waterOptions, state.water.modelPath || "");
ui.waterModelScale.value = String(state.water.modelScale);
ui.waterModelY.value = String(state.water.modelY);
ui.waterSize.value = String(state.water.size);
ui.waterSegments.value = String(state.water.segments);
ui.waterWaveAmp.value = String(state.water.waveAmp);
ui.waterWaveSteps.value = String(state.water.waveSteps);
ui.waterWaveWeight1.value = String(state.water.waveWeight1);
ui.waterWaveFreqX1.value = String(state.water.waveFreqX1);
ui.waterWaveSpeed1.value = String(state.water.waveSpeed1);
ui.waterWaveWeight2.value = String(state.water.waveWeight2);
ui.waterWaveFreqZ2.value = String(state.water.waveFreqZ2);
ui.waterWaveSpeed2.value = String(state.water.waveSpeed2);
ui.waterWaveWeight3.value = String(state.water.waveWeight3);
ui.waterWaveFreqX3.value = String(state.water.waveFreqX3);
ui.waterWaveFreqZ3.value = String(state.water.waveFreqZ3);
ui.waterWaveSpeed3.value = String(state.water.waveSpeed3);
ui.waterColorDeep.value = sanitizeColor(state.water.colorDeep, "#2a5577");
ui.waterColorShallow.value = sanitizeColor(state.water.colorShallow, "#4ea3c4");

["tree", "island", "port", "water", "composite"].forEach(function (t) {
  var o = document.createElement("option");
  o.value = t;
  o.textContent = t.toUpperCase();
  ui.newType.appendChild(o);
});
fillModelSelectForType(ui.newModel, ui.newType.value || "tree");
refreshCompositeList();
refreshObjectList();
setGizmoMode("translate");

var saveTimer = null;
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(function () {
    saveState(state);
    setStatus("Settings saved");
  }, 180);
}

ui.shipModel.addEventListener("change", function () {
  state.ship.modelPath = ui.shipModel.value;
  rebuildShip();
  scheduleSave();
});
ui.shipScale.addEventListener("input", function () {
  state.ship.scale = parseFloat(ui.shipScale.value);
  shipHolder.scale.setScalar(state.ship.scale);
  scheduleSave();
});
ui.shipRotY.addEventListener("input", function () {
  state.ship.rotYDeg = parseFloat(ui.shipRotY.value);
  shipHolder.rotation.y = THREE.MathUtils.degToRad(state.ship.rotYDeg);
  scheduleSave();
});
ui.shipOverrideClass.addEventListener("change", function () {
  var slot = ui.shipOverrideClass.value;
  fillSelect(ui.shipOverrideModel, LIB.ship, state.shipOverrides[slot] || state.ship.modelPath);
});
ui.saveShipOverrideBtn.addEventListener("click", function () {
  var slot = ui.shipOverrideClass.value;
  if (!slot) return;
  state.shipOverrides[slot] = ui.shipOverrideModel.value;
  scheduleSave();
  setStatus("Ship override set: " + slot);
});

ui.weatherPreset.addEventListener("change", function () {
  state.weather.preset = ui.weatherPreset.value;
  var p = PRESETS[state.weather.preset];
  if (p) {
    state.weather.fogDensity = p.fogDensity;
    state.weather.ambientInt = p.ambientInt;
    state.weather.sunInt = p.sunInt;
    state.weather.rainDensity = p.rainDensity;
    ui.fogDensity.value = String(p.fogDensity);
    ui.ambientInt.value = String(p.ambientInt);
    ui.sunInt.value = String(p.sunInt);
    ui.rainDensity.value = String(p.rainDensity);
    applyWeather();
  }
  scheduleSave();
});

[
  ["fogDensity", "fogDensity"], ["ambientInt", "ambientInt"],
  ["sunInt", "sunInt"], ["rainDensity", "rainDensity"]
].forEach(function (pair) {
  ui[pair[0]].addEventListener("input", function () {
    state.weather[pair[1]] = parseFloat(ui[pair[0]].value);
    applyWeather();
    scheduleSave();
  });
});

ui.waterModel.addEventListener("change", function () {
  state.water.modelPath = ui.waterModel.value;
  rebuildWaterModel();
  scheduleSave();
});
ui.waterModelScale.addEventListener("input", function () {
  state.water.modelScale = parseFloat(ui.waterModelScale.value);
  waterModelHolder.scale.setScalar(state.water.modelScale);
  scheduleSave();
});
ui.waterModelY.addEventListener("input", function () {
  state.water.modelY = parseFloat(ui.waterModelY.value);
  waterModelHolder.position.y = state.water.modelY;
  scheduleSave();
});
ui.waterSize.addEventListener("input", function () {
  state.water.size = parseFloat(ui.waterSize.value);
  rebuildOceanGeometry();
  scheduleSave();
});
ui.waterSegments.addEventListener("input", function () {
  state.water.segments = parseFloat(ui.waterSegments.value);
  rebuildOceanGeometry();
  scheduleSave();
});
[
  ["waterWaveAmp", "waveAmp"],
  ["waterWaveSteps", "waveSteps"],
  ["waterWaveWeight1", "waveWeight1"],
  ["waterWaveFreqX1", "waveFreqX1"],
  ["waterWaveSpeed1", "waveSpeed1"],
  ["waterWaveWeight2", "waveWeight2"],
  ["waterWaveFreqZ2", "waveFreqZ2"],
  ["waterWaveSpeed2", "waveSpeed2"],
  ["waterWaveWeight3", "waveWeight3"],
  ["waterWaveFreqX3", "waveFreqX3"],
  ["waterWaveFreqZ3", "waveFreqZ3"],
  ["waterWaveSpeed3", "waveSpeed3"]
].forEach(function (pair) {
  ui[pair[0]].addEventListener("input", function () {
    state.water[pair[1]] = parseFloat(ui[pair[0]].value);
    scheduleSave();
  });
});
ui.waterColorDeep.addEventListener("input", function () {
  state.water.colorDeep = ui.waterColorDeep.value;
  applyWaterSurface();
  scheduleSave();
});
ui.waterColorShallow.addEventListener("input", function () {
  state.water.colorShallow = ui.waterColorShallow.value;
  applyWaterSurface();
  scheduleSave();
});

ui.newType.addEventListener("change", function () {
  fillModelSelectForType(ui.newModel, ui.newType.value);
});

ui.addObjectBtn.addEventListener("click", function () {
  var type = ui.newType.value;
  var p = null;
  if (type === "composite") {
    if (!ui.newModel.value) {
      setStatus("No composite selected");
      return;
    }
    p = { id: nextId(), type: type, compositeName: ui.newModel.value, x: 0, y: 0, z: 0, scale: 1, rotYDeg: 0 };
  } else {
    var modelPath = ui.newModel.value;
    p = { id: nextId(), type: type, modelPath: modelPath, x: 0, y: 0, z: 0, scale: 1, rotYDeg: 0 };
  }
  state.props.push(p);
  addProp(p, true);
  scheduleSave();
});

ui.createCompositeBtn.addEventListener("click", function () {
  var name = (ui.compositeName.value || "").trim();
  if (!name) {
    setStatus("Enter a composite name");
    return;
  }
  var parts = state.props.filter(function (p) { return p.type !== "composite"; });
  if (parts.length === 0) {
    setStatus("Add objects first");
    return;
  }

  var cx = 0, cy = 0, cz = 0;
  for (var i = 0; i < parts.length; i++) {
    cx += parts[i].x; cy += parts[i].y; cz += parts[i].z;
  }
  cx /= parts.length; cy /= parts.length; cz /= parts.length;

  var def = {
    name: name,
    items: parts.map(function (p) {
      return {
        type: p.type,
        modelPath: p.modelPath,
        x: p.x - cx,
        y: p.y - cy,
        z: p.z - cz,
        scale: p.scale,
        rotYDeg: p.rotYDeg
      };
    })
  };

  state.composites = state.composites.filter(function (c) { return c.name !== name; });
  state.composites.push(def);
  refreshCompositeList();
  fillModelSelectForType(ui.newModel, "composite", name);
  ui.newType.value = "composite";
  setStatus("Composite created: " + name);
  scheduleSave();
});

ui.spawnCompositeBtn.addEventListener("click", function () {
  if (!ui.compositeList.value) {
    setStatus("No composite selected");
    return;
  }
  var p = { id: nextId(), type: "composite", compositeName: ui.compositeList.value, x: 0, y: 0, z: 0, scale: 1, rotYDeg: 0 };
  state.props.push(p);
  addProp(p, true);
  scheduleSave();
});

ui.exportCompositeBtn.addEventListener("click", function () {
  var name = ui.compositeList.value;
  var def = getCompositeDef(name);
  if (!def) {
    setStatus("No composite selected");
    return;
  }
  var txt = JSON.stringify(def, null, 2);
  ui.presetJson.value = txt;
  try { navigator.clipboard.writeText(txt); } catch (e) { /* ignore */ }
  setStatus("Composite exported: " + name);
});

ui.deleteCompositeBtn.addEventListener("click", function () {
  var name = ui.compositeList.value;
  if (!name) {
    setStatus("No composite selected");
    return;
  }
  var removed = deleteCompositeByName(name);
  refreshCompositeList();
  fillModelSelectForType(ui.newModel, ui.newType.value || "tree");
  scheduleSave();
  setStatus("Composite deleted: " + name + " (removed " + removed + " instances)");
});

ui.objectList.addEventListener("change", function () {
  selectedPropId = ui.objectList.value || null;
  applySelectedToInputs();
});
ui.gizmoTranslateBtn.addEventListener("click", function () { setGizmoMode("translate"); });
ui.gizmoRotateBtn.addEventListener("click", function () { setGizmoMode("rotate"); });
ui.gizmoScaleBtn.addEventListener("click", function () { setGizmoMode("scale"); });

ui.objectModel.addEventListener("change", async function () {
  var p = selectedProp();
  if (!p) return;
  if (p.type === "composite") p.compositeName = ui.objectModel.value;
  else p.modelPath = ui.objectModel.value;
  removePropById(p.id);
  state.props.push(p);
  await addProp(p, true);
  scheduleSave();
});

[
  ["objX", "x"], ["objY", "y"], ["objZ", "z"], ["objScale", "scale"], ["objRotY", "rotYDeg"]
].forEach(function (pair) {
  ui[pair[0]].addEventListener("input", function () {
    var p = selectedProp();
    if (!p) return;
    p[pair[1]] = parseFloat(ui[pair[0]].value);
    applySelectedTransform();
    scheduleSave();
  });
});

ui.deleteObjectBtn.addEventListener("click", function () {
  if (!selectedPropId) return;
  removePropById(selectedPropId);
  selectedPropId = null;
  refreshObjectList();
  scheduleSave();
});

ui.saveBtn.addEventListener("click", function () {
  saveState(state);
  setStatus("Settings saved");
});

ui.resetBtn.addEventListener("click", function () {
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
});

ui.exportJsonBtn.addEventListener("click", function () {
  var txt = JSON.stringify(state, null, 2);
  ui.presetJson.value = txt;
  try { navigator.clipboard.writeText(txt); } catch (e) { /* ignore */ }
  setStatus("Preset JSON exported");
});

ui.exportObjectsBtn.addEventListener("click", function () {
  var out = [];
  for (var i = 0; i < state.props.length; i++) {
    var p = state.props[i];
    out.push({
      type: p.type,
      modelPath: p.modelPath,
      compositeName: p.compositeName,
      x: parseFloat(Number(p.x).toFixed(2)),
      y: parseFloat(Number(p.y).toFixed(2)),
      z: parseFloat(Number(p.z).toFixed(2)),
      scale: parseFloat(Number(p.scale).toFixed(3)),
      rotYDeg: parseFloat(Number(p.rotYDeg).toFixed(2))
    });
  }
  var txt = JSON.stringify({ composites: state.composites, objects: out }, null, 2);
  ui.presetJson.value = txt;
  try { navigator.clipboard.writeText(txt); } catch (e) { /* ignore */ }
  setStatus("Object transforms exported");
});

ui.exportWaterBtn.addEventListener("click", function () {
  var txt = JSON.stringify({ water: state.water }, null, 2);
  ui.presetJson.value = txt;
  try { navigator.clipboard.writeText(txt); } catch (e) { /* ignore */ }
  setStatus("Water settings exported");
});

ui.exportWeatherBtn.addEventListener("click", function () {
  var txt = JSON.stringify({ presets: PRESETS, active: state.weather }, null, 2);
  ui.presetJson.value = txt;
  try { navigator.clipboard.writeText(txt); } catch (e) { /* ignore */ }
  setStatus("Weather settings exported");
});

ui.exportShipOverridesBtn.addEventListener("click", function () {
  var payload = {
    slots: SHIP_SLOTS,
    overrides: state.shipOverrides,
    selectedLabModel: state.ship.modelPath
  };
  var txt = JSON.stringify(payload, null, 2);
  ui.presetJson.value = txt;
  try { navigator.clipboard.writeText(txt); } catch (e) { /* ignore */ }
  setStatus("Ship override mapping exported");
});

ui.importJsonBtn.addEventListener("click", async function () {
  try {
    var parsed = JSON.parse(ui.presetJson.value || "{}");
    await rebuildFromState(parsed);
    setStatus("Preset JSON imported");
  } catch (e) {
    setStatus("Import failed: invalid JSON");
  }
});

ui.applyToGameBtn.addEventListener("click", function () {
  var payload = {
    ship: { scale: state.ship.scale, modelPath: state.ship.modelPath, overrides: state.shipOverrides },
    weather: {
      preset: state.weather.preset,
      fogDensity: state.weather.fogDensity,
      ambientInt: state.weather.ambientInt,
      sunInt: state.weather.sunInt
    },
    water: state.water,
    objects: state.props.map(function (p) {
      return {
        type: p.type,
        modelPath: p.modelPath,
        compositeName: p.compositeName,
        x: p.x, y: p.y, z: p.z,
        scale: p.scale,
        rotYDeg: p.rotYDeg
      };
    }),
    composites: state.composites
  };
  var txt = JSON.stringify(payload, null, 2);
  ui.presetJson.value = txt;
  try { navigator.clipboard.writeText(txt); } catch (e) { /* ignore */ }
  setStatus("Full game graphics JSON exported");
});

window.addEventListener("resize", function () {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

async function init() {
  await loadCatalog();
  state = normalizeImportedState(state);
  await rebuildFromState(state);
  setStatus("Ready");
}

function normalizeImportedState(parsed) {
  var base = defaultState();
  var s = Object.assign({}, base, parsed || {});
  if (Array.isArray(parsed && parsed.objects) && !Array.isArray(parsed && parsed.props)) {
    s.props = parsed.objects;
  }
  s.ship = Object.assign({}, base.ship, s.ship || {});
  s.weather = Object.assign({}, base.weather, s.weather || {});
  s.water = Object.assign({}, base.water, s.water || {});
  if (parsed && parsed.weather && parsed.weather.waveAmp !== undefined) {
    s.water.waveAmp = parsed.weather.waveAmp;
  }
  if (parsed && parsed.water && parsed.water.waveStrength !== undefined) {
    s.water.waveAmp = s.water.waveAmp * parsed.water.waveStrength;
  }
  s.water.waveSteps = Math.max(1, Math.floor(s.water.waveSteps || base.water.waveSteps));
  s.water.segments = Math.max(1, Math.floor(s.water.segments || base.water.segments));
  s.water.colorDeep = sanitizeColor(s.water.colorDeep, base.water.colorDeep);
  s.water.colorShallow = sanitizeColor(s.water.colorShallow, base.water.colorShallow);
  s.shipOverrides = Object.assign({}, base.shipOverrides, s.shipOverrides || {});
  for (var si = 0; si < SHIP_SLOTS.length; si++) {
    var slot = SHIP_SLOTS[si];
    if (!s.shipOverrides[slot]) s.shipOverrides[slot] = base.ship.modelPath;
  }
  if (!Array.isArray(s.props)) s.props = [];
  if (!Array.isArray(s.composites)) s.composites = [];
  return s;
}

async function rebuildFromState(newState) {
  state = normalizeImportedState(newState);
  for (var id in propMap) {
    if (Object.prototype.hasOwnProperty.call(propMap, id)) {
      scene.remove(propMap[id].holder);
    }
  }
  propMap = {};
  selectedPropId = null;
  transform.detach();

  fillSelect(ui.shipModel, LIB.ship, state.ship.modelPath);
  ui.shipScale.value = String(state.ship.scale);
  ui.shipRotY.value = String(state.ship.rotYDeg);
  fillSelect(ui.shipOverrideClass, SHIP_SLOTS.map(function (slot) { return { value: slot, label: slot.toUpperCase() }; }), ui.shipOverrideClass.value || SHIP_SLOTS[0]);
  fillSelect(ui.shipOverrideModel, LIB.ship, state.shipOverrides[ui.shipOverrideClass.value] || state.ship.modelPath);
  ui.weatherPreset.value = state.weather.preset;
  ui.fogDensity.value = String(state.weather.fogDensity);
  ui.ambientInt.value = String(state.weather.ambientInt);
  ui.sunInt.value = String(state.weather.sunInt);
  ui.rainDensity.value = String(state.weather.rainDensity);
  fillSelect(ui.waterModel, [{ value: "", label: "(none)" }].concat(LIB.water), state.water.modelPath || "");
  ui.waterModelScale.value = String(state.water.modelScale);
  ui.waterModelY.value = String(state.water.modelY);
  ui.waterSize.value = String(state.water.size);
  ui.waterSegments.value = String(state.water.segments);
  ui.waterWaveAmp.value = String(state.water.waveAmp);
  ui.waterWaveSteps.value = String(state.water.waveSteps);
  ui.waterWaveWeight1.value = String(state.water.waveWeight1);
  ui.waterWaveFreqX1.value = String(state.water.waveFreqX1);
  ui.waterWaveSpeed1.value = String(state.water.waveSpeed1);
  ui.waterWaveWeight2.value = String(state.water.waveWeight2);
  ui.waterWaveFreqZ2.value = String(state.water.waveFreqZ2);
  ui.waterWaveSpeed2.value = String(state.water.waveSpeed2);
  ui.waterWaveWeight3.value = String(state.water.waveWeight3);
  ui.waterWaveFreqX3.value = String(state.water.waveFreqX3);
  ui.waterWaveFreqZ3.value = String(state.water.waveFreqZ3);
  ui.waterWaveSpeed3.value = String(state.water.waveSpeed3);
  ui.waterColorDeep.value = state.water.colorDeep;
  ui.waterColorShallow.value = state.water.colorShallow;
  refreshCompositeList();
  fillModelSelectForType(ui.newModel, ui.newType.value || "tree");

  rebuildOceanGeometry();
  applyWeather();
  applyWaterSurface();
  await rebuildShip();
  await rebuildWaterModel();
  for (var i = 0; i < state.props.length; i++) await addProp(state.props[i], false);
  refreshObjectList();
  saveState(state);
}

var clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  var t = clock.getElapsedTime();
  var dt = Math.min(0.05, clock.getDelta());
  var w = state.water;
  var waveAmp = w.waveAmp;
  var deepColor = new THREE.Color(state.water.colorDeep);
  var shallowColor = new THREE.Color(state.water.colorShallow);
  var tmpColor = new THREE.Color();

  var pos = oceanGeo.attributes.position;
  var cols = oceanGeo.attributes.color;
  for (var i = 0; i < pos.count; i++) {
    var x = pos.getX(i);
    var z = pos.getY(i);
    var h = 0;
    h += Math.sin(x * w.waveFreqX1 + t * w.waveSpeed1) * w.waveWeight1 * waveAmp;
    h += Math.sin(z * w.waveFreqZ2 + t * w.waveSpeed2) * w.waveWeight2 * waveAmp;
    h += Math.sin(x * w.waveFreqX3 + z * w.waveFreqZ3 + t * w.waveSpeed3) * w.waveWeight3 * waveAmp;
    h = Math.floor(h * w.waveSteps) / w.waveSteps;
    pos.setZ(i, h);
    var tcol = THREE.MathUtils.clamp((h / (Math.max(0.01, waveAmp) * 1.6) + 1) * 0.5, 0, 1);
    tmpColor.copy(deepColor).lerp(shallowColor, tcol);
    cols.setXYZ(i, tmpColor.r, tmpColor.g, tmpColor.b);
  }
  pos.needsUpdate = true;
  cols.needsUpdate = true;
  oceanGeo.computeVertexNormals();

  var rp = rainGeo.attributes.position.array;
  for (var r = 0; r < rainCount; r++) {
    var idx = r * 3;
    rp[idx + 1] -= rainVel[r] * dt;
    if (rp[idx + 1] < 0.1) {
      rp[idx] = camera.position.x + (Math.random() - 0.5) * 180;
      rp[idx + 1] = 70 + Math.random() * 20;
      rp[idx + 2] = camera.position.z + (Math.random() - 0.5) * 180;
    }
  }
  rainGeo.attributes.position.needsUpdate = true;

  controls.update();
  renderer.render(scene, camera);
}

init();
animate();
