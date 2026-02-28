// port.js — supply ports: fixed resupply points on island coastlines
import * as THREE from "three";
import { addAmmo, addFuel } from "./resource.js";
import { getRepairCost } from "./upgrade.js";
import { sampleHeightmap, isHeightmapLand, isLand, terrainBlocksLine } from "./terrain.js";
import { nextRandom } from "./rng.js";
import { loadGlbVisual } from "./glbVisual.js";
import { ensureAssetRoles, getRoleVariants, pickRoleVariant } from "./assetRoles.js";

// --- tuning ---
var PORT_CHUNK_CHANCE = 0.18;    // probability a chunk spawns a port (~18%)
var PORT_CHUNK_SIZE = 400;       // must match terrain.js CHUNK_SIZE
var PORT_COUNT = 3;              // legacy: ports per map for initPorts fallback
var PORT_COLLECT_RADIUS = 10;    // proximity to trigger resupply
var PORT_COOLDOWN = 45;          // seconds before port can be used again
var PORT_AMMO_RESTOCK = 30;
var PORT_FUEL_RESTOCK = 40;
var PORT_HP_RESTOCK = 15;        // flat HP restored
var PORT_WATER_NUDGE = 4;        // move port root slightly toward open water
var PORT_DOCK_OFFSET = 8;        // interaction anchor placed on water side of port
var PORT_DOCK_MAX_OFFSET = 22;   // allow farther dock fallback on complex coasts
var PORT_DOCK_CLEAR_RADIUS = 3.6;
var PORT_DOCK_REFRESH = 0.75;    // refresh dock anchor against visual colliders
var PORT_CITY_CHANCE = 0.6;      // chance that a spawned port is promoted to a city
var PORT_CITY_HOSTILE_BASE = 0.55;
var PORT_CITY_HOSTILE_STEP = 0.07; // scales with difficulty context
var PORT_CITY_MIN_COUNT = 1;     // if coastal anchors exist, ensure at least this many city ports
var PORT_HOSTILE_CITY_MIN_COUNT = 1; // if cities exist, ensure at least this many hostile city ports
var PORT_CITY_MAX_FRACTION = 0.8; // keep some plain ports for pacing
var CITY_ANCHOR_MIN_DIST = 7;
var CITY_ANCHOR_MAX_DIST = 22;
var CITY_ANCHOR_STEP = 1.5;
var CITY_PROJECTILE_SPEED = 26;
var CITY_PROJECTILE_GRAVITY = 9.2;
var CITY_PROJECTILE_MAX_RANGE = 120;
var CITY_PROJECTILE_DAMAGE = 1.2;
var CITY_GUN_RANGE = 95;
var CITY_GUN_IGNORE_LOS_RANGE = 34;
var CITY_GUN_FIRE_COOLDOWN_MIN = 2.0;
var CITY_GUN_FIRE_COOLDOWN_MAX = 3.8;
var CITY_BATTERY_COUNT_MIN = 2;
var CITY_BATTERY_COUNT_MAX = 4;
var CITY_BATTERY_HP = 3;
var CITY_BATTERY_HIT_RADIUS = 2.2;
var CITY_CAPTURE_BONUS = 45;
var CITY_BATTERY_BONUS = 10;
var CITY_WARNING_RADIUS = 85;
var CITY_WARNING_COOLDOWN = 5.5;

// coastline search: find cells near sea level
var COAST_SEARCH_ATTEMPTS = 200;
var COAST_HEIGHT_MIN = -0.05;    // just below sea level (water side)
var COAST_HEIGHT_MAX = 0.15;     // just above sea level (beach)
var MAP_HALF = 200;              // half of MAP_SIZE (400)
var MIN_PORT_SPACING = 60;       // minimum distance between ports
var MIN_CENTER_DIST = 40;        // keep ports away from spawn
var PORT_THEME_ORDER = ["neutral", "merchant", "pirate"];
var CITY_NAME_BY_THEME = {
  neutral: ["Sable Quay", "Mistwater", "Brass Jetty", "Stonewake"],
  merchant: ["Goldwake", "Ledger Point", "Tradewind", "Copperharbor"],
  pirate: ["Skullhaven", "Ragged Anchorage", "Razor Quay", "Black Keel"]
};

var PORT_THEME_VARIANTS = [
  [
    { path: "assets/models/environment/wooden-piers/wooden-pier.glb", fit: 8, x: 0, y: 0, z: 0, ry: 0 },
    { path: "assets/models/environment/wooden-posts/wooden-post-2.glb", fit: 2.5, x: -1.2, y: 0, z: -2.3, ry: 0 },
    { path: "assets/models/environment/wooden-posts/wooden-post-3.glb", fit: 2.5, x: 1.2, y: 0, z: -2.3, ry: 0 },
    { path: "assets/models/environment/boxes/box.glb", fit: 1.1, x: 0.6, y: 1.8, z: 0.9, ry: Math.PI * 0.15 },
    { path: "assets/models/environment/barrels/barrel.glb", fit: 1.0, x: -0.6, y: 1.8, z: -0.7, ry: 0 }
  ],
  [
    { path: "assets/models/environment/wooden-piers/wooden-pier-4.glb", fit: 8.5, x: 0, y: 0, z: 0, ry: 0 },
    { path: "assets/models/environment/lamppost.glb", fit: 3.0, x: 1.1, y: 1.4, z: -2.0, ry: 0 },
    { path: "assets/models/environment/bags/bag-grain.glb", fit: 1.1, x: -0.5, y: 1.8, z: 0.7, ry: 0 },
    { path: "assets/models/environment/boxes/box-3.glb", fit: 1.1, x: 0.7, y: 1.8, z: 1.0, ry: Math.PI * 0.2 },
    { path: "assets/models/environment/barrels/barrel-3.glb", fit: 1.1, x: -0.8, y: 1.8, z: -0.7, ry: 0 }
  ],
  [
    { path: "assets/models/environment/wooden-platforms/wooden-platform-2.glb", fit: 8.2, x: 0, y: 0, z: 0, ry: 0 },
    { path: "assets/models/environment/wooden-piers/wooden-pier-2.glb", fit: 8, x: 0, y: 0, z: 0.2, ry: 0 },
    { path: "assets/models/environment/boards/board-2.glb", fit: 1.1, x: -0.6, y: 1.8, z: 0.6, ry: Math.PI * 0.2 },
    { path: "assets/models/environment/barrels/barrel-2.glb", fit: 1.0, x: 0.6, y: 1.8, z: -0.7, ry: 0 },
    { path: "assets/models/environment/bottles/bottle-2.glb", fit: 0.7, x: 0.2, y: 2.0, z: 0.4, ry: 0 }
  ]
];

var PORT_THEME_VARIANTS_BY_FACTION = {
  neutral: PORT_THEME_VARIANTS,
  merchant: [
    [
      { path: "assets/models/environment/wooden-piers/wooden-pier-4.glb", fit: 8.4, x: 0, y: 0, z: 0, ry: 0 },
      { path: "assets/models/houses/trading/trading-house.glb", fit: 5.4, x: 0.2, y: 1.8, z: -2.4, ry: 0 },
      { path: "assets/models/environment/food-tents/food-tent-2.glb", fit: 2.8, x: -1.1, y: 1.8, z: 1.0, ry: 0 },
      { path: "assets/models/environment/bags/bag-grain.glb", fit: 1.0, x: 0.7, y: 1.8, z: 1.1, ry: 0.17 },
      { path: "assets/models/environment/boxes/box-3.glb", fit: 1.0, x: -0.6, y: 1.8, z: 0.8, ry: 0.5 }
    ],
    [
      { path: "assets/models/environment/wooden-platforms/wooden-platform.glb", fit: 8.4, x: 0, y: 0, z: 0, ry: 0 },
      { path: "assets/models/houses/trading/trading-house-2.glb", fit: 5.6, x: -0.3, y: 1.8, z: -2.5, ry: 0 },
      { path: "assets/models/environment/tables/table-2.glb", fit: 1.6, x: 0.95, y: 1.8, z: 0.55, ry: 0.22 },
      { path: "assets/models/environment/chairs/chair.glb", fit: 1.1, x: 0.35, y: 1.8, z: 0.95, ry: -0.4 },
      { path: "assets/models/environment/barrels/barrel-stand.glb", fit: 1.4, x: -0.8, y: 1.8, z: 0.6, ry: 0.2 }
    ]
  ],
  pirate: [
    [
      { path: "assets/models/environment/destroyed-wooden-pier.glb", fit: 8.3, x: 0, y: 0, z: 0, ry: 0 },
      { path: "assets/models/houses/pirate/pirate-house.glb", fit: 5.8, x: -0.1, y: 1.8, z: -2.3, ry: 0 },
      { path: "assets/models/environment/barrels/barrel-3.glb", fit: 1.0, x: 0.9, y: 1.8, z: 0.85, ry: 0 },
      { path: "assets/models/environment/fences/untreated/untreated-fence.glb", fit: 2.3, x: 0.2, y: 1.8, z: 1.3, ry: 0.08 },
      { path: "assets/models/environment/bags/bag-grain-2.glb", fit: 1.0, x: -0.7, y: 1.8, z: 0.8, ry: -0.35 }
    ],
    [
      { path: "assets/models/environment/wooden-piers/wooden-pier-5.glb", fit: 8.6, x: 0, y: 0, z: 0, ry: 0 },
      { path: "assets/models/houses/pirate/pirate-house-2.glb", fit: 5.6, x: 0, y: 1.8, z: -2.5, ry: 0 },
      { path: "assets/models/environment/fences/stone/stone-fence-small.glb", fit: 2.2, x: 1.0, y: 1.8, z: 1.1, ry: 0.24 },
      { path: "assets/models/environment/barrels/barrel.glb", fit: 1.0, x: -0.6, y: 1.8, z: 0.9, ry: 0 },
      { path: "assets/models/environment/boxes/box-2.glb", fit: 1.0, x: 0.6, y: 1.8, z: 0.7, ry: 0.35 }
    ]
  ]
};

var CITY_MODULES_BY_THEME = {
  neutral: [
    { path: "assets/models/houses/trading/trading-house.glb", fit: 6.0, x: 0, y: 1.8, z: 0, ry: 0 },
    { path: "assets/models/houses/trading/trading-house-2.glb", fit: 5.6, x: 4.4, y: 1.8, z: -2.8, ry: 0.2 },
    { path: "assets/models/environment/fences/stone/stone-fence-small.glb", fit: 3.0, x: 2.1, y: 1.8, z: 3.4, ry: 0.35 }
  ],
  merchant: [
    { path: "assets/models/houses/trading/trading-house.glb", fit: 6.2, x: 0, y: 1.8, z: 0, ry: 0 },
    { path: "assets/models/houses/trading/trading-house-2.glb", fit: 5.8, x: -4.8, y: 1.8, z: -2.2, ry: -0.15 },
    { path: "assets/models/environment/food-tents/food-tent-2.glb", fit: 3.0, x: 3.9, y: 1.8, z: 1.9, ry: 0.25 }
  ],
  pirate: [
    { path: "assets/models/houses/pirate/pirate-house.glb", fit: 6.0, x: 0, y: 1.8, z: 0, ry: 0 },
    { path: "assets/models/houses/pirate/pirate-house-2.glb", fit: 5.8, x: 4.1, y: 1.8, z: -2.5, ry: 0.12 },
    { path: "assets/models/environment/fences/untreated/untreated-fence.glb", fit: 3.0, x: -3.3, y: 1.8, z: 2.9, ry: -0.25 }
  ]
};

// --- deterministic hash / RNG for chunk-based port placement ---
function hashInt3Port(a, b, c) {
  var h = (a | 0) ^ Math.imul(b | 0, 0x85ebca6b) ^ Math.imul(c | 0, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  h = h ^ (h >>> 16);
  return h >>> 0;
}

function seededRandPort(seed) {
  var s = (seed >>> 0) || 1;
  return function () {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function findChunkCoastlinePosition(chunk, terrain, rng) {
  var half = PORT_CHUNK_SIZE * 0.5;
  var centerGlobalX = chunk.cx * PORT_CHUNK_SIZE;
  var centerGlobalZ = chunk.cy * PORT_CHUNK_SIZE;
  var margin = 40;
  var searchRange = PORT_CHUNK_SIZE - margin * 2;

  for (var attempt = 0; attempt < 80; attempt++) {
    var gx = centerGlobalX + (rng() - 0.5) * searchRange;
    var gz = centerGlobalZ + (rng() - 0.5) * searchRange;

    // Scene-space coordinates for terrain queries
    var x = gx - terrain.originOffsetX;
    var z = gz - terrain.originOffsetZ;

    // Spawn protection near global origin
    var originDist = Math.sqrt(gx * gx + gz * gz);
    if (originDist < MIN_CENTER_DIST) continue;

    var h = sampleHeightmap(terrain, x, z);
    if (h < COAST_HEIGHT_MIN || h > COAST_HEIGHT_MAX) continue;

    // Ensure nearby land
    var hasLand = false;
    for (var la = 0; la < 8; la++) {
      var lAngle = la * Math.PI / 4;
      if (isHeightmapLand(terrain, x + Math.cos(lAngle) * 8, z + Math.sin(lAngle) * 8)) {
        hasLand = true;
        break;
      }
    }
    if (!hasLand) continue;

    // Ensure nearby water
    var hasWater = false;
    for (var wa = 0; wa < 8; wa++) {
      var wAngle = wa * Math.PI / 4;
      if (!isHeightmapLand(terrain, x + Math.cos(wAngle) * 8, z + Math.sin(wAngle) * 8)) {
        hasWater = true;
        break;
      }
    }
    if (!hasWater) continue;

    // Find best water angle
    var bestWaterAngle = 0;
    var bestWaterH = 999;
    for (var ba = 0; ba < 16; ba++) {
      var bAngle = ba * Math.PI / 8;
      var testH = sampleHeightmap(terrain, x + Math.cos(bAngle) * 6, z + Math.sin(bAngle) * 6);
      if (testH < bestWaterH) {
        bestWaterH = testH;
        bestWaterAngle = bAngle;
      }
    }

    // Nudge toward water
    x += Math.cos(bestWaterAngle) * PORT_WATER_NUDGE;
    z += Math.sin(bestWaterAngle) * PORT_WATER_NUDGE;

    // Validate against full terrain collision
    if (!hasWaterClearance(terrain, x, z, isLand)) {
      var rootWater = findDockCandidate(
        x, z, bestWaterAngle, 0,
        Math.max(PORT_DOCK_OFFSET, PORT_DOCK_MAX_OFFSET * 0.45), 1.5,
        function (rx, rz) { return hasWaterClearance(terrain, rx, rz, isLand); }
      );
      if (!rootWater) continue;
      x = rootWater.x;
      z = rootWater.z;
    }

    // Find dock candidate
    var dock = findDockCandidate(
      x, z, bestWaterAngle,
      Math.max(1, PORT_DOCK_OFFSET * 0.4), PORT_DOCK_MAX_OFFSET, 1.5,
      function (dx, dz) { return hasWaterClearance(terrain, dx, dz, isLand); }
    );
    if (!dock) continue;

    return { x: x, z: z, waterAngle: bestWaterAngle, dockX: dock.x, dockZ: dock.z };
  }

  return null;
}

// --- find coastline positions (legacy: near-origin search) ---
function findCoastlinePositions(terrain) {
  var positions = [];
  for (var attempt = 0; attempt < COAST_SEARCH_ATTEMPTS && positions.length < PORT_COUNT; attempt++) {
    // random position on map, avoiding edges
    var x = (nextRandom() - 0.5) * (MAP_HALF * 2 - 80);
    var z = (nextRandom() - 0.5) * (MAP_HALF * 2 - 80);

    // check distance from center
    var cdist = Math.sqrt(x * x + z * z);
    if (cdist < MIN_CENTER_DIST) continue;

    // sample terrain height — we want positions right at the coastline
    var h = sampleHeightmap(terrain, x, z);
    if (h < COAST_HEIGHT_MIN || h > COAST_HEIGHT_MAX) continue;

    // ensure there's land nearby (within 10 units in some direction)
    var hasLand = false;
    for (var a = 0; a < 8; a++) {
      var angle = a * Math.PI / 4;
      var checkX = x + Math.cos(angle) * 8;
      var checkZ = z + Math.sin(angle) * 8;
      if (isHeightmapLand(terrain, checkX, checkZ)) {
        hasLand = true;
        break;
      }
    }
    if (!hasLand) continue;

    // ensure there's water nearby (so ship can reach)
    var hasWater = false;
    for (var a = 0; a < 8; a++) {
      var angle = a * Math.PI / 4;
      var checkX = x + Math.cos(angle) * 8;
      var checkZ = z + Math.sin(angle) * 8;
      if (!isHeightmapLand(terrain, checkX, checkZ)) {
        hasWater = true;
        break;
      }
    }
    if (!hasWater) continue;

    // check spacing from existing ports
    var tooClose = false;
    for (var j = 0; j < positions.length; j++) {
      var dx = positions[j].x - x;
      var dz = positions[j].z - z;
      if (Math.sqrt(dx * dx + dz * dz) < MIN_PORT_SPACING) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;

    // nudge position slightly toward water for accessibility
    var bestWaterAngle = 0;
    var bestWaterH = 999;
    for (var a = 0; a < 16; a++) {
      var angle = a * Math.PI / 8;
      var testH = sampleHeightmap(terrain, x + Math.cos(angle) * 6, z + Math.sin(angle) * 6);
      if (testH < bestWaterH) {
        bestWaterH = testH;
        bestWaterAngle = angle;
      }
    }
    // nudge toward deepest water neighbor to reduce shoreline collision frustration
    x += Math.cos(bestWaterAngle) * PORT_WATER_NUDGE;
    z += Math.sin(bestWaterAngle) * PORT_WATER_NUDGE;

    // Validate against full terrain collision (not only heightmap) so docks don't clip into island meshes.
    if (!hasWaterClearance(terrain, x, z, isLand)) {
      var rootWater = findDockCandidate(
        x, z, bestWaterAngle,
        0,
        Math.max(PORT_DOCK_OFFSET, PORT_DOCK_MAX_OFFSET * 0.45),
        1.5,
        function (rx, rz) {
          return hasWaterClearance(terrain, rx, rz, isLand);
        }
      );
      if (!rootWater) continue;
      x = rootWater.x;
      z = rootWater.z;
    }

    var dock = findDockCandidate(
      x, z, bestWaterAngle,
      Math.max(1, PORT_DOCK_OFFSET * 0.4),
      PORT_DOCK_MAX_OFFSET,
      1.5,
      function (dx, dz) {
        return hasWaterClearance(terrain, dx, dz, isLand);
      }
    );
    var foundDock = !!dock;
    if (!foundDock) continue;

    positions.push({ x: x, z: z, waterAngle: bestWaterAngle, dockX: dock.x, dockZ: dock.z });
  }
  return positions;
}

function normalizeThemeKey(value) {
  if (typeof value !== "string") return null;
  var key = value.trim().toLowerCase();
  return key || null;
}

function parsePortFactionRole(entry) {
  if (typeof entry === "string") return normalizeThemeKey(entry);
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
  if (typeof entry.value === "string") return normalizeThemeKey(entry.value);
  if (typeof entry.variant === "string") return normalizeThemeKey(entry.variant);
  if (typeof entry.faction === "string") return normalizeThemeKey(entry.faction);
  if (typeof entry.key === "string") return normalizeThemeKey(entry.key);
  return null;
}

function normalizeRoleToken(value) {
  if (value === null || value === undefined) return null;
  var text = String(value).trim().toLowerCase();
  if (!text) return null;
  text = text.replace(/[^a-z0-9_\-]/g, "_");
  return text || null;
}

function getPortThemeKeys() {
  var roleKeys = getRoleVariants("port.factions");
  if (!roleKeys || !roleKeys.length) return PORT_THEME_ORDER;

  var keys = [];
  for (var i = 0; i < roleKeys.length; i++) {
    var key = parsePortFactionRole(roleKeys[i]);
    if (!key) continue;
    if (keys.indexOf(key) >= 0) continue;
    keys.push(key);
  }
  return keys.length ? keys : PORT_THEME_ORDER;
}

function pickPortThemeKey(fallbackKeys, fallbackIdx) {
  var picked = pickRoleVariant("port.factions", null, nextRandom);
  var weightedKey = parsePortFactionRole(picked);
  if (weightedKey) return weightedKey;
  if (!fallbackKeys || fallbackKeys.length === 0) return null;
  return fallbackKeys[fallbackIdx % fallbackKeys.length];
}

function getFallbackThemes(themeKey) {
  var themed = themeKey ? PORT_THEME_VARIANTS_BY_FACTION[themeKey] : null;
  return themed && themed.length ? themed : PORT_THEME_VARIANTS;
}

function hasWaterClearance(terrain, x, z, landTest) {
  if (landTest(terrain, x, z)) return false;
  for (var a = 0; a < 8; a++) {
    var angle = a * Math.PI / 4;
    var cx = x + Math.cos(angle) * PORT_DOCK_CLEAR_RADIUS;
    var cz = z + Math.sin(angle) * PORT_DOCK_CLEAR_RADIUS;
    if (landTest(terrain, cx, cz)) return false;
  }
  return true;
}

function findDockCandidate(baseX, baseZ, baseAngle, minDist, maxDist, step, isWaterTest) {
  var angleOffsets = [0, 0.35, -0.35, 0.7, -0.7, 1.05, -1.05];
  for (var dist = minDist; dist <= maxDist; dist += step) {
    for (var i = 0; i < angleOffsets.length; i++) {
      var angle = baseAngle + angleOffsets[i];
      var x = baseX + Math.cos(angle) * dist;
      var z = baseZ + Math.sin(angle) * dist;
      if (isWaterTest(x, z)) return { x: x, z: z };
    }
  }
  return null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function shuffledCopy(values) {
  if (!Array.isArray(values) || values.length <= 1) return Array.isArray(values) ? values.slice() : [];
  var out = values.slice();
  for (var i = out.length - 1; i > 0; i--) {
    var j = Math.floor(nextRandom() * (i + 1));
    var tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

function collectTrueIndices(flags) {
  var out = [];
  if (!Array.isArray(flags)) return out;
  for (var i = 0; i < flags.length; i++) {
    if (flags[i]) out.push(i);
  }
  return out;
}

function ensureMinimumSelection(flags, candidateIndices, minCount) {
  if (!Array.isArray(flags) || !Array.isArray(candidateIndices)) return;
  var target = Math.max(0, Math.floor(minCount || 0));
  if (!target) return;
  var selected = collectTrueIndices(flags).length;
  if (selected >= target) return;
  var shuffled = shuffledCopy(candidateIndices);
  for (var i = 0; i < shuffled.length && selected < target; i++) {
    var idx = shuffled[i];
    if (idx < 0 || idx >= flags.length) continue;
    if (flags[idx]) continue;
    flags[idx] = true;
    selected++;
  }
}

function trimSelection(flags, maxCount) {
  if (!Array.isArray(flags)) return;
  var limit = Math.max(0, Math.floor(maxCount || 0));
  var selected = collectTrueIndices(flags);
  if (selected.length <= limit) return;
  var shuffled = shuffledCopy(selected);
  for (var i = limit; i < shuffled.length; i++) {
    var idx = shuffled[i];
    if (idx >= 0 && idx < flags.length) flags[idx] = false;
  }
}

function getRoleDifficulty(roleContext) {
  if (!roleContext || roleContext.difficulty === undefined || roleContext.difficulty === null) return 1;
  var d = Number(roleContext.difficulty);
  if (!isFinite(d)) return 1;
  return Math.max(1, d);
}

function pickCityName(themeKey) {
  var key = normalizeThemeKey(themeKey) || "neutral";
  var pool = CITY_NAME_BY_THEME[key] || CITY_NAME_BY_THEME.neutral;
  if (!pool || !pool.length) return "Harbor City";
  var idx = Math.floor(nextRandom() * pool.length);
  if (idx < 0 || idx >= pool.length) idx = 0;
  return pool[idx];
}

function countLandNeighbors(terrain, x, z, radius) {
  var count = 0;
  for (var i = 0; i < 8; i++) {
    var a = i * Math.PI / 4;
    var nx = x + Math.cos(a) * radius;
    var nz = z + Math.sin(a) * radius;
    if (isHeightmapLand(terrain, nx, nz)) count++;
  }
  return count;
}

function countWaterNeighbors(terrain, x, z, radius) {
  var count = 0;
  for (var i = 0; i < 8; i++) {
    var a = i * Math.PI / 4;
    var nx = x + Math.cos(a) * radius;
    var nz = z + Math.sin(a) * radius;
    if (!isHeightmapLand(terrain, nx, nz)) count++;
  }
  return count;
}

function findCityAnchor(terrain, baseX, baseZ, waterAngle) {
  if (!terrain) return null;
  var landAngle = (waterAngle || 0) + Math.PI;
  var offsets = [0, 0.3, -0.3, 0.6, -0.6, 0.95, -0.95];
  var best = null;
  var bestScore = -Infinity;
  var fallback = null;
  for (var dist = CITY_ANCHOR_MIN_DIST; dist <= CITY_ANCHOR_MAX_DIST; dist += CITY_ANCHOR_STEP) {
    for (var i = 0; i < offsets.length; i++) {
      var a = landAngle + offsets[i];
      var x = baseX + Math.cos(a) * dist;
      var z = baseZ + Math.sin(a) * dist;
      if (!isHeightmapLand(terrain, x, z)) continue;
      var y = sampleHeightmap(terrain, x, z);
      var nearLand = countLandNeighbors(terrain, x, z, 3.6);
      var outerLand = countLandNeighbors(terrain, x, z, 6.6);
      var coastalWater = countWaterNeighbors(terrain, x, z, 9.2);

      if (!fallback) fallback = { x: x, y: y, z: z, angle: a };
      if (y < 0.05) continue;
      if (nearLand < 4) continue;
      if (coastalWater < 1 || coastalWater > 6) continue;

      var coastalBalance = Math.abs(3 - coastalWater);
      var score = nearLand * 2.0 + outerLand * 0.8 - coastalBalance * 0.7 + y * 3.5 - dist * 0.04;
      if (score > bestScore) {
        bestScore = score;
        best = { x: x, y: y, z: z, angle: a };
      }
    }
  }
  return best || fallback;
}

function buildCityBatteryMesh(isHostile) {
  var root = new THREE.Group();
  var base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7, 0.9, 1.2, 8),
    new THREE.MeshToonMaterial({ color: isHostile ? 0x6f3c2a : 0x666f7a })
  );
  base.position.y = 0.7;
  root.add(base);

  var turret = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.35, 1.6),
    new THREE.MeshToonMaterial({ color: isHostile ? 0x33231b : 0x334054 })
  );
  turret.position.y = 1.35;
  turret.position.z = 0.15;
  root.add(turret);

  var muzzle = new THREE.Object3D();
  muzzle.position.set(0, 1.35, 1.0);
  root.add(muzzle);

  var lamp = new THREE.PointLight(isHostile ? 0xff5533 : 0x88aaff, 0.8, 9);
  lamp.position.set(0, 2.1, -0.4);
  root.add(lamp);

  root.userData.cityBattery = {
    muzzle: muzzle,
    lamp: lamp
  };
  return root;
}

function removePlayerProjectile(weaponState, index, scene) {
  if (!weaponState || !weaponState.projectiles || index < 0 || index >= weaponState.projectiles.length) return;
  var p = weaponState.projectiles[index];
  if (!p) return;
  if (p.trail && p.trail.length) {
    for (var i = 0; i < p.trail.length; i++) {
      if (p.trail[i] && p.trail[i].mesh) scene.remove(p.trail[i].mesh);
    }
  }
  if (p.mesh) scene.remove(p.mesh);
  weaponState.projectiles.splice(index, 1);
}

function pointInShipOBB(px, pz, ship) {
  var dx = px - ship.posX;
  var dz = pz - ship.posZ;
  var cosH = Math.cos(ship.heading);
  var sinH = Math.sin(ship.heading);
  var localZ = dx * sinH + dz * cosH;
  var localX = dx * cosH - dz * sinH;
  var halfL = ship.hitHalfL || 1.5;
  var halfW = ship.hitHalfW || 0.9;
  return Math.abs(localZ) <= halfL && Math.abs(localX) <= halfW;
}

// --- build dock mesh ---
function buildPortMesh(themeKey, roleContext, cityMeta) {
  var group = new THREE.Group();

  // pier platform
  var pierGeo = new THREE.BoxGeometry(3, 0.4, 6);
  var pierMat = new THREE.MeshToonMaterial({ color: 0xa07a18 });
  var pier = new THREE.Mesh(pierGeo, pierMat);
  pier.position.set(0, 1.5, 0);
  pier.userData.portFallback = true;
  group.add(pier);

  // pilings (4 corner posts)
  var pilingGeo = new THREE.CylinderGeometry(0.15, 0.15, 3, 6);
  var pilingMat = new THREE.MeshToonMaterial({ color: 0x6a4a14 });
  var offsets = [[-1.2, -2.5], [1.2, -2.5], [-1.2, 2.5], [1.2, 2.5]];
  for (var i = 0; i < offsets.length; i++) {
    var piling = new THREE.Mesh(pilingGeo, pilingMat);
    piling.position.set(offsets[i][0], 0.2, offsets[i][1]);
    piling.userData.portFallback = true;
    group.add(piling);
  }

  // supply crate on pier
  var crateGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
  var crateMat = new THREE.MeshToonMaterial({ color: 0x44cc77 });
  var crate = new THREE.Mesh(crateGeo, crateMat);
  crate.position.set(0.5, 2.1, 1.0);
  crate.userData.portFallback = true;
  group.add(crate);

  // barrel on pier
  var barrelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.7, 8);
  var barrelMat = new THREE.MeshToonMaterial({ color: 0x2299ee });
  var barrel = new THREE.Mesh(barrelGeo, barrelMat);
  barrel.position.set(-0.6, 2.05, -0.8);
  barrel.userData.portFallback = true;
  group.add(barrel);

  // glow light (green when available, grey when on cooldown)
  var light = new THREE.PointLight(0x44ff88, 1.5, 15);
  light.position.set(0, 3, 0);
  group.add(light);

  // beacon post
  var postGeo = new THREE.CylinderGeometry(0.08, 0.08, 2, 6);
  var postMat = new THREE.MeshToonMaterial({ color: 0x999999 });
  var post = new THREE.Mesh(postGeo, postMat);
  post.position.set(1.2, 2.5, -2.5);
  group.add(post);

  // beacon lamp
  var lampGeo = new THREE.SphereGeometry(0.2, 8, 8);
  var lampMat = new THREE.MeshBasicMaterial({ color: 0x44ff88 });
  var lamp = new THREE.Mesh(lampGeo, lampMat);
  lamp.position.set(1.2, 3.6, -2.5);
  group.add(lamp);

  group.userData.light = light;
  group.userData.lamp = lamp;
  group.userData.lampMat = lampMat;
  group.userData.themeKey = themeKey || "neutral";
  group.userData.isCity = !!(cityMeta && cityMeta.isCity);
  group.userData.hostileCity = !!(cityMeta && cityMeta.hostile);
  group.userData.cityName = cityMeta && cityMeta.name ? cityMeta.name : null;

  // async GLB dock dressing; keep primitive base as resilient fallback
  hydratePortVisual(group, themeKey, roleContext);
  if (cityMeta && cityMeta.isCity) {
    hydrateCityVisual(group, themeKey, cityMeta);
  }

  return group;
}

function pickPortTheme(themeKey, roleContext) {
  var normalizedKey = normalizeThemeKey(themeKey);
  var themedKey = normalizedKey ? "port.themes." + normalizedKey : null;
  var zoneId = roleContext ? normalizeRoleToken(roleContext.zoneId || roleContext.id) : null;
  var condition = roleContext ? normalizeRoleToken(roleContext.condition) : null;
  var difficulty = roleContext ? normalizeRoleToken(roleContext.difficulty) : null;
  var storyRegion = roleContext ? normalizeRoleToken(roleContext.storyRegion || roleContext.region) : null;
  var encounterType = roleContext ? normalizeRoleToken(roleContext.encounterType || roleContext.nodeType) : null;
  var candidates = [];
  if (themedKey) {
    if (zoneId) candidates.push(themedKey + ".zone." + zoneId);
    if (condition) candidates.push(themedKey + ".condition." + condition);
    if (difficulty) candidates.push(themedKey + ".difficulty." + difficulty);
    if (storyRegion) candidates.push(themedKey + ".storyregion." + storyRegion);
    if (encounterType) candidates.push(themedKey + ".encounter." + encounterType);
  }
  if (zoneId) candidates.push("port.themes.zone." + zoneId);
  if (condition) candidates.push("port.themes.condition." + condition);
  if (difficulty) candidates.push("port.themes.difficulty." + difficulty);
  if (storyRegion) candidates.push("port.themes.storyregion." + storyRegion);
  if (encounterType) candidates.push("port.themes.encounter." + encounterType);

  for (var i = 0; i < candidates.length; i++) {
    var contextualPick = pickRoleVariant(candidates[i], null, nextRandom);
    if (contextualPick) return contextualPick;
  }

  var modules = themedKey ? pickRoleVariant(themedKey, null, nextRandom) : null;
  if (!modules) modules = pickRoleVariant("port.themes", null, nextRandom);
  if (modules) return modules;

  var fallback = getFallbackThemes(normalizedKey);
  var idx = Math.floor(nextRandom() * fallback.length);
  if (idx < 0 || idx >= fallback.length) idx = 0;
  return fallback[idx];
}

function hydratePortVisual(group, themeKey, roleContext) {
  var modules = pickPortTheme(themeKey, roleContext);
  if (!Array.isArray(modules) || modules.length === 0) return;
  var visualRoot = new THREE.Group();
  group.add(visualRoot);

  var fallbackHidden = false;
  for (var i = 0; i < modules.length; i++) {
    (function (mod) {
      // Keep full mesh topology for port kits; budget decimation can punch visible holes.
      loadGlbVisual(mod.path, mod.fit, true, { noDecimate: true })
        .then(function (obj) {
          if (!fallbackHidden) {
            fallbackHidden = true;
            group.traverse(function (child) {
              if (child.isMesh && child.userData && child.userData.portFallback) {
                child.visible = false;
              }
            });
          }
          obj.position.set(mod.x || 0, mod.y || 0, mod.z || 0);
          obj.rotation.y = mod.ry || 0;
          visualRoot.add(obj);
        })
        .catch(function () {
          // keep primitive fallback visuals if GLB fails
        });
    })(modules[i]);
  }
}

function hydrateCityVisual(group, themeKey, cityMeta) {
  if (!group || !cityMeta) return;
  var key = normalizeThemeKey(themeKey) || "neutral";
  var modules = CITY_MODULES_BY_THEME[key] || CITY_MODULES_BY_THEME.neutral;
  if (!modules || !modules.length) return;

  var cityRoot = new THREE.Group();
  cityRoot.position.set(cityMeta.localX || 0, cityMeta.localY || 0, cityMeta.localZ || 0);
  cityRoot.rotation.y = (cityMeta.landAngle || 0) - Math.PI * 0.5;
  group.add(cityRoot);

  for (var i = 0; i < modules.length; i++) {
    (function (mod) {
      loadGlbVisual(mod.path, mod.fit, true, { noDecimate: true })
        .then(function (obj) {
          obj.position.set(mod.x || 0, mod.y || 0, mod.z || 0);
          obj.rotation.y = mod.ry || 0;
          cityRoot.add(obj);
        })
        .catch(function () {
          // city visuals are decorative only
        });
    })(modules[i]);
  }

  // Simple wall ring fallback to communicate city footprint.
  var wallMat = new THREE.MeshToonMaterial({ color: cityMeta.hostile ? 0x7b3525 : 0x506a7b });
  for (var w = 0; w < 6; w++) {
    var wall = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.2, 0.6), wallMat);
    var wa = (w / 6) * Math.PI * 2;
    wall.position.set(Math.cos(wa) * 5.0, 1.1, Math.sin(wa) * 5.0);
    wall.rotation.y = wa;
    cityRoot.add(wall);
  }
}

// --- port manager ---
export function createPortManager() {
  ensureAssetRoles();
  return {
    ports: [],
    cityProjectiles: [],
    cityWarningTimer: 0,
    cityEvents: [],
    initialized: false
  };
}

// --- initialize ports for a zone (chunk-aware) ---
export function initPorts(manager, terrain, scene, roleContext) {
  clearPorts(manager, scene);

  // Store references for chunk lifecycle hooks
  manager._terrain = terrain;
  manager._scene = scene;
  manager._roleContext = roleContext;

  // Set up terrain lifecycle hooks for dynamic port spawning
  if (terrain) {
    terrain.onChunkReady = function (chunk) {
      trySpawnChunkPort(manager, chunk, terrain, scene, roleContext);
    };
    terrain.onChunkDispose = function (chunk) {
      removeChunkPort(manager, chunk.key, scene);
    };
    terrain.onOriginShift = function (shiftX, shiftZ) {
      shiftPortPositions(manager, shiftX, shiftZ);
    };
  }

  // Spawn ports for already-active chunks
  if (terrain && terrain.chunks) {
    terrain.chunks.forEach(function (chunk) {
      if (!chunk || chunk.state !== "active" || !chunk.ready) return;
      trySpawnChunkPort(manager, chunk, terrain, scene, roleContext);
    });
  }

  manager.initialized = true;
}

// --- spawn a port deterministically for a single chunk ---
export function trySpawnChunkPort(manager, chunk, terrain, scene, roleContext) {
  if (!manager || !chunk || !terrain || !scene) return;
  if (chunk.port !== undefined) return; // already checked this chunk

  var worldSeed = chunk.worldSeed || 0;
  var portSeed = hashInt3Port(worldSeed, chunk.cx ^ 0x504F, chunk.cy ^ 0x5254);
  var rng = seededRandPort(portSeed);

  // Deterministic port chance
  if (rng() >= PORT_CHUNK_CHANCE) {
    chunk.port = null;
    return;
  }

  var pos = findChunkCoastlinePosition(chunk, terrain, rng);
  if (!pos) {
    chunk.port = null;
    return;
  }

  // Check spacing from existing ports
  for (var j = 0; j < manager.ports.length; j++) {
    var ep = manager.ports[j];
    var edx = ep.posX - pos.x;
    var edz = ep.posZ - pos.z;
    if (Math.sqrt(edx * edx + edz * edz) < MIN_PORT_SPACING) {
      chunk.port = null;
      return;
    }
  }

  // Determine theme and city properties via seeded RNG
  var themeKeys = getPortThemeKeys();
  var themeIdx = Math.floor(rng() * themeKeys.length);
  var themeKey = themeKeys[themeIdx] || "neutral";
  var difficulty = getRoleDifficulty(roleContext);
  var hostileChance = clamp(PORT_CITY_HOSTILE_BASE + (difficulty - 1) * PORT_CITY_HOSTILE_STEP, 0.15, 0.9);

  var cityAnchor = findCityAnchor(terrain, pos.x, pos.z, pos.waterAngle);
  var isCity = !!cityAnchor && rng() < PORT_CITY_CHANCE;
  var hostileCity = isCity && rng() < hostileChance;

  // Distance-based difficulty: further from origin = more hostile
  var globalX = pos.x + terrain.originOffsetX;
  var globalZ = pos.z + terrain.originOffsetZ;
  var distFromOrigin = Math.sqrt(globalX * globalX + globalZ * globalZ);
  if (isCity && !hostileCity && distFromOrigin > 1000) {
    var distFactor = Math.min(1, (distFromOrigin - 1000) / 5000);
    if (rng() < distFactor * 0.4) hostileCity = true;
  }

  var cityMeta = null;
  if (isCity && cityAnchor) {
    cityMeta = {
      isCity: true,
      hostile: hostileCity,
      name: pickCityName(themeKey),
      localX: cityAnchor.x - pos.x,
      localY: cityAnchor.y || 0,
      localZ: cityAnchor.z - pos.z,
      landAngle: cityAnchor.angle
    };
  }

  var mesh = buildPortMesh(themeKey, roleContext, cityMeta);
  mesh.position.set(pos.x, 0, pos.z);
  scene.add(mesh);

  var port = {
    mesh: mesh,
    posX: pos.x,
    posZ: pos.z,
    dockX: pos.dockX,
    dockZ: pos.dockZ,
    dockRefreshTimer: 0,
    waterAngle: pos.waterAngle,
    themeKey: themeKey || "neutral",
    cooldown: 0,
    available: !hostileCity,
    isCity: isCity,
    hostileCity: hostileCity,
    cityPacified: false,
    cityName: cityMeta ? cityMeta.name : null,
    cityAnchorX: isCity && cityAnchor ? cityAnchor.x : pos.x,
    cityAnchorY: isCity && cityAnchor ? (cityAnchor.y || 0) : 0,
    cityAnchorZ: isCity && cityAnchor ? cityAnchor.z : pos.z,
    batteries: [],
    chunkKey: chunk.key
  };

  if (isCity) {
    port.batteries = createCityBatteries(port, terrain);
    for (var bi = 0; bi < port.batteries.length; bi++) {
      mesh.add(port.batteries[bi].mesh);
    }
  }

  manager.ports.push(port);
  chunk.port = port;
}

// --- remove port when its chunk is GC'd ---
export function removeChunkPort(manager, chunkKey, scene) {
  if (!manager || !manager.ports) return;
  for (var i = manager.ports.length - 1; i >= 0; i--) {
    var port = manager.ports[i];
    if (port.chunkKey !== chunkKey) continue;
    // Remove city projectiles associated with this port
    for (var cp = manager.cityProjectiles.length - 1; cp >= 0; cp--) {
      if (manager.cityProjectiles[cp] && manager.cityProjectiles[cp].port === port) {
        if (manager.cityProjectiles[cp].mesh) scene.remove(manager.cityProjectiles[cp].mesh);
        manager.cityProjectiles.splice(cp, 1);
      }
    }
    if (port.mesh) scene.remove(port.mesh);
    manager.ports.splice(i, 1);
  }
}

// --- shift port positions when terrain origin shifts ---
export function shiftPortPositions(manager, shiftX, shiftZ) {
  if (!manager || !manager.ports) return;
  for (var i = 0; i < manager.ports.length; i++) {
    var port = manager.ports[i];
    port.posX -= shiftX;
    port.posZ -= shiftZ;
    if (port.mesh) {
      port.mesh.position.x -= shiftX;
      port.mesh.position.z -= shiftZ;
    }
    if (port.dockX !== undefined) {
      port.dockX -= shiftX;
      port.dockZ -= shiftZ;
    }
    port.cityAnchorX -= shiftX;
    port.cityAnchorZ -= shiftZ;
  }
  // Shift city projectiles
  for (var j = 0; j < manager.cityProjectiles.length; j++) {
    var cp = manager.cityProjectiles[j];
    if (cp && cp.mesh) {
      cp.mesh.position.x -= shiftX;
      cp.mesh.position.z -= shiftZ;
    }
    if (cp && cp.origin) {
      cp.origin.x -= shiftX;
      cp.origin.z -= shiftZ;
    }
  }
}

function getPortTarget(port) {
  if (!port) return { x: 0, z: 0 };
  return {
    x: port.dockX !== undefined ? port.dockX : port.posX,
    z: port.dockZ !== undefined ? port.dockZ : port.posZ
  };
}

function refreshPortDockTarget(port, terrain) {
  if (!port || !terrain) return;
  var current = getPortTarget(port);
  if (hasWaterClearance(terrain, current.x, current.z, isLand)) return;

  var dock = findDockCandidate(
    port.posX,
    port.posZ,
    port.waterAngle || 0,
    Math.max(1, PORT_DOCK_OFFSET * 0.35),
    PORT_DOCK_MAX_OFFSET,
    1.25,
    function (x, z) {
      return hasWaterClearance(terrain, x, z, isLand);
    }
  );
  if (!dock) return;
  port.dockX = dock.x;
  port.dockZ = dock.z;
}

function createCityBatteries(port, terrain) {
  var out = [];
  if (!port || !port.isCity) return out;
  var count = CITY_BATTERY_COUNT_MIN + Math.floor(nextRandom() * (CITY_BATTERY_COUNT_MAX - CITY_BATTERY_COUNT_MIN + 1));
  var seaAngle = port.waterAngle || 0;

  function resolveBatteryAnchor(preferredX, preferredZ, fallbackX, fallbackZ) {
    if (!terrain) return { x: preferredX, y: 0, z: preferredZ };
    var rings = [0, 1.0, 2.0, 3.2];
    for (var r = 0; r < rings.length; r++) {
      var radius = rings[r];
      for (var a = 0; a < 10; a++) {
        var angle = (a / 10) * Math.PI * 2;
        var x = preferredX + Math.cos(angle) * radius;
        var z = preferredZ + Math.sin(angle) * radius;
        if (!isHeightmapLand(terrain, x, z)) continue;
        var h = sampleHeightmap(terrain, x, z);
        if (h < 0.03) continue;
        return { x: x, y: h, z: z };
      }
    }
    if (isHeightmapLand(terrain, fallbackX, fallbackZ)) {
      return { x: fallbackX, y: sampleHeightmap(terrain, fallbackX, fallbackZ), z: fallbackZ };
    }
    return { x: preferredX, y: Math.max(0, sampleHeightmap(terrain, preferredX, preferredZ)), z: preferredZ };
  }

  for (var i = 0; i < count; i++) {
    var spread = (i - (count - 1) * 0.5) * 0.45;
    var dist = 3.4 + nextRandom() * 2.6;
    var wx = port.cityAnchorX + Math.cos(seaAngle + spread) * dist;
    var wz = port.cityAnchorZ + Math.sin(seaAngle + spread) * dist;
    var fallbackX = port.cityAnchorX - Math.cos(seaAngle) * (2.5 + nextRandom() * 2.0);
    var fallbackZ = port.cityAnchorZ - Math.sin(seaAngle) * (2.5 + nextRandom() * 2.0);
    var anchor = resolveBatteryAnchor(wx, wz, fallbackX, fallbackZ);

    var mesh = buildCityBatteryMesh(port.hostileCity);
    mesh.position.set(anchor.x - port.posX, (anchor.y || 0) + 0.05, anchor.z - port.posZ);
    mesh.rotation.y = seaAngle + spread;
    out.push({
      mesh: mesh,
      hp: CITY_BATTERY_HP,
      maxHp: CITY_BATTERY_HP,
      alive: true,
      hitRadius: CITY_BATTERY_HIT_RADIUS,
      fireTimer: CITY_GUN_FIRE_COOLDOWN_MIN + nextRandom() * (CITY_GUN_FIRE_COOLDOWN_MAX - CITY_GUN_FIRE_COOLDOWN_MIN)
    });
  }
  return out;
}

function countAliveBatteries(port) {
  if (!port || !port.batteries) return 0;
  var alive = 0;
  for (var i = 0; i < port.batteries.length; i++) {
    if (port.batteries[i] && port.batteries[i].alive) alive++;
  }
  return alive;
}

function getBatteryWorldPosition(battery, out) {
  var target = out || new THREE.Vector3();
  if (!battery || !battery.mesh) {
    target.set(0, 0, 0);
    return target;
  }
  battery.mesh.getWorldPosition(target);
  return target;
}

function getBatteryMuzzleWorldPosition(battery, out) {
  var target = out || new THREE.Vector3();
  if (!battery || !battery.mesh) {
    target.set(0, 0, 0);
    return target;
  }
  var muzzle = battery.mesh.userData && battery.mesh.userData.cityBattery
    ? battery.mesh.userData.cityBattery.muzzle
    : null;
  if (muzzle && muzzle.getWorldPosition) {
    muzzle.getWorldPosition(target);
  } else {
    battery.mesh.getWorldPosition(target);
    target.y += 1.1;
  }
  return target;
}

function removeCityProjectile(manager, idx, scene) {
  if (!manager || !manager.cityProjectiles || idx < 0 || idx >= manager.cityProjectiles.length) return;
  var p = manager.cityProjectiles[idx];
  if (p && p.mesh) scene.remove(p.mesh);
  manager.cityProjectiles.splice(idx, 1);
}

function spawnCityProjectile(manager, port, battery, ship, scene) {
  if (!manager || !port || !battery || !ship || !scene) return;
  var muzzle = getBatteryMuzzleWorldPosition(battery, new THREE.Vector3());
  var dx = ship.posX - muzzle.x;
  var dz = ship.posZ - muzzle.z;
  var dist = Math.sqrt(dx * dx + dz * dz);
  if (dist < 0.1) return;

  var dirX = dx / dist;
  var dirZ = dz / dist;
  var velocity = new THREE.Vector3(
    dirX * CITY_PROJECTILE_SPEED,
    CITY_PROJECTILE_SPEED * 0.08,
    dirZ * CITY_PROJECTILE_SPEED
  );

  var mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 9, 7),
    new THREE.MeshBasicMaterial({ color: 0xffb066, transparent: true, opacity: 0.92, depthWrite: false })
  );
  mesh.renderOrder = 4;
  mesh.position.copy(muzzle);
  scene.add(mesh);
  manager.cityProjectiles.push({
    mesh: mesh,
    velocity: velocity,
    origin: muzzle.clone(),
    age: 0,
    port: port,
    damage: CITY_PROJECTILE_DAMAGE
  });

  var lamp = battery.mesh.userData && battery.mesh.userData.cityBattery
    ? battery.mesh.userData.cityBattery.lamp
    : null;
  if (lamp) lamp.intensity = 1.8;
}

function updateCityProjectiles(manager, ship, enemyMgr, dt, scene, terrain) {
  if (!manager || !manager.cityProjectiles || manager.cityProjectiles.length === 0) return;
  var alive = [];
  for (var i = 0; i < manager.cityProjectiles.length; i++) {
    var p = manager.cityProjectiles[i];
    if (!p || !p.mesh) continue;
    p.age += dt;

    var prevX = p.mesh.position.x;
    var prevZ = p.mesh.position.z;
    p.velocity.y -= CITY_PROJECTILE_GRAVITY * dt;
    p.mesh.position.x += p.velocity.x * dt;
    p.mesh.position.y += p.velocity.y * dt;
    p.mesh.position.z += p.velocity.z * dt;

    var dx = p.mesh.position.x - p.origin.x;
    var dz = p.mesh.position.z - p.origin.z;
    var dist = Math.sqrt(dx * dx + dz * dz);
    var hitWater = p.mesh.position.y < 0.2;
    var hitTerrain = terrain && isLand(terrain, p.mesh.position.x, p.mesh.position.z);
    var outOfRange = dist > CITY_PROJECTILE_MAX_RANGE;

    var hitShip = false;
    var segDx = p.mesh.position.x - prevX;
    var segDz = p.mesh.position.z - prevZ;
    var segLen = Math.sqrt(segDx * segDx + segDz * segDz);
    var steps = Math.max(1, Math.ceil(segLen / 0.5));
    for (var si = 0; si <= steps; si++) {
      var t = si / steps;
      var sx = prevX + (p.mesh.position.x - prevX) * t;
      var sz = prevZ + (p.mesh.position.z - prevZ) * t;
      if (pointInShipOBB(sx, sz, ship)) {
        hitShip = true;
        if (enemyMgr) {
          var armor = enemyMgr.playerArmor || 0;
          var incoming = Math.max(0.1, p.damage * (1 - armor));
          enemyMgr.playerHp = Math.max(0, enemyMgr.playerHp - incoming);
        }
        break;
      }
    }

    if (hitWater || hitTerrain || outOfRange || hitShip) {
      scene.remove(p.mesh);
      continue;
    }
    alive.push(p);
  }
  manager.cityProjectiles = alive;
}

function processCityBatteryHits(manager, port, weaponState, scene, upgrades) {
  if (!port || !port.hostileCity || !port.batteries || !weaponState || !scene) return;
  for (var pi = weaponState.projectiles.length - 1; pi >= 0; pi--) {
    var proj = weaponState.projectiles[pi];
    if (!proj || !proj.mesh) continue;
    var px = proj.mesh.position.x;
    var pz = proj.mesh.position.z;
    var hit = false;
    for (var bi = 0; bi < port.batteries.length; bi++) {
      var battery = port.batteries[bi];
      if (!battery || !battery.alive || !battery.mesh) continue;
      var bPos = getBatteryWorldPosition(battery, new THREE.Vector3());
      var dx = px - bPos.x;
      var dz = pz - bPos.z;
      if (dx * dx + dz * dz > CITY_BATTERY_HIT_RADIUS * CITY_BATTERY_HIT_RADIUS) continue;

      var damage = Math.max(1, Math.round(proj.damageMult || 1));
      battery.hp -= damage;
      removePlayerProjectile(weaponState, pi, scene);
      hit = true;
      if (battery.hp <= 0) {
        battery.alive = false;
        battery.mesh.visible = false;
        if (upgrades) upgrades.gold += CITY_BATTERY_BONUS;
        if (manager.cityEvents) {
          manager.cityEvents.push({
            type: "city_battery_destroyed",
            cityName: port.cityName || "Harbor City",
            rewardGold: CITY_BATTERY_BONUS
          });
        }
      }
      break;
    }
    if (hit) continue;
  }

  if (port.hostileCity && countAliveBatteries(port) <= 0) {
    port.hostileCity = false;
    port.cityPacified = true;
    port.available = true;
    port.cooldown = 0;
    if (port.mesh && port.mesh.userData) port.mesh.userData.hostileCity = false;
    if (upgrades) upgrades.gold += CITY_CAPTURE_BONUS;
    if (port.mesh && port.mesh.userData && port.mesh.userData.light) {
      port.mesh.userData.light.color.setHex(0x44ff88);
      port.mesh.userData.light.intensity = 1.2;
    }
    if (port.mesh && port.mesh.userData && port.mesh.userData.lampMat) {
      port.mesh.userData.lampMat.color.setHex(0x44ff88);
    }
    if (manager.cityEvents) {
      manager.cityEvents.push({
        type: "city_pacified",
        cityName: port.cityName || "Harbor City",
        rewardGold: CITY_CAPTURE_BONUS
      });
    }
  }
}

function updateCityBatteries(manager, port, ship, dt, scene, terrain) {
  if (!port || !port.hostileCity || !port.batteries || !port.batteries.length) return;
  for (var i = 0; i < port.batteries.length; i++) {
    var battery = port.batteries[i];
    if (!battery || !battery.alive || !battery.mesh) continue;
    var bPos = getBatteryWorldPosition(battery, new THREE.Vector3());
    var dx = ship.posX - bPos.x;
    var dz = ship.posZ - bPos.z;
    var dist = Math.sqrt(dx * dx + dz * dz);

    var targetYaw = Math.atan2(dx, dz);
    var curYaw = battery.mesh.rotation.y;
    var yawDiff = targetYaw - curYaw;
    while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
    while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
    var maxTurn = dt * 1.8;
    if (Math.abs(yawDiff) <= maxTurn) battery.mesh.rotation.y = targetYaw;
    else battery.mesh.rotation.y += Math.sign(yawDiff) * maxTurn;

    var lamp = battery.mesh.userData && battery.mesh.userData.cityBattery
      ? battery.mesh.userData.cityBattery.lamp
      : null;
    if (lamp) {
      lamp.color.setHex(0xff5533);
      lamp.intensity = 0.45 + Math.sin(Date.now() * 0.004 + i) * 0.2;
    }

    battery.fireTimer -= dt;
    var muzzlePos = getBatteryMuzzleWorldPosition(battery, new THREE.Vector3());
    var hasLOS = !terrain || !terrainBlocksLine(terrain, muzzlePos.x, muzzlePos.z, ship.posX, ship.posZ);
    var closeRange = dist <= CITY_GUN_IGNORE_LOS_RANGE;
    if (battery.fireTimer <= 0 && dist <= CITY_GUN_RANGE && (hasLOS || closeRange)) {
      spawnCityProjectile(manager, port, battery, ship, scene);
      battery.fireTimer = CITY_GUN_FIRE_COOLDOWN_MIN + nextRandom() * (CITY_GUN_FIRE_COOLDOWN_MAX - CITY_GUN_FIRE_COOLDOWN_MIN);
    }
  }
}

// --- clear all ports ---
export function clearPorts(manager, scene) {
  if (!manager) return;
  for (var cp = 0; cp < manager.cityProjectiles.length; cp++) {
    if (manager.cityProjectiles[cp] && manager.cityProjectiles[cp].mesh) {
      scene.remove(manager.cityProjectiles[cp].mesh);
    }
  }
  manager.cityProjectiles = [];
  manager.cityWarningTimer = 0;
  manager.cityEvents = [];
  for (var i = 0; i < manager.ports.length; i++) {
    scene.remove(manager.ports[i].mesh);
  }
  manager.ports = [];
  manager.initialized = false;
}

// --- update ports: check proximity, tick cooldowns, update visuals ---
export function updatePorts(manager, ship, resources, enemyMgr, dt, upgrades, classKey, terrain, scene, weaponState) {
  if (!manager) return;
  manager.cityWarningTimer = Math.max(0, (manager.cityWarningTimer || 0) - dt);

  for (var i = 0; i < manager.ports.length; i++) {
    var port = manager.ports[i];
    if (!port) continue;

    if (scene && weaponState && port.hostileCity) {
      processCityBatteryHits(manager, port, weaponState, scene, upgrades);
    }

    port.dockRefreshTimer = (port.dockRefreshTimer || 0) - dt;
    if (port.dockRefreshTimer <= 0) {
      refreshPortDockTarget(port, terrain);
      port.dockRefreshTimer = PORT_DOCK_REFRESH;
    }

    // tick cooldown
    if (!port.hostileCity && port.cooldown > 0) {
      port.cooldown -= dt;
      if (port.cooldown <= 0) {
        port.cooldown = 0;
        port.available = true;
      }
    }

    if (port.hostileCity && scene) {
      updateCityBatteries(manager, port, ship, dt, scene, terrain);
      var cityDx = ship.posX - port.cityAnchorX;
      var cityDz = ship.posZ - port.cityAnchorZ;
      var cityDist = Math.sqrt(cityDx * cityDx + cityDz * cityDz);
      if (cityDist < CITY_WARNING_RADIUS && manager.cityWarningTimer <= 0) {
        manager.cityWarningTimer = CITY_WARNING_COOLDOWN;
        if (manager.cityEvents) {
          manager.cityEvents.push({
            type: "city_warning",
            cityName: port.cityName || "Harbor City"
          });
        }
      }
    }

    // check proximity for resupply
    if (port.available && !port.hostileCity) {
      var target = getPortTarget(port);
      var dx = ship.posX - target.x;
      var dz = ship.posZ - target.z;
      var distSq = dx * dx + dz * dz;

      if (distSq < PORT_COLLECT_RADIUS * PORT_COLLECT_RADIUS) {
        // resupply ammo + fuel (free)
        addAmmo(resources, PORT_AMMO_RESTOCK);
        addFuel(resources, PORT_FUEL_RESTOCK);
        // repair: costs gold based on ship class, only if damaged and can afford
        var hpInfo = { hp: enemyMgr.playerHp, maxHp: enemyMgr.playerMaxHp };
        if (hpInfo.hp < hpInfo.maxHp && upgrades) {
          var repairCost = getRepairCost(classKey);
          if (upgrades.gold >= repairCost) {
            upgrades.gold -= repairCost;
            var newHp = Math.min(hpInfo.maxHp, hpInfo.hp + PORT_HP_RESTOCK);
            enemyMgr.playerHp = newHp;
          }
        }
        // start cooldown
        port.cooldown = PORT_COOLDOWN;
        port.available = false;
        console.log("[PORT] Resupplied at port " + i);
      }
    }

    // update visuals: green glow when available, dim grey on cooldown
    var light = port.mesh.userData.light;
    var lamp = port.mesh.userData.lamp;
    var lampMat = port.mesh.userData.lampMat;

    if (port.hostileCity) {
      light.color.setHex(0xaa3322);
      light.intensity = 0.9 + Math.sin(Date.now() * 0.004 + i) * 0.35;
      lampMat.color.setHex(0xaa3322);
    } else if (port.available) {
      light.color.setHex(0x44ff88);
      light.intensity = 1.5 + Math.sin(Date.now() * 0.003) * 0.5;
      lampMat.color.setHex(0x44ff88);
    } else {
      // cooldown: dim red/grey, pulse slowly
      var cdRatio = port.cooldown / PORT_COOLDOWN;
      light.color.setHex(0x884422);
      light.intensity = 0.3 + cdRatio * 0.2;
      lampMat.color.setHex(0x884422);
    }
  }

  if (scene) {
    updateCityProjectiles(manager, ship, enemyMgr, dt, scene, terrain);
  }
}

// --- get port info for HUD ---
export function getPortsInfo(manager, ship) {
  var nearest = null;
  var nearestDist = Infinity;
  for (var i = 0; i < manager.ports.length; i++) {
    var port = manager.ports[i];
    var target = getPortTarget(port);
    var dx = ship.posX - target.x;
    var dz = ship.posZ - target.z;
    var dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = port;
    }
  }
  if (!nearest) return null;
  var label = "PORT";
  if (nearest.isCity && nearest.hostileCity) label = "HOSTILE CITY";
  else if (nearest.isCity) label = "CITY PORT";
  return {
    dist: nearestDist,
    available: nearest.available,
    cooldown: nearest.cooldown,
    maxCooldown: PORT_COOLDOWN,
    isCity: !!nearest.isCity,
    hostile: !!nearest.hostileCity,
    cityName: nearest.cityName || null,
    label: label
  };
}

export function consumeCityEvents(manager) {
  if (!manager || !manager.cityEvents || manager.cityEvents.length === 0) return [];
  var out = manager.cityEvents.slice();
  manager.cityEvents.length = 0;
  return out;
}
