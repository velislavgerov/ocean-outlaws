// weapon.js — weapon type definitions, weapon state, switching logic
import * as THREE from "three";
import { damageEnemy } from "./enemy.js";
import { spendAmmo } from "./resource.js";
import { damageBoss } from "./boss.js";
import { isLand } from "./terrain.js";
import { playImpactSound } from "./soundFx.js";

var WEAPON_TYPES = {
  cannon: {
    name: "Iron Cannon", key: 0, fireRate: 1.0, damage: 1, projSpeed: 35,
    ammoCost: 1, color: 0xffcc44, trailColor: 0xffcc44, projRadius: 0.12,
    gravity: 9.8, loft: 0.08, maxRange: 40, homing: false,
    waterLevel: false, splashScale: 1.0,
    tiers: [
      { name: "Iron Cannon" },
      { name: "Bronze Cannon", damage: 1.5, fireRate: 0.85, projSpeed: 40 },
      { name: "Steel Cannon",  damage: 2.2, fireRate: 0.7,  projSpeed: 45, perk: "pierce" }
    ]
  },
  chainshot: {
    name: "Rope Shot", key: 1, fireRate: 2.5, damage: 3, projSpeed: 28,
    ammoCost: 3, color: 0xff6644, trailColor: 0xff8844, projRadius: 0.2,
    gravity: 2.0, loft: 0.15, maxRange: 50, homing: true,
    homingTurnRate: 1.8, waterLevel: false, splashScale: 2.0,
    tiers: [
      { name: "Rope Shot" },
      { name: "Barbed Chain",  damage: 4.5, homingTurnRate: 2.4 },
      { name: "Anchor Chain",  damage: 6,   homingTurnRate: 3.0, perk: "slow" }
    ]
  },
  firebomb: {
    name: "Tar Bomb", key: 2, fireRate: 4.0, damage: 6, projSpeed: 18,
    ammoCost: 5, color: 0x44aaff, trailColor: 0x88ccff, projRadius: 0.25,
    gravity: 0, loft: 0, maxRange: 35, homing: false,
    waterLevel: true, splashScale: 3.5, wakeTrail: true,
    tiers: [
      { name: "Tar Bomb" },
      { name: "Greek Fire",     damage: 9, splashScale: 4.5 },
      { name: "Hellfire Bomb",  damage: 13, splashScale: 6.0, perk: "burn" }
    ]
  }
};

var WEAPON_ORDER = ["cannon", "chainshot", "firebomb"];

export function getEffectiveConfig(weaponKey, tier) {
  var base = WEAPON_TYPES[weaponKey];
  if (!base) return null;
  var tierDef = base.tiers && base.tiers[tier];
  if (!tierDef) return base;
  // Shallow merge — tier properties override base
  var cfg = {};
  for (var k in base) { if (base.hasOwnProperty(k) && k !== "tiers") cfg[k] = base[k]; }
  for (var k in tierDef) { if (tierDef.hasOwnProperty(k)) cfg[k] = tierDef[k]; }
  return cfg;
}

var sharedGeo = {}, sharedMat = {};
var wakeGeo = null, wakeMat = null;
var smallSplashGeo = null;
var bigSplashGeo = null, bigSplashMat = null;
var flashGeo = null, flashMat = null;
var aimRaycaster = null, aimNdc = null, waterPlane = null;
var trailPool = {};
var projPool = {};
var flashPool = [];
var wakePool = [];
var splashPool = [];

var TRAIL_POOL_SIZE = 64;
var PROJ_POOL_SIZE = 8;
var FLASH_POOL_SIZE = 4;
var WAKE_POOL_SIZE = 16;
var SPLASH_POOL_SIZE = 12;

function ensureMaterials() {
  if (flashGeo) return;
  for (var i = 0; i < WEAPON_ORDER.length; i++) {
    var key = WEAPON_ORDER[i];
    var cfg = WEAPON_TYPES[key];
    sharedGeo[key] = new THREE.SphereGeometry(cfg.projRadius, 6, 4);
    sharedMat[key] = new THREE.MeshBasicMaterial({ color: cfg.color });
    var trailColor = cfg.trailColor || cfg.color;
    sharedMat[key + "_trail"] = new THREE.MeshBasicMaterial({ color: trailColor, transparent: true, opacity: 0.6 });
    trailPool[key] = [];
    for (var j = 0; j < TRAIL_POOL_SIZE; j++) {
      var tm = new THREE.Mesh(sharedGeo[key], sharedMat[key + "_trail"].clone());
      tm.scale.setScalar(0.5);
      tm.visible = false;
      trailPool[key].push(tm);
    }
    projPool[key] = [];
    for (var j = 0; j < PROJ_POOL_SIZE; j++) {
      var geo = key === "firebomb" ? new THREE.CylinderGeometry(0.12, 0.15, 0.6, 6) : sharedGeo[key];
      var pm = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: cfg.color }));
      pm.visible = false;
      projPool[key].push(pm);
    }
  }
  sharedGeo.firebomb = new THREE.CylinderGeometry(0.12, 0.15, 0.6, 6);
  flashGeo = new THREE.SphereGeometry(0.3, 6, 4);
  flashMat = new THREE.MeshBasicMaterial({ color: 0xffee88, transparent: true, opacity: 0.9 });
  for (var i = 0; i < FLASH_POOL_SIZE; i++) {
    var fm = new THREE.Mesh(flashGeo, new THREE.MeshBasicMaterial({ color: 0xffee88, transparent: true, opacity: 0.9 }));
    fm.visible = false;
    flashPool.push(fm);
  }
  wakeGeo = new THREE.PlaneGeometry(0.3, 0.3);
  wakeMat = new THREE.MeshBasicMaterial({ color: 0xaaccdd, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
  for (var i = 0; i < WAKE_POOL_SIZE; i++) {
    var wm = new THREE.Mesh(wakeGeo, new THREE.MeshBasicMaterial({ color: 0xaaccdd, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
    wm.rotation.x = -Math.PI / 2;
    wm.visible = false;
    wakePool.push(wm);
  }
  smallSplashGeo = new THREE.RingGeometry(0.1, 0.6, 8);
  bigSplashGeo = new THREE.RingGeometry(0.2, 1.2, 12);
  bigSplashMat = new THREE.MeshBasicMaterial({ color: 0x88bbdd, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
  for (var i = 0; i < SPLASH_POOL_SIZE; i++) {
    var half = Math.floor(SPLASH_POOL_SIZE / 2);
    var isSmall = i < half;
    var sg = new THREE.Mesh(
      isSmall ? smallSplashGeo : bigSplashGeo,
      new THREE.MeshBasicMaterial({ color: isSmall ? 0x88aacc : 0x88bbdd, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
    );
    sg.rotation.x = -Math.PI / 2;
    sg.visible = false;
    sg.userData.isSmall = isSmall;
    splashPool.push(sg);
  }
  aimRaycaster = new THREE.Raycaster();
  aimNdc = new THREE.Vector2();
  waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.3);
}

function acquireProjMesh(weaponKey, scene) {
  var pool = projPool[weaponKey];
  if (pool) {
    for (var i = 0; i < pool.length; i++) {
      if (!pool[i].visible) {
        pool[i].visible = true;
        if (!pool[i].parent) scene.add(pool[i]);
        return pool[i];
      }
    }
  }
  var geo = weaponKey === "firebomb" ? sharedGeo.firebomb : sharedGeo[weaponKey];
  var pm = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: WEAPON_TYPES[weaponKey].color }));
  scene.add(pm);
  return pm;
}

function releaseProjMesh(mesh) {
  mesh.visible = false;
}

function acquireFlashMesh(scene) {
  for (var i = 0; i < flashPool.length; i++) {
    if (!flashPool[i].visible) {
      flashPool[i].visible = true;
      if (!flashPool[i].parent) scene.add(flashPool[i]);
      return flashPool[i];
    }
  }
  var fm = new THREE.Mesh(flashGeo, new THREE.MeshBasicMaterial({ color: 0xffee88, transparent: true, opacity: 0.9 }));
  scene.add(fm);
  return fm;
}

function acquireWakeMesh(scene) {
  for (var i = 0; i < wakePool.length; i++) {
    if (!wakePool[i].visible) {
      wakePool[i].visible = true;
      if (!wakePool[i].parent) scene.add(wakePool[i]);
      return wakePool[i];
    }
  }
  var wm = new THREE.Mesh(wakeGeo, new THREE.MeshBasicMaterial({ color: 0xaaccdd, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
  wm.rotation.x = -Math.PI / 2;
  scene.add(wm);
  return wm;
}

function acquireSplashMesh(isSmall, scene) {
  for (var i = 0; i < splashPool.length; i++) {
    if (!splashPool[i].visible && splashPool[i].userData.isSmall === isSmall) {
      splashPool[i].visible = true;
      if (!splashPool[i].parent) scene.add(splashPool[i]);
      return splashPool[i];
    }
  }
  var sg = new THREE.Mesh(
    isSmall ? smallSplashGeo : bigSplashGeo,
    new THREE.MeshBasicMaterial({ color: isSmall ? 0x88aacc : 0x88bbdd, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
  );
  sg.rotation.x = -Math.PI / 2;
  sg.userData.isSmall = isSmall;
  scene.add(sg);
  return sg;
}

function releasePoolMesh(mesh) {
  mesh.visible = false;
}

function acquireTrailMesh(weaponKey, scene) {
  var pool = trailPool[weaponKey];
  if (pool) {
    for (var i = 0; i < pool.length; i++) {
      if (!pool[i].visible) {
        pool[i].visible = true;
        if (!pool[i].parent) scene.add(pool[i]);
        return pool[i];
      }
    }
  }
  // pool exhausted — fallback
  var tm = new THREE.Mesh(sharedGeo[weaponKey], sharedMat[weaponKey + "_trail"].clone());
  tm.scale.setScalar(0.5);
  scene.add(tm);
  return tm;
}

function releaseTrailMesh(mesh) {
  mesh.visible = false;
}

export function createWeaponState(ship) {
  ensureMaterials();
  var turretGroups = ship.mesh.userData.turrets || [];
  return {
    ship: ship, turretGroups: turretGroups, activeWeapon: 0,
    projectiles: [], effects: [], cooldown: 0, shotCount: 0,
    aimWorldPos: new THREE.Vector3(0, 0, 0),
    onNetHitCallback: null,  // called with (targetType, targetId, damage) for multiplayer sync
    weaponTiers: { cannon: 0, chainshot: 0, firebomb: 0 }
  };
}

export function setWeaponHitCallback(state, callback) {
  state.onNetHitCallback = callback;
}

export function getActiveWeapon(state) {
  return WEAPON_TYPES[WEAPON_ORDER[state.activeWeapon]];
}

export function getActiveWeaponName(state) {
  var key = WEAPON_ORDER[state.activeWeapon];
  var tier = state.weaponTiers ? (state.weaponTiers[key] || 0) : 0;
  var cfg = getEffectiveConfig(key, tier);
  return cfg ? cfg.name : WEAPON_TYPES[key].name;
}

export function getActiveTierName(state) {
  var key = WEAPON_ORDER[state.activeWeapon];
  var tier = state.weaponTiers ? (state.weaponTiers[key] || 0) : 0;
  var cfg = getEffectiveConfig(key, tier);
  return cfg ? cfg.name : key;
}

export function getWeaponOrder() { return WEAPON_ORDER; }

export function getWeaponConfig(key) { return WEAPON_TYPES[key]; }

export function switchWeapon(state, index) {
  if (index >= 0 && index < WEAPON_ORDER.length) {
    state.activeWeapon = index;
  }
}

export function aimWeapons(state, worldTarget) {
  state.aimWorldPos.copy(worldTarget);
  // fire points are invisible Object3D markers — no rotation needed
}

export function fireWeapon(state, scene, resources, upgradeMults) {
  var fireRateMult = upgradeMults ? upgradeMults.fireRate : 1;
  var projSpeedMult = upgradeMults ? upgradeMults.projSpeed : 1;
  var damageMult = upgradeMults ? upgradeMults.damage : 1;
  if (state.cooldown > 0) return;

  var weaponKey = WEAPON_ORDER[state.activeWeapon];
  var tier = state.weaponTiers ? (state.weaponTiers[weaponKey] || 0) : 0;
  var cfg = getEffectiveConfig(weaponKey, tier);

  if (resources) {
    if (resources.ammo < cfg.ammoCost) return;
    for (var a = 0; a < cfg.ammoCost; a++) {
      if (!spendAmmo(resources)) break;
    }
  }

  state.cooldown = cfg.fireRate / fireRateMult;
  state.shotCount++;

  var turretIdx = state.shotCount % state.turretGroups.length;
  var firePoint = state.turretGroups[turretIdx];
  var barrelTip = new THREE.Vector3();
  firePoint.getWorldPosition(barrelTip);

  var dir = new THREE.Vector3();
  dir.subVectors(state.aimWorldPos, barrelTip);
  dir.y = 0;
  dir.normalize();

  var effectiveProjSpeed = cfg.projSpeed * projSpeedMult;
  if (cfg.waterLevel) barrelTip.y = 0.3;

  var velocity = new THREE.Vector3(
    dir.x * effectiveProjSpeed,
    cfg.waterLevel ? 0 : effectiveProjSpeed * cfg.loft,
    dir.z * effectiveProjSpeed
  );

  var projMesh = acquireProjMesh(weaponKey, scene);
  projMesh.position.copy(barrelTip);
  if (weaponKey === "firebomb") {
    projMesh.rotation.x = Math.PI / 2;
    projMesh.rotation.order = "YXZ";
    projMesh.rotation.y = Math.atan2(dir.x, dir.z);
  } else {
    projMesh.rotation.set(0, 0, 0);
  }

  var proj = {
    mesh: projMesh, velocity: velocity, origin: barrelTip.clone(),
    age: 0, trail: [], damageMult: cfg.damage * damageMult,
    weaponKey: weaponKey, cfg: cfg
  };
  if (cfg.perk === "pierce") proj.pierceCount = 1;
  state.projectiles.push(proj);
  spawnFlash(state, scene, barrelTip);
}

function spawnFlash(state, scene, position) {
  var mesh = acquireFlashMesh(scene);
  mesh.material.opacity = 0.9;
  mesh.scale.setScalar(1);
  mesh.position.copy(position);
  state.effects.push({ type: "flash", mesh: mesh, life: 0.08 });
}

function spawnSplash(state, scene, position, scale) {
  var isSmall = scale <= 2.0;
  var mesh = acquireSplashMesh(isSmall, scene);
  mesh.material.opacity = 0.8;
  mesh.scale.setScalar(1);
  mesh.position.copy(position);
  mesh.position.y = 0.4;
  state.effects.push({ type: "splash", mesh: mesh, life: 0.3 * scale, maxLife: 0.3 * scale, scale: scale });
}

function spawnWake(state, scene, position) {
  var mesh = acquireWakeMesh(scene);
  mesh.material.opacity = 0.5;
  mesh.scale.setScalar(1);
  mesh.position.set(position.x, 0.35, position.z);
  state.effects.push({ type: "wake", mesh: mesh, life: 0.8, maxLife: 0.8 });
}

function spawnBurnZone(state, scene, position, splashScale, enemyManager) {
  var radius = (splashScale || 3.5) * 0.5;
  var geo = new THREE.CircleGeometry(radius, 12);
  var mat = new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
  var mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(position.x, 0.25, position.z);
  scene.add(mesh);
  state.effects.push({
    type: "burn",
    mesh: mesh,
    life: 4.0, maxLife: 4.0,
    posX: position.x, posZ: position.z,
    radius: radius,
    damagePerSec: 1.0,
    _lastDamageTick: 0,
    enemyManager: enemyManager
  });
}

// activeBoss: optional boss object for hit detection
// terrain: optional terrain for projectile blocking
export function updateWeapons(state, dt, scene, enemyManager, activeBoss, terrain) {
  var enemies = enemyManager ? enemyManager.enemies : [];
  state.cooldown = Math.max(0, state.cooldown - dt);

  var alive = [];
  for (var i = 0; i < state.projectiles.length; i++) {
    var p = state.projectiles[i];
    p.age += dt;
    var cfg = p.cfg;

    p.velocity.y -= cfg.gravity * dt;

    if (cfg.homing && enemies.length > 0) {
      applyHoming(p, enemies, cfg.homingTurnRate, dt);
    }

    var prevX = p.mesh.position.x;
    var prevZ = p.mesh.position.z;
    p.mesh.position.x += p.velocity.x * dt;
    p.mesh.position.y += p.velocity.y * dt;
    p.mesh.position.z += p.velocity.z * dt;

    if (cfg.waterLevel) {
      p.mesh.position.y = 0.3;
      p.velocity.y = 0;
      p.mesh.rotation.y = Math.atan2(p.velocity.x, p.velocity.z);
    }

    var trailMesh = acquireTrailMesh(p.weaponKey, scene);
    trailMesh.position.copy(p.mesh.position);
    trailMesh.material.opacity = 0.6;
    p.trail.push({ mesh: trailMesh, life: 0.3 });

    var aliveTrail = [];
    for (var t = 0; t < p.trail.length; t++) {
      p.trail[t].life -= dt;
      if (p.trail[t].life <= 0) {
        releaseTrailMesh(p.trail[t].mesh);
      } else {
        p.trail[t].mesh.material.opacity = p.trail[t].life / 0.3;
        aliveTrail.push(p.trail[t]);
      }
    }
    p.trail = aliveTrail;

    if (cfg.wakeTrail && p.age > 0.1) {
      if (Math.floor(p.age * 10) !== Math.floor((p.age - dt) * 10)) {
        spawnWake(state, scene, p.mesh.position);
      }
    }

    var dx = p.mesh.position.x - p.origin.x;
    var dz = p.mesh.position.z - p.origin.z;
    var dist = Math.sqrt(dx * dx + dz * dz);
    var hitWater = !cfg.waterLevel && p.mesh.position.y < 0.2;
    var hitTerrain = terrain && isLand(terrain, p.mesh.position.x, p.mesh.position.z);
    var outOfRange = dist > cfg.maxRange;
    var hitEnemy = checkEnemyHit(p, prevX, prevZ, enemies, enemyManager, scene, state);
    var hitBoss = !hitEnemy && checkBossHit(p, prevX, prevZ, activeBoss, scene, state);

    if (hitWater || hitTerrain || outOfRange || hitEnemy || hitBoss) {
      if (hitWater || hitTerrain || hitEnemy || hitBoss) {
        spawnSplash(state, scene, p.mesh.position, cfg.splashScale);
        if (cfg.perk === "burn") {
          spawnBurnZone(state, scene, p.mesh.position.clone(), cfg.splashScale, enemyManager);
        }
        // differentiated impact sounds
        if (hitEnemy || hitBoss) playImpactSound("metal");
        else if (hitTerrain) playImpactSound("terrain");
        else if (hitWater) playImpactSound("water");
      }
      for (var t = 0; t < p.trail.length; t++) {
        releaseTrailMesh(p.trail[t].mesh);
      }
      releaseProjMesh(p.mesh);
    } else {
      alive.push(p);
    }
  }
  state.projectiles = alive;

  var aliveEffects = [];
  for (var i = 0; i < state.effects.length; i++) {
    var e = state.effects[i];
    e.life -= dt;
    if (e.life <= 0) {
      if (e.type === "burn") {
        scene.remove(e.mesh);
        if (e.mesh.geometry) e.mesh.geometry.dispose();
        if (e.mesh.material) e.mesh.material.dispose();
      } else {
        releasePoolMesh(e.mesh);
      }
    } else {
      if (e.type === "flash") {
        e.mesh.material.opacity = e.life / 0.08;
        e.mesh.scale.setScalar(1 + (1 - e.life / 0.08) * 2);
      } else if (e.type === "splash") {
        var progress = 1 - e.life / e.maxLife;
        e.mesh.material.opacity = 0.8 * (1 - progress);
        e.mesh.scale.setScalar(1 + progress * 3 * (e.scale || 1));
      } else if (e.type === "wake") {
        var wProg = 1 - e.life / e.maxLife;
        e.mesh.material.opacity = 0.5 * (1 - wProg);
        e.mesh.scale.setScalar(1 + wProg * 2);
      } else if (e.type === "burn") {
        var bProg = 1 - e.life / e.maxLife;
        e.mesh.material.opacity = 0.35 * (1 - bProg * 0.5);
        // damage enemies in radius every second
        e._lastDamageTick = (e._lastDamageTick || 0) + dt;
        if (e._lastDamageTick >= 1.0) {
          e._lastDamageTick -= 1.0;
          if (e.enemyManager) {
            var burnEnemies = e.enemyManager.enemies;
            for (var ei = 0; ei < burnEnemies.length; ei++) {
              if (!burnEnemies[ei].alive) continue;
              var bdx = burnEnemies[ei].posX - e.posX;
              var bdz = burnEnemies[ei].posZ - e.posZ;
              if (bdx * bdx + bdz * bdz < e.radius * e.radius) {
                damageEnemy(e.enemyManager, burnEnemies[ei], scene, e.damagePerSec);
              }
            }
          }
        }
      }
      aliveEffects.push(e);
    }
  }
  state.effects = aliveEffects;
}

function applyHoming(projectile, enemies, turnRate, dt) {
  var px = projectile.mesh.position.x;
  var pz = projectile.mesh.position.z;
  var nearest = null, nearestDist = Infinity;
  for (var i = 0; i < enemies.length; i++) {
    if (!enemies[i].alive) continue;
    var dx = enemies[i].posX - px;
    var dz = enemies[i].posZ - pz;
    var d = dx * dx + dz * dz;
    if (d < nearestDist) { nearestDist = d; nearest = enemies[i]; }
  }
  if (!nearest) return;

  var vx = projectile.velocity.x, vz = projectile.velocity.z;
  var speed = Math.sqrt(vx * vx + vz * vz);
  if (speed < 0.1) return;

  var currentAngle = Math.atan2(vx, vz);
  var targetAngle = Math.atan2(nearest.posX - px, nearest.posZ - pz);
  var diff = targetAngle - currentAngle;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;

  var maxTurn = turnRate * dt;
  if (Math.abs(diff) > maxTurn) diff = Math.sign(diff) * maxTurn;

  var newAngle = currentAngle + diff;
  projectile.velocity.x = Math.sin(newAngle) * speed;
  projectile.velocity.z = Math.cos(newAngle) * speed;
}

// OBB ratios for heading-aligned ship hitbox
var OBB_LENGTH_RATIO = 0.8;
var OBB_WIDTH_RATIO = 0.5;
var HITBOX_PADDING = 0.22;

function pointInShipOBB(px, pz, shipX, shipZ, heading, halfL, halfW) {
  var dx = px - shipX;
  var dz = pz - shipZ;
  var cosH = Math.cos(heading);
  var sinH = Math.sin(heading);
  var localZ = dx * sinH + dz * cosH;
  var localX = dx * cosH - dz * sinH;
  return Math.abs(localZ) <= halfL && Math.abs(localX) <= halfW;
}

function getTargetHalfExtents(target, fallbackRadius, projRadius) {
  var halfL = target.hitHalfL || ((fallbackRadius || 2.0) * OBB_LENGTH_RATIO);
  var halfW = target.hitHalfW || ((fallbackRadius || 2.0) * OBB_WIDTH_RATIO);
  var pad = (projRadius || 0.12) + HITBOX_PADDING;
  return { halfL: halfL + pad, halfW: halfW + pad };
}

function segmentSteps(x0, z0, x1, z1, sampleSpacing) {
  var dx = x1 - x0;
  var dz = z1 - z0;
  var len = Math.sqrt(dx * dx + dz * dz);
  return Math.max(1, Math.ceil(len / Math.max(0.15, sampleSpacing)));
}

function checkEnemyHit(projectile, prevX, prevZ, enemies, enemyManager, scene, weaponState) {
  if (!enemies) return false;
  var pp = projectile.mesh.position;
  var dmg = projectile.damageMult || 1;
  var projRadius = projectile.cfg && projectile.cfg.projRadius ? projectile.cfg.projRadius : 0.12;

  for (var i = 0; i < enemies.length; i++) {
    var enemy = enemies[i];
    if (!enemy.alive) continue;
    var ex = enemy.posX;
    var ez = enemy.posZ;
    var hitRadius = enemy.hitRadius || 2.0;
    var ext = getTargetHalfExtents(enemy, hitRadius, projRadius);
    var broad = Math.max(hitRadius, ext.halfL, ext.halfW);

    var midX = (prevX + pp.x) * 0.5;
    var midZ = (prevZ + pp.z) * 0.5;
    var bdx = midX - ex;
    var bdz = midZ - ez;
    if (bdx * bdx + bdz * bdz > (broad * broad * 2.2)) continue;

    var steps = segmentSteps(prevX, prevZ, pp.x, pp.z, Math.min(ext.halfW, ext.halfL) * 0.8);
    for (var sIdx = 0; sIdx <= steps; sIdx++) {
      var t = sIdx / steps;
      var sx = prevX + (pp.x - prevX) * t;
      var sz = prevZ + (pp.z - prevZ) * t;
      if (pointInShipOBB(sx, sz, ex, ez, enemy.heading, ext.halfL, ext.halfW)) {
        var slowHit = projectile.cfg && projectile.cfg.perk === "slow";
        if (enemyManager) damageEnemy(enemyManager, enemy, scene, dmg, slowHit);
        if (weaponState && weaponState.onNetHitCallback) {
          weaponState.onNetHitCallback("enemy", i, dmg);
        }
        if (projectile.pierceCount && projectile.pierceCount > 0) {
          projectile.pierceCount--;
          break; // stop checking sub-steps for this enemy but continue to next enemy
        }
        return true;
      }
    }
  }
  return false;
}

function checkBossHit(projectile, prevX, prevZ, boss, scene, weaponState) {
  if (!boss || !boss.alive) return false;
  var pp = projectile.mesh.position;
  var dmg = projectile.damageMult || 1;
  var projRadius = projectile.cfg && projectile.cfg.projRadius ? projectile.cfg.projRadius : 0.12;
  var hitRadius = boss.hitRadius || 5.0;
  var ext = getTargetHalfExtents(boss, hitRadius, projRadius);

  var midX = (prevX + pp.x) * 0.5;
  var midZ = (prevZ + pp.z) * 0.5;
  var dx = midX - boss.posX, dz = midZ - boss.posZ;
  var broad = Math.max(hitRadius, ext.halfL, ext.halfW);
  if (dx * dx + dz * dz > (broad * broad * 2.2)) return false;

  var steps = segmentSteps(prevX, prevZ, pp.x, pp.z, Math.min(ext.halfW, ext.halfL) * 0.8);
  for (var sIdx = 0; sIdx <= steps; sIdx++) {
    var t = sIdx / steps;
    var sx = prevX + (pp.x - prevX) * t;
    var sz = prevZ + (pp.z - prevZ) * t;
    if (pointInShipOBB(sx, sz, boss.posX, boss.posZ, boss.heading, ext.halfL, ext.halfW)) {
      damageBoss(boss, dmg, scene);
      if (weaponState && weaponState.onNetHitCallback) {
        weaponState.onNetHitCallback("boss", 0, dmg);
      }
      return true;
    }
  }
  return false;
}

export function findNearestEnemy(ship, enemies) {
  if (!enemies || enemies.length === 0) return null;
  var best = null, bestDist = Infinity;
  for (var i = 0; i < enemies.length; i++) {
    var e = enemies[i];
    if (!e.alive) continue;
    var dx = e.posX - ship.posX, dz = e.posZ - ship.posZ;
    var distSq = dx * dx + dz * dz;
    if (distSq < bestDist) { bestDist = distSq; best = e; }
  }
  return best;
}

export function getActiveWeaponRange(state) {
  var cfg = WEAPON_TYPES[WEAPON_ORDER[state.activeWeapon]];
  return cfg ? cfg.maxRange : 120;
}

export function aimAtEnemy(state, enemy) {
  if (!enemy || !enemy.alive) return;
  aimWeapons(state, new THREE.Vector3(enemy.posX, enemy.mesh.position.y, enemy.posZ));
}

export function screenToWorld(screenX, screenY, camera) {
  ensureMaterials();
  aimNdc.set(
    (screenX / window.innerWidth) * 2 - 1,
    -(screenY / window.innerHeight) * 2 + 1
  );
  aimRaycaster.setFromCamera(aimNdc, camera);
  var target = new THREE.Vector3();
  aimRaycaster.ray.intersectPlane(waterPlane, target);
  return target || new THREE.Vector3(0, 0.3, 0);
}

export function rollWeaponUpgradeKey(weaponTiers) {
  var keys = ["cannon", "chainshot", "firebomb"];
  var eligible = keys.filter(function(k) { return (weaponTiers[k] || 0) < 2; });
  if (eligible.length === 0) return null;
  // weight: tier 0 = 3, tier 1 = 2 (tier 2 already filtered)
  var weights = eligible.map(function(k) { return 3 - (weaponTiers[k] || 0); });
  var total = weights.reduce(function(a, b) { return a + b; }, 0);
  var r = Math.random() * total;
  var acc = 0;
  for (var i = 0; i < eligible.length; i++) {
    acc += weights[i];
    if (r < acc) return eligible[i];
  }
  return eligible[eligible.length - 1];
}
