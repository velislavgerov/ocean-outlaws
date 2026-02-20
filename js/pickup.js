// pickup.js — resource pickups: floating crates/barrels dropped by enemies
import * as THREE from "three";
import { addAmmo, addFuel, addParts } from "./resource.js";

// --- tuning ---
var PICKUP_FLOAT_OFFSET = 0.8;
var PICKUP_BOB_AMP = 0.3;
var PICKUP_BOB_SPEED = 2.0;
var PICKUP_SPIN_SPEED = 1.2;
var PICKUP_COLLECT_RADIUS = 3.5;
var PICKUP_LIFETIME = 30;         // seconds before pickup despawns
var GLOW_PULSE_SPEED = 3.0;
var GLOW_PULSE_MIN = 0.5;

// drop amounts
var AMMO_DROP_AMOUNT = 8;
var FUEL_DROP_AMOUNT = 15;
var PARTS_DROP_AMOUNT = 1;

// drop chances (must sum to 1)
var DROP_CHANCE_AMMO = 0.45;
var DROP_CHANCE_FUEL = 0.35;
// remainder = parts

// --- shared geometry ---
var crateGeo = null;
var barrelGeo = null;

function ensureGeo() {
  if (crateGeo) return;
  crateGeo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
  barrelGeo = new THREE.CylinderGeometry(0.25, 0.3, 0.7, 8);
}

// --- color by type ---
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

// --- build pickup mesh ---
function buildPickupMesh(type) {
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

  // glow point light
  var glowColor = GLOW_COLORS[type] || 0xffffff;
  var light = new THREE.PointLight(glowColor, 1.0, 6);
  light.position.set(0, 0.5, 0);
  group.add(light);

  group.userData.light = light;
  return group;
}

// --- pickup manager ---
export function createPickupManager() {
  return {
    pickups: []
  };
}

// --- spawn a pickup at position ---
export function spawnPickup(manager, x, y, z, scene) {
  var roll = Math.random();
  var type;
  if (roll < DROP_CHANCE_AMMO) {
    type = "ammo";
  } else if (roll < DROP_CHANCE_AMMO + DROP_CHANCE_FUEL) {
    type = "fuel";
  } else {
    type = "parts";
  }

  var mesh = buildPickupMesh(type);
  mesh.position.set(x, y + PICKUP_FLOAT_OFFSET, z);
  scene.add(mesh);

  manager.pickups.push({
    mesh: mesh,
    type: type,
    posX: x,
    posZ: z,
    age: 0,
    collected: false
  });
}

// --- clear all pickups (called on wave transition) ---
export function clearPickups(manager, scene) {
  for (var i = 0; i < manager.pickups.length; i++) {
    scene.remove(manager.pickups[i].mesh);
  }
  manager.pickups = [];
}

// --- update pickups: bob, glow, check proximity, despawn ---
export function updatePickups(manager, ship, resources, dt, elapsed, getWaveHeight, scene) {
  var alive = [];

  for (var i = 0; i < manager.pickups.length; i++) {
    var p = manager.pickups[i];
    p.age += dt;

    // despawn old pickups
    if (p.age > PICKUP_LIFETIME) {
      scene.remove(p.mesh);
      continue;
    }

    // proximity collection
    var dx = ship.posX - p.posX;
    var dz = ship.posZ - p.posZ;
    var distSq = dx * dx + dz * dz;

    if (distSq < PICKUP_COLLECT_RADIUS * PICKUP_COLLECT_RADIUS) {
      collectPickup(p, resources);
      scene.remove(p.mesh);
      continue;
    }

    // bob on waves
    var waveY = getWaveHeight(p.posX, p.posZ, elapsed);
    var bob = Math.sin(elapsed * PICKUP_BOB_SPEED + p.posX * 0.5) * PICKUP_BOB_AMP;
    p.mesh.position.y = waveY + PICKUP_FLOAT_OFFSET + bob;

    // spin
    p.mesh.rotation.y += PICKUP_SPIN_SPEED * dt;

    // glow pulse
    var light = p.mesh.userData.light;
    if (light) {
      var pulse = GLOW_PULSE_MIN + (1 - GLOW_PULSE_MIN) * (0.5 + 0.5 * Math.sin(elapsed * GLOW_PULSE_SPEED));
      light.intensity = pulse;
    }

    // fade out near end of life
    if (p.age > PICKUP_LIFETIME - 3) {
      var fade = (PICKUP_LIFETIME - p.age) / 3;
      p.mesh.traverse(function (child) {
        if (child.isMesh && child.material) {
          child.material.transparent = true;
          child.material.opacity = fade;
        }
      });
    }

    alive.push(p);
  }

  manager.pickups = alive;
}

// --- apply pickup to resources ---
function collectPickup(pickup, resources) {
  if (pickup.type === "ammo") {
    addAmmo(resources, AMMO_DROP_AMOUNT);
  } else if (pickup.type === "fuel") {
    addFuel(resources, FUEL_DROP_AMOUNT);
  } else if (pickup.type === "parts") {
    addParts(resources, PARTS_DROP_AMOUNT);
  }
  console.log("[PICKUP] Collected " + pickup.type);
}
