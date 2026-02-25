// terrain.js — Palmov composition terrain, collision queries, map boundaries
import * as THREE from "three";
import { nextRandom } from "./rng.js";
import { addCompositeFieldVisual, addTieredIslandFieldVisual, pointInVisualLand, resolveVisualCollision, getTerrainAvoidance as _getTerrainAvoidance, createColliderDebugOverlay, removeColliderDebugOverlay } from "./terrainComposite.js";

// --- tuning ---
var MAP_SIZE = 400;           // world units, matches ocean plane
var GRID_RES = 128;           // heightmap resolution (NxN)
var SEA_LEVEL = 0.0;          // threshold: above = land, below = water
var NOISE_SCALE = 0.02;       // noise frequency tuned for island-sized features
var OCTAVES = 4;
var PERSISTENCE = 0.5;
var LACUNARITY = 2.0;
var SPAWN_CLEAR_RADIUS = 40;  // keep center clear for player spawn
var COLLISION_RADIUS = 1.5;   // ship collision sampling radius
var VISUAL_COLLIDER_PAD = 0.35;

// --- map boundary ---
var EDGE_FOG_START = 160;     // distance from center where fog begins
var EDGE_PUSH_START = 180;    // distance from center where push-back begins
var EDGE_HARD_LIMIT = 200;    // absolute boundary (MAP_SIZE / 2)

// --- simplex-style 2D noise (value noise with smooth interpolation) ---
// Seeded pseudo-random hash
var _seed = 0;

function hashCoord(ix, iy) {
  var n = ix * 374761393 + iy * 668265263 + _seed;
  n = (n ^ (n >> 13)) * 1274126177;
  n = n ^ (n >> 16);
  return (n & 0x7fffffff) / 0x7fffffff;  // 0..1
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
  return value / maxAmp;  // normalized 0..1
}

// --- Gaussian blur for smoother, more organic island shapes ---
function gaussianBlur(data, size, passes) {
  var tmp = new Float32Array(data.length);
  // 3x3 Gaussian kernel weights (sigma ~0.85)
  var k0 = 4 / 16, k1 = 2 / 16, k2 = 1 / 16;
  for (var p = 0; p < passes; p++) {
    for (var y = 0; y < size; y++) {
      for (var x = 0; x < size; x++) {
        var x0 = Math.max(0, x - 1), x1 = Math.min(size - 1, x + 1);
        var y0 = Math.max(0, y - 1), y1 = Math.min(size - 1, y + 1);
        tmp[y * size + x] =
          data[y * size + x] * k0 +
          (data[y * size + x0] + data[y * size + x1] +
           data[y0 * size + x] + data[y1 * size + x]) * k1 +
          (data[y0 * size + x0] + data[y0 * size + x1] +
           data[y1 * size + x0] + data[y1 * size + x1]) * k2;
      }
    }
    for (var i = 0; i < data.length; i++) data[i] = tmp[i];
  }
}

// --- generate heightmap ---
function generateHeightmap(seed, difficulty) {
  _seed = seed;
  var size = GRID_RES + 1;  // +1 for vertex grid
  var data = new Float32Array(size * size);
  var half = MAP_SIZE / 2;

  // scale noise coverage based on difficulty (more land at higher difficulty)
  // ~95% ocean at easy (diff 1), ~90% ocean at hard (diff 6); archipelago feel
  var landThreshold = Math.max(0.70, 0.76 - difficulty * 0.01);  // higher = less land

  for (var iy = 0; iy < size; iy++) {
    for (var ix = 0; ix < size; ix++) {
      var worldX = (ix / GRID_RES) * MAP_SIZE - half;
      var worldZ = (iy / GRID_RES) * MAP_SIZE - half;

      // base noise
      var n = fbm(worldX * NOISE_SCALE, worldZ * NOISE_SCALE);

      // remap: shift so threshold is at sea level
      var h = (n - landThreshold) * 2;  // -1..1 range roughly

      // no border — open ocean fading to horizon

      // clear center area for player spawn
      var distFromCenter = Math.sqrt(worldX * worldX + worldZ * worldZ);
      if (distFromCenter < SPAWN_CLEAR_RADIUS) {
        var clearFactor = 1 - distFromCenter / SPAWN_CLEAR_RADIUS;
        clearFactor = clearFactor * clearFactor;
        h = h - clearFactor * 3;  // push below sea level
      }

      data[iy * size + ix] = h;
    }
  }

  // smooth heightmap for rounder, more natural island profiles
  gaussianBlur(data, size, 2);

  return { data: data, size: size };
}

// --- flood fill to ensure all water is navigable ---
function ensureNavigable(heightmap) {
  var size = heightmap.size;
  var data = heightmap.data;
  // find the center cell (guaranteed water)
  var cx = Math.floor(size / 2);
  var cy = Math.floor(size / 2);

  // BFS from center to mark all reachable water
  var visited = new Uint8Array(size * size);
  var queue = [cx + cy * size];
  visited[cx + cy * size] = 1;

  while (queue.length > 0) {
    var idx = queue.shift();
    var y = Math.floor(idx / size);
    var x = idx - y * size;
    var neighbors = [
      [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]
    ];
    for (var i = 0; i < neighbors.length; i++) {
      var nx = neighbors[i][0];
      var ny = neighbors[i][1];
      if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;
      var ni = ny * size + nx;
      if (visited[ni]) continue;
      if (data[ni] <= SEA_LEVEL) {
        visited[ni] = 1;
        queue.push(ni);
      }
    }
  }

  // any water cell NOT visited is a landlocked pocket — fill with land
  // (alternatively, lower unreachable land to make it water, but filling is simpler)
  for (var i = 0; i < data.length; i++) {
    if (data[i] <= SEA_LEVEL && !visited[i]) {
      // this water pocket is unreachable — raise it to land
      data[i] = 0.3;
    }
  }
}

// --- query heightmap at world position ---
function sampleHeight(terrain, worldX, worldZ) {
  var half = MAP_SIZE / 2;
  var u = (worldX + half) / MAP_SIZE * GRID_RES;
  var v = (worldZ + half) / MAP_SIZE * GRID_RES;
  var size = terrain.heightmap.size;
  var data = terrain.heightmap.data;

  var ix = Math.floor(u);
  var iy = Math.floor(v);
  ix = Math.max(0, Math.min(size - 2, ix));
  iy = Math.max(0, Math.min(size - 2, iy));
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

// --- heightmap-specific queries for port placement (used during async load window) ---
export function sampleHeightmap(terrain, worldX, worldZ) {
  if (!terrain || !terrain.heightmap) return -1;
  return sampleHeight(terrain, worldX, worldZ);
}

export function isHeightmapLand(terrain, worldX, worldZ) {
  if (!terrain || !terrain.heightmap) return false;
  return sampleHeight(terrain, worldX, worldZ) > SEA_LEVEL;
}

// --- public: check if a world position is on land ---
export function isLand(terrain, worldX, worldZ) {
  if (!terrain) return false;
  if (terrain.useVisualCollision) return pointInVisualLand(terrain, worldX, worldZ, COLLISION_RADIUS);
  return false;
}

// --- public: get terrain height at world position ---
export function getTerrainHeight(terrain, worldX, worldZ) {
  if (!terrain) return -1;
  if (terrain.useVisualCollision) return pointInVisualLand(terrain, worldX, worldZ, COLLISION_RADIUS) ? 1 : -1;
  return -1;
}

// --- public: collide a moving entity with terrain ---
// Returns { collided, newX, newZ, normalX, normalZ } — pushes entity out of land
export function collideWithTerrain(terrain, posX, posZ, prevX, prevZ) {
  if (!terrain) return { collided: false, newX: posX, newZ: posZ, normalX: 0, normalZ: 0 };
  if (terrain.useVisualCollision) {
    var vcol = resolveVisualCollision(terrain, posX, posZ, prevX, prevZ);
    if (vcol) return vcol;
  }
  return { collided: false, newX: posX, newZ: posZ, normalX: 0, normalZ: 0 };
}

// --- public: check line-of-sight between two points ---
// Returns true if terrain blocks the line
export function terrainBlocksLine(terrain, x1, z1, x2, z2) {
  if (!terrain) return false;
  if (terrain.useVisualCollision) {
    var vdx = x2 - x1;
    var vdz = z2 - z1;
    var vdist = Math.sqrt(vdx * vdx + vdz * vdz);
    var vsteps = Math.ceil(vdist / 2.0);
    if (vsteps < 2) vsteps = 2;
    for (var vi = 1; vi < vsteps; vi++) {
      var vt = vi / vsteps;
      var vx = x1 + vdx * vt;
      var vz = z1 + vdz * vt;
      if (pointInVisualLand(terrain, vx, vz, VISUAL_COLLIDER_PAD)) return true;
    }
  }
  return false;
}

// --- public: create terrain for a zone ---
export function createTerrain(seed, difficulty) {
  var heightmap = generateHeightmap(seed, difficulty);
  ensureNavigable(heightmap);

  var mesh = new THREE.Group();

  var terrain = {
    mesh: mesh,
    heightmap: heightmap,
    seed: seed,
    difficulty: difficulty,
    visualMode: "composite-field",
    compositePlacedCount: 0,
    compositeInstanceCount: 0,
    placedModelCount: 0,
    visualColliders: [],
    useVisualCollision: false,
    minimapMarkers: []
  };

  addCompositeFieldVisual(mesh, terrain, seed + difficulty * 101).then(function (res) {
    terrain.compositePlacedCount = res ? (res.itemsPlaced || 0) : 0;
    terrain.compositeInstanceCount = res ? (res.instancesPlaced || 0) : 0;
    terrain.placedModelCount = terrain.compositePlacedCount;

    if (terrain.placedModelCount <= 0) {
      terrain.visualMode = "composite-fallback-tiered";
      addTieredIslandFieldVisual(mesh, terrain, heightmap, seed).then(function (placed) {
        terrain.placedModelCount = placed;
        terrain.useVisualCollision = placed > 0;
      });
      return;
    }
    terrain.useVisualCollision = true;
  });

  return terrain;
}

// --- public: remove terrain from scene ---
export function removeTerrain(terrain, scene) {
  if (!terrain || !terrain.mesh) return;
  scene.remove(terrain.mesh);
  terrain.mesh.traverse(function (o) {
    if (o.geometry) o.geometry.dispose();
    if (!o.material) return;
    if (Array.isArray(o.material)) {
      for (var i = 0; i < o.material.length; i++) if (o.material[i] && o.material[i].dispose) o.material[i].dispose();
    } else if (o.material.dispose) {
      o.material.dispose();
    }
  });
}

// --- public: find a valid (water) spawn position near a point ---
export function findWaterPosition(terrain, nearX, nearZ, minDist, maxDist) {
  if (!terrain) {
    var angle = nextRandom() * Math.PI * 2;
    var dist = minDist + nextRandom() * (maxDist - minDist);
    return { x: nearX + Math.sin(angle) * dist, z: nearZ + Math.cos(angle) * dist };
  }
  // try random positions until we find water
  for (var attempt = 0; attempt < 50; attempt++) {
    var angle = nextRandom() * Math.PI * 2;
    var dist = minDist + nextRandom() * (maxDist - minDist);
    var x = nearX + Math.sin(angle) * dist;
    var z = nearZ + Math.cos(angle) * dist;
    if (!isLand(terrain, x, z)) {
      return { x: x, z: z };
    }
  }
  // fallback: return center (always water)
  return { x: 0, z: 0 };
}

// --- public: get edge proximity factor (0 = safe, 1 = at hard limit) ---
export function getEdgeFactor(worldX, worldZ) {
  var dist = Math.sqrt(worldX * worldX + worldZ * worldZ);
  if (dist <= EDGE_FOG_START) return 0;
  return Math.min(1, (dist - EDGE_FOG_START) / (EDGE_HARD_LIMIT - EDGE_FOG_START));
}

// --- public: apply map edge push-back to a position ---
// Returns { posX, posZ, pushed } — nudges entity toward center when near edge
export function applyEdgeBoundary(posX, posZ) {
  var dist = Math.sqrt(posX * posX + posZ * posZ);
  if (dist <= EDGE_PUSH_START) return { posX: posX, posZ: posZ, pushed: false };

  var factor = Math.min(1, (dist - EDGE_PUSH_START) / (EDGE_HARD_LIMIT - EDGE_PUSH_START));
  factor = factor * factor;  // ease-in: gentle at first, strong near limit

  // push toward center
  var pushStrength = factor * 15;  // max push force
  var nx = posX / dist;
  var nz = posZ / dist;
  var newX = posX - nx * pushStrength * 0.016;  // ~1 frame at 60fps
  var newZ = posZ - nz * pushStrength * 0.016;

  // hard clamp at absolute limit
  var newDist = Math.sqrt(newX * newX + newZ * newZ);
  if (newDist > EDGE_HARD_LIMIT) {
    newX = newX / newDist * EDGE_HARD_LIMIT;
    newZ = newZ / newDist * EDGE_HARD_LIMIT;
  }

  return { posX: newX, posZ: newZ, pushed: true };
}

export function getTerrainMinimapMarkers(terrain) {
  if (!terrain || !terrain.minimapMarkers) return [];
  return terrain.minimapMarkers;
}

export { _getTerrainAvoidance as getTerrainAvoidance };
export { createColliderDebugOverlay, removeColliderDebugOverlay };
