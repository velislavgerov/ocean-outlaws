// pickup.js — resource pickups: floating crates/barrels dropped by enemies
import * as THREE from "three";
import { addAmmo, addFuel, addParts } from "./resource.js";
import { addGold } from "./upgrade.js";
import { nextRandom } from "./rng.js";
import { loadGlbVisual } from "./glbVisual.js";
import { ensureAssetRoles, pickRoleVariant } from "./assetRoles.js";

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
var GOLD_DROP_AMOUNT = 15;       // gold per pickup

// drop chances (must sum to 1)
var DROP_CHANCE_AMMO = 0.35;
var DROP_CHANCE_FUEL = 0.30;
var DROP_CHANCE_GOLD = 0.20;
// remainder = parts (0.15)

// --- shared geometry ---
var crateGeo = null;
var barrelGeo = null;

var cachedPickupMat = {};
var cachedPickupLight = {};

function ensureGeo() {
  if (crateGeo) return;
  crateGeo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
  barrelGeo = new THREE.CylinderGeometry(0.25, 0.3, 0.7, 8);
  var types = ["ammo", "fuel", "parts", "gold"];
  for (var i = 0; i < types.length; i++) {
    var t = types[i];
    cachedPickupMat[t] = new THREE.MeshToonMaterial({ color: TYPE_COLORS[t] });
    cachedPickupLight[t] = new THREE.PointLight(GLOW_COLORS[t] || 0xffffff, 1.0, 6);
    cachedPickupLight[t].position.set(0, 0.5, 0);
  }
}

var PICKUP_MODEL_POOLS = {
  ammo: [
    { path: "assets/models/environment/boxes/box.glb", fit: 1.0 },
    { path: "assets/models/environment/boxes/box-2.glb", fit: 1.0 },
    { path: "assets/models/environment/boxes/box-3.glb", fit: 1.0 }
  ],
  fuel: [
    { path: "assets/models/environment/barrels/barrel.glb", fit: 1.0 },
    { path: "assets/models/environment/barrels/barrel-2.glb", fit: 1.0 },
    { path: "assets/models/environment/bottles/bottle-2.glb", fit: 0.95 }
  ],
  parts: [
    { path: "assets/models/environment/boards/board.glb", fit: 1.0 },
    { path: "assets/models/environment/boards/board-2.glb", fit: 1.0 },
    { path: "assets/models/environment/wooden-posts/wooden-post.glb", fit: 1.0 }
  ],
  gold: [
    { path: "assets/models/environment/basket.glb", fit: 1.0 },
    { path: "assets/models/environment/bags/bag-grain.glb", fit: 1.0 },
    { path: "assets/models/environment/mug.glb", fit: 1.0 }
  ]
};

// --- color by type ---
var TYPE_COLORS = {
  ammo: 0xffaa22,
  fuel: 0x22aaff,
  parts: 0x44dd66,
  gold: 0xffcc44
};

var GLOW_COLORS = {
  ammo: 0xffdd66,
  fuel: 0x66ccff,
  parts: 0x88ff99,
  gold: 0xffee88
};

function pickPickupModel(type) {
  return pickRoleVariant("pickup." + type, PICKUP_MODEL_POOLS[type], nextRandom);
}

function normalizeRoleToken(value) {
  if (value === null || value === undefined) return null;
  var text = String(value).trim().toLowerCase();
  if (!text) return null;
  text = text.replace(/[^a-z0-9_\-]/g, "_");
  return text || null;
}

function pickPickupModelWithContext(type, roleContext) {
  var baseRole = "pickup." + type;
  var zoneId = roleContext ? normalizeRoleToken(roleContext.zoneId || roleContext.id) : null;
  var condition = roleContext ? normalizeRoleToken(roleContext.condition) : null;
  var difficulty = roleContext ? normalizeRoleToken(roleContext.difficulty) : null;
  var storyRegion = roleContext ? normalizeRoleToken(roleContext.storyRegion || roleContext.region) : null;
  var encounterType = roleContext ? normalizeRoleToken(roleContext.encounterType || roleContext.nodeType) : null;
  var candidates = [];
  if (zoneId) candidates.push(baseRole + ".zone." + zoneId);
  if (condition) candidates.push(baseRole + ".condition." + condition);
  if (difficulty) candidates.push(baseRole + ".difficulty." + difficulty);
  if (storyRegion) candidates.push(baseRole + ".storyregion." + storyRegion);
  if (encounterType) candidates.push(baseRole + ".encounter." + encounterType);
  for (var i = 0; i < candidates.length; i++) {
    var contextual = pickRoleVariant(candidates[i], null, nextRandom);
    if (contextual) return contextual;
  }
  return pickPickupModel(type);
}

// --- build pickup mesh ---
function buildPickupMesh(type) {
  ensureGeo();
  var group = new THREE.Group();

  var mat = cachedPickupMat[type] || new THREE.MeshToonMaterial({ color: TYPE_COLORS[type] || 0xffffff });

  var mesh;
  if (type === "fuel") {
    mesh = new THREE.Mesh(barrelGeo, mat);
  } else {
    mesh = new THREE.Mesh(crateGeo, mat);
  }
  mesh.userData.pickupFallback = true;
  group.add(mesh);

  // glow point light — create a fresh one per pickup (lights need separate instances for position)
  var glowColor = GLOW_COLORS[type] || 0xffffff;
  var light = new THREE.PointLight(glowColor, 1.0, 6);
  light.position.set(0, 0.5, 0);
  group.add(light);

  group.userData.light = light;
  return group;
}

function hydratePickupMesh(pickup) {
  var model = pickPickupModelWithContext(pickup.type, pickup.roleContext);
  if (!model) return;
  loadGlbVisual(model.path, model.fit, true)
    .then(function (obj) {
      if (pickup.collected || !pickup.mesh || !pickup.mesh.parent) return;
      pickup.mesh.traverse(function (child) {
        if (child.isMesh && child.userData && child.userData.pickupFallback) {
          child.visible = false;
        }
      });
      obj.position.y = 0.1;
      pickup.mesh.add(obj);
    })
    .catch(function () {
      // keep fallback mesh
    });
}

// --- pickup manager ---
export function createPickupManager() {
  ensureAssetRoles();
  return {
    pickups: [],
    roleContext: null,
    onCollectCallback: null  // called with (index) for multiplayer sync
  };
}

export function setPickupCollectCallback(manager, callback) {
  manager.onCollectCallback = callback;
}

export function setPickupRoleContext(manager, roleContext) {
  if (!manager) return;
  manager.roleContext = roleContext || null;
}

// --- spawn a pickup at position ---
export function spawnPickup(manager, x, y, z, scene) {
  var roll = nextRandom();
  var type;
  if (roll < DROP_CHANCE_AMMO) {
    type = "ammo";
  } else if (roll < DROP_CHANCE_AMMO + DROP_CHANCE_FUEL) {
    type = "fuel";
  } else if (roll < DROP_CHANCE_AMMO + DROP_CHANCE_FUEL + DROP_CHANCE_GOLD) {
    type = "gold";
  } else {
    type = "parts";
  }

  var mesh = buildPickupMesh(type);
  mesh.position.set(x, y + PICKUP_FLOAT_OFFSET, z);
  scene.add(mesh);

  var pickup = {
    mesh: mesh,
    type: type,
    posX: x,
    posZ: z,
    roleContext: manager.roleContext || null,
    age: 0,
    collected: false
  };
  manager.pickups.push(pickup);

  hydratePickupMesh(pickup);
}

// --- clear all pickups (called on wave transition) ---
export function clearPickups(manager, scene) {
  for (var i = 0; i < manager.pickups.length; i++) {
    scene.remove(manager.pickups[i].mesh);
  }
  manager.pickups = [];
}

// --- update pickups: bob, glow, check proximity, despawn ---
export function updatePickups(manager, ship, resources, dt, elapsed, getWaveHeight, scene, upgrades) {
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

    if (distSq < PICKUP_COLLECT_RADIUS * PICKUP_COLLECT_RADIUS && !p.collected) {
      p.collected = true;
      collectPickup(p, resources, upgrades);
      scene.remove(p.mesh);
      // Broadcast pickup claim for multiplayer
      if (manager.onCollectCallback) manager.onCollectCallback(i);
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
function collectPickup(pickup, resources, upgrades) {
  if (pickup.type === "ammo") {
    addAmmo(resources, AMMO_DROP_AMOUNT);
  } else if (pickup.type === "fuel") {
    addFuel(resources, FUEL_DROP_AMOUNT);
  } else if (pickup.type === "parts") {
    addParts(resources, PARTS_DROP_AMOUNT);
  } else if (pickup.type === "gold" && upgrades) {
    addGold(upgrades, GOLD_DROP_AMOUNT);
  }
  console.log("[PICKUP] Collected " + pickup.type);
}

// --- pre-warm GLB models to avoid shader compile stutter on first pickup ---
export function preloadPickupModels(scene) {
  var types = ["ammo", "fuel", "parts", "gold"];
  for (var i = 0; i < types.length; i++) {
    var models = PICKUP_MODEL_POOLS[types[i]];
    for (var j = 0; j < models.length; j++) {
      (function(model) {
        loadGlbVisual(model.path, model.fit, true).then(function(obj) {
          obj.position.set(99999, 0, 99999);
          obj.visible = false;
          scene.add(obj);
        }).catch(function() {});
      })(models[j]);
    }
  }
}
