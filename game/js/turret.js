// turret.js — turret aiming, firing, projectile physics, hit detection, visual effects
import * as THREE from "three";
import { damageEnemy } from "./enemy.js";
import { spendAmmo } from "./resource.js";

// --- tuning ---
var PROJECTILE_SPEED = 60;
var GRAVITY = 9.8;
var MAX_RANGE = 120;
var FIRE_COOLDOWN = 0.4;        // seconds between shots
var AMMO_PER_WAVE = 50;
var MUZZLE_FLASH_DURATION = 0.08;
var TRAIL_SEGMENT_LIFE = 0.3;
var SPLASH_DURATION = 0.3;

// --- shared geometry / materials ---
var projectileGeo = null;
var projectileMat = null;
var trailMat = null;
var flashGeo = null;
var flashMat = null;
var splashGeo = null;
var splashMat = null;
var aimRaycaster = null;
var aimNdc = null;
var waterPlane = null;

function ensureMaterials() {
  if (projectileGeo) return;
  projectileGeo = new THREE.SphereGeometry(0.12, 6, 4);
  projectileMat = new THREE.MeshBasicMaterial({ color: 0xffcc44 });
  trailMat = new THREE.MeshBasicMaterial({ color: 0xffcc44, transparent: true, opacity: 0.6 });
  flashGeo = new THREE.SphereGeometry(0.3, 6, 4);
  flashMat = new THREE.MeshBasicMaterial({ color: 0xffee88, transparent: true, opacity: 0.9 });
  splashGeo = new THREE.RingGeometry(0.1, 0.6, 8);
  splashMat = new THREE.MeshBasicMaterial({
    color: 0x88aacc, transparent: true, opacity: 0.7, side: THREE.DoubleSide
  });
  aimRaycaster = new THREE.Raycaster();
  aimNdc = new THREE.Vector2();
  waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.3);
}

// --- turret state ---
export function createTurretSystem(ship) {
  ensureMaterials();
  var turretGroups = ship.mesh.userData.turrets || [];
  return {
    ship: ship,
    turretGroups: turretGroups,
    projectiles: [],       // active projectiles in scene
    effects: [],           // muzzle flashes, splashes
    ammo: AMMO_PER_WAVE,
    maxAmmo: AMMO_PER_WAVE,
    shotCount: 0,          // total shots fired (for turret alternation)
    cooldown: 0,
    aimWorldPos: new THREE.Vector3(0, 0, 0)
  };
}

// --- aim turrets toward a world-space target ---
export function aimTurrets(turretState, worldTarget) {
  turretState.aimWorldPos.copy(worldTarget);
  var ship = turretState.ship;

  for (var i = 0; i < turretState.turretGroups.length; i++) {
    var turret = turretState.turretGroups[i];

    // get turret world position
    var turretWorld = new THREE.Vector3();
    turret.getWorldPosition(turretWorld);

    // direction from turret to target in world space
    var dx = worldTarget.x - turretWorld.x;
    var dz = worldTarget.z - turretWorld.z;

    // angle in world space
    var worldAngle = Math.atan2(dx, dz);

    // subtract ship heading to get local rotation
    var localAngle = worldAngle - ship.heading;

    turret.rotation.y = localAngle;
  }
}

// --- fire projectile from first available turret ---
// upgradeMults: { fireRate, projSpeed, damage } from upgrade system (optional)
export function fire(turretState, scene, resources, upgradeMults) {
  var fireRateMult = upgradeMults ? upgradeMults.fireRate : 1;
  var projSpeedMult = upgradeMults ? upgradeMults.projSpeed : 1;
  var damageMult = upgradeMults ? upgradeMults.damage : 1;

  if (turretState.cooldown > 0) return;

  // use resource system for ammo if available, else fallback to internal
  if (resources) {
    if (!spendAmmo(resources)) return;
    // sync turret display state
    turretState.ammo = resources.ammo;
    turretState.maxAmmo = resources.maxAmmo;
  } else {
    if (turretState.ammo <= 0) return;
    turretState.ammo--;
  }

  turretState.cooldown = FIRE_COOLDOWN / fireRateMult;
  turretState.shotCount++;

  // alternate turrets
  var turretIdx = turretState.shotCount % turretState.turretGroups.length;
  var turret = turretState.turretGroups[turretIdx];

  // get barrel tip world position (barrel is at local z=0.35, plus half barrel length ~0.35)
  var barrelTip = new THREE.Vector3(0, 0.1, 0.7);
  turret.localToWorld(barrelTip);

  // direction toward aim point
  var dir = new THREE.Vector3();
  dir.subVectors(turretState.aimWorldPos, barrelTip);
  dir.y = 0; // keep horizontal for initial direction
  dir.normalize();

  // slight upward arc for gravity
  var effectiveProjSpeed = PROJECTILE_SPEED * projSpeedMult;
  var velocity = new THREE.Vector3(
    dir.x * effectiveProjSpeed,
    effectiveProjSpeed * 0.08,  // slight loft
    dir.z * effectiveProjSpeed
  );

  // create projectile mesh
  var projMesh = new THREE.Mesh(projectileGeo, projectileMat);
  projMesh.position.copy(barrelTip);
  scene.add(projMesh);

  // trail segments
  var trail = [];

  var proj = {
    mesh: projMesh,
    velocity: velocity,
    origin: barrelTip.clone(),
    age: 0,
    trail: trail,
    damageMult: damageMult
  };
  turretState.projectiles.push(proj);

  // muzzle flash
  spawnFlash(turretState, scene, barrelTip);

  // sound placeholder
  console.log("[SFX] FIRE turret " + turretIdx);
}

// --- muzzle flash ---
function spawnFlash(turretState, scene, position) {
  var mesh = new THREE.Mesh(flashGeo, flashMat.clone());
  mesh.position.copy(position);
  scene.add(mesh);
  turretState.effects.push({
    type: "flash",
    mesh: mesh,
    life: MUZZLE_FLASH_DURATION
  });
}

// --- impact splash ---
function spawnSplash(turretState, scene, position) {
  var mesh = new THREE.Mesh(splashGeo, splashMat.clone());
  mesh.position.copy(position);
  mesh.position.y = 0.4; // just above water
  mesh.rotation.x = -Math.PI / 2;
  scene.add(mesh);
  turretState.effects.push({
    type: "splash",
    mesh: mesh,
    life: SPLASH_DURATION,
    maxLife: SPLASH_DURATION
  });
  console.log("[SFX] SPLASH at", position.x.toFixed(1), position.z.toFixed(1));
}

// --- update projectiles, effects, cooldown ---
export function updateTurrets(turretState, dt, scene, enemyManager) {
  var enemies = enemyManager ? enemyManager.enemies : [];
  // cooldown
  turretState.cooldown = Math.max(0, turretState.cooldown - dt);

  // update projectiles
  var alive = [];
  for (var i = 0; i < turretState.projectiles.length; i++) {
    var p = turretState.projectiles[i];
    p.age += dt;

    // apply gravity
    p.velocity.y -= GRAVITY * dt;

    // move
    p.mesh.position.x += p.velocity.x * dt;
    p.mesh.position.y += p.velocity.y * dt;
    p.mesh.position.z += p.velocity.z * dt;

    // trail segment (uses transparent material so opacity fading works)
    var trailMesh = new THREE.Mesh(projectileGeo, trailMat.clone());
    trailMesh.scale.setScalar(0.5);
    trailMesh.position.copy(p.mesh.position);
    scene.add(trailMesh);
    p.trail.push({ mesh: trailMesh, life: TRAIL_SEGMENT_LIFE });

    // update trail
    var aliveTrail = [];
    for (var t = 0; t < p.trail.length; t++) {
      p.trail[t].life -= dt;
      if (p.trail[t].life <= 0) {
        scene.remove(p.trail[t].mesh);
      } else {
        p.trail[t].mesh.material.opacity = p.trail[t].life / TRAIL_SEGMENT_LIFE;
        aliveTrail.push(p.trail[t]);
      }
    }
    p.trail = aliveTrail;

    // distance check
    var dx = p.mesh.position.x - p.origin.x;
    var dz = p.mesh.position.z - p.origin.z;
    var dist = Math.sqrt(dx * dx + dz * dz);

    // hit water (below surface)
    var hitWater = p.mesh.position.y < 0.2;
    // hit max range
    var outOfRange = dist > MAX_RANGE;
    // hit enemy
    var hitEnemy = checkEnemyHit(p, enemies, enemyManager, scene);

    if (hitWater || outOfRange || hitEnemy) {
      // splash on water hit or enemy hit
      if (hitWater || hitEnemy) {
        spawnSplash(turretState, scene, p.mesh.position);
      }
      if (hitEnemy) {
        console.log("[SFX] HIT enemy!");
      }
      // clean up trail
      for (var t = 0; t < p.trail.length; t++) {
        scene.remove(p.trail[t].mesh);
      }
      scene.remove(p.mesh);
    } else {
      alive.push(p);
    }
  }
  turretState.projectiles = alive;

  // update effects
  var aliveEffects = [];
  for (var i = 0; i < turretState.effects.length; i++) {
    var e = turretState.effects[i];
    e.life -= dt;
    if (e.life <= 0) {
      scene.remove(e.mesh);
    } else {
      if (e.type === "flash") {
        e.mesh.material.opacity = e.life / MUZZLE_FLASH_DURATION;
        e.mesh.scale.setScalar(1 + (1 - e.life / MUZZLE_FLASH_DURATION) * 2);
      } else if (e.type === "splash") {
        var progress = 1 - e.life / e.maxLife;
        e.mesh.material.opacity = 0.7 * (1 - progress);
        e.mesh.scale.setScalar(1 + progress * 3);
      }
      aliveEffects.push(e);
    }
  }
  turretState.effects = aliveEffects;
}

// --- enemy hit detection (bounding sphere) ---
function checkEnemyHit(projectile, enemies, enemyManager, scene) {
  if (!enemies) return false;
  var pp = projectile.mesh.position;
  var dmgMult = projectile.damageMult || 1;
  for (var i = 0; i < enemies.length; i++) {
    var enemy = enemies[i];
    if (!enemy.alive) continue;
    var ex = enemy.mesh.position.x;
    var ez = enemy.mesh.position.z;
    var dx = pp.x - ex;
    var dz = pp.z - ez;
    var distSq = dx * dx + dz * dz;
    var hitRadius = enemy.hitRadius || 2.0;
    if (distSq < hitRadius * hitRadius) {
      if (enemyManager) {
        damageEnemy(enemyManager, enemy, scene, dmgMult);
      }
      return true;
    }
  }
  return false;
}

// --- project screen coords to world XZ plane (for aiming) ---
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
