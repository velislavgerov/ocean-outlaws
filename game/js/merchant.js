// merchant.js — ambient merchant ships: trade routes, convoys, zone-scaled spawning
import { isLand } from "./terrain.js";
import { nextRandom } from "./rng.js";
import { spawnAmbientEnemy } from "./enemy.js";

// --- constants ---
var SPAWN_INTERVAL_BASE = 25;    // seconds between spawn checks
var SPAWN_INTERVAL_MIN = 12;     // minimum interval at high-difficulty zones
var MAX_MERCHANTS = 6;           // concurrent ambient merchants (includes escorts)
var MERCHANT_LIFETIME = 120;     // seconds before off-map despawn
var SPEED_RATIO_MIN = 0.5;       // merchant speed as fraction of player max
var SPEED_RATIO_MAX = 0.7;
var FLEE_SPEED_RATIO = 0.85;     // flee speed fraction — always < player speed
var SPEED_FLOOR = 4;             // minimum speed so slow-ship encounters are interesting
var CONVOY_CHANCE = 0.2;         // 20% chance a spawn is a convoy
var CONVOY_SIZE_MIN = 2;
var CONVOY_SIZE_MAX = 3;
var ESCORT_FACTION = "navy";
var MAP_HALF = 200;
var TRADE_ROUTE_MARGIN = 30;     // inset from map edge for spawn/destination points
var DESPAWN_MARGIN = 15;         // extra buffer past map edge before despawn

// --- edge helpers ---
// Returns a point on the given edge (0=north, 1=east, 2=south, 3=west).
// t is 0..1 along the edge.
function edgePoint(edge, t) {
  var margin = TRADE_ROUTE_MARGIN;
  var limit = MAP_HALF - margin;
  switch (edge) {
    case 0: return { x: -limit + t * limit * 2, z: -MAP_HALF + margin }; // north
    case 1: return { x:  MAP_HALF - margin,      z: -limit + t * limit * 2 }; // east
    case 2: return { x: -limit + t * limit * 2, z:  MAP_HALF - margin }; // south
    case 3: return { x: -MAP_HALF + margin,      z: -limit + t * limit * 2 }; // west
    default: return { x: 0, z: 0 };
  }
}

function oppositeEdge(edge) {
  return (edge + 2) % 4;
}

// Pick a spawn point on an edge avoiding land.
function pickEdgeSpawn(edge, terrain) {
  for (var attempt = 0; attempt < 20; attempt++) {
    var pt = edgePoint(edge, nextRandom());
    if (!terrain || !isLand(terrain, pt.x, pt.z)) return pt;
  }
  return null;
}

// --- manager ---
export function createMerchantManager() {
  return {
    merchants: [],          // refs to ambient enemy objects (subset of enemyMgr.enemies)
    spawnTimer: SPAWN_INTERVAL_BASE * 0.5,  // first spawn sooner
    playerMaxSpeed: 10
  };
}

export function setMerchantPlayerSpeed(mgr, speed) {
  mgr.playerMaxSpeed = speed || 10;
}

export function getMerchantCount(mgr) {
  var count = 0;
  for (var i = 0; i < mgr.merchants.length; i++) {
    if (mgr.merchants[i].alive && !mgr.merchants[i].sinking) count++;
  }
  return count;
}

// --- spawn a merchant group (solo or convoy) ---
function spawnMerchantGroup(mgr, scene, terrain, enemyMgr, roleContext) {
  if (mgr.merchants.length >= MAX_MERCHANTS) return;

  // pick trade route: start on one edge, destination on opposite edge
  var startEdge = Math.floor(nextRandom() * 4);
  var endEdge = oppositeEdge(startEdge);
  var startPt = pickEdgeSpawn(startEdge, terrain);
  if (!startPt) return;
  var endPt = edgePoint(endEdge, nextRandom());

  // compute speeds relative to player
  var playerSpeed = mgr.playerMaxSpeed || 10;
  var ratio = SPEED_RATIO_MIN + nextRandom() * (SPEED_RATIO_MAX - SPEED_RATIO_MIN);
  var merchantSpeed = Math.max(SPEED_FLOOR, playerSpeed * ratio);
  var fleeSpeed = Math.max(SPEED_FLOOR, playerSpeed * FLEE_SPEED_RATIO);

  var route = { startX: startPt.x, startZ: startPt.z, endX: endPt.x, endZ: endPt.z };
  var heading = Math.atan2(endPt.x - startPt.x, endPt.z - startPt.z);

  var isConvoy = nextRandom() < CONVOY_CHANCE;
  var groupSize = isConvoy
    ? CONVOY_SIZE_MIN + Math.floor(nextRandom() * (CONVOY_SIZE_MAX - CONVOY_SIZE_MIN + 1))
    : 1;
  var convoyId = isConvoy ? (Date.now() + Math.floor(nextRandom() * 100000)) : null;

  // spawn merchant ships
  for (var i = 0; i < groupSize; i++) {
    if (mgr.merchants.length >= MAX_MERCHANTS) break;
    var offsetX = (nextRandom() - 0.5) * 6;
    var offsetZ = (nextRandom() - 0.5) * 6;
    var enemy = spawnAmbientEnemy(
      enemyMgr,
      startPt.x + offsetX,
      startPt.z + offsetZ,
      heading,
      "merchant",
      merchantSpeed,
      scene,
      { startX: route.startX, startZ: route.startZ, endX: route.endX, endZ: route.endZ },
      roleContext
    );
    if (enemy) {
      enemy.fleeSpeed = fleeSpeed;
      enemy.lifetime = 0;
      if (convoyId) enemy.convoyId = convoyId;
      mgr.merchants.push(enemy);
    }
  }

  // spawn navy escort for convoys
  if (isConvoy && convoyId && mgr.merchants.length < MAX_MERCHANTS) {
    var escortSpeed = Math.max(SPEED_FLOOR, playerSpeed * 0.6);
    var escOffX = (nextRandom() - 0.5) * 8;
    var escOffZ = (nextRandom() - 0.5) * 8;
    var escort = spawnAmbientEnemy(
      enemyMgr,
      startPt.x + escOffX,
      startPt.z + escOffZ,
      heading,
      ESCORT_FACTION,
      escortSpeed,
      scene,
      { startX: route.startX, startZ: route.startZ, endX: route.endX, endZ: route.endZ },
      roleContext
    );
    if (escort) {
      escort.fleeSpeed = escortSpeed;
      escort.lifetime = 0;
      escort.convoyId = convoyId;
      mgr.merchants.push(escort);
    }
  }
}

// --- clear all ambient merchants (called on scene transitions) ---
export function clearMerchants(mgr, scene) {
  for (var i = 0; i < mgr.merchants.length; i++) {
    var m = mgr.merchants[i];
    if (m.mesh) scene.remove(m.mesh);
    m.alive = false;
    m.sinking = false;
  }
  mgr.merchants = [];
  mgr.spawnTimer = SPAWN_INTERVAL_BASE * 0.5;
}

// --- update: tick spawn timer, track lifetime, despawn off-map ---
export function updateMerchants(mgr, ship, dt, scene, terrain, elapsed, getWaveHeight, enemyMgr, zone, zoneId, roleContext) {
  // scale spawn interval by zone difficulty
  var difficulty = (zone && zone.difficulty) ? zone.difficulty : 1;
  var interval = Math.max(SPAWN_INTERVAL_MIN, SPAWN_INTERVAL_BASE - difficulty * 2);
  var derivedRoleContext = zone ? {
    zoneId: zoneId || zone.id || null,
    condition: zone.condition || null,
    difficulty: zone.difficulty || null
  } : null;
  var spawnRoleContext = roleContext || derivedRoleContext;

  mgr.spawnTimer -= dt;
  if (mgr.spawnTimer <= 0) {
    spawnMerchantGroup(mgr, scene, terrain, enemyMgr, spawnRoleContext);
    mgr.spawnTimer = interval;
  }

  // prune dead/sinking/off-map merchants from our tracking list
  var stillActive = [];
  for (var i = 0; i < mgr.merchants.length; i++) {
    var m = mgr.merchants[i];

    // already removed by enemy manager (sinking complete)
    if (!m.alive && !m.sinking) continue;

    // sinking in progress — keep tracking until enemy manager removes it
    if (m.sinking) {
      stillActive.push(m);
      continue;
    }

    m.lifetime = (m.lifetime || 0) + dt;

    // despawn when off-map or lifetime expired
    var offMap = Math.abs(m.posX) > MAP_HALF + DESPAWN_MARGIN || Math.abs(m.posZ) > MAP_HALF + DESPAWN_MARGIN;
    if (m.lifetime > MERCHANT_LIFETIME || offMap) {
      if (m.mesh) scene.remove(m.mesh);
      m.alive = false;
      continue;
    }

    stillActive.push(m);
  }
  mgr.merchants = stillActive;
}
