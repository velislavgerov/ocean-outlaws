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
var navTerrainRef = null;
var initialized = false;

// combat target reticle (ring around targeted enemy)
var reticle = null;
var combatTarget = null;   // reference to targeted enemy object (or null)

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

function findClickedEnemy(worldX, worldZ) {
  if (!navEnemyMgrRef) return null;
  var enemies = navEnemyMgrRef.enemies;
  var best = null;
  var bestDist = ENEMY_CLICK_RADIUS * ENEMY_CLICK_RADIUS;
  for (var i = 0; i < enemies.length; i++) {
    var e = enemies[i];
    if (!e.alive) continue;
    var dx = e.posX - worldX;
    var dz = e.posZ - worldZ;
    var distSq = dx * dx + dz * dz;
    if (distSq < bestDist) {
      bestDist = distSq;
      best = e;
    }
  }
  return best;
}

// --- init click/tap handler ---
export function initNav(camera, ship, scene, enemyMgr, terrain) {
  navShipRef = ship;
  navCameraRef = camera;
  navEnemyMgrRef = enemyMgr || null;
  navTerrainRef = terrain || null;

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

// --- get current combat target ---
export function getCombatTarget() {
  // clear dead targets
  if (combatTarget && !combatTarget.alive) {
    combatTarget = null;
  }
  return combatTarget;
}

// --- set combat target programmatically (for auto-acquire) ---
export function setCombatTarget(enemy) {
  combatTarget = enemy;
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
    if (combatTarget && combatTarget.alive) {
      reticle.visible = true;
      reticle.position.set(
        combatTarget.posX,
        combatTarget.mesh.position.y + 0.2,
        combatTarget.posZ
      );
      var rPulse = 1.0 + Math.sin(elapsed * 4) * 0.1;
      reticle.scale.set(rPulse, 1, rPulse);
    } else {
      reticle.visible = false;
      if (combatTarget && !combatTarget.alive) {
        combatTarget = null;
      }
    }
  }
}
