// terrain.js — infinite chunked terrain streaming, collision queries, and GC
import * as THREE from "three";
import { nextRandom } from "./rng.js";
import {
  addCompositeFieldVisual,
  addTieredIslandFieldVisual,
  createColliderDebugOverlay as createCompositeColliderDebugOverlay,
  removeColliderDebugOverlay as removeCompositeColliderDebugOverlay
} from "./terrainComposite.js";

// --- world/chunk tuning ---
var CHUNK_SIZE = 400;                  // keeps compatibility with existing map-scale content
var GRID_RES = 128;                    // per-chunk heightmap resolution
var SEA_LEVEL = 0.0;
var NOISE_SCALE = 0.02;
var OCTAVES = 4;
var PERSISTENCE = 0.5;
var LACUNARITY = 2.0;
var SPAWN_CLEAR_RADIUS = 40;
var COLLISION_RADIUS = 1.5;
var VISUAL_COLLIDER_PAD = 0.35;

// streaming radii in chunk coordinates
var STREAM_RADIUS = 2;                 // immediate active bubble
var KEEP_RADIUS = 3;                   // keep nearby chunks warm before GC
var PRELOAD_AHEAD = 3;                 // preload 2-3 chunks ahead of heading

// disposal budget per frame (resources disposed incrementally)
var GC_RESOURCE_BUDGET = 40;
var ACTIVE_CHUNK_SOFT_LIMIT = 36;
var ACTIVE_CHUNK_HARD_LIMIT = 48;

// difficulty / loot scaling with distance from spawn
var DISTANCE_RAMP_MAX = 6000;
var ENEMY_SCALE_MAX_ADD = 1.35;
var LOOT_SCALE_MAX_ADD = 1.2;
var MIN_COMPOSITION_CHANCE = 0.38;
var COMPOSITION_RARITY_MAX_DROP = 0.52;

// --- value-noise helpers (seeded by world seed for deterministic infinite sampling) ---
var _noiseSeed = 0;

function hashCoord(ix, iy) {
  var n = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ (_noiseSeed | 0);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n = n ^ (n >>> 16);
  return (n >>> 0) / 4294967295;
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

function noise2D(x, y) {
  var ix = Math.floor(x);
  var iy = Math.floor(y);
  var fx = x - ix;
  var fy = y - iy;
  var sx = smoothstep(fx);
  var sy = smoothstep(fy);

  var n00 = hashCoord(ix, iy);
  var n10 = hashCoord(ix + 1, iy);
  var n01 = hashCoord(ix, iy + 1);
  var n11 = hashCoord(ix + 1, iy + 1);

  var nx0 = n00 + (n10 - n00) * sx;
  var nx1 = n01 + (n11 - n01) * sx;
  return nx0 + (nx1 - nx0) * sy;
}

function fbm(x, y) {
  var value = 0;
  var amplitude = 1;
  var frequency = 1;
  var maxAmp = 0;
  for (var i = 0; i < OCTAVES; i++) {
    value += noise2D(x * frequency, y * frequency) * amplitude;
    maxAmp += amplitude;
    amplitude *= PERSISTENCE;
    frequency *= LACUNARITY;
  }
  return value / maxAmp;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function chunkKey(cx, cy) {
  return cx + "," + cy;
}

function toChunkCoord(globalCoord) {
  // chunk coordinate where chunk center is at coord * CHUNK_SIZE
  return Math.floor((globalCoord + CHUNK_SIZE * 0.5) / CHUNK_SIZE);
}

function chunkCenter(coord) {
  return coord * CHUNK_SIZE;
}

function hashInt3(a, b, c) {
  var h = (a | 0) ^ Math.imul(b | 0, 0x85ebca6b) ^ Math.imul(c | 0, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  h = h ^ (h >>> 16);
  return h >>> 0;
}

function seedToUnit(seed) {
  return ((seed >>> 0) % 1000000) / 1000000;
}

function gaussianBlur(data, size, passes) {
  var tmp = new Float32Array(data.length);
  var k0 = 4 / 16, k1 = 2 / 16, k2 = 1 / 16;
  for (var p = 0; p < passes; p++) {
    for (var y = 0; y < size; y++) {
      for (var x = 0; x < size; x++) {
        var x0 = Math.max(0, x - 1), x1 = Math.min(size - 1, x + 1);
        var y0 = Math.max(0, y - 1), y1 = Math.min(size - 1, y + 1);
        tmp[y * size + x] =
          data[y * size + x] * k0 +
          (data[y * size + x0] + data[y * size + x1] + data[y0 * size + x] + data[y1 * size + x]) * k1 +
          (data[y0 * size + x0] + data[y0 * size + x1] + data[y1 * size + x0] + data[y1 * size + x1]) * k2;
      }
    }
    for (var i = 0; i < data.length; i++) data[i] = tmp[i];
  }
}

function distanceMetrics(globalX, globalZ) {
  var dist = Math.sqrt(globalX * globalX + globalZ * globalZ);
  var t = clamp(dist / DISTANCE_RAMP_MAX, 0, 1);
  return {
    distance: dist,
    t: t,
    enemyMult: 1 + t * ENEMY_SCALE_MAX_ADD,
    lootMult: 1 + t * LOOT_SCALE_MAX_ADD,
    compositionChance: Math.max(MIN_COMPOSITION_CHANCE, 1 - t * COMPOSITION_RARITY_MAX_DROP)
  };
}

function generateChunkHeightmap(worldSeed, difficulty, cx, cy) {
  _noiseSeed = worldSeed | 0;
  var size = GRID_RES + 1;
  var data = new Float32Array(size * size);
  var half = CHUNK_SIZE * 0.5;
  var centerX = chunkCenter(cx);
  var centerZ = chunkCenter(cy);

  // distance-scaled land threshold: farther chunks trend slightly rougher
  var centerMetrics = distanceMetrics(centerX, centerZ);
  var farLandBias = centerMetrics.t * 0.02;
  var landThreshold = Math.max(0.67, 0.76 - difficulty * 0.01 - farLandBias);

  for (var iy = 0; iy < size; iy++) {
    for (var ix = 0; ix < size; ix++) {
      var worldX = centerX + (ix / GRID_RES) * CHUNK_SIZE - half;
      var worldZ = centerZ + (iy / GRID_RES) * CHUNK_SIZE - half;

      var n = fbm(worldX * NOISE_SCALE, worldZ * NOISE_SCALE);
      var h = (n - landThreshold) * 2;

      // keep the global origin clear for spawn only
      var originDist = Math.sqrt(worldX * worldX + worldZ * worldZ);
      if (originDist < SPAWN_CLEAR_RADIUS) {
        var clearFactor = 1 - originDist / SPAWN_CLEAR_RADIUS;
        clearFactor = clearFactor * clearFactor;
        h -= clearFactor * 3;
      }

      data[iy * size + ix] = h;
    }
  }

  gaussianBlur(data, size, 2);
  return { data: data, size: size };
}

function sampleChunkHeight(chunk, globalX, globalZ) {
  if (!chunk || !chunk.heightmap) return -1;
  var size = chunk.heightmap.size;
  var data = chunk.heightmap.data;
  var half = CHUNK_SIZE * 0.5;
  var minX = chunkCenter(chunk.cx) - half;
  var minZ = chunkCenter(chunk.cy) - half;

  var u = (globalX - minX) / CHUNK_SIZE * GRID_RES;
  var v = (globalZ - minZ) / CHUNK_SIZE * GRID_RES;

  var ix = clamp(Math.floor(u), 0, size - 2);
  var iy = clamp(Math.floor(v), 0, size - 2);
  var fx = u - ix;
  var fy = v - iy;

  var h00 = data[iy * size + ix];
  var h10 = data[iy * size + ix + 1];
  var h01 = data[(iy + 1) * size + ix];
  var h11 = data[(iy + 1) * size + ix + 1];

  var hx0 = h00 + (h10 - h00) * fx;
  var hx1 = h01 + (h11 - h01) * fx;
  return hx0 + (hx1 - hx0) * fy;
}

function gatherMaterialTextures(material, outSet) {
  if (!material) return;
  for (var k in material) {
    if (!Object.prototype.hasOwnProperty.call(material, k)) continue;
    var v = material[k];
    if (v && v.isTexture) outSet.add(v);
  }
}

function collectChunkResources(group) {
  var geometrySet = new Set();
  var materialSet = new Set();
  var textureSet = new Set();

  if (!group) return { geometries: [], materials: [], textures: [] };

  group.traverse(function (o) {
    if (o.geometry) geometrySet.add(o.geometry);
    if (!o.material) return;
    if (Array.isArray(o.material)) {
      for (var i = 0; i < o.material.length; i++) {
        var m = o.material[i];
        if (!m) continue;
        materialSet.add(m);
        gatherMaterialTextures(m, textureSet);
      }
    } else {
      materialSet.add(o.material);
      gatherMaterialTextures(o.material, textureSet);
    }
  });

  return {
    geometries: Array.from(geometrySet),
    materials: Array.from(materialSet),
    textures: Array.from(textureSet)
  };
}

function isSharedTemplateResource(resource) {
  return !!(resource && resource.userData && resource.userData.__glbSharedTemplate);
}

function retainResource(refMap, resource) {
  if (!resource || !resource.uuid) return;
  if (isSharedTemplateResource(resource)) return;
  var entry = refMap.get(resource.uuid);
  if (entry) {
    entry.count++;
  } else {
    refMap.set(resource.uuid, { resource: resource, count: 1 });
  }
}

function releaseResource(refMap, resource) {
  if (!resource || !resource.uuid) return false;
  if (isSharedTemplateResource(resource)) return false;
  var entry = refMap.get(resource.uuid);
  if (!entry) return true;
  entry.count--;
  if (entry.count <= 0) {
    refMap.delete(resource.uuid);
    return true;
  }
  return false;
}

function retainChunkResources(terrain, chunk) {
  if (!chunk || chunk.resourcesTracked) return;
  if (!chunk.resources) chunk.resources = collectChunkResources(chunk.group);

  var i;
  for (i = 0; i < chunk.resources.geometries.length; i++) {
    retainResource(terrain.resourceRefs.geometry, chunk.resources.geometries[i]);
  }
  for (i = 0; i < chunk.resources.materials.length; i++) {
    retainResource(terrain.resourceRefs.material, chunk.resources.materials[i]);
  }
  for (i = 0; i < chunk.resources.textures.length; i++) {
    retainResource(terrain.resourceRefs.texture, chunk.resources.textures[i]);
  }

  chunk.resourcesTracked = true;
}

function buildChunkGcEntries(chunk) {
  var entries = [];
  if (!chunk || !chunk.resources) return entries;
  var i;
  for (i = 0; i < chunk.resources.geometries.length; i++) {
    entries.push({ type: "geometry", resource: chunk.resources.geometries[i] });
  }
  for (i = 0; i < chunk.resources.materials.length; i++) {
    entries.push({ type: "material", resource: chunk.resources.materials[i] });
  }
  for (i = 0; i < chunk.resources.textures.length; i++) {
    entries.push({ type: "texture", resource: chunk.resources.textures[i] });
  }
  return entries;
}

function disposeGcEntry(terrain, entry) {
  if (!entry || !entry.resource) return;
  var refMap = terrain.resourceRefs[entry.type];
  var shouldDispose = releaseResource(refMap, entry.resource);
  if (shouldDispose && entry.resource.dispose) {
    entry.resource.dispose();
    terrain.debug.disposedResources++;
  }
}

function setChunkLocalPosition(terrain, chunk) {
  if (!terrain || !chunk || !chunk.group) return;
  var globalX = chunkCenter(chunk.cx);
  var globalZ = chunkCenter(chunk.cy);
  chunk.group.position.set(globalX - terrain.originOffsetX, 0, globalZ - terrain.originOffsetZ);
}

function collectTerrainColliders(terrain) {
  var colliders = [];
  terrain.chunks.forEach(function (chunk) {
    if (chunk.state !== "active" || !chunk.useVisualCollision || !chunk.visualColliders) return;
    for (var i = 0; i < chunk.visualColliders.length; i++) colliders.push(chunk.visualColliders[i]);
  });
  return colliders;
}

function getChunkAtGlobal(terrain, globalX, globalZ) {
  var cx = toChunkCoord(globalX);
  var cy = toChunkCoord(globalZ);
  return terrain.chunks.get(chunkKey(cx, cy)) || null;
}

function ensureChunk(terrain, cx, cy) {
  var key = chunkKey(cx, cy);
  var existing = terrain.chunks.get(key);
  if (existing) return existing;

  var group = new THREE.Group();
  var worldSeed = terrain.worldSeed | 0;
  var chunkSeed = hashInt3(worldSeed, cx, cy);
  var centerX = chunkCenter(cx);
  var centerZ = chunkCenter(cy);
  var metrics = distanceMetrics(centerX, centerZ);

  var chunk = {
    key: key,
    cx: cx,
    cy: cy,
    group: group,
    seed: chunkSeed,
    worldSeed: worldSeed,
    metrics: metrics,
    heightmap: generateChunkHeightmap(worldSeed, terrain.difficulty, cx, cy),
    visualMode: "composite-field",
    compositePlacedCount: 0,
    compositeInstanceCount: 0,
    placedModelCount: 0,
    visualColliders: [],
    minimapMarkers: [],
    useVisualCollision: false,
    resources: null,
    resourcesTracked: false,
    gcEntries: null,
    gcPrepared: false,
    ready: false,
    state: "loading"
  };

  setChunkLocalPosition(terrain, chunk);
  terrain.mesh.add(group);
  terrain.chunks.set(key, chunk);
  terrain.debug.chunksCreated++;

  console.log("[WORLD] chunk create", {
    chunk: key,
    active: terrain.chunks.size,
    created: terrain.debug.chunksCreated,
    destroyed: terrain.debug.chunksDestroyed
  });

  var compositeChance = metrics.compositionChance;
  var roll = seedToUnit(hashInt3(chunkSeed, 0x63d83595, 0x7f4a7c15));
  var shouldGenerateVisuals = roll <= compositeChance;

  function finalizeChunk() {
    if (chunk.ready) return;
    chunk.ready = true;
    chunk.useVisualCollision = !!(chunk.visualColliders && chunk.visualColliders.length > 0);
    retainChunkResources(terrain, chunk);

    if (chunk.state === "queued") {
      prepareChunkForGc(terrain, chunk);
    } else {
      chunk.state = "active";
    }
  }

  if (!shouldGenerateVisuals) {
    chunk.visualMode = "sparse-open-water";
    chunk.useVisualCollision = false;
    finalizeChunk();
    return chunk;
  }

  addCompositeFieldVisual(group, chunk, chunkSeed + terrain.difficulty * 101)
    .then(function (res) {
      chunk.compositePlacedCount = res ? (res.itemsPlaced || 0) : 0;
      chunk.compositeInstanceCount = res ? (res.instancesPlaced || 0) : 0;
      chunk.placedModelCount = chunk.compositePlacedCount;

      if (chunk.placedModelCount <= 0) {
        chunk.visualMode = "composite-fallback-tiered";
        return addTieredIslandFieldVisual(group, chunk, chunk.heightmap, chunkSeed).then(function (placed) {
          chunk.placedModelCount = placed || 0;
        });
      }
      return null;
    })
    .catch(function () {
      // Keep this chunk navigable even if visual generation fails.
      chunk.visualMode = "composite-failed-open-water";
    })
    .finally(function () {
      finalizeChunk();
    });

  return chunk;
}

function prepareChunkForGc(terrain, chunk) {
  if (!chunk || chunk.gcPrepared || chunk.state === "disposed") return;
  if (!chunk.resourcesTracked) retainChunkResources(terrain, chunk);

  chunk.gcEntries = buildChunkGcEntries(chunk);
  chunk.gcPrepared = true;
  chunk.state = "queued";

  if (chunk.group && chunk.group.parent) {
    chunk.group.parent.remove(chunk.group);
  }
  // Stop participating in collision/minimap immediately.
  chunk.useVisualCollision = false;
  chunk.visualColliders = [];
  chunk.minimapMarkers = [];

  terrain.gcQueue.push(chunk);
}

function enqueueChunkForGc(terrain, chunk) {
  if (!chunk || chunk.state === "queued" || chunk.state === "disposed") return;
  chunk.state = "queued";
  if (chunk.ready) {
    prepareChunkForGc(terrain, chunk);
  }
}

function finalizeChunkDisposal(terrain, chunk) {
  if (!chunk || chunk.state === "disposed") return;

  terrain.chunks.delete(chunk.key);
  chunk.state = "disposed";
  chunk.group = null;
  chunk.heightmap = null;
  chunk.resources = null;
  chunk.gcEntries = null;
  chunk.visualColliders = null;
  chunk.minimapMarkers = null;

  terrain.debug.chunksDestroyed++;

  console.log("[WORLD] chunk destroy", {
    chunk: chunk.key,
    active: terrain.chunks.size,
    created: terrain.debug.chunksCreated,
    destroyed: terrain.debug.chunksDestroyed,
    disposedResources: terrain.debug.disposedResources
  });
}

function processGcQueue(terrain) {
  var budget = terrain.gcResourceBudget;

  while (budget > 0 && terrain.gcQueue.length > 0) {
    var chunk = terrain.gcQueue[0];
    if (!chunk || !chunk.gcEntries) {
      terrain.gcQueue.shift();
      if (chunk) finalizeChunkDisposal(terrain, chunk);
      continue;
    }

    if (chunk.gcEntries.length === 0) {
      terrain.gcQueue.shift();
      finalizeChunkDisposal(terrain, chunk);
      continue;
    }

    var entry = chunk.gcEntries.pop();
    disposeGcEntry(terrain, entry);
    budget--;
  }
}

function gatherChunksAroundGlobal(terrain, globalX, globalZ, range) {
  var cx = toChunkCoord(globalX);
  var cy = toChunkCoord(globalZ);
  var rad = Math.max(1, Math.ceil((range || CHUNK_SIZE * 0.5) / CHUNK_SIZE) + 1);
  var chunks = [];

  for (var x = cx - rad; x <= cx + rad; x++) {
    for (var y = cy - rad; y <= cy + rad; y++) {
      var ch = terrain.chunks.get(chunkKey(x, y));
      if (!ch || ch.state !== "active" || !ch.useVisualCollision || !ch.visualColliders || ch.visualColliders.length === 0) continue;
      chunks.push(ch);
    }
  }
  return chunks;
}

function pointInColliders(chunks, x, z, pad) {
  var p = pad || 0;
  for (var ci = 0; ci < chunks.length; ci++) {
    var colliders = chunks[ci].visualColliders;
    for (var i = 0; i < colliders.length; i++) {
      var c = colliders[i];
      if (x >= c.minX - p && x <= c.maxX + p && z >= c.minZ - p && z <= c.maxZ + p) {
        return true;
      }
    }
  }
  return false;
}

function resolveCollisionFromColliders(chunks, posX, posZ) {
  var pad = COLLISION_RADIUS + VISUAL_COLLIDER_PAD;
  var nx = posX;
  var nz = posZ;
  var collided = false;
  var lastNX = 0;
  var lastNZ = 0;

  for (var it = 0; it < 4; it++) {
    var any = false;
    for (var ci = 0; ci < chunks.length; ci++) {
      var colliders = chunks[ci].visualColliders;
      for (var i = 0; i < colliders.length; i++) {
        var c = colliders[i];
        var minX = c.minX - pad;
        var maxX = c.maxX + pad;
        var minZ = c.minZ - pad;
        var maxZ = c.maxZ + pad;
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
    }
    if (!any) break;
  }

  if (!collided) return null;
  return { collided: true, newX: nx, newZ: nz, normalX: lastNX, normalZ: lastNZ };
}

function computeAvoidanceFromChunks(chunks, worldX, worldZ, range) {
  var out = { factor: 0, awayX: 0, awayZ: 0, distance: Infinity };
  if (!chunks || chunks.length === 0) return out;

  var avoidRange = range || 14;
  var bestDist = Infinity;
  var bestDx = 0;
  var bestDz = 0;

  for (var ci = 0; ci < chunks.length; ci++) {
    var colliders = chunks[ci].visualColliders;
    for (var i = 0; i < colliders.length; i++) {
      var c = colliders[i];
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
  }

  if (!isFinite(bestDist) || bestDist >= avoidRange) return out;

  var len = Math.sqrt(bestDx * bestDx + bestDz * bestDz);
  if (len < 0.0001) {
    bestDx = 0;
    bestDz = -1;
    len = 1;
  }

  out.awayX = bestDx / len;
  out.awayZ = bestDz / len;
  var t = 1 - bestDist / avoidRange;
  out.factor = clamp(t * t, 0, 1);
  out.distance = bestDist;
  return out;
}

function buildDesiredChunkSet(terrain, globalX, globalZ, heading) {
  var desired = new Set();
  var cx = toChunkCoord(globalX);
  var cy = toChunkCoord(globalZ);

  // Base active bubble around player.
  for (var dx = -STREAM_RADIUS; dx <= STREAM_RADIUS; dx++) {
    for (var dy = -STREAM_RADIUS; dy <= STREAM_RADIUS; dy++) {
      desired.add(chunkKey(cx + dx, cy + dy));
    }
  }

  // Preload a forward corridor to hide pop-in while sailing.
  var dirX = Math.sin(heading || 0);
  var dirZ = Math.cos(heading || 0);
  for (var step = 1; step <= PRELOAD_AHEAD; step++) {
    var ax = cx + Math.round(dirX * step);
    var ay = cy + Math.round(dirZ * step);
    for (var sx = -1; sx <= 1; sx++) {
      for (var sy = -1; sy <= 1; sy++) {
        desired.add(chunkKey(ax + sx, ay + sy));
      }
    }
  }

  return { desired: desired, centerX: cx, centerY: cy };
}

function forceGcIfNeeded(terrain, centerX, centerY, desiredSet) {
  if (terrain.chunks.size <= ACTIVE_CHUNK_HARD_LIMIT) return;

  var candidates = [];
  terrain.chunks.forEach(function (chunk) {
    if (!chunk || chunk.state !== "active") return;
    if (desiredSet.has(chunk.key)) return;
    var dx = chunk.cx - centerX;
    var dy = chunk.cy - centerY;
    candidates.push({ chunk: chunk, d2: dx * dx + dy * dy });
  });

  candidates.sort(function (a, b) { return b.d2 - a.d2; });

  var idx = 0;
  while (terrain.chunks.size - terrain.gcQueue.length > ACTIVE_CHUNK_SOFT_LIMIT && idx < candidates.length) {
    enqueueChunkForGc(terrain, candidates[idx].chunk);
    terrain.debug.forcedGcCount++;
    idx++;
  }
}

export function createTerrain(seed, difficulty) {
  var mesh = new THREE.Group();

  var terrain = {
    mesh: mesh,
    seed: seed,
    worldSeed: seed | 0,
    difficulty: difficulty,
    chunks: new Map(),
    gcQueue: [],
    gcResourceBudget: GC_RESOURCE_BUDGET,
    originOffsetX: 0,
    originOffsetZ: 0,
    resourceRefs: {
      geometry: new Map(),
      material: new Map(),
      texture: new Map()
    },
    debug: {
      chunksCreated: 0,
      chunksDestroyed: 0,
      disposedResources: 0,
      forcedGcCount: 0
    },
    getDensityAt: function (worldX, worldZ) {
      var globalX = worldX + terrain.originOffsetX;
      var globalZ = worldZ + terrain.originOffsetZ;
      return distanceMetrics(globalX, globalZ);
    },
    getDebugState: function () {
      return {
        seed: terrain.worldSeed,
        activeChunks: terrain.chunks.size,
        queuedGc: terrain.gcQueue.length,
        created: terrain.debug.chunksCreated,
        destroyed: terrain.debug.chunksDestroyed,
        disposedResources: terrain.debug.disposedResources,
        forcedGc: terrain.debug.forcedGcCount,
        originOffsetX: terrain.originOffsetX,
        originOffsetZ: terrain.originOffsetZ
      };
    }
  };

  // bootstrap around spawn so first frame has content
  updateTerrainStreaming(terrain, 0, 0, 0, 0);

  return terrain;
}

export function updateTerrainStreaming(terrain, playerX, playerZ, playerHeading) {
  if (!terrain) return;

  var globalX = playerX + terrain.originOffsetX;
  var globalZ = playerZ + terrain.originOffsetZ;

  var desiredInfo = buildDesiredChunkSet(terrain, globalX, globalZ, playerHeading || 0);
  var desiredSet = desiredInfo.desired;

  desiredSet.forEach(function (key) {
    var parts = key.split(",");
    var cx = parseInt(parts[0], 10);
    var cy = parseInt(parts[1], 10);
    ensureChunk(terrain, cx, cy);
  });

  terrain.chunks.forEach(function (chunk) {
    if (!chunk || chunk.state === "queued" || chunk.state === "disposed") return;

    var dx = Math.abs(chunk.cx - desiredInfo.centerX);
    var dy = Math.abs(chunk.cy - desiredInfo.centerY);
    var keep = dx <= KEEP_RADIUS && dy <= KEEP_RADIUS;
    if (!keep) {
      enqueueChunkForGc(terrain, chunk);
    }
  });

  forceGcIfNeeded(terrain, desiredInfo.centerX, desiredInfo.centerY, desiredSet);
  processGcQueue(terrain);
}

export function shiftTerrainOrigin(terrain, shiftX, shiftZ) {
  if (!terrain || (!shiftX && !shiftZ)) return;

  terrain.originOffsetX += shiftX;
  terrain.originOffsetZ += shiftZ;

  terrain.chunks.forEach(function (chunk) {
    if (!chunk || chunk.state === "disposed") return;
    if (chunk.group) {
      chunk.group.position.x -= shiftX;
      chunk.group.position.z -= shiftZ;
    }

    if (chunk.visualColliders) {
      for (var i = 0; i < chunk.visualColliders.length; i++) {
        var c = chunk.visualColliders[i];
        c.minX -= shiftX;
        c.maxX -= shiftX;
        c.minZ -= shiftZ;
        c.maxZ -= shiftZ;
      }
    }

    if (chunk.minimapMarkers) {
      for (var m = 0; m < chunk.minimapMarkers.length; m++) {
        chunk.minimapMarkers[m].x -= shiftX;
        chunk.minimapMarkers[m].z -= shiftZ;
      }
    }
  });
}

// --- heightmap queries (used for port placement and coastline checks) ---
export function sampleHeightmap(terrain, worldX, worldZ) {
  if (!terrain) return -1;

  var globalX = worldX + terrain.originOffsetX;
  var globalZ = worldZ + terrain.originOffsetZ;
  var cx = toChunkCoord(globalX);
  var cy = toChunkCoord(globalZ);
  var chunk = ensureChunk(terrain, cx, cy);
  if (!chunk || !chunk.heightmap) return -1;

  return sampleChunkHeight(chunk, globalX, globalZ);
}

export function isHeightmapLand(terrain, worldX, worldZ) {
  if (!terrain) return false;
  return sampleHeightmap(terrain, worldX, worldZ) > SEA_LEVEL;
}

// --- collision / LOS queries ---
export function isLand(terrain, worldX, worldZ) {
  if (!terrain) return false;

  var globalX = worldX + terrain.originOffsetX;
  var globalZ = worldZ + terrain.originOffsetZ;
  ensureChunk(terrain, toChunkCoord(globalX), toChunkCoord(globalZ));

  var chunks = gatherChunksAroundGlobal(terrain, globalX, globalZ, COLLISION_RADIUS + 2);
  return pointInColliders(chunks, worldX, worldZ, COLLISION_RADIUS);
}

export function getTerrainHeight(terrain, worldX, worldZ) {
  if (!terrain) return -1;
  return isLand(terrain, worldX, worldZ) ? 1 : -1;
}

export function collideWithTerrain(terrain, posX, posZ, prevX, prevZ) {
  if (!terrain) {
    return { collided: false, newX: posX, newZ: posZ, normalX: 0, normalZ: 0 };
  }

  var globalX = posX + terrain.originOffsetX;
  var globalZ = posZ + terrain.originOffsetZ;
  ensureChunk(terrain, toChunkCoord(globalX), toChunkCoord(globalZ));

  var chunks = gatherChunksAroundGlobal(terrain, globalX, globalZ, 6);
  var col = resolveCollisionFromColliders(chunks, posX, posZ);
  if (col) return col;

  return { collided: false, newX: posX, newZ: posZ, normalX: 0, normalZ: 0 };
}

export function terrainBlocksLine(terrain, x1, z1, x2, z2) {
  if (!terrain) return false;

  var midX = (x1 + x2) * 0.5 + terrain.originOffsetX;
  var midZ = (z1 + z2) * 0.5 + terrain.originOffsetZ;
  var dist = Math.sqrt((x2 - x1) * (x2 - x1) + (z2 - z1) * (z2 - z1));
  var chunks = gatherChunksAroundGlobal(terrain, midX, midZ, dist * 0.5 + 8);

  var steps = Math.max(2, Math.ceil(dist / 2));
  for (var i = 1; i < steps; i++) {
    var t = i / steps;
    var sx = x1 + (x2 - x1) * t;
    var sz = z1 + (z2 - z1) * t;
    if (pointInColliders(chunks, sx, sz, VISUAL_COLLIDER_PAD)) return true;
  }
  return false;
}

export function getTerrainAvoidance(terrain, worldX, worldZ, range) {
  if (!terrain) return { factor: 0, awayX: 0, awayZ: 0, distance: Infinity };

  var globalX = worldX + terrain.originOffsetX;
  var globalZ = worldZ + terrain.originOffsetZ;
  var r = range || 14;
  var chunks = gatherChunksAroundGlobal(terrain, globalX, globalZ, r + 4);
  return computeAvoidanceFromChunks(chunks, worldX, worldZ, r);
}

// --- disposal ---
export function removeTerrain(terrain, scene) {
  if (!terrain || !terrain.mesh) return;
  scene.remove(terrain.mesh);

  // Dispose everything eagerly on full teardown.
  terrain.chunks.forEach(function (chunk) {
    if (!chunk) return;
    if (!chunk.resources) chunk.resources = collectChunkResources(chunk.group);

    for (var gi = 0; gi < chunk.resources.geometries.length; gi++) {
      var g = chunk.resources.geometries[gi];
      if (isSharedTemplateResource(g)) continue;
      if (g && g.dispose) g.dispose();
    }
    for (var mi = 0; mi < chunk.resources.materials.length; mi++) {
      var m = chunk.resources.materials[mi];
      if (isSharedTemplateResource(m)) continue;
      if (m && m.dispose) m.dispose();
    }
    for (var ti = 0; ti < chunk.resources.textures.length; ti++) {
      var tx = chunk.resources.textures[ti];
      if (isSharedTemplateResource(tx)) continue;
      if (tx && tx.dispose) tx.dispose();
    }
  });

  terrain.chunks.clear();
  terrain.gcQueue = [];
}

// --- spawn helpers ---
export function findWaterPosition(terrain, nearX, nearZ, minDist, maxDist) {
  if (!terrain) {
    var a = nextRandom() * Math.PI * 2;
    var d = minDist + nextRandom() * (maxDist - minDist);
    return { x: nearX + Math.sin(a) * d, z: nearZ + Math.cos(a) * d };
  }

  for (var attempt = 0; attempt < 50; attempt++) {
    var angle = nextRandom() * Math.PI * 2;
    var dist = minDist + nextRandom() * (maxDist - minDist);
    var x = nearX + Math.sin(angle) * dist;
    var z = nearZ + Math.cos(angle) * dist;
    if (!isLand(terrain, x, z)) {
      return { x: x, z: z };
    }
  }

  return { x: nearX, z: nearZ };
}

// --- boundary is intentionally disabled for infinite world ---
export function getEdgeFactor(worldX, worldZ) {
  return 0;
}

export function applyEdgeBoundary(posX, posZ) {
  return { posX: posX, posZ: posZ, pushed: false };
}

export function getTerrainMinimapMarkers(terrain) {
  if (!terrain) return [];
  var markers = [];
  terrain.chunks.forEach(function (chunk) {
    if (!chunk || chunk.state !== "active" || !chunk.minimapMarkers) return;
    for (var i = 0; i < chunk.minimapMarkers.length; i++) {
      markers.push(chunk.minimapMarkers[i]);
    }
  });
  return markers;
}

// --- debug overlay helpers ---
export function createColliderDebugOverlay(terrain, scene) {
  if (!terrain) return;
  var proxy = {
    visualColliders: collectTerrainColliders(terrain)
  };
  return createCompositeColliderDebugOverlay(proxy, scene);
}

export function removeColliderDebugOverlay(scene) {
  removeCompositeColliderDebugOverlay(scene);
}
