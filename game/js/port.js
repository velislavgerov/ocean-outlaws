// port.js — supply ports: fixed resupply points on island coastlines
import * as THREE from "three";
import { addAmmo, addFuel } from "./resource.js";
import { getRepairCost } from "./upgrade.js";
import { sampleHeightmap, isHeightmapLand, isLand } from "./terrain.js";
import { nextRandom } from "./rng.js";
import { loadGlbVisual } from "./glbVisual.js";
import { ensureAssetRoles, getRoleVariants } from "./assetRoles.js";

// --- tuning ---
var PORT_COUNT = 3;              // ports per map
var PORT_COLLECT_RADIUS = 10;    // proximity to trigger resupply
var PORT_COOLDOWN = 45;          // seconds before port can be used again
var PORT_AMMO_RESTOCK = 30;
var PORT_FUEL_RESTOCK = 40;
var PORT_HP_RESTOCK = 15;        // flat HP restored
var PORT_WATER_NUDGE = 4;        // move port root slightly toward open water
var PORT_DOCK_OFFSET = 8;        // interaction anchor placed on water side of port
var PORT_DOCK_MAX_OFFSET = 22;   // allow farther dock fallback on complex coasts
var PORT_DOCK_CLEAR_RADIUS = 2.2;
var PORT_DOCK_REFRESH = 0.75;    // refresh dock anchor against visual colliders

// coastline search: find cells near sea level
var COAST_SEARCH_ATTEMPTS = 200;
var COAST_HEIGHT_MIN = -0.05;    // just below sea level (water side)
var COAST_HEIGHT_MAX = 0.15;     // just above sea level (beach)
var MAP_HALF = 200;              // half of MAP_SIZE (400)
var MIN_PORT_SPACING = 60;       // minimum distance between ports
var MIN_CENTER_DIST = 40;        // keep ports away from spawn
var PORT_THEME_ORDER = ["neutral", "merchant", "pirate"];

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

var PORT_THEME_VARIANTS_BY_FACTION = {
  neutral: PORT_THEME_VARIANTS,
  merchant: [
    [
      { path: "assets/models/environment/wooden-piers/wooden-pier-4.glb", fit: 8.4, x: 0, y: 0, z: 0, ry: 0 },
      { path: "assets/models/houses/trading/trading-house.glb", fit: 5.4, x: 0.2, y: 1.8, z: -2.4, ry: 0 },
      { path: "assets/models/environment/food-tents/food-tent-2.glb", fit: 2.8, x: -1.1, y: 1.8, z: 1.0, ry: 0 },
      { path: "assets/models/environment/bags/bag-grain.glb", fit: 1.0, x: 0.7, y: 1.8, z: 1.1, ry: 0.17 },
      { path: "assets/models/environment/boxes/box-3.glb", fit: 1.0, x: -0.6, y: 1.8, z: 0.8, ry: 0.5 }
    ],
    [
      { path: "assets/models/environment/wooden-platforms/wooden-platform.glb", fit: 8.4, x: 0, y: 0, z: 0, ry: 0 },
      { path: "assets/models/houses/trading/trading-house-2.glb", fit: 5.6, x: -0.3, y: 1.8, z: -2.5, ry: 0 },
      { path: "assets/models/environment/tables/table-2.glb", fit: 1.6, x: 0.95, y: 1.8, z: 0.55, ry: 0.22 },
      { path: "assets/models/environment/chairs/chair.glb", fit: 1.1, x: 0.35, y: 1.8, z: 0.95, ry: -0.4 },
      { path: "assets/models/environment/barrels/barrel-stand.glb", fit: 1.4, x: -0.8, y: 1.8, z: 0.6, ry: 0.2 }
    ]
  ],
  pirate: [
    [
      { path: "assets/models/environment/destroyed-wooden-pier.glb", fit: 8.3, x: 0, y: 0, z: 0, ry: 0 },
      { path: "assets/models/houses/pirate/pirate-house.glb", fit: 5.8, x: -0.1, y: 1.8, z: -2.3, ry: 0 },
      { path: "assets/models/environment/barrels/barrel-3.glb", fit: 1.0, x: 0.9, y: 1.8, z: 0.85, ry: 0 },
      { path: "assets/models/environment/fences/untreated/untreated-fence.glb", fit: 2.3, x: 0.2, y: 1.8, z: 1.3, ry: 0.08 },
      { path: "assets/models/environment/bags/bag-grain-2.glb", fit: 1.0, x: -0.7, y: 1.8, z: 0.8, ry: -0.35 }
    ],
    [
      { path: "assets/models/environment/wooden-piers/wooden-pier-5.glb", fit: 8.6, x: 0, y: 0, z: 0, ry: 0 },
      { path: "assets/models/houses/pirate/pirate-house-2.glb", fit: 5.6, x: 0, y: 1.8, z: -2.5, ry: 0 },
      { path: "assets/models/environment/fences/stone/stone-fence-small.glb", fit: 2.2, x: 1.0, y: 1.8, z: 1.1, ry: 0.24 },
      { path: "assets/models/environment/barrels/barrel.glb", fit: 1.0, x: -0.6, y: 1.8, z: 0.9, ry: 0 },
      { path: "assets/models/environment/boxes/box-2.glb", fit: 1.0, x: 0.6, y: 1.8, z: 0.7, ry: 0.35 }
    ]
  ]
};

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
    // nudge toward deepest water neighbor to reduce shoreline collision frustration
    x += Math.cos(bestWaterAngle) * PORT_WATER_NUDGE;
    z += Math.sin(bestWaterAngle) * PORT_WATER_NUDGE;

    var dock = findDockCandidate(
      x, z, bestWaterAngle,
      Math.max(1, PORT_DOCK_OFFSET * 0.4),
      PORT_DOCK_MAX_OFFSET,
      1.5,
      function (dx, dz) {
        return hasWaterClearance(terrain, dx, dz, isHeightmapLand);
      }
    );
    var foundDock = !!dock;
    if (!foundDock) continue;

    positions.push({ x: x, z: z, waterAngle: bestWaterAngle, dockX: dock.x, dockZ: dock.z });
  }
  return positions;
}

function normalizeThemeKey(value) {
  if (typeof value !== "string") return null;
  var key = value.trim().toLowerCase();
  return key || null;
}

function getPortThemeKeys() {
  var roleKeys = getRoleVariants("port.factions");
  if (!roleKeys || !roleKeys.length) return PORT_THEME_ORDER;

  var keys = [];
  for (var i = 0; i < roleKeys.length; i++) {
    var key = normalizeThemeKey(roleKeys[i]);
    if (!key) continue;
    if (keys.indexOf(key) >= 0) continue;
    keys.push(key);
  }
  return keys.length ? keys : PORT_THEME_ORDER;
}

function getFallbackThemes(themeKey) {
  var themed = themeKey ? PORT_THEME_VARIANTS_BY_FACTION[themeKey] : null;
  return themed && themed.length ? themed : PORT_THEME_VARIANTS;
}

function hasWaterClearance(terrain, x, z, landTest) {
  if (landTest(terrain, x, z)) return false;
  for (var a = 0; a < 8; a++) {
    var angle = a * Math.PI / 4;
    var cx = x + Math.cos(angle) * PORT_DOCK_CLEAR_RADIUS;
    var cz = z + Math.sin(angle) * PORT_DOCK_CLEAR_RADIUS;
    if (landTest(terrain, cx, cz)) return false;
  }
  return true;
}

function findDockCandidate(baseX, baseZ, baseAngle, minDist, maxDist, step, isWaterTest) {
  var angleOffsets = [0, 0.35, -0.35, 0.7, -0.7, 1.05, -1.05];
  for (var dist = minDist; dist <= maxDist; dist += step) {
    for (var i = 0; i < angleOffsets.length; i++) {
      var angle = baseAngle + angleOffsets[i];
      var x = baseX + Math.cos(angle) * dist;
      var z = baseZ + Math.sin(angle) * dist;
      if (isWaterTest(x, z)) return { x: x, z: z };
    }
  }
  return null;
}

// --- build dock mesh ---
function buildPortMesh(themeKey) {
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
  group.userData.themeKey = themeKey || "neutral";

  // async GLB dock dressing; keep primitive base as resilient fallback
  hydratePortVisual(group, themeKey);

  return group;
}

function pickPortTheme(themeKey) {
  var normalizedKey = normalizeThemeKey(themeKey);
  var themedRole = normalizedKey ? getRoleVariants("port.themes." + normalizedKey) : null;
  var roleThemes = getRoleVariants("port.themes");
  var themes = themedRole && themedRole.length
    ? themedRole
    : roleThemes && roleThemes.length
      ? roleThemes
      : getFallbackThemes(normalizedKey);
  var idx = Math.floor(nextRandom() * themes.length);
  if (idx < 0 || idx >= themes.length) idx = 0;
  return themes[idx];
}

function hydratePortVisual(group, themeKey) {
  var modules = pickPortTheme(themeKey);
  var visualRoot = new THREE.Group();
  group.add(visualRoot);

  var fallbackHidden = false;
  for (var i = 0; i < modules.length; i++) {
    (function (mod) {
      // Keep full mesh topology for port kits; budget decimation can punch visible holes.
      loadGlbVisual(mod.path, mod.fit, true, { noDecimate: true })
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
  ensureAssetRoles();
  return {
    ports: [],
    initialized: false
  };
}

// --- initialize ports for a zone ---
export function initPorts(manager, terrain, scene) {
  clearPorts(manager, scene);
  var positions = findCoastlinePositions(terrain);
  var themeKeys = getPortThemeKeys();
  var themeOffset = themeKeys.length ? Math.floor(nextRandom() * themeKeys.length) : 0;

  for (var i = 0; i < positions.length; i++) {
    var themeKey = themeKeys.length ? themeKeys[(themeOffset + i) % themeKeys.length] : null;
    var mesh = buildPortMesh(themeKey);
    mesh.position.set(positions[i].x, 0, positions[i].z);
    scene.add(mesh);

    manager.ports.push({
      mesh: mesh,
      posX: positions[i].x,
      posZ: positions[i].z,
      dockX: positions[i].dockX,
      dockZ: positions[i].dockZ,
      dockRefreshTimer: 0,
      waterAngle: positions[i].waterAngle,
      themeKey: themeKey || "neutral",
      cooldown: 0,       // 0 = available
      available: true
    });
  }

  manager.initialized = true;
}

function getPortTarget(port) {
  if (!port) return { x: 0, z: 0 };
  return {
    x: port.dockX !== undefined ? port.dockX : port.posX,
    z: port.dockZ !== undefined ? port.dockZ : port.posZ
  };
}

function refreshPortDockTarget(port, terrain) {
  if (!port || !terrain) return;
  var current = getPortTarget(port);
  if (hasWaterClearance(terrain, current.x, current.z, isLand)) return;

  var dock = findDockCandidate(
    port.posX,
    port.posZ,
    port.waterAngle || 0,
    Math.max(1, PORT_DOCK_OFFSET * 0.35),
    PORT_DOCK_MAX_OFFSET,
    1.25,
    function (x, z) {
      return hasWaterClearance(terrain, x, z, isLand);
    }
  );
  if (!dock) return;
  port.dockX = dock.x;
  port.dockZ = dock.z;
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
export function updatePorts(manager, ship, resources, enemyMgr, dt, upgrades, classKey, terrain) {
  for (var i = 0; i < manager.ports.length; i++) {
    var port = manager.ports[i];

    port.dockRefreshTimer = (port.dockRefreshTimer || 0) - dt;
    if (port.dockRefreshTimer <= 0) {
      refreshPortDockTarget(port, terrain);
      port.dockRefreshTimer = PORT_DOCK_REFRESH;
    }

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
      var target = getPortTarget(port);
      var dx = ship.posX - target.x;
      var dz = ship.posZ - target.z;
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
    var target = getPortTarget(port);
    var dx = ship.posX - target.x;
    var dz = ship.posZ - target.z;
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
