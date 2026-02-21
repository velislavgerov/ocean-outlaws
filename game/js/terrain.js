// terrain.js — procedural island generation, 3D mesh, collision queries
import * as THREE from "three";

// --- tuning ---
var MAP_SIZE = 400;           // world units, matches ocean plane
var GRID_RES = 128;           // heightmap resolution (NxN)
var CELL_SIZE = MAP_SIZE / GRID_RES;
var SEA_LEVEL = 0.0;          // threshold: above = land, below = water
var TERRAIN_HEIGHT = 4;       // max land elevation (lowered for small islands)
var BEACH_HEIGHT = 0.8;       // height below which land counts as beach
var NOISE_SCALE = 0.02;       // noise frequency tuned for island-sized features
var OCTAVES = 4;
var PERSISTENCE = 0.5;
var LACUNARITY = 2.0;
var SPAWN_CLEAR_RADIUS = 40;  // keep center clear for player spawn
var COLLISION_RADIUS = 1.5;   // ship collision sampling radius
var BOUNCE_STRENGTH = 8;      // push-back force on collision

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

// --- marching squares: interpolated shoreline vertex along cell edge ---
// Returns the interpolated position (0..1 fraction) where sea level crosses
function edgeLerp(hA, hB) {
  var denom = hA - hB;
  if (Math.abs(denom) < 0.0001) return 0.5;
  return Math.max(0, Math.min(1, hA / denom));
}

// Convert heightmap value to mesh Y with gentle beach slope
function heightToY(h) {
  if (h <= SEA_LEVEL) return 0;
  // gradual beach ramp: ease-in for low heights
  var beachRamp = Math.min(h / BEACH_HEIGHT, 1.0);
  beachRamp = beachRamp * beachRamp;  // quadratic ease-in for gentle slope
  return h * TERRAIN_HEIGHT * (0.3 + 0.7 * beachRamp);
}

// Edge connectivity: edge 0=bottom(0→1), 1=right(1→2), 2=top(3→2), 3=left(0→3)
var EDGE_FROM = [0, 1, 3, 0];
var EDGE_TO   = [1, 2, 2, 3];

// --- build 3D mesh from heightmap using marching squares ---
// Interpolates shoreline edges for smooth, curved coastlines that match
// the bilinear-interpolated collision boundary exactly.
function buildTerrainMesh(heightmap) {
  var size = heightmap.size;
  var data = heightmap.data;
  var half = MAP_SIZE / 2;

  var positions = [];
  var colors = [];

  var colorLand = new THREE.Color(0x4a7a35);
  var colorDirt = new THREE.Color(0x8b6914);
  var colorBeach = new THREE.Color(0xe8d5a0);
  var colorPeak = new THREE.Color(0x5a5a5a);

  for (var iy = 0; iy < size - 1; iy++) {
    for (var ix = 0; ix < size - 1; ix++) {
      var h00 = data[iy * size + ix];
      var h10 = data[iy * size + ix + 1];
      var h01 = data[(iy + 1) * size + ix];
      var h11 = data[(iy + 1) * size + ix + 1];

      // marching squares case index: bit per corner above sea level
      var caseIdx =
        (h00 > SEA_LEVEL ? 1 : 0) |
        (h10 > SEA_LEVEL ? 2 : 0) |
        (h11 > SEA_LEVEL ? 4 : 0) |
        (h01 > SEA_LEVEL ? 8 : 0);

      // skip all-water cells
      if (caseIdx === 0) continue;

      // world-space corners of this cell
      var x0 = (ix / GRID_RES) * MAP_SIZE - half;
      var x1 = ((ix + 1) / GRID_RES) * MAP_SIZE - half;
      var z0 = (iy / GRID_RES) * MAP_SIZE - half;
      var z1 = ((iy + 1) / GRID_RES) * MAP_SIZE - half;

      // corners: 0=SW(x0,z0) 1=SE(x1,z0) 2=NE(x1,z1) 3=NW(x0,z1)
      var cx = [x0, x1, x1, x0];
      var cz = [z0, z0, z1, z1];
      var ch = [h00, h10, h11, h01];
      var cy = [heightToY(h00), heightToY(h10), heightToY(h11), heightToY(h01)];

      // interpolated edge crossing points where sea level meets cell edges
      var ex = [], ez = [], ey = [];
      for (var e = 0; e < 4; e++) {
        var a = EDGE_FROM[e], b = EDGE_TO[e];
        var t = edgeLerp(ch[a], ch[b]);
        ex[e] = cx[a] + (cx[b] - cx[a]) * t;
        ez[e] = cz[a] + (cz[b] - cz[a]) * t;
        ey[e] = 0;  // shoreline vertices at sea level
      }

      // all-land: full quad, same as before but with beach slopes
      if (caseIdx === 15) {
        pushTri(positions, cx[0], cy[0], cz[0], cx[1], cy[1], cz[1], cx[3], cy[3], cz[3]);
        pushTri(positions, cx[1], cy[1], cz[1], cx[2], cy[2], cz[2], cx[3], cy[3], cz[3]);
        var avgH1 = (ch[0] + ch[1] + ch[3]) / 3;
        var avgH2 = (ch[1] + ch[2] + ch[3]) / 3;
        colorTriangle(colors, avgH1, colorBeach, colorLand, colorDirt, colorPeak);
        colorTriangle(colors, avgH2, colorBeach, colorLand, colorDirt, colorPeak);
        continue;
      }

      // marching squares triangulation for partial cells
      // Each case emits triangles covering only the land portion
      var tris = marchTris(caseIdx, cx, cy, cz, ex, ey, ez);
      for (var ti = 0; ti < tris.length; ti += 9) {
        positions.push(
          tris[ti], tris[ti + 1], tris[ti + 2],
          tris[ti + 3], tris[ti + 4], tris[ti + 5],
          tris[ti + 6], tris[ti + 7], tris[ti + 8]
        );
        // average height of the triangle's source data for coloring
        var triAvgH = Math.max(0, (tris[ti + 1] + tris[ti + 4] + tris[ti + 7]) / (3 * TERRAIN_HEIGHT));
        colorTriangle(colors, triAvgH, colorBeach, colorLand, colorDirt, colorPeak);
      }
    }
  }

  var geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  var material = new THREE.MeshLambertMaterial({
    vertexColors: true,
    flatShading: true,
    side: THREE.DoubleSide
  });

  var mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = 4;  // raise terrain above max wave height
  mesh.renderOrder = 2;
  return mesh;
}

function pushTri(arr, ax, ay, az, bx, by, bz, cx, cy, cz) {
  arr.push(ax, ay, az, bx, by, bz, cx, cy, cz);
}

// Marching squares triangle tables. Corners: 0=SW 1=SE 2=NE 3=NW.
// Edges: 0=bottom 1=right 2=top 3=left. Negative = edge idx (offset by -1).
// caseIdx bits: corner0=1, corner1=2, corner2=4, corner3=8.
var MARCH_TABLE = [];
MARCH_TABLE[1]  = [0, -1, -4];
MARCH_TABLE[2]  = [1, -2, -1];
MARCH_TABLE[4]  = [2, -3, -2];
MARCH_TABLE[8]  = [3, -4, -3];
MARCH_TABLE[3]  = [0, 1, -2,  0, -2, -4];
MARCH_TABLE[6]  = [1, 2, -3,  1, -3, -1];
MARCH_TABLE[12] = [3, -4, 2,  2, -4, -2];
MARCH_TABLE[9]  = [0, -1, 3,  3, -1, -3];
MARCH_TABLE[5]  = [0, -1, -4,  2, -3, -2];
MARCH_TABLE[10] = [1, -2, -1,  3, -4, -3];
MARCH_TABLE[14] = [1, 2, 3,  1, 3, -4,  1, -4, -1];
MARCH_TABLE[13] = [0, -1, 3,  3, -1, -2,  3, -2, 2];
MARCH_TABLE[11] = [0, 1, -2,  0, -2, -3,  0, -3, 3];
MARCH_TABLE[7]  = [0, 1, 2,  0, 2, -3,  0, -3, -4];

function marchTris(caseIdx, cx, cy, cz, ex, ey, ez) {
  var table = MARCH_TABLE[caseIdx];
  if (!table) return [];
  var out = [];
  for (var i = 0; i < table.length; i++) {
    var v = table[i];
    if (v >= 0) { out.push(cx[v], cy[v], cz[v]); }
    else { var e = -v - 1; out.push(ex[e], ey[e], ez[e]); }
  }
  return out;
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
