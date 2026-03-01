// terrainComposite.js — composition-field island placement with GLB models
import * as THREE from "three";
import { loadGlbVisual } from "./glbVisual.js";
import { getQualityConfig } from "./mobile.js";

var TERRAIN_VISUAL_Y_OFFSET = 4.0;
var VISUAL_COLLIDER_PAD = 0.35;
var VISUAL_COLLIDER_SHRINK = 0.82;
var COMPOSITE_PRESET_PATH = "data/compositePresetsPalmov30.json";
var MIN_COMPOSITE_OBJECTS = 30;
var MIN_COMPOSITE_INSTANCES = 4;
var MAX_COMPOSITE_INSTANCES = 7;
var COMPOSITE_CENTER_MIN_DIST = 76;
var COMPOSITE_CENTER_MAX_DIST = 176;
var COMPOSITE_CENTER_ATTEMPTS = 220;
var SMALL_ISLAND_MODEL = "assets/models/islands/island-mountain-arch-2.glb";
var MIN_BIG_ISLANDS = 3;
var MIN_MEDIUM_ISLANDS = 7;
var MIN_SMALL_ISLANDS = 10;
var SPAWN_CLEAR_RADIUS = 40;
var MAP_SIZE = 400;
var TERRAIN_HEIGHT = 4;

var _compositePackPromise = null;
var _worldPosTmp = new THREE.Vector3();

function seededRand(seed) {
  var s = (seed >>> 0) || 1;
  return function () {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// --- multi-box decomposition grid resolution ---
var DECOMP_GRID_RES = 12; // cells per axis for footprint rasterization
var MAX_BOXES_PER_ISLAND = 8;

// Detect arch-type models by path keyword
function isArchModel(modelPath) {
  if (!modelPath) return false;
  var lower = modelPath.toLowerCase();
  return lower.indexOf("arch") >= 0;
}

// Rasterize mesh XZ footprint onto a 2D grid, return occupied cells
function rasterizeFootprint(obj, gridRes) {
  var box = new THREE.Box3().setFromObject(obj);
  if (!isFinite(box.min.x) || !isFinite(box.max.x)) return null;
  var extX = box.max.x - box.min.x;
  var extZ = box.max.z - box.min.z;
  if (extX < 0.01 || extZ < 0.01) return null;

  var cellW = extX / gridRes;
  var cellH = extZ / gridRes;
  var grid = new Uint8Array(gridRes * gridRes);

  // sample mesh triangles onto the grid
  obj.traverse(function (child) {
    if (!child.isMesh || !child.geometry) return;
    var geo = child.geometry;
    var posAttr = geo.attributes.position;
    if (!posAttr) return;
    var idx = geo.index;
    var triCount = idx ? idx.count / 3 : posAttr.count / 3;
    var worldMat = child.matrixWorld;
    var v = new THREE.Vector3();

    for (var t = 0; t < triCount; t++) {
      // sample each triangle's three vertices
      for (var vi = 0; vi < 3; vi++) {
        var vertIdx = idx ? idx.getX(t * 3 + vi) : t * 3 + vi;
        v.fromBufferAttribute(posAttr, vertIdx);
        v.applyMatrix4(worldMat);
        var gx = Math.floor((v.x - box.min.x) / cellW);
        var gz = Math.floor((v.z - box.min.z) / cellH);
        if (gx >= 0 && gx < gridRes && gz >= 0 && gz < gridRes) {
          grid[gz * gridRes + gx] = 1;
        }
      }
      // also sample triangle centroid for better coverage
      if (idx) {
        var i0 = idx.getX(t * 3), i1 = idx.getX(t * 3 + 1), i2 = idx.getX(t * 3 + 2);
        var cx = 0, cz = 0;
        for (var k = 0; k < 3; k++) {
          var ki = k === 0 ? i0 : (k === 1 ? i1 : i2);
          v.fromBufferAttribute(posAttr, ki);
          v.applyMatrix4(worldMat);
          cx += v.x; cz += v.z;
        }
        cx /= 3; cz /= 3;
        var gcx = Math.floor((cx - box.min.x) / cellW);
        var gcz = Math.floor((cz - box.min.z) / cellH);
        if (gcx >= 0 && gcx < gridRes && gcz >= 0 && gcz < gridRes) {
          grid[gcz * gridRes + gcx] = 1;
        }
      }
    }
  });

  return { grid: grid, res: gridRes, box: box, cellW: cellW, cellH: cellH };
}

// Greedy box fitting: decompose occupied cells into maximal rectangles
function decomposeGrid(footprint, maxBoxes) {
  var res = footprint.res;
  var grid = new Uint8Array(footprint.grid); // copy so we can mark consumed
  var boxes = [];

  for (var pass = 0; pass < maxBoxes; pass++) {
    // find largest rectangle of occupied cells
    var bestArea = 0, bestR0 = 0, bestC0 = 0, bestR1 = 0, bestC1 = 0;
    for (var r = 0; r < res; r++) {
      for (var c = 0; c < res; c++) {
        if (!grid[r * res + c]) continue;
        // expand rectangle from (r, c)
        var maxC1 = res - 1;
        for (var r1 = r; r1 < res; r1++) {
          for (var c1 = c; c1 <= maxC1; c1++) {
            if (!grid[r1 * res + c1]) { maxC1 = c1 - 1; break; }
          }
          var area = (r1 - r + 1) * (maxC1 - c + 1);
          if (area > bestArea) {
            bestArea = area;
            bestR0 = r; bestC0 = c; bestR1 = r1; bestC1 = maxC1;
          }
        }
      }
    }
    if (bestArea === 0) break;

    // convert grid coords to world AABB
    var minX = footprint.box.min.x + bestC0 * footprint.cellW;
    var maxX = footprint.box.min.x + (bestC1 + 1) * footprint.cellW;
    var minZ = footprint.box.min.z + bestR0 * footprint.cellH;
    var maxZ = footprint.box.min.z + (bestR1 + 1) * footprint.cellH;

    // shrink slightly to avoid invisible walls
    var shrinkX = (maxX - minX) * (1 - VISUAL_COLLIDER_SHRINK) * 0.5;
    var shrinkZ = (maxZ - minZ) * (1 - VISUAL_COLLIDER_SHRINK) * 0.5;
    boxes.push({
      minX: minX + shrinkX, maxX: maxX - shrinkX,
      minZ: minZ + shrinkZ, maxZ: maxZ - shrinkZ
    });

    // mark consumed cells
    for (var r = bestR0; r <= bestR1; r++) {
      for (var c = bestC0; c <= bestC1; c++) {
        grid[r * res + c] = 0;
      }
    }
  }

  return boxes;
}

// Decompose arch into two separate pillar colliders (left + right supports)
function decomposeArch(footprint) {
  var res = footprint.res;
  var grid = footprint.grid;
  // Split grid into left half and right half, build separate boxes for each
  var halfC = Math.floor(res / 2);
  var pillars = [];

  for (var side = 0; side < 2; side++) {
    var cStart = side === 0 ? 0 : halfC;
    var cEnd = side === 0 ? halfC : res;
    var minR = res, maxR = -1, minC = res, maxC = -1;
    var occupied = false;
    for (var r = 0; r < res; r++) {
      for (var c = cStart; c < cEnd; c++) {
        if (!grid[r * res + c]) continue;
        occupied = true;
        if (r < minR) minR = r;
        if (r > maxR) maxR = r;
        if (c < minC) minC = c;
        if (c > maxC) maxC = c;
      }
    }
    if (!occupied) continue;
    var wMinX = footprint.box.min.x + minC * footprint.cellW;
    var wMaxX = footprint.box.min.x + (maxC + 1) * footprint.cellW;
    var wMinZ = footprint.box.min.z + minR * footprint.cellH;
    var wMaxZ = footprint.box.min.z + (maxR + 1) * footprint.cellH;
    var shrinkX = (wMaxX - wMinX) * (1 - VISUAL_COLLIDER_SHRINK) * 0.5;
    var shrinkZ = (wMaxZ - wMinZ) * (1 - VISUAL_COLLIDER_SHRINK) * 0.5;
    pillars.push({
      minX: wMinX + shrinkX, maxX: wMaxX - shrinkX,
      minZ: wMinZ + shrinkZ, maxZ: wMaxZ - shrinkZ
    });
  }
  return pillars;
}

function addVisualColliderFromObject(terrain, obj, modelPath) {
  if (!terrain || !obj) return;

  // try multi-box decomposition from mesh geometry
  obj.updateMatrixWorld(true);
  var footprint = rasterizeFootprint(obj, DECOMP_GRID_RES);

  if (!footprint) {
    // fallback to single AABB
    var box = new THREE.Box3().setFromObject(obj);
    if (!isFinite(box.min.x) || !isFinite(box.max.x)) return;
    var cx = (box.min.x + box.max.x) * 0.5;
    var cz = (box.min.z + box.max.z) * 0.5;
    var hx = (box.max.x - box.min.x) * 0.5 * VISUAL_COLLIDER_SHRINK;
    var hz = (box.max.z - box.min.z) * 0.5 * VISUAL_COLLIDER_SHRINK;
    terrain.visualColliders.push({ minX: cx - hx, maxX: cx + hx, minZ: cz - hz, maxZ: cz + hz });
    return;
  }

  // check if occupied cells exist at all
  var hasOccupied = false;
  for (var i = 0; i < footprint.grid.length; i++) {
    if (footprint.grid[i]) { hasOccupied = true; break; }
  }
  if (!hasOccupied) return;

  var boxes;
  if (isArchModel(modelPath)) {
    // arch: split into two separate pillar colliders
    boxes = decomposeArch(footprint);
  } else {
    // normal island: greedy multi-box decomposition
    boxes = decomposeGrid(footprint, MAX_BOXES_PER_ISLAND);
  }

  // push all decomposed boxes
  for (var b = 0; b < boxes.length; b++) {
    terrain.visualColliders.push(boxes[b]);
  }
}

function addMinimapMarker(terrain, type, x, z, size, modelPath) {
  if (!terrain) return;
  if (!terrain.minimapMarkers) terrain.minimapMarkers = [];
  terrain.minimapMarkers.push({ type: type || "island", x: x, z: z, size: size || 1, modelPath: modelPath || "" });
}

function addMinimapMarkerForObject(terrain, type, obj, size, modelPath) {
  if (!obj) return;
  obj.getWorldPosition(_worldPosTmp);
  addMinimapMarker(terrain, type, _worldPosTmp.x, _worldPosTmp.z, size, modelPath);
}

function shouldAddCompositeCollider(item) {
  return item && item.type === "island";
}

function fitForCompositeItem(item) {
  if (item.type === "tree") return 10;
  if (item.type === "port") return 18;
  return 20;
}

function getCompositeMarkerTypeByScale(itemType, worldScale) {
  if (itemType === "port") return "port";
  if (itemType === "tree") return "tree";
  if (worldScale >= 1.35) return "island_big";
  if (worldScale >= 1.0) return "island_mid";
  return "island_small";
}

function rotateXZ(x, z, rad) {
  var c = Math.cos(rad);
  var s = Math.sin(rad);
  return { x: x * c - z * s, z: x * s + z * c };
}

function scaleBucket(rng) {
  var p = rng();
  if (p < 0.34) return 0.72 + rng() * 0.22;
  if (p < 0.78) return 0.96 + rng() * 0.30;
  return 1.30 + rng() * 0.38;
}

function estimateCompositeRadius(def, instanceScale) {
  if (!def || !Array.isArray(def.items) || def.items.length === 0) return 28 * instanceScale;
  var maxD2 = 0;
  for (var i = 0; i < def.items.length; i++) {
    var it = def.items[i];
    var lx = (it.x || 0);
    var lz = (it.z || 0);
    var localScale = (it.scale || 1);
    var d2 = lx * lx + lz * lz;
    if (d2 > maxD2) maxD2 = d2;
    d2 = d2 + (16 * localScale * localScale);
    if (d2 > maxD2) maxD2 = d2;
  }
  return Math.sqrt(maxD2) * instanceScale + 8;
}

function loadCompositePack() {
  if (_compositePackPromise) return _compositePackPromise;
  _compositePackPromise = fetch(COMPOSITE_PRESET_PATH).then(function (res) {
    if (!res.ok) throw new Error("failed to load composite presets");
    return res.json();
  }).then(function (json) {
    return Array.isArray(json.composites) ? json.composites : [];
  }).catch(function () {
    return [];
  });
  return _compositePackPromise;
}

// ============================================================
// Instanced Rendering Manager (Phase 3)
// ============================================================
var _instanceRoot = null;
var _modelEntries = {};         // entryKey → ModelEntry (completed)
var _modelEntryPromises = {};   // entryKey → Promise<ModelEntry> (in-flight dedup)
var _chunkSlots = {};      // chunkKey → [{ entryKey, slot }]
var _INST_CAP_INIT = 512;
var _INST_CAP_GROW = 256;
var _matA = new THREE.Matrix4();
var _matB = new THREE.Matrix4();
var _quatTmp = new THREE.Quaternion();
var _vecTmp = new THREE.Vector3();
var _scaleTmp = new THREE.Vector3();
var _zeroMat = new THREE.Matrix4().makeScale(0, 0, 0);
var _yAxis = new THREE.Vector3(0, 1, 0);
var _dirtyEntries = new Set();

export function initIslandInstancing(parentGroup) {
  if (_instanceRoot) return;
  _instanceRoot = new THREE.Group();
  _instanceRoot.name = "island-instances";
  parentGroup.add(_instanceRoot);
}

export async function preloadTerrainModels() {
  if (!_instanceRoot) return;
  var defs = await loadCompositePack();
  if (!defs || defs.length === 0) return;

  var seen = new Set();
  var promises = [];

  for (var i = 0; i < defs.length; i++) {
    var def = defs[i];
    if (!def || !Array.isArray(def.items)) continue;
    for (var j = 0; j < def.items.length; j++) {
      var item = def.items[j];
      if (!item || !item.modelPath) continue;
      var fitSize = fitForCompositeItem(item);
      var key = getEntryKey(item.modelPath, fitSize);
      if (seen.has(key)) continue;
      seen.add(key);
      promises.push(ensureModelEntry(item.modelPath, fitSize));
    }
  }

  var smallKey = getEntryKey(SMALL_ISLAND_MODEL, 20);
  if (!seen.has(smallKey)) {
    promises.push(ensureModelEntry(SMALL_ISLAND_MODEL, 20));
  }

  await Promise.all(promises);
}

export function disposeIslandInstancing() {
  if (!_instanceRoot) return;
  for (var key in _modelEntries) {
    if (!Object.prototype.hasOwnProperty.call(_modelEntries, key)) continue;
    var entry = _modelEntries[key];
    for (var i = 0; i < entry.submeshes.length; i++) {
      var sm = entry.submeshes[i];
      if (sm.instancedMesh) {
        if (sm.instancedMesh.parent) sm.instancedMesh.parent.remove(sm.instancedMesh);
        sm.instancedMesh.dispose();
      }
      if (sm.geo && sm.geo.dispose) sm.geo.dispose();
      if (sm.mat) {
        if (Array.isArray(sm.mat)) {
          for (var j = 0; j < sm.mat.length; j++) { if (sm.mat[j] && sm.mat[j].dispose) sm.mat[j].dispose(); }
        } else if (sm.mat.dispose) { sm.mat.dispose(); }
      }
    }
  }
  if (_instanceRoot.parent) _instanceRoot.parent.remove(_instanceRoot);
  _instanceRoot = null;
  _modelEntries = {};
  _modelEntryPromises = {};
  _chunkSlots = {};
}

function getEntryKey(modelPath, fitSize) {
  return modelPath + "|" + fitSize;
}

function ensureModelEntry(modelPath, fitSize) {
  var key = getEntryKey(modelPath, fitSize);
  if (_modelEntries[key]) return Promise.resolve(_modelEntries[key]);
  if (_modelEntryPromises[key]) return _modelEntryPromises[key];

  _modelEntryPromises[key] = loadGlbVisual(modelPath, fitSize, true).then(function (visual) {
    visual.updateMatrixWorld(true);

    var submeshes = [];

    visual.traverse(function (child) {
      if (!child.isMesh) return;
      var localMatrix = new THREE.Matrix4();
      localMatrix.copy(child.matrixWorld);
      submeshes.push({ geo: child.geometry, mat: child.material, localMatrix: localMatrix, instancedMesh: null });
    });

    if (submeshes.length === 0) {
      delete _modelEntryPromises[key];
      return null;
    }

    // Pre-compute collider decomposition from fitted template
    var tplColliders = computeTemplateColliders(visual, modelPath);

    for (var i = 0; i < submeshes.length; i++) {
      var sm = submeshes[i];
      var im = new THREE.InstancedMesh(sm.geo, sm.mat, _INST_CAP_INIT);
      im.count = 0;
      im.frustumCulled = false;
      _instanceRoot.add(im);
      sm.instancedMesh = im;
    }

    var entry = { key: key, submeshes: submeshes, templateColliders: tplColliders, capacity: _INST_CAP_INIT, count: 0, freeSlots: [] };
    _modelEntries[key] = entry;
    delete _modelEntryPromises[key];
    return entry;
  });

  return _modelEntryPromises[key];
}

function growModelEntry(entry) {
  var newCap = entry.capacity + _INST_CAP_GROW;
  for (var i = 0; i < entry.submeshes.length; i++) {
    var sm = entry.submeshes[i];
    var oldIM = sm.instancedMesh;
    var newIM = new THREE.InstancedMesh(sm.geo, sm.mat, newCap);
    newIM.count = oldIM.count;
    newIM.frustumCulled = false;
    var src = oldIM.instanceMatrix.array;
    var dst = newIM.instanceMatrix.array;
    dst.set(src.subarray(0, oldIM.count * 16));
    newIM.instanceMatrix.needsUpdate = true;
    _instanceRoot.remove(oldIM);
    oldIM.dispose();
    _instanceRoot.add(newIM);
    sm.instancedMesh = newIM;
  }
  entry.capacity = newCap;
}

function addInstanceSlot(entry, worldMatrix) {
  var slot;
  if (entry.freeSlots.length > 0) {
    slot = entry.freeSlots.pop();
  } else {
    if (entry.count >= entry.capacity) growModelEntry(entry);
    slot = entry.count;
    entry.count++;
  }
  for (var i = 0; i < entry.submeshes.length; i++) {
    var sm = entry.submeshes[i];
    _matB.multiplyMatrices(worldMatrix, sm.localMatrix);
    sm.instancedMesh.setMatrixAt(slot, _matB);
    if (slot >= sm.instancedMesh.count) sm.instancedMesh.count = slot + 1;
  }
  _dirtyEntries.add(entry.key);
  return slot;
}

function removeInstanceSlot(entry, slot) {
  for (var i = 0; i < entry.submeshes.length; i++) {
    entry.submeshes[i].instancedMesh.setMatrixAt(slot, _zeroMat);
  }
  _dirtyEntries.add(entry.key);
  entry.freeSlots.push(slot);
}

function computeTemplateColliders(visual, modelPath) {
  visual.updateMatrixWorld(true);
  var footprint = rasterizeFootprint(visual, DECOMP_GRID_RES);
  if (!footprint) {
    var box = new THREE.Box3().setFromObject(visual);
    if (!isFinite(box.min.x) || !isFinite(box.max.x)) return [];
    var cx = (box.min.x + box.max.x) * 0.5;
    var cz = (box.min.z + box.max.z) * 0.5;
    var hx = (box.max.x - box.min.x) * 0.5 * VISUAL_COLLIDER_SHRINK;
    var hz = (box.max.z - box.min.z) * 0.5 * VISUAL_COLLIDER_SHRINK;
    return [{ minX: cx - hx, maxX: cx + hx, minZ: cz - hz, maxZ: cz + hz }];
  }
  var hasOcc = false;
  for (var i = 0; i < footprint.grid.length; i++) {
    if (footprint.grid[i]) { hasOcc = true; break; }
  }
  if (!hasOcc) return [];
  if (isArchModel(modelPath)) return decomposeArch(footprint);
  return decomposeGrid(footprint, MAX_BOXES_PER_ISLAND);
}

function transformColliderBox(tplBox, posX, posZ, rotY, scale) {
  var cx = (tplBox.minX + tplBox.maxX) * 0.5 * scale;
  var cz = (tplBox.minZ + tplBox.maxZ) * 0.5 * scale;
  var hx = (tplBox.maxX - tplBox.minX) * 0.5 * scale;
  var hz = (tplBox.maxZ - tplBox.minZ) * 0.5 * scale;
  var cosR = Math.cos(rotY);
  var sinR = Math.sin(rotY);
  var rcx = cx * cosR - cz * sinR;
  var rcz = cx * sinR + cz * cosR;
  var aCos = Math.abs(cosR);
  var aSin = Math.abs(sinR);
  var nhx = hx * aCos + hz * aSin;
  var nhz = hx * aSin + hz * aCos;
  return { minX: posX + rcx - nhx, maxX: posX + rcx + nhx, minZ: posZ + rcz - nhz, maxZ: posZ + rcz + nhz };
}

function placeInstanceWithColliders(chunkKey, chunk, entry, sceneX, sceneY, sceneZ, rotY, scale, addCollider, markerType, modelPath) {
  _quatTmp.setFromAxisAngle(_yAxis, rotY);
  _vecTmp.set(sceneX, sceneY, sceneZ);
  _scaleTmp.set(scale, scale, scale);
  _matA.compose(_vecTmp, _quatTmp, _scaleTmp);
  var slot = addInstanceSlot(entry, _matA);

  if (!_chunkSlots[chunkKey]) _chunkSlots[chunkKey] = [];
  _chunkSlots[chunkKey].push({ entryKey: entry.key, slot: slot });

  if (addCollider && entry.templateColliders.length > 0) {
    for (var b = 0; b < entry.templateColliders.length; b++) {
      chunk.visualColliders.push(transformColliderBox(entry.templateColliders[b], sceneX, sceneZ, rotY, scale));
    }
  }
  addMinimapMarker(chunk, markerType, sceneX, sceneZ, scale, modelPath);
}

export function removeChunkInstances(chunkKey) {
  var slots = _chunkSlots[chunkKey];
  if (!slots) return;
  for (var i = 0; i < slots.length; i++) {
    var s = slots[i];
    var entry = _modelEntries[s.entryKey];
    if (entry) removeInstanceSlot(entry, s.slot);
  }
  delete _chunkSlots[chunkKey];
}

export function shiftAllInstancePositions(shiftX, shiftZ) {
  if (!_instanceRoot) return;
  for (var key in _modelEntries) {
    if (!Object.prototype.hasOwnProperty.call(_modelEntries, key)) continue;
    var entry = _modelEntries[key];
    for (var si = 0; si < entry.submeshes.length; si++) {
      var im = entry.submeshes[si].instancedMesh;
      var arr = im.instanceMatrix.array;
      for (var i = 0; i < im.count; i++) {
        var base = i * 16;
        // skip free slots (zero-scale: diagonal elements 0,5,10 all zero)
        if (arr[base] === 0 && arr[base + 5] === 0 && arr[base + 10] === 0) continue;
        arr[base + 12] -= shiftX; // translate X
        arr[base + 14] -= shiftZ; // translate Z
      }
      im.instanceMatrix.needsUpdate = true;
    }
  }
}

export function flushInstanceUpdates() {
  if (_dirtyEntries.size === 0) return;
  _dirtyEntries.forEach(function (key) {
    var entry = _modelEntries[key];
    if (!entry) return;
    for (var i = 0; i < entry.submeshes.length; i++) {
      entry.submeshes[i].instancedMesh.instanceMatrix.needsUpdate = true;
    }
  });
  _dirtyEntries.clear();
}

// ============================================================

export async function addCompositeFieldVisual(root, terrain, seed) {
  var defs = await loadCompositePack();
  if (!defs || defs.length === 0) return { itemsPlaced: 0, instancesPlaced: 0 };

  var useInstancing = !!_instanceRoot;
  var qCfg = getQualityConfig();
  var maxInstances = qCfg.maxCompositeInstances || MAX_COMPOSITE_INSTANCES;
  var rng = seededRand(seed + 4041);
  var centers = [];
  var itemsPlaced = 0;
  var instancesPlaced = 0;
  var used = {};

  while (instancesPlaced < maxInstances) {
    if (instancesPlaced >= MIN_COMPOSITE_INSTANCES && itemsPlaced >= MIN_COMPOSITE_OBJECTS) break;

    var chosenIdx = Math.floor(rng() * defs.length);
    if (instancesPlaced < defs.length) {
      var scan = 0;
      while (scan < defs.length && used[chosenIdx]) { chosenIdx = (chosenIdx + 1) % defs.length; scan++; }
    }
    used[chosenIdx] = true;
    var def = defs[chosenIdx];
    if (!def || !Array.isArray(def.items) || def.items.length === 0) continue;

    var instScale = scaleBucket(rng);
    var radius = estimateCompositeRadius(def, instScale);
    var rot = rng() * Math.PI * 2;

    var found = null;
    for (var a = 0; a < COMPOSITE_CENTER_ATTEMPTS; a++) {
      var ang = rng() * Math.PI * 2;
      var dist = COMPOSITE_CENTER_MIN_DIST + rng() * (COMPOSITE_CENTER_MAX_DIST - COMPOSITE_CENTER_MIN_DIST);
      var cx = Math.sin(ang) * dist;
      var cz = Math.cos(ang) * dist;

      var ok = true;
      for (var c = 0; c < centers.length; c++) {
        var dx = cx - centers[c].x;
        var dz = cz - centers[c].z;
        var minD = radius + centers[c].radius + 14;
        if (dx * dx + dz * dz < minD * minD) { ok = false; break; }
      }
      if (!ok) continue;
      if (cx * cx + cz * cz < COMPOSITE_CENTER_MIN_DIST * COMPOSITE_CENTER_MIN_DIST) continue;
      found = { x: cx, z: cz };
      break;
    }
    if (!found) continue;

    centers.push({ x: found.x, z: found.z, radius: radius });
    instancesPlaced++;

    for (var i = 0; i < def.items.length; i++) {
      var item = def.items[i];
      try {
        var local = rotateXZ((item.x || 0) * instScale, (item.z || 0) * instScale, rot);
        var fitSize = fitForCompositeItem(item);
        var worldScale = (item.scale || 1) * instScale;
        var itemRotY = rot + THREE.MathUtils.degToRad(item.rotYDeg || 0);
        var localX = found.x + local.x;
        var localZ = found.z + local.z;
        var localY = TERRAIN_VISUAL_Y_OFFSET + (item.y || 0) * instScale;

        if (useInstancing) {
          var entry = await ensureModelEntry(item.modelPath, fitSize);
          if (!entry) continue;
          var sceneX = root.position.x + localX;
          var sceneZ = root.position.z + localZ;
          placeInstanceWithColliders(
            terrain.key, terrain, entry,
            sceneX, localY, sceneZ, itemRotY, worldScale,
            shouldAddCompositeCollider(item),
            getCompositeMarkerTypeByScale(item.type, worldScale),
            item.modelPath
          );
        } else {
          var visual = await loadGlbVisual(item.modelPath, fitSize, true);
          var holder = new THREE.Group();
          holder.add(visual);
          holder.position.set(localX, localY, localZ);
          holder.rotation.y = itemRotY;
          holder.scale.setScalar(worldScale);
          root.add(holder);
          if (shouldAddCompositeCollider(item)) addVisualColliderFromObject(terrain, holder, item.modelPath);
          addMinimapMarkerForObject(terrain, getCompositeMarkerTypeByScale(item.type, worldScale), holder, worldScale, item.modelPath);
        }
        itemsPlaced++;
      } catch (e) {
        // keep loading remaining objects
      }
    }
  }

  return { itemsPlaced: itemsPlaced, instancesPlaced: instancesPlaced };
}

function collectLandPoints(heightmap, minDistFromCenter) {
  var pts = [];
  var half = MAP_SIZE / 2;
  var size = heightmap.size;
  var data = heightmap.data;
  var SEA_LEVEL = 0.0;
  for (var iy = 0; iy < size; iy++) {
    for (var ix = 0; ix < size; ix++) {
      var h = data[iy * size + ix];
      if (h <= SEA_LEVEL + 0.03) continue;
      var x = (ix / (size - 1)) * MAP_SIZE - half;
      var z = (iy / (size - 1)) * MAP_SIZE - half;
      var d2 = x * x + z * z;
      if (d2 < minDistFromCenter * minDistFromCenter) continue;
      pts.push({ x: x, z: z, h: h });
    }
  }
  return pts;
}

export async function addTieredIslandFieldVisual(root, terrain, heightmap, seed) {
  var land = collectLandPoints(heightmap, SPAWN_CLEAR_RADIUS + 12);
  if (land.length === 0) return 0;

  var useInstancing = !!_instanceRoot;
  var rng = seededRand(seed + 1337);
  var placed = [];
  var offX = root.position.x;
  var offZ = root.position.z;

  function pointInVisualLand(x, z, pad) {
    for (var i = 0; i < terrain.visualColliders.length; i++) {
      var c = terrain.visualColliders[i];
      if (x >= c.minX - pad && x <= c.maxX + pad && z >= c.minZ - pad && z <= c.maxZ + pad) return true;
    }
    return false;
  }

  function tryPlaceLegacy(count, minScale, maxScale, minSpacing, template, markerType) {
    var placedNow = 0;
    for (var t = 0; t < land.length * 4 && placedNow < count; t++) {
      var cand = land[Math.floor(rng() * land.length)];
      if (pointInVisualLand(cand.x, cand.z, minSpacing * 0.75)) continue;
      var ok = true;
      for (var i = 0; i < placed.length; i++) {
        var dx = cand.x - placed[i].x;
        var dz = cand.z - placed[i].z;
        if (dx * dx + dz * dz < minSpacing * minSpacing) { ok = false; break; }
      }
      if (!ok) continue;
      var holder = new THREE.Group();
      holder.add(template.clone(true));
      holder.position.set(cand.x, TERRAIN_VISUAL_Y_OFFSET + cand.h * TERRAIN_HEIGHT * 0.05, cand.z);
      holder.rotation.y = rng() * Math.PI * 2;
      holder.scale.setScalar(minScale + rng() * (maxScale - minScale));
      root.add(holder);
      addVisualColliderFromObject(terrain, holder, SMALL_ISLAND_MODEL);
      addMinimapMarkerForObject(terrain, markerType, holder, holder.scale.x, SMALL_ISLAND_MODEL);
      placed.push({ x: cand.x, z: cand.z });
      placedNow++;
    }
    return placedNow;
  }

  function tryPlaceInstanced(count, minScale, maxScale, minSpacing, entry, markerType) {
    var placedNow = 0;
    for (var t = 0; t < land.length * 4 && placedNow < count; t++) {
      var cand = land[Math.floor(rng() * land.length)];
      var checkX = offX + cand.x;
      var checkZ = offZ + cand.z;
      if (pointInVisualLand(checkX, checkZ, minSpacing * 0.75)) continue;
      var ok = true;
      for (var i = 0; i < placed.length; i++) {
        var dx = cand.x - placed[i].x;
        var dz = cand.z - placed[i].z;
        if (dx * dx + dz * dz < minSpacing * minSpacing) { ok = false; break; }
      }
      if (!ok) continue;
      var scaleVal = minScale + rng() * (maxScale - minScale);
      var rotYVal = rng() * Math.PI * 2;
      var sceneY = TERRAIN_VISUAL_Y_OFFSET + cand.h * TERRAIN_HEIGHT * 0.05;
      placeInstanceWithColliders(
        terrain.key, terrain, entry,
        checkX, sceneY, checkZ, rotYVal, scaleVal,
        true, markerType, SMALL_ISLAND_MODEL
      );
      placed.push({ x: cand.x, z: cand.z });
      placedNow++;
    }
    return placedNow;
  }

  try {
    var total = 0;
    var qCfg2 = getQualityConfig();
    var islandScale = qCfg2.maxCompositeInstances ? qCfg2.maxCompositeInstances / MAX_COMPOSITE_INSTANCES : 1;
    var bigCount = Math.max(1, Math.round(MIN_BIG_ISLANDS * islandScale));
    var medCount = Math.max(2, Math.round(MIN_MEDIUM_ISLANDS * islandScale));
    var smallCount = Math.max(3, Math.round(MIN_SMALL_ISLANDS * islandScale));

    if (useInstancing) {
      var entry = await ensureModelEntry(SMALL_ISLAND_MODEL, 20);
      if (!entry) return 0;
      total += tryPlaceInstanced(bigCount, 1.7, 2.05, 38, entry, "island_big");
      total += tryPlaceInstanced(medCount, 1.2, 1.55, 30, entry, "island_mid");
      total += tryPlaceInstanced(smallCount, 0.82, 1.12, 21, entry, "island_small");
    } else {
      var template = await loadGlbVisual(SMALL_ISLAND_MODEL, 20, true);
      total += tryPlaceLegacy(bigCount, 1.7, 2.05, 38, template, "island_big");
      total += tryPlaceLegacy(medCount, 1.2, 1.55, 30, template, "island_mid");
      total += tryPlaceLegacy(smallCount, 0.82, 1.12, 21, template, "island_small");
    }
    return total;
  } catch (e) {
    return 0;
  }
}

export function pointInVisualLand(terrain, x, z, radiusPad) {
  if (!terrain || !terrain.visualColliders || terrain.visualColliders.length === 0) return false;
  var pad = radiusPad || 0;
  for (var i = 0; i < terrain.visualColliders.length; i++) {
    var c = terrain.visualColliders[i];
    if (x >= c.minX - pad && x <= c.maxX + pad && z >= c.minZ - pad && z <= c.maxZ + pad) return true;
  }
  return false;
}

export function resolveVisualCollision(terrain, posX, posZ, prevX, prevZ) {
  if (!terrain || !terrain.visualColliders) return null;
  var pad = 1.5 + VISUAL_COLLIDER_PAD;
  var nx = posX;
  var nz = posZ;
  var collided = false;
  var lastNX = 0;
  var lastNZ = 0;

  for (var it = 0; it < 4; it++) {
    var any = false;
    for (var i = 0; i < terrain.visualColliders.length; i++) {
      var c = terrain.visualColliders[i];
      var minX = c.minX - pad, maxX = c.maxX + pad, minZ = c.minZ - pad, maxZ = c.maxZ + pad;
      if (nx < minX || nx > maxX || nz < minZ || nz > maxZ) continue;

      any = true;
      collided = true;
      var leftDist = Math.abs(nx - minX);
      var rightDist = Math.abs(maxX - nx);
      var downDist = Math.abs(nz - minZ);
      var upDist = Math.abs(maxZ - nz);
      var minDist = Math.min(leftDist, rightDist, downDist, upDist);
      if (minDist === leftDist) { nx = minX - 0.02; lastNX = -1; lastNZ = 0; }
      else if (minDist === rightDist) { nx = maxX + 0.02; lastNX = 1; lastNZ = 0; }
      else if (minDist === downDist) { nz = minZ - 0.02; lastNX = 0; lastNZ = -1; }
      else { nz = maxZ + 0.02; lastNX = 0; lastNZ = 1; }
    }
    if (!any) break;
  }
  if (!collided) return null;
  return { collided: true, newX: nx, newZ: nz, normalX: lastNX, normalZ: lastNZ };
}

export function getTerrainAvoidance(terrain, worldX, worldZ, range) {
  var out = { factor: 0, awayX: 0, awayZ: 0, distance: Infinity };
  if (!terrain || !terrain.useVisualCollision || !terrain.visualColliders || terrain.visualColliders.length === 0) return out;
  var avoidRange = range || 14;
  var bestDist = Infinity;
  var bestDx = 0;
  var bestDz = 0;

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  for (var i = 0; i < terrain.visualColliders.length; i++) {
    var c = terrain.visualColliders[i];
    var nx = clamp(worldX, c.minX, c.maxX);
    var nz = clamp(worldZ, c.minZ, c.maxZ);
    var dx = worldX - nx;
    var dz = worldZ - nz;
    var inside = (worldX >= c.minX && worldX <= c.maxX && worldZ >= c.minZ && worldZ <= c.maxZ);
    var d = Math.sqrt(dx * dx + dz * dz);

    if (inside) {
      var ccx = (c.minX + c.maxX) * 0.5;
      var ccz = (c.minZ + c.maxZ) * 0.5;
      dx = worldX - ccx;
      dz = worldZ - ccz;
      d = 0;
    }
    if (d < bestDist) {
      bestDist = d;
      bestDx = dx;
      bestDz = dz;
    }
  }

  if (!isFinite(bestDist) || bestDist >= avoidRange) return out;
  var len = Math.sqrt(bestDx * bestDx + bestDz * bestDz);
  if (len < 0.0001) { bestDx = 0; bestDz = -1; len = 1; }
  out.awayX = bestDx / len;
  out.awayZ = bestDz / len;
  var t = 1 - bestDist / avoidRange;
  out.factor = Math.max(0, Math.min(1, t * t));
  out.distance = bestDist;
  return out;
}

// --- debug overlay: render collider boxes as wireframes ---
var _debugGroup = null;

export function createColliderDebugOverlay(terrain, scene) {
  if (_debugGroup) {
    scene.remove(_debugGroup);
    _debugGroup = null;
  }
  if (!terrain || !terrain.visualColliders || terrain.visualColliders.length === 0) return;

  _debugGroup = new THREE.Group();
  _debugGroup.name = "collider-debug";
  var mat = new THREE.LineBasicMaterial({ color: 0x00ff00, depthTest: false });

  for (var i = 0; i < terrain.visualColliders.length; i++) {
    var c = terrain.visualColliders[i];
    var sx = c.maxX - c.minX;
    var sz = c.maxZ - c.minZ;
    var cx = (c.minX + c.maxX) * 0.5;
    var cz = (c.minZ + c.maxZ) * 0.5;
    var geo = new THREE.BoxGeometry(sx, 4, sz);
    var edges = new THREE.EdgesGeometry(geo);
    var line = new THREE.LineSegments(edges, mat);
    line.position.set(cx, 6, cz);
    line.renderOrder = 999;
    _debugGroup.add(line);
  }
  scene.add(_debugGroup);
  return _debugGroup;
}

export function removeColliderDebugOverlay(scene) {
  if (!_debugGroup) return;
  scene.remove(_debugGroup);
  _debugGroup = null;
}
