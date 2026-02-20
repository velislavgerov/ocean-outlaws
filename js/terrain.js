// terrain.js — procedural island generation, 3D mesh, collision queries
import * as THREE from "three";

// --- tuning ---
var MAP_SIZE = 400;           // world units, matches ocean plane
var GRID_RES = 128;           // heightmap resolution (NxN)
var CELL_SIZE = MAP_SIZE / GRID_RES;
var SEA_LEVEL = 0.0;          // threshold: above = land, below = water
var TERRAIN_HEIGHT = 6;       // max land elevation
var BEACH_HEIGHT = 0.8;       // height below which land counts as beach
var BORDER_WIDTH = 40;        // coastline border width at map edges
var NOISE_SCALE = 0.012;      // base noise frequency
var OCTAVES = 4;
var PERSISTENCE = 0.5;
var LACUNARITY = 2.0;
var SPAWN_CLEAR_RADIUS = 30;  // keep center clear for player spawn
var COLLISION_RADIUS = 1.5;   // ship collision sampling radius
var BOUNCE_STRENGTH = 8;      // push-back force on collision

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

// --- generate heightmap ---
function generateHeightmap(seed, difficulty) {
  _seed = seed;
  var size = GRID_RES + 1;  // +1 for vertex grid
  var data = new Float32Array(size * size);
  var half = MAP_SIZE / 2;

  // scale noise coverage based on difficulty (more land at higher difficulty)
  var landThreshold = 0.48 - difficulty * 0.02;  // lower threshold = more land

  for (var iy = 0; iy < size; iy++) {
    for (var ix = 0; ix < size; ix++) {
      var worldX = (ix / GRID_RES) * MAP_SIZE - half;
      var worldZ = (iy / GRID_RES) * MAP_SIZE - half;

      // base noise
      var n = fbm(worldX * NOISE_SCALE, worldZ * NOISE_SCALE);

      // remap: shift so threshold is at sea level
      var h = (n - landThreshold) * 2;  // -1..1 range roughly

      // border: force land at map edges (coastline boundary)
      var distFromEdge = Math.min(
        half - Math.abs(worldX),
        half - Math.abs(worldZ)
      );
      if (distFromEdge < BORDER_WIDTH) {
        var borderFactor = 1 - distFromEdge / BORDER_WIDTH;
        borderFactor = borderFactor * borderFactor;  // ease-in
        h = h + borderFactor * 1.5;  // raise terrain at edges
      }

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

// --- public: check if a world position is on land ---
export function isLand(terrain, worldX, worldZ) {
  if (!terrain) return false;
  return sampleHeight(terrain, worldX, worldZ) > SEA_LEVEL;
}

// --- public: get terrain height at world position ---
export function getTerrainHeight(terrain, worldX, worldZ) {
  if (!terrain) return -1;
  return sampleHeight(terrain, worldX, worldZ);
}

// --- public: collide a moving entity with terrain ---
// Returns { collided, newX, newZ } — pushes entity out of land
export function collideWithTerrain(terrain, posX, posZ, prevX, prevZ) {
  if (!terrain) return { collided: false, newX: posX, newZ: posZ };

  var h = sampleHeight(terrain, posX, posZ);
  if (h <= SEA_LEVEL) return { collided: false, newX: posX, newZ: posZ };

  // sample gradient to find push direction (away from higher terrain)
  var step = CELL_SIZE;
  var hL = sampleHeight(terrain, posX - step, posZ);
  var hR = sampleHeight(terrain, posX + step, posZ);
  var hU = sampleHeight(terrain, posX, posZ - step);
  var hD = sampleHeight(terrain, posX, posZ + step);

  var gradX = hR - hL;
  var gradZ = hD - hU;
  var gradLen = Math.sqrt(gradX * gradX + gradZ * gradZ);

  if (gradLen > 0.001) {
    // push along negative gradient (downhill = toward water)
    var pushX = -gradX / gradLen;
    var pushZ = -gradZ / gradLen;
    // push distance proportional to penetration
    var penetration = h - SEA_LEVEL;
    var pushDist = penetration * 2 + 0.5;
    var newX = posX + pushX * pushDist;
    var newZ = posZ + pushZ * pushDist;
    // verify the pushed position is actually water
    if (sampleHeight(terrain, newX, newZ) <= SEA_LEVEL) {
      return { collided: true, newX: newX, newZ: newZ };
    }
  }

  // fallback: revert to previous position
  return { collided: true, newX: prevX, newZ: prevZ };
}

// --- public: check line-of-sight between two points ---
// Returns true if terrain blocks the line
export function terrainBlocksLine(terrain, x1, z1, x2, z2) {
  if (!terrain) return false;
  var dx = x2 - x1;
  var dz = z2 - z1;
  var dist = Math.sqrt(dx * dx + dz * dz);
  var steps = Math.ceil(dist / (CELL_SIZE * 0.5));
  if (steps < 2) steps = 2;

  for (var i = 1; i < steps; i++) {
    var t = i / steps;
    var sx = x1 + dx * t;
    var sz = z1 + dz * t;
    if (sampleHeight(terrain, sx, sz) > SEA_LEVEL + 0.5) {
      return true;
    }
  }
  return false;
}

// --- build 3D mesh from heightmap ---
function buildTerrainMesh(heightmap) {
  var size = heightmap.size;
  var data = heightmap.data;
  var half = MAP_SIZE / 2;

  // collect only land triangles to reduce polycount
  var positions = [];
  var colors = [];

  var colorLand = new THREE.Color(0x2d5a1e);     // green
  var colorDirt = new THREE.Color(0x6b4423);      // brown
  var colorBeach = new THREE.Color(0xc2b280);     // sandy
  var colorPeak = new THREE.Color(0x3d7a2e);      // darker green peak

  for (var iy = 0; iy < size - 1; iy++) {
    for (var ix = 0; ix < size - 1; ix++) {
      var h00 = data[iy * size + ix];
      var h10 = data[iy * size + ix + 1];
      var h01 = data[(iy + 1) * size + ix];
      var h11 = data[(iy + 1) * size + ix + 1];

      // skip if all corners are water
      var anyLand = h00 > SEA_LEVEL || h10 > SEA_LEVEL || h01 > SEA_LEVEL || h11 > SEA_LEVEL;
      if (!anyLand) continue;

      var x0 = (ix / GRID_RES) * MAP_SIZE - half;
      var x1 = ((ix + 1) / GRID_RES) * MAP_SIZE - half;
      var z0 = (iy / GRID_RES) * MAP_SIZE - half;
      var z1 = ((iy + 1) / GRID_RES) * MAP_SIZE - half;

      // clamp heights: water areas stay at sea level
      var y00 = Math.max(SEA_LEVEL + 0.1, h00) * TERRAIN_HEIGHT;
      var y10 = Math.max(SEA_LEVEL + 0.1, h10) * TERRAIN_HEIGHT;
      var y01 = Math.max(SEA_LEVEL + 0.1, h01) * TERRAIN_HEIGHT;
      var y11 = Math.max(SEA_LEVEL + 0.1, h11) * TERRAIN_HEIGHT;

      // triangle 1: 00, 10, 01
      positions.push(x0, y00, z0);
      positions.push(x1, y10, z0);
      positions.push(x0, y01, z1);

      // triangle 2: 10, 11, 01
      positions.push(x1, y10, z0);
      positions.push(x1, y11, z1);
      positions.push(x0, y01, z1);

      // color per-face based on average height
      var avgH1 = (h00 + h10 + h01) / 3;
      var avgH2 = (h10 + h11 + h01) / 3;

      colorTriangle(colors, avgH1, colorBeach, colorLand, colorDirt, colorPeak);
      colorTriangle(colors, avgH2, colorBeach, colorLand, colorDirt, colorPeak);
    }
  }

  var geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  var material = new THREE.MeshLambertMaterial({
    vertexColors: true,
    flatShading: true
  });

  var mesh = new THREE.Mesh(geometry, material);
  return mesh;
}

function colorTriangle(colors, avgH, beach, land, dirt, peak) {
  var c;
  if (avgH < BEACH_HEIGHT * 0.3) {
    c = beach;
  } else if (avgH < BEACH_HEIGHT) {
    var t = avgH / BEACH_HEIGHT;
    c = beach.clone().lerp(dirt, t);
  } else if (avgH < 0.6) {
    var t = (avgH - BEACH_HEIGHT) / (0.6 - BEACH_HEIGHT);
    c = dirt.clone().lerp(land, t);
  } else {
    var t = Math.min(1, (avgH - 0.6) / 0.4);
    c = land.clone().lerp(peak, t);
  }
  // 3 vertices per triangle, same color (flat shading)
  for (var i = 0; i < 3; i++) {
    colors.push(c.r, c.g, c.b);
  }
}

// --- public: create terrain for a zone ---
export function createTerrain(seed, difficulty) {
  var heightmap = generateHeightmap(seed, difficulty);
  ensureNavigable(heightmap);

  var mesh = buildTerrainMesh(heightmap);

  return {
    mesh: mesh,
    heightmap: heightmap,
    seed: seed,
    difficulty: difficulty
  };
}

// --- public: remove terrain from scene ---
export function removeTerrain(terrain, scene) {
  if (!terrain) return;
  if (terrain.mesh) {
    scene.remove(terrain.mesh);
    if (terrain.mesh.geometry) terrain.mesh.geometry.dispose();
    if (terrain.mesh.material) terrain.mesh.material.dispose();
  }
}

// --- public: find a valid (water) spawn position near a point ---
export function findWaterPosition(terrain, nearX, nearZ, minDist, maxDist) {
  if (!terrain) {
    var angle = Math.random() * Math.PI * 2;
    var dist = minDist + Math.random() * (maxDist - minDist);
    return { x: nearX + Math.sin(angle) * dist, z: nearZ + Math.cos(angle) * dist };
  }
  // try random positions until we find water
  for (var attempt = 0; attempt < 50; attempt++) {
    var angle = Math.random() * Math.PI * 2;
    var dist = minDist + Math.random() * (maxDist - minDist);
    var x = nearX + Math.sin(angle) * dist;
    var z = nearZ + Math.cos(angle) * dist;
    if (!isLand(terrain, x, z)) {
      return { x: x, z: z };
    }
  }
  // fallback: return center (always water)
  return { x: 0, z: 0 };
}
