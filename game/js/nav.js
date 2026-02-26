// nav.js — click-to-move navigation + destination marker + enemy click targeting
import * as THREE from "three";
import { setNavTarget } from "./ship.js";
import { getWaveHeight } from "./ocean.js";
import { isLand } from "./terrain.js";

var raycaster = new THREE.Raycaster();
var pointer = new THREE.Vector2();
var oceanPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
var intersectPoint = new THREE.Vector3();

var marker = null;
var markerActive = false;
var markerTargetX = 0;
var markerTargetZ = 0;
var navShipRef = null;
var navCameraRef = null;
var navEnemyMgrRef = null;
var navPortMgrRef = null;
var navTerrainRef = null;
var navBossRef = null;
var initialized = false;

// combat target reticle (ring around targeted enemy)
var reticle = null;
var combatTarget = null;   // reference to targeted enemy object (or null)
var targetWorldPos = new THREE.Vector3();

// --- build destination marker (pulsing ring on water) ---
function buildMarker() {
  var group = new THREE.Group();

  var ringGeo = new THREE.RingGeometry(1.0, 1.4, 24);
  var ringMat = new THREE.MeshBasicMaterial({
    color: 0x44aaff,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.6,
    depthWrite: false
  });
  var ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  group.add(ring);

  var dotGeo = new THREE.CircleGeometry(0.3, 12);
  var dotMat = new THREE.MeshBasicMaterial({
    color: 0x66ccff,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.8,
    depthWrite: false
  });
  var dot = new THREE.Mesh(dotGeo, dotMat);
  dot.rotation.x = -Math.PI / 2;
  dot.position.y = 0.05;
  group.add(dot);

  group.visible = false;
  return group;
}

// --- build combat target reticle (red pulsing ring) ---
function buildReticle() {
  var group = new THREE.Group();

  var ringGeo = new THREE.RingGeometry(2.0, 2.4, 24);
  var ringMat = new THREE.MeshBasicMaterial({
    color: 0xff4444,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.7,
    depthWrite: false
  });
  var ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  group.add(ring);

  var innerGeo = new THREE.RingGeometry(1.4, 1.6, 24);
  var innerMat = new THREE.MeshBasicMaterial({
    color: 0xff6666,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.4,
    depthWrite: false
  });
  var inner = new THREE.Mesh(innerGeo, innerMat);
  inner.rotation.x = -Math.PI / 2;
  inner.position.y = 0.05;
  group.add(inner);

  group.visible = false;
  return group;
}

function projectToOcean(clientX, clientY, camera) {
  pointer.x = (clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);
  return raycaster.ray.intersectPlane(oceanPlane, intersectPoint);
}

// --- check if click hit an enemy (2D distance on XZ plane) ---
var ENEMY_CLICK_RADIUS = 4.0;
var BATTERY_CLICK_RADIUS = 5.0;

function syncTargetPosition(target) {
  if (!target || !target.mesh || !target.mesh.getWorldPosition) return;
  target.mesh.getWorldPosition(targetWorldPos);
  target.posX = targetWorldPos.x;
  target.posZ = targetWorldPos.z;
}

function isValidTarget(target) {
  if (!target || !target.alive) return false;
  if (!target.mesh || !target.mesh.parent) return false;
  return true;
}

function findClickedHostileBattery(worldX, worldZ, bestDistSq) {
  if (!navPortMgrRef || !navPortMgrRef.ports) return null;
  var best = null;
  var bestDist = bestDistSq;
  for (var i = 0; i < navPortMgrRef.ports.length; i++) {
    var port = navPortMgrRef.ports[i];
    if (!port || !port.hostileCity || !port.batteries) continue;
    for (var bi = 0; bi < port.batteries.length; bi++) {
      var battery = port.batteries[bi];
      if (!battery || !battery.alive || !battery.mesh || !battery.mesh.parent || !battery.mesh.visible) continue;
      battery.mesh.getWorldPosition(targetWorldPos);
      var dx = targetWorldPos.x - worldX;
      var dz = targetWorldPos.z - worldZ;
      var distSq = dx * dx + dz * dz;
      var clickR = Math.max(BATTERY_CLICK_RADIUS, battery.hitRadius || 0);
      if (distSq > clickR * clickR || distSq >= bestDist) continue;
      battery.posX = targetWorldPos.x;
      battery.posZ = targetWorldPos.z;
      best = battery;
      bestDist = distSq;
    }
  }
  return best;
}

function findClickedEnemy(worldX, worldZ) {
  var best = null;
  var bestDist = Infinity;

  // check boss first (larger click radius)
  if (navBossRef && navBossRef.alive) {
    var bx = navBossRef.posX - worldX;
    var bz = navBossRef.posZ - worldZ;
    var bDistSq = bx * bx + bz * bz;
    var bClickR = (navBossRef.hitRadius || 5.0) + 2.0;
    if (bDistSq < bClickR * bClickR && bDistSq < bestDist) {
      best = navBossRef;
      bestDist = bDistSq;
    }
  }

  // check regular enemies
  if (navEnemyMgrRef) {
    var enemies = navEnemyMgrRef.enemies;
    for (var i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (!e.alive) continue;
      var dx = e.posX - worldX;
      var dz = e.posZ - worldZ;
      var distSq = dx * dx + dz * dz;
      if (distSq <= ENEMY_CLICK_RADIUS * ENEMY_CLICK_RADIUS && distSq < bestDist) {
        bestDist = distSq;
        best = e;
      }
    }
  }

  var clickedBattery = findClickedHostileBattery(worldX, worldZ, bestDist);
  if (clickedBattery) {
    best = clickedBattery;
  }

  return best;
}

// --- init click/tap handler ---
export function initNav(camera, ship, scene, enemyMgr, terrain, portMgr) {
  navShipRef = ship;
  navCameraRef = camera;
  navEnemyMgrRef = enemyMgr || null;
  navTerrainRef = terrain || null;
  navPortMgrRef = portMgr || null;

  if (initialized) return;
  initialized = true;

  marker = buildMarker();
  scene.add(marker);

  reticle = buildReticle();
  scene.add(reticle);

  window.addEventListener("contextmenu", function (e) {
    e.preventDefault();
  });
}

// --- process a click at screen coords; returns "nav" or "enemy" ---
export function handleClick(clientX, clientY) {
  if (!navShipRef || !navCameraRef) return null;
  var hit = projectToOcean(clientX, clientY, navCameraRef);
  if (!hit) return null;

  var worldX = intersectPoint.x;
  var worldZ = intersectPoint.z;

  // check if clicked on an enemy first
  var enemy = findClickedEnemy(worldX, worldZ);
  if (enemy) {
    combatTarget = enemy;
    return "enemy";
  }

  // reject clicks on land — cannot navigate to terrain
  if (navTerrainRef && isLand(navTerrainRef, worldX, worldZ)) {
    return null;
  }

  // clicked on water — set nav target (does NOT change combat target)
  markerTargetX = worldX;
  markerTargetZ = worldZ;
  markerActive = true;
  marker.visible = true;
  setNavTarget(navShipRef, worldX, worldZ);
  return "nav";
}

// --- continuously update nav target while pointer is held (press-and-hold movement) ---
export function handleHold(clientX, clientY) {
  if (!navShipRef || !navCameraRef) return;
  var hit = projectToOcean(clientX, clientY, navCameraRef);
  if (!hit) return;

  var worldX = intersectPoint.x;
  var worldZ = intersectPoint.z;

  // skip land — don't steer into terrain
  if (navTerrainRef && isLand(navTerrainRef, worldX, worldZ)) return;

  markerTargetX = worldX;
  markerTargetZ = worldZ;
  markerActive = true;
  marker.visible = true;
  setNavTarget(navShipRef, worldX, worldZ);
}

// --- stop hold movement (clear nav target when pointer released) ---
export function stopHold() {
  if (!navShipRef) return;
  navShipRef.navTarget = null;
}

// --- get current combat target ---
export function getCombatTarget() {
  if (!isValidTarget(combatTarget)) {
    combatTarget = null;
    return combatTarget;
  }
  syncTargetPosition(combatTarget);
  return combatTarget;
}

// --- set combat target programmatically (for auto-acquire) ---
export function setCombatTarget(enemy) {
  combatTarget = enemy || null;
  if (combatTarget) syncTargetPosition(combatTarget);
}

export function setNavBoss(boss) {
  navBossRef = boss;
}

// --- clear combat target ---
export function clearCombatTarget() {
  combatTarget = null;
}

// --- update marker + reticle positions ---
export function updateNav(ship, elapsed) {
  // nav marker
  if (marker) {
    if (!ship.navTarget) {
      if (markerActive) {
        markerActive = false;
        marker.visible = false;
      }
    } else {
      var waveY = getWaveHeight(markerTargetX, markerTargetZ, elapsed);
      marker.position.set(markerTargetX, waveY + 0.3, markerTargetZ);
      var pulse = 1.0 + Math.sin(elapsed * 3) * 0.15;
      marker.scale.set(pulse, 1, pulse);
    }
  }

  // combat target reticle
  if (reticle) {
    var target = getCombatTarget();
    if (target) {
      reticle.visible = true;
      var targetY = 0.2;
      if (target.mesh && target.mesh.position) targetY = target.mesh.position.y + 0.2;
      reticle.position.set(
        target.posX,
        targetY,
        target.posZ
      );
      var rPulse = 1.0 + Math.sin(elapsed * 4) * 0.1;
      reticle.scale.set(rPulse, 1, rPulse);
    } else {
      reticle.visible = false;
    }
  }
}
