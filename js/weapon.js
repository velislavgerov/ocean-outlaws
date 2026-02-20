// weapon.js — weapon type definitions, weapon state, switching logic
import * as THREE from "three";
import { damageEnemy } from "./enemy.js";
import { spendAmmo } from "./resource.js";
import { damageBoss } from "./boss.js";

var WEAPON_TYPES = {
  turret: {
    name: "Turret", key: 0, fireRate: 1.0, damage: 1, projSpeed: 35,
    ammoCost: 1, color: 0xffcc44, trailColor: 0xffcc44, projRadius: 0.12,
    gravity: 9.8, loft: 0.08, maxRange: 40, homing: false,
    waterLevel: false, splashScale: 1.0
  },
  missile: {
    name: "Missile", key: 1, fireRate: 2.5, damage: 3, projSpeed: 28,
    ammoCost: 3, color: 0xff6644, trailColor: 0xff8844, projRadius: 0.2,
    gravity: 2.0, loft: 0.15, maxRange: 50, homing: true,
    homingTurnRate: 1.8, waterLevel: false, splashScale: 2.0
  },
  torpedo: {
    name: "Torpedo", key: 2, fireRate: 4.0, damage: 6, projSpeed: 18,
    ammoCost: 5, color: 0x44aaff, trailColor: 0x88ccff, projRadius: 0.25,
    gravity: 0, loft: 0, maxRange: 35, homing: false,
    waterLevel: true, splashScale: 3.5, wakeTrail: true
  }
};

var WEAPON_ORDER = ["turret", "missile", "torpedo"];

var sharedGeo = {}, sharedMat = {};
var wakeGeo = null, wakeMat = null;
var bigSplashGeo = null, bigSplashMat = null;
var flashGeo = null, flashMat = null;
var aimRaycaster = null, aimNdc = null, waterPlane = null;

function ensureMaterials() {
  if (flashGeo) return;
  for (var i = 0; i < WEAPON_ORDER.length; i++) {
    var key = WEAPON_ORDER[i];
    var cfg = WEAPON_TYPES[key];
    sharedGeo[key] = new THREE.SphereGeometry(cfg.projRadius, 6, 4);
    sharedMat[key] = new THREE.MeshBasicMaterial({ color: cfg.color });
  }
  sharedGeo.torpedo = new THREE.CylinderGeometry(0.12, 0.15, 0.6, 6);
  flashGeo = new THREE.SphereGeometry(0.3, 6, 4);
  flashMat = new THREE.MeshBasicMaterial({ color: 0xffee88, transparent: true, opacity: 0.9 });
  wakeGeo = new THREE.PlaneGeometry(0.3, 0.3);
  wakeMat = new THREE.MeshBasicMaterial({ color: 0xaaccdd, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
  bigSplashGeo = new THREE.RingGeometry(0.2, 1.2, 12);
  bigSplashMat = new THREE.MeshBasicMaterial({ color: 0x88bbdd, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
  aimRaycaster = new THREE.Raycaster();
  aimNdc = new THREE.Vector2();
  waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.3);
}

export function createWeaponState(ship) {
  ensureMaterials();
  var turretGroups = ship.mesh.userData.turrets || [];
  return {
    ship: ship, turretGroups: turretGroups, activeWeapon: 0,
    projectiles: [], effects: [], cooldown: 0, shotCount: 0,
    aimWorldPos: new THREE.Vector3(0, 0, 0)
  };
}

export function getActiveWeapon(state) {
  return WEAPON_TYPES[WEAPON_ORDER[state.activeWeapon]];
}

export function getActiveWeaponName(state) {
  return WEAPON_TYPES[WEAPON_ORDER[state.activeWeapon]].name;
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
  var ship = state.ship;
  for (var i = 0; i < state.turretGroups.length; i++) {
    var turret = state.turretGroups[i];
    var turretWorld = new THREE.Vector3();
    turret.getWorldPosition(turretWorld);
    var dx = worldTarget.x - turretWorld.x;
    var dz = worldTarget.z - turretWorld.z;
    var worldAngle = Math.atan2(dx, dz);
    turret.rotation.y = worldAngle - ship.heading;
  }
}

export function fireWeapon(state, scene, resources, upgradeMults) {
  var fireRateMult = upgradeMults ? upgradeMults.fireRate : 1;
  var projSpeedMult = upgradeMults ? upgradeMults.projSpeed : 1;
  var damageMult = upgradeMults ? upgradeMults.damage : 1;
  if (state.cooldown > 0) return;

  var weaponKey = WEAPON_ORDER[state.activeWeapon];
  var cfg = WEAPON_TYPES[weaponKey];

  if (resources) {
    if (resources.ammo < cfg.ammoCost) return;
    for (var a = 0; a < cfg.ammoCost; a++) {
      if (!spendAmmo(resources)) break;
    }
  }

  state.cooldown = cfg.fireRate / fireRateMult;
  state.shotCount++;

  var turretIdx = state.shotCount % state.turretGroups.length;
  var turret = state.turretGroups[turretIdx];
  var barrelTip = new THREE.Vector3(0, 0.1, 0.7);
  turret.localToWorld(barrelTip);

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

  var projMesh;
  if (weaponKey === "torpedo") {
    projMesh = new THREE.Mesh(sharedGeo.torpedo, sharedMat.torpedo.clone());
    projMesh.rotation.x = Math.PI / 2;
    projMesh.rotation.order = "YXZ";
    projMesh.rotation.y = Math.atan2(dir.x, dir.z);
  } else if (weaponKey === "missile") {
    projMesh = new THREE.Mesh(sharedGeo.missile, sharedMat.missile.clone());
  } else {
    projMesh = new THREE.Mesh(sharedGeo.turret, sharedMat.turret.clone());
  }
  projMesh.position.copy(barrelTip);
  scene.add(projMesh);

  var proj = {
    mesh: projMesh, velocity: velocity, origin: barrelTip.clone(),
    age: 0, trail: [], damageMult: cfg.damage * damageMult,
    weaponKey: weaponKey, cfg: cfg
  };
  state.projectiles.push(proj);
  spawnFlash(state, scene, barrelTip);
}

function spawnFlash(state, scene, position) {
  var mesh = new THREE.Mesh(flashGeo, flashMat.clone());
  mesh.position.copy(position);
  scene.add(mesh);
  state.effects.push({ type: "flash", mesh: mesh, life: 0.08 });
}

function spawnSplash(state, scene, position, scale) {
  var geo = scale > 2.0 ? bigSplashGeo : new THREE.RingGeometry(0.1, 0.6, 8);
  var mat = new THREE.MeshBasicMaterial({
    color: scale > 2.0 ? 0x88bbdd : 0x88aacc,
    transparent: true, opacity: 0.8, side: THREE.DoubleSide
  });
  var mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(position);
  mesh.position.y = 0.4;
  mesh.rotation.x = -Math.PI / 2;
  scene.add(mesh);
  state.effects.push({ type: "splash", mesh: mesh, life: 0.3 * scale, maxLife: 0.3 * scale, scale: scale });
}

function spawnWake(state, scene, position) {
  var mesh = new THREE.Mesh(wakeGeo, wakeMat.clone());
  mesh.position.set(position.x, 0.35, position.z);
  mesh.rotation.x = -Math.PI / 2;
  scene.add(mesh);
  state.effects.push({ type: "wake", mesh: mesh, life: 0.8, maxLife: 0.8 });
}

// activeBoss: optional boss object for hit detection
export function updateWeapons(state, dt, scene, enemyManager, activeBoss) {
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

    p.mesh.position.x += p.velocity.x * dt;
    p.mesh.position.y += p.velocity.y * dt;
    p.mesh.position.z += p.velocity.z * dt;

    if (cfg.waterLevel) {
      p.mesh.position.y = 0.3;
      p.velocity.y = 0;
      p.mesh.rotation.y = Math.atan2(p.velocity.x, p.velocity.z);
    }

    var trailColor = cfg.trailColor || cfg.color;
    var trailMat = new THREE.MeshBasicMaterial({ color: trailColor, transparent: true, opacity: 0.6 });
    var trailMesh = new THREE.Mesh(sharedGeo[p.weaponKey], trailMat);
    trailMesh.scale.setScalar(0.5);
    trailMesh.position.copy(p.mesh.position);
    scene.add(trailMesh);
    p.trail.push({ mesh: trailMesh, life: 0.3 });

    var aliveTrail = [];
    for (var t = 0; t < p.trail.length; t++) {
      p.trail[t].life -= dt;
      if (p.trail[t].life <= 0) {
        scene.remove(p.trail[t].mesh);
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
    var outOfRange = dist > cfg.maxRange;
    var hitEnemy = checkEnemyHit(p, enemies, enemyManager, scene);
    var hitBoss = !hitEnemy && checkBossHit(p, activeBoss, scene);

    if (hitWater || outOfRange || hitEnemy || hitBoss) {
      if (hitWater || hitEnemy || hitBoss) {
        spawnSplash(state, scene, p.mesh.position, cfg.splashScale);
      }
      for (var t = 0; t < p.trail.length; t++) {
        scene.remove(p.trail[t].mesh);
      }
      scene.remove(p.mesh);
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
      scene.remove(e.mesh);
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

function checkEnemyHit(projectile, enemies, enemyManager, scene) {
  if (!enemies) return false;
  var pp = projectile.mesh.position;
  var dmg = projectile.damageMult || 1;
  for (var i = 0; i < enemies.length; i++) {
    var enemy = enemies[i];
    if (!enemy.alive) continue;
    var dx = pp.x - enemy.mesh.position.x;
    var dz = pp.z - enemy.mesh.position.z;
    var distSq = dx * dx + dz * dz;
    var hitRadius = enemy.hitRadius || 2.0;
    if (distSq < hitRadius * hitRadius) {
      if (enemyManager) damageEnemy(enemyManager, enemy, scene, dmg);
      return true;
    }
  }
  return false;
}

function checkBossHit(projectile, boss, scene) {
  if (!boss || !boss.alive) return false;
  var pp = projectile.mesh.position;
  var dmg = projectile.damageMult || 1;
  var dx = pp.x - boss.posX, dz = pp.z - boss.posZ;
  var distSq = dx * dx + dz * dz;
  var hitRadius = boss.hitRadius || 5.0;
  if (distSq < hitRadius * hitRadius) {
    damageBoss(boss, dmg, scene);
    return true;
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
