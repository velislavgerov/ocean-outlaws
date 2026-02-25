// port.js — supply ports: fixed resupply points on island coastlines
import * as THREE from "three";
import { addAmmo, addFuel } from "./resource.js";
import { getRepairCost } from "./upgrade.js";
import { sampleHeightmap, isHeightmapLand } from "./terrain.js";
import { nextRandom } from "./rng.js";
import { loadGlbVisual } from "./glbVisual.js";

// --- tuning ---
var PORT_COUNT = 3;              // ports per map
var PORT_COLLECT_RADIUS = 8;     // proximity to trigger resupply
var PORT_COOLDOWN = 45;          // seconds before port can be used again
var PORT_AMMO_RESTOCK = 30;
var PORT_FUEL_RESTOCK = 40;
var PORT_HP_RESTOCK = 15;        // flat HP restored

// coastline search: find cells near sea level
var COAST_SEARCH_ATTEMPTS = 200;
var COAST_HEIGHT_MIN = -0.05;    // just below sea level (water side)
var COAST_HEIGHT_MAX = 0.15;     // just above sea level (beach)
var MAP_HALF = 200;              // half of MAP_SIZE (400)
var MIN_PORT_SPACING = 60;       // minimum distance between ports
var MIN_CENTER_DIST = 40;        // keep ports away from spawn

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

// --- find coastline positions ---
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
    // nudge 3 units toward the deepest water neighbor
    x += Math.cos(bestWaterAngle) * 3;
    z += Math.sin(bestWaterAngle) * 3;

    positions.push({ x: x, z: z });
  }
  return positions;
}

// --- build dock mesh ---
function buildPortMesh() {
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

  // async GLB dock dressing; keep primitive base as resilient fallback
  hydratePortVisual(group);

  return group;
}

function pickPortTheme() {
  var idx = Math.floor(nextRandom() * PORT_THEME_VARIANTS.length);
  if (idx < 0 || idx >= PORT_THEME_VARIANTS.length) idx = 0;
  return PORT_THEME_VARIANTS[idx];
}

function hydratePortVisual(group) {
  var modules = pickPortTheme();
  var visualRoot = new THREE.Group();
  group.add(visualRoot);

  var fallbackHidden = false;
  for (var i = 0; i < modules.length; i++) {
    (function (mod) {
      loadGlbVisual(mod.path, mod.fit, true)
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

// --- port manager ---
export function createPortManager() {
  return {
    ports: [],
    initialized: false
  };
}

// --- initialize ports for a zone ---
export function initPorts(manager, terrain, scene) {
  clearPorts(manager, scene);
  var positions = findCoastlinePositions(terrain);

  for (var i = 0; i < positions.length; i++) {
    var mesh = buildPortMesh();
    mesh.position.set(positions[i].x, 0, positions[i].z);
    scene.add(mesh);

    manager.ports.push({
      mesh: mesh,
      posX: positions[i].x,
      posZ: positions[i].z,
      cooldown: 0,       // 0 = available
      available: true
    });
  }

  manager.initialized = true;
}

// --- clear all ports ---
export function clearPorts(manager, scene) {
  for (var i = 0; i < manager.ports.length; i++) {
    scene.remove(manager.ports[i].mesh);
  }
  manager.ports = [];
  manager.initialized = false;
}

// --- update ports: check proximity, tick cooldowns, update visuals ---
export function updatePorts(manager, ship, resources, enemyMgr, dt, upgrades, classKey) {
  for (var i = 0; i < manager.ports.length; i++) {
    var port = manager.ports[i];

    // tick cooldown
    if (port.cooldown > 0) {
      port.cooldown -= dt;
      if (port.cooldown <= 0) {
        port.cooldown = 0;
        port.available = true;
      }
    }

    // check proximity for resupply
    if (port.available) {
      var dx = ship.posX - port.posX;
      var dz = ship.posZ - port.posZ;
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

    if (port.available) {
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
}

// --- get port info for HUD ---
export function getPortsInfo(manager, ship) {
  var nearest = null;
  var nearestDist = Infinity;
  for (var i = 0; i < manager.ports.length; i++) {
    var port = manager.ports[i];
    var dx = ship.posX - port.posX;
    var dz = ship.posZ - port.posZ;
    var dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = port;
    }
  }
  if (!nearest) return null;
  return {
    dist: nearestDist,
    available: nearest.available,
    cooldown: nearest.cooldown,
    maxCooldown: PORT_COOLDOWN
  };
}
