// port.js — supply ports: fixed resupply points on island coastlines
import * as THREE from "three";
import { addAmmo, addFuel } from "./resource.js";
import { getTerrainHeight, isLand } from "./terrain.js";

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

// --- find coastline positions ---
function findCoastlinePositions(terrain) {
  var positions = [];
  for (var attempt = 0; attempt < COAST_SEARCH_ATTEMPTS && positions.length < PORT_COUNT; attempt++) {
    // random position on map, avoiding edges
    var x = (Math.random() - 0.5) * (MAP_HALF * 2 - 80);
    var z = (Math.random() - 0.5) * (MAP_HALF * 2 - 80);

    // check distance from center
    var cdist = Math.sqrt(x * x + z * z);
    if (cdist < MIN_CENTER_DIST) continue;

    // sample terrain height — we want positions right at the coastline
    var h = getTerrainHeight(terrain, x, z);
    if (h < COAST_HEIGHT_MIN || h > COAST_HEIGHT_MAX) continue;

    // ensure there's land nearby (within 10 units in some direction)
    var hasLand = false;
    for (var a = 0; a < 8; a++) {
      var angle = a * Math.PI / 4;
      var checkX = x + Math.cos(angle) * 8;
      var checkZ = z + Math.sin(angle) * 8;
      if (isLand(terrain, checkX, checkZ)) {
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
      if (!isLand(terrain, checkX, checkZ)) {
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
      var testH = getTerrainHeight(terrain, x + Math.cos(angle) * 6, z + Math.sin(angle) * 6);
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
  var pierMat = new THREE.MeshLambertMaterial({ color: 0x8b6914 });
  var pier = new THREE.Mesh(pierGeo, pierMat);
  pier.position.set(0, 1.5, 0);
  group.add(pier);

  // pilings (4 corner posts)
  var pilingGeo = new THREE.CylinderGeometry(0.15, 0.15, 3, 6);
  var pilingMat = new THREE.MeshLambertMaterial({ color: 0x5a4010 });
  var offsets = [[-1.2, -2.5], [1.2, -2.5], [-1.2, 2.5], [1.2, 2.5]];
  for (var i = 0; i < offsets.length; i++) {
    var piling = new THREE.Mesh(pilingGeo, pilingMat);
    piling.position.set(offsets[i][0], 0.2, offsets[i][1]);
    group.add(piling);
  }

  // supply crate on pier
  var crateGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
  var crateMat = new THREE.MeshLambertMaterial({ color: 0x44aa66 });
  var crate = new THREE.Mesh(crateGeo, crateMat);
  crate.position.set(0.5, 2.1, 1.0);
  group.add(crate);

  // barrel on pier
  var barrelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.7, 8);
  var barrelMat = new THREE.MeshLambertMaterial({ color: 0x2288cc });
  var barrel = new THREE.Mesh(barrelGeo, barrelMat);
  barrel.position.set(-0.6, 2.05, -0.8);
  group.add(barrel);

  // glow light (green when available, grey when on cooldown)
  var light = new THREE.PointLight(0x44ff88, 1.5, 15);
  light.position.set(0, 3, 0);
  group.add(light);

  // beacon post
  var postGeo = new THREE.CylinderGeometry(0.08, 0.08, 2, 6);
  var postMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
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

  return group;
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
export function updatePorts(manager, ship, resources, enemyMgr, dt) {
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
        // resupply
        addAmmo(resources, PORT_AMMO_RESTOCK);
        addFuel(resources, PORT_FUEL_RESTOCK);
        // heal player
        var hpInfo = { hp: enemyMgr.playerHp, maxHp: enemyMgr.playerMaxHp };
        var newHp = Math.min(hpInfo.maxHp, hpInfo.hp + PORT_HP_RESTOCK);
        enemyMgr.playerHp = newHp;
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
