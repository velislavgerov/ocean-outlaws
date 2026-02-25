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
var ROUTE_HALF_SPAN = 220;
var TRADE_ROUTE_MARGIN = 30;     // inset from map edge for spawn/destination points
var DESPAWN_DISTANCE = 340;      // despawn when far off the spawned trade lane bubble

// --- edge helpers ---
// Returns a point on the given edge (0=north, 1=east, 2=south, 3=west).
// t is 0..1 along the edge.
function edgePoint(edge, t, originX, originZ) {
  var margin = TRADE_ROUTE_MARGIN;
  var half = ROUTE_HALF_SPAN;
  var limit = half - margin;
  var ox = originX || 0;
  var oz = originZ || 0;
  switch (edge) {
    case 0: return { x: ox - limit + t * limit * 2, z: oz - half + margin }; // north
    case 1: return { x: ox + half - margin,         z: oz - limit + t * limit * 2 }; // east
    case 2: return { x: ox - limit + t * limit * 2, z: oz + half - margin }; // south
    case 3: return { x: ox - half + margin,         z: oz - limit + t * limit * 2 }; // west
    default: return { x: ox, z: oz };
  }
}

function oppositeEdge(edge) {
  return (edge + 2) % 4;
}

// Pick a spawn point on an edge avoiding land.
function pickEdgeSpawn(edge, terrain, originX, originZ) {
  for (var attempt = 0; attempt < 20; attempt++) {
    var pt = edgePoint(edge, nextRandom(), originX, originZ);
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
function spawnMerchantGroup(mgr, ship, scene, terrain, enemyMgr) {
  if (mgr.merchants.length >= MAX_MERCHANTS) return;
  if (!ship) return;

  // pick trade route: start on one edge, destination on opposite edge
  var startEdge = Math.floor(nextRandom() * 4);
  var endEdge = oppositeEdge(startEdge);
  var originX = ship.posX;
  var originZ = ship.posZ;
  var startPt = pickEdgeSpawn(startEdge, terrain, originX, originZ);
  if (!startPt) return;
  var endPt = edgePoint(endEdge, nextRandom(), originX, originZ);

  // compute speeds relative to player
  var playerSpeed = mgr.playerMaxSpeed || 10;
  var ratio = SPEED_RATIO_MIN + nextRandom() * (SPEED_RATIO_MAX - SPEED_RATIO_MIN);
  var merchantSpeed = Math.max(SPEED_FLOOR, playerSpeed * ratio);
  var fleeSpeed = Math.max(SPEED_FLOOR, playerSpeed * FLEE_SPEED_RATIO);

  var route = {
    startX: startPt.x, startZ: startPt.z,
    endX: endPt.x, endZ: endPt.z,
    centerX: originX, centerZ: originZ
  };
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
      { startX: route.startX, startZ: route.startZ, endX: route.endX, endZ: route.endZ }
    );
    if (enemy) {
      enemy.fleeSpeed = fleeSpeed;
      enemy.lifetime = 0;
      enemy.routeCenterX = route.centerX;
      enemy.routeCenterZ = route.centerZ;
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
      { startX: route.startX, startZ: route.startZ, endX: route.endX, endZ: route.endZ }
    );
    if (escort) {
      escort.fleeSpeed = escortSpeed;
      escort.lifetime = 0;
      escort.routeCenterX = route.centerX;
      escort.routeCenterZ = route.centerZ;
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
export function updateMerchants(mgr, ship, dt, scene, terrain, elapsed, getWaveHeight, enemyMgr, zone) {
  // scale spawn interval by zone difficulty
  var difficulty = (zone && zone.difficulty) ? zone.difficulty : 1;
  var interval = Math.max(SPAWN_INTERVAL_MIN, SPAWN_INTERVAL_BASE - difficulty * 2);

  mgr.spawnTimer -= dt;
  if (mgr.spawnTimer <= 0) {
    spawnMerchantGroup(mgr, ship, scene, terrain, enemyMgr);
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

    // despawn when route-lane bounds are exceeded or lifetime expires
    var rcx = m.routeCenterX !== undefined ? m.routeCenterX : ship.posX;
    var rcz = m.routeCenterZ !== undefined ? m.routeCenterZ : ship.posZ;
    var offRoute = Math.abs(m.posX - rcx) > DESPAWN_DISTANCE || Math.abs(m.posZ - rcz) > DESPAWN_DISTANCE;
    if (m.lifetime > MERCHANT_LIFETIME || offRoute) {
      if (m.mesh) scene.remove(m.mesh);
      m.alive = false;
      continue;
    }

    stillActive.push(m);
  }
  mgr.merchants = stillActive;
}
