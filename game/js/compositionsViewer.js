import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { loadGlbVisual } from "./glbVisual.js";

var ui = {
  presetFile: document.getElementById("presetFile"),
  reloadBtn: document.getElementById("reloadBtn"),
  randomBtn: document.getElementById("randomBtn"),
  compositeSelect: document.getElementById("compositeSelect"),
  prevBtn: document.getElementById("prevBtn"),
  nextBtn: document.getElementById("nextBtn"),
  fitBtn: document.getElementById("fitBtn"),
  showIsland: document.getElementById("showIsland"),
  showPort: document.getElementById("showPort"),
  showTree: document.getElementById("showTree"),
  autoRotate: document.getElementById("autoRotate"),
  stats: document.getElementById("stats"),
  status: document.getElementById("status")
};

var app = document.getElementById("app");
var renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

var scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0f1d);
scene.fog = new THREE.FogExp2(0x0a0f1d, 0.0058);

var camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1600);
camera.position.set(42, 32, 44);

var controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(0, 4, 0);
controls.minDistance = 10;
controls.maxDistance = 260;

var hemi = new THREE.HemisphereLight(0x9dc8ff, 0x253243, 0.9);
scene.add(hemi);

var sun = new THREE.DirectionalLight(0xfff4d8, 1.05);
sun.position.set(80, 90, 30);
scene.add(sun);

var fill = new THREE.DirectionalLight(0x8eb6e0, 0.34);
fill.position.set(-50, 25, -60);
scene.add(fill);

var floorGeo = new THREE.PlaneGeometry(520, 520, 80, 80);
var floorMat = new THREE.MeshLambertMaterial({
  color: 0x2b4f73,
  side: THREE.DoubleSide,
  flatShading: true
});
var floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.02;
scene.add(floor);

var grid = new THREE.GridHelper(520, 52, 0x3f5f7f, 0x2b4560);
grid.position.y = 0.01;
scene.add(grid);

var compRoot = new THREE.Group();
scene.add(compRoot);

var state = {
  presets: [],
  currentIndex: -1,
  placed: []
};

function setStatus(msg) {
  ui.status.textContent = msg || "";
}

function countTypes(items) {
  var c = { island: 0, port: 0, tree: 0, other: 0 };
  for (var i = 0; i < items.length; i++) {
    var t = items[i].type;
    if (t === "island") c.island++;
    else if (t === "port") c.port++;
    else if (t === "tree") c.tree++;
    else c.other++;
  }
  return c;
}

function updateStats(comp) {
  if (!comp) {
    ui.stats.textContent = "No composition loaded.";
    return;
  }
  var counts = countTypes(comp.items || []);
  ui.stats.textContent =
    "Name: " + comp.name + "\n" +
    "Items: " + (comp.items ? comp.items.length : 0) + "\n" +
    "Islands: " + counts.island + " | Ports/Props: " + counts.port + " | Trees: " + counts.tree + "\n" +
    "Tip: Use type toggles to inspect layout readability.";
}

function clearComposition() {
  while (compRoot.children.length) compRoot.remove(compRoot.children[0]);
  state.placed = [];
}

function isVisibleType(type) {
  if (type === "island") return !!ui.showIsland.checked;
  if (type === "port") return !!ui.showPort.checked;
  if (type === "tree") return !!ui.showTree.checked;
  return true;
}

function refreshTypeVisibility() {
  for (var i = 0; i < state.placed.length; i++) {
    state.placed[i].group.visible = isVisibleType(state.placed[i].type);
  }
}

function fitCameraToCurrent() {
  if (!compRoot.children.length) return;
  var box = new THREE.Box3().setFromObject(compRoot);
  if (!isFinite(box.min.x) || !isFinite(box.max.x)) return;
  var center = new THREE.Vector3();
  var size = new THREE.Vector3();
  box.getCenter(center);
  box.getSize(size);
  var maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim < 0.01) maxDim = 12;

  controls.target.copy(center);
  var dist = maxDim * 1.7;
  camera.position.set(center.x + dist * 0.92, center.y + dist * 0.72, center.z + dist * 0.88);
  camera.near = Math.max(0.1, maxDim / 300);
  camera.far = Math.max(1000, maxDim * 20);
  camera.updateProjectionMatrix();
  controls.update();
}

async function loadCompositeByIndex(idx) {
  if (!state.presets.length) {
    clearComposition();
    updateStats(null);
    return;
  }
  if (idx < 0) idx = state.presets.length - 1;
  if (idx >= state.presets.length) idx = 0;
  state.currentIndex = idx;
  ui.compositeSelect.value = String(idx);

  var comp = state.presets[idx];
  clearComposition();
  setStatus("Loading " + comp.name + " ...");

  var items = comp.items || [];
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    try {
      var fit = (item.type === "island") ? 20 : (item.type === "port" ? 14 : 10);
      var visual = await loadGlbVisual(item.modelPath, fit, true);
      var g = new THREE.Group();
      g.add(visual);
      g.position.set(item.x || 0, item.y || 0, item.z || 0);
      g.rotation.y = THREE.MathUtils.degToRad(item.rotYDeg || 0);
      g.scale.setScalar(item.scale || 1);
      g.visible = isVisibleType(item.type);
      compRoot.add(g);
      state.placed.push({ group: g, type: item.type || "other", modelPath: item.modelPath || "" });
    } catch (e) {
      // keep loading remaining items
    }
  }

  updateStats(comp);
  fitCameraToCurrent();
  setStatus("Loaded: " + comp.name + " (" + state.placed.length + " rendered)");
}

function refreshCompositeList() {
  ui.compositeSelect.innerHTML = "";
  for (var i = 0; i < state.presets.length; i++) {
    var c = state.presets[i];
    var o = document.createElement("option");
    o.value = String(i);
    o.textContent = c.name + " (" + (c.items ? c.items.length : 0) + ")";
    ui.compositeSelect.appendChild(o);
  }
}

async function loadPresetFile() {
  setStatus("Loading preset file...");
  try {
    var res = await fetch(ui.presetFile.value);
    if (!res.ok) throw new Error("HTTP " + res.status);
    var json = await res.json();
    var comps = Array.isArray(json.composites) ? json.composites : [];
    state.presets = comps;
    refreshCompositeList();
    if (!comps.length) {
      clearComposition();
      updateStats(null);
      setStatus("No composites in file");
      return;
    }
    await loadCompositeByIndex(0);
  } catch (e) {
    state.presets = [];
    refreshCompositeList();
    clearComposition();
    updateStats(null);
    setStatus("Failed to load preset file");
  }
}

ui.reloadBtn.addEventListener("click", function () {
  loadPresetFile();
});

ui.randomBtn.addEventListener("click", function () {
  if (!state.presets.length) return;
  var idx = Math.floor(Math.random() * state.presets.length);
  loadCompositeByIndex(idx);
});

ui.prevBtn.addEventListener("click", function () {
  loadCompositeByIndex(state.currentIndex - 1);
});

ui.nextBtn.addEventListener("click", function () {
  loadCompositeByIndex(state.currentIndex + 1);
});

ui.fitBtn.addEventListener("click", function () {
  fitCameraToCurrent();
});

ui.compositeSelect.addEventListener("change", function () {
  var idx = parseInt(ui.compositeSelect.value, 10);
  if (isNaN(idx)) return;
  loadCompositeByIndex(idx);
});

ui.showIsland.addEventListener("change", refreshTypeVisibility);
ui.showPort.addEventListener("change", refreshTypeVisibility);
ui.showTree.addEventListener("change", refreshTypeVisibility);

window.addEventListener("resize", function () {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

var clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  var dt = clock.getDelta();
  if (ui.autoRotate.checked && compRoot.children.length) {
    compRoot.rotation.y += dt * 0.18;
  }
  controls.update();
  renderer.render(scene, camera);
}

loadPresetFile();
animate();
