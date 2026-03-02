// crewPickup.js — crew member as 3D in-game pickup (Diablo-style loot drop)
import * as THREE from "three";

var FLOAT_OFFSET = 1.2;
var BOB_AMP = 0.35;
var BOB_SPEED = 1.8;
var SPIN_SPEED = 0.9;
var COLLECT_RADIUS = 3.8;
var LIFETIME = 45;
var GLOW_PULSE_SPEED = 2.5;

// --- shared geometry (built on first use) ---
var figureGeo = null;
var gemGeo = null;
var headGeo = null;
var crewBodyMat = null;
var crewHeadMat = null;
var crewGemMat = null;
var crewMeshPool = [];
var CREW_PICKUP_POOL_MAX = 24;

function ensureGeo() {
  if (figureGeo) return;
  // Simple humanoid bust: stacked cylinder (body) + sphere (head)
  figureGeo = new THREE.CylinderGeometry(0.18, 0.28, 0.55, 8);
  gemGeo = new THREE.OctahedronGeometry(0.22);
  headGeo = new THREE.SphereGeometry(0.18, 8, 6);
  crewBodyMat = new THREE.MeshToonMaterial({ color: 0x9944cc });
  crewHeadMat = new THREE.MeshToonMaterial({ color: 0xffcc88 });
  crewGemMat = new THREE.MeshToonMaterial({ color: 0xdd88ff, emissive: 0x440066 });
}

function collectFadeMaterials(mesh) {
  var mats = [];
  if (!mesh) return mats;
  mesh.traverse(function (child) {
    if (!child.isMesh || !child.material) return;
    if (Array.isArray(child.material)) {
      for (var i = 0; i < child.material.length; i++) {
        if (child.material[i]) mats.push(child.material[i]);
      }
      return;
    }
    mats.push(child.material);
  });
  return mats;
}

function resetCrewMesh(mesh) {
  if (!mesh) return;
  mesh.visible = true;
  mesh.rotation.set(0, 0, 0);
  mesh.scale.set(1, 1, 1);
  var mats = mesh.userData.fadeMaterials || [];
  for (var i = 0; i < mats.length; i++) {
    var mat = mats[i];
    if (!mat) continue;
    mat.opacity = 1;
    mat.transparent = false;
  }
  var light = mesh.userData.light;
  if (light) light.intensity = 1.4;
}

function acquireCrewMesh() {
  if (crewMeshPool.length > 0) {
    var pooled = crewMeshPool.pop();
    resetCrewMesh(pooled);
    return pooled;
  }
  return buildCrewMesh();
}

function releaseCrewMesh(mesh) {
  if (!mesh || crewMeshPool.length >= CREW_PICKUP_POOL_MAX) return;
  resetCrewMesh(mesh);
  crewMeshPool.push(mesh);
}

function buildCrewMesh() {
  ensureGeo();
  var group = new THREE.Group();

  var body = new THREE.Mesh(figureGeo, crewBodyMat.clone());
  body.position.y = 0;
  group.add(body);

  var head = new THREE.Mesh(headGeo, crewHeadMat.clone());
  head.position.y = 0.42;
  group.add(head);

  // gem accent on top
  var gem = new THREE.Mesh(gemGeo, crewGemMat.clone());
  gem.position.y = 0.72;
  gem.scale.setScalar(0.7);
  group.add(gem);

  // gold/purple glow light
  var light = new THREE.PointLight(0xcc66ff, 1.4, 9);
  light.position.set(0, 0.5, 0);
  group.add(light);

  group.userData.light = light;
  group.userData.fadeMaterials = collectFadeMaterials(group);
  return group;
}

// --- manager ---
export function createCrewPickupManager() {
  return {
    pickups: [],
    onCollect: null,  // callback(officer)
    onClaim: null     // callback(index) — fires before collect for multiplayer claim/confirm
  };
}

export function setCrewPickupCallback(mgr, cb) {
  mgr.onCollect = cb;
}

export function setCrewPickupClaimCallback(mgr, cb) {
  mgr.onClaim = cb;
}

// --- spawn ---
export function spawnCrewPickup(mgr, x, y, z, scene, officer) {
  var mesh = acquireCrewMesh();
  mesh.position.set(x, (y || 0) + FLOAT_OFFSET, z);
  scene.add(mesh);

  mgr.pickups.push({
    mesh: mesh,
    officer: officer,
    posX: x,
    posZ: z,
    fadeMaterials: mesh.userData.fadeMaterials || [],
    age: 0,
    collected: false
  });
}

// --- remove a specific crew pickup by index (for host-confirmed removal) ---
export function removeCrewPickup(mgr, index, scene) {
  if (index < 0 || index >= mgr.pickups.length) return null;
  var p = mgr.pickups[index];
  scene.remove(p.mesh);
  releaseCrewMesh(p.mesh);
  p.collected = true;
  return p.officer;
}

// --- clear all crew pickups ---
export function clearCrewPickups(mgr, scene) {
  for (var i = 0; i < mgr.pickups.length; i++) {
    var p = mgr.pickups[i];
    scene.remove(p.mesh);
    releaseCrewMesh(p.mesh);
  }
  mgr.pickups = [];
}

// --- update: bob, spin, proximity collection, despawn ---
export function updateCrewPickups(mgr, ship, dt, elapsed, getWaveHeight, scene) {
  var alive = [];

  for (var i = 0; i < mgr.pickups.length; i++) {
    var p = mgr.pickups[i];
    p.age += dt;

    if (p.collected) {
      if (p.mesh && p.mesh.parent) scene.remove(p.mesh);
      releaseCrewMesh(p.mesh);
      continue;
    }

    if (p.age > LIFETIME) {
      scene.remove(p.mesh);
      releaseCrewMesh(p.mesh);
      continue;
    }

    // proximity collection
    var dx = ship.posX - p.posX;
    var dz = ship.posZ - p.posZ;
    if (dx * dx + dz * dz < COLLECT_RADIUS * COLLECT_RADIUS && !p.collected) {
      p.collected = true;
      if (mgr.onClaim) {
        // multiplayer: defer actual collection until host confirms
        mgr.onClaim(i, p.officer);
      } else {
        scene.remove(p.mesh);
        releaseCrewMesh(p.mesh);
        if (mgr.onCollect) mgr.onCollect(p.officer);
      }
      continue;
    }

    // bob on waves
    var waveY = getWaveHeight(p.posX, p.posZ, elapsed);
    var bob = Math.sin(elapsed * BOB_SPEED + p.posX * 0.7) * BOB_AMP;
    p.mesh.position.y = waveY + FLOAT_OFFSET + bob;

    // spin
    p.mesh.rotation.y += SPIN_SPEED * dt;

    // glow pulse
    var light = p.mesh.userData.light;
    if (light) {
      var pulse = 0.5 + 0.5 * Math.sin(elapsed * GLOW_PULSE_SPEED);
      light.intensity = 0.8 + pulse * 0.9;
    }

    // fade out near end of life
    if (p.age > LIFETIME - 4) {
      var fade = (LIFETIME - p.age) / 4;
      var fadeMats = p.fadeMaterials || [];
      for (var mi = 0; mi < fadeMats.length; mi++) {
        var mat = fadeMats[mi];
        if (!mat) continue;
        mat.transparent = true;
        mat.opacity = fade;
      }
    }

    alive.push(p);
  }

  mgr.pickups = alive;
}
