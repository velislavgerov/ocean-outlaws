// crate.js — periodic resource crates: spawn at random water positions
import * as THREE from "three";
import { addAmmo, addFuel, addParts } from "./resource.js";
import { isLand } from "./terrain.js";

// --- tuning ---
var SPAWN_INTERVAL = 18;         // seconds between crate spawns
var CRATE_LIFETIME = 45;         // seconds before despawn
var COLLECT_RADIUS = 3.5;        // same as enemy drops
var FLOAT_OFFSET = 0.8;
var BOB_AMP = 0.3;
var BOB_SPEED = 2.0;
var SPIN_SPEED = 0.8;
var GLOW_PULSE_SPEED = 3.0;
var GLOW_PULSE_MIN = 0.5;
var SPAWN_DIST_MIN = 30;         // min distance from player
var SPAWN_DIST_MAX = 100;        // max distance from player
var MAP_HALF = 200;
var MAX_CRATES = 8;              // max concurrent crates on map

// crate drop amounts (slightly less than port, more than enemy drops)
var CRATE_AMMO = 12;
var CRATE_FUEL = 20;
var CRATE_PARTS = 1;

// drop chances
var CHANCE_AMMO = 0.45;
var CHANCE_FUEL = 0.35;
// remainder = parts

// --- shared geometry ---
var crateGeo = null;
var barrelGeo = null;

function ensureGeo() {
  if (crateGeo) return;
  crateGeo = new THREE.BoxGeometry(0.7, 0.7, 0.7);
  barrelGeo = new THREE.CylinderGeometry(0.28, 0.32, 0.75, 8);
}

// --- colors ---
var TYPE_COLORS = {
  ammo: 0xffaa22,
  fuel: 0x22aaff,
  parts: 0x44dd66
};

var GLOW_COLORS = {
  ammo: 0xffdd66,
  fuel: 0x66ccff,
  parts: 0x88ff99
};

// --- build crate mesh ---
function buildCrateMesh(type) {
  ensureGeo();
  var group = new THREE.Group();

  var color = TYPE_COLORS[type] || 0xffffff;
  var mat = new THREE.MeshLambertMaterial({ color: color });

  var mesh;
  if (type === "fuel") {
    mesh = new THREE.Mesh(barrelGeo, mat);
  } else {
    mesh = new THREE.Mesh(crateGeo, mat);
  }
  group.add(mesh);

  // stripe to distinguish from enemy drops (white band)
  var stripeGeo = new THREE.BoxGeometry(0.72, 0.1, 0.72);
  var stripeMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  var stripe = new THREE.Mesh(stripeGeo, stripeMat);
  stripe.position.y = 0.15;
  group.add(stripe);

  // glow
  var glowColor = GLOW_COLORS[type] || 0xffffff;
  var light = new THREE.PointLight(glowColor, 1.2, 8);
  light.position.set(0, 0.6, 0);
  group.add(light);

  group.userData.light = light;
  return group;
}

// --- crate manager ---
export function createCrateManager() {
  return {
    crates: [],
    spawnTimer: SPAWN_INTERVAL * 0.5  // first crate spawns sooner
  };
}

// --- find random water position for crate ---
function findCrateSpawnPosition(ship, terrain) {
  for (var attempt = 0; attempt < 30; attempt++) {
    var angle = Math.random() * Math.PI * 2;
    var dist = SPAWN_DIST_MIN + Math.random() * (SPAWN_DIST_MAX - SPAWN_DIST_MIN);
    var x = ship.posX + Math.sin(angle) * dist;
    var z = ship.posZ + Math.cos(angle) * dist;

    // keep within map bounds
    if (Math.abs(x) > MAP_HALF - 20 || Math.abs(z) > MAP_HALF - 20) continue;

    // must be on water
    if (terrain && isLand(terrain, x, z)) continue;

    return { x: x, z: z };
  }
  return null;
}

// --- spawn a crate ---
function spawnCrate(manager, ship, terrain, scene) {
  if (manager.crates.length >= MAX_CRATES) return;

  var pos = findCrateSpawnPosition(ship, terrain);
  if (!pos) return;

  var roll = Math.random();
  var type;
  if (roll < CHANCE_AMMO) {
    type = "ammo";
  } else if (roll < CHANCE_AMMO + CHANCE_FUEL) {
    type = "fuel";
  } else {
    type = "parts";
  }

  var mesh = buildCrateMesh(type);
  mesh.position.set(pos.x, FLOAT_OFFSET, pos.z);
  scene.add(mesh);

  manager.crates.push({
    mesh: mesh,
    type: type,
    posX: pos.x,
    posZ: pos.z,
    age: 0
  });
}

// --- clear all crates ---
export function clearCrates(manager, scene) {
  for (var i = 0; i < manager.crates.length; i++) {
    scene.remove(manager.crates[i].mesh);
  }
  manager.crates = [];
  manager.spawnTimer = SPAWN_INTERVAL * 0.5;
}

// --- update crates: spawn timer, bob, collect, despawn ---
export function updateCrates(manager, ship, resources, terrain, dt, elapsed, getWaveHeight, scene) {
  // tick spawn timer
  manager.spawnTimer -= dt;
  if (manager.spawnTimer <= 0) {
    spawnCrate(manager, ship, terrain, scene);
    manager.spawnTimer = SPAWN_INTERVAL;
  }

  var alive = [];

  for (var i = 0; i < manager.crates.length; i++) {
    var c = manager.crates[i];
    c.age += dt;

    // despawn old crates
    if (c.age > CRATE_LIFETIME) {
      scene.remove(c.mesh);
      continue;
    }

    // proximity collection
    var dx = ship.posX - c.posX;
    var dz = ship.posZ - c.posZ;
    var distSq = dx * dx + dz * dz;

    if (distSq < COLLECT_RADIUS * COLLECT_RADIUS) {
      collectCrate(c, resources);
      scene.remove(c.mesh);
      continue;
    }

    // bob on waves
    var waveY = getWaveHeight(c.posX, c.posZ, elapsed);
    var bob = Math.sin(elapsed * BOB_SPEED + c.posX * 0.5) * BOB_AMP;
    c.mesh.position.y = waveY + FLOAT_OFFSET + bob;

    // spin
    c.mesh.rotation.y += SPIN_SPEED * dt;

    // glow pulse
    var light = c.mesh.userData.light;
    if (light) {
      var pulse = GLOW_PULSE_MIN + (1 - GLOW_PULSE_MIN) * (0.5 + 0.5 * Math.sin(elapsed * GLOW_PULSE_SPEED));
      light.intensity = pulse * 1.2;
    }

    // fade near end of life
    if (c.age > CRATE_LIFETIME - 5) {
      var fade = (CRATE_LIFETIME - c.age) / 5;
      c.mesh.traverse(function (child) {
        if (child.isMesh && child.material) {
          child.material.transparent = true;
          child.material.opacity = fade;
        }
      });
    }

    alive.push(c);
  }

  manager.crates = alive;
}

// --- collect crate ---
function collectCrate(crate, resources) {
  if (crate.type === "ammo") {
    addAmmo(resources, CRATE_AMMO);
  } else if (crate.type === "fuel") {
    addFuel(resources, CRATE_FUEL);
  } else if (crate.type === "parts") {
    addParts(resources, CRATE_PARTS);
  }
  console.log("[CRATE] Collected " + crate.type);
}

// --- get spawn interval for external tuning ---
export function getCrateInterval() {
  return SPAWN_INTERVAL;
}
