// enemy.js — enemy patrol boats: spawn, chase AI, firing, health, destruction
import * as THREE from "three";
import { isLand, collideWithTerrain, terrainBlocksLine } from "./terrain.js";

// --- tuning ---
var ENEMY_SPEED = 14;
var ENEMY_TURN_SPEED = 1.8;
var ENGAGE_DIST = 25;          // desired engagement distance
var ARRIVE_TOLERANCE = 5;
var FIRE_RANGE = 30;
var FIRE_COOLDOWN = 1.5;       // seconds between enemy shots
var ENEMY_PROJ_SPEED = 30;
var ENEMY_PROJ_GRAVITY = 9.8;
var FLOAT_OFFSET = 1.0;
var BUOYANCY_LERP = 8;
var TILT_LERP = 6;
var TILT_DAMPING = 0.3;        // gentle tilt, not wild rotation

// spawn tuning
var SPAWN_DIST_MIN = 80;
var SPAWN_DIST_MAX = 120;
var INITIAL_SPAWN_INTERVAL = 6;   // seconds
var MIN_SPAWN_INTERVAL = 2;
var SPAWN_ACCEL = 0.02;           // interval decreases per second
var MAX_ENEMIES = 12;

// destruction tuning
var SINK_SPEED = 1.5;
var SINK_DURATION = 3.0;
var PARTICLE_COUNT = 12;
var PARTICLE_SPEED = 8;
var PARTICLE_LIFE = 1.0;

// health
var ENEMY_HP = 3;
var PLAYER_HP = 10;

// --- shared geometry ---
var particleGeo = null;
var particleMat = null;
var enemyProjGeo = null;
var enemyProjMat = null;

function ensureGeo() {
  if (particleGeo) return;
  particleGeo = new THREE.SphereGeometry(0.15, 4, 3);
  particleMat = new THREE.MeshBasicMaterial({ color: 0xff6622, transparent: true });
  enemyProjGeo = new THREE.SphereGeometry(0.1, 6, 4);
  enemyProjMat = new THREE.MeshBasicMaterial({ color: 0xff4422 });
}

// --- shared PBR materials for enemy meshes ---
var enemyHullMat = null;
var enemyDeckMat = null;
var enemyBridgeMat = null;
var enemyTurretMat = null;
var enemyBarrelMat = null;
var enemyGlassMat = null;

function ensureEnemyMats() {
  if (enemyHullMat) return;
  enemyHullMat = new THREE.MeshStandardMaterial({ color: 0x6a3030, roughness: 0.65, metalness: 0.15 });
  enemyDeckMat = new THREE.MeshStandardMaterial({ color: 0x7a4040, roughness: 0.5, metalness: 0.05 });
  enemyBridgeMat = new THREE.MeshStandardMaterial({ color: 0x8a5050, roughness: 0.45, metalness: 0.2 });
  enemyTurretMat = new THREE.MeshStandardMaterial({ color: 0x5a2828, roughness: 0.35, metalness: 0.7 });
  enemyBarrelMat = new THREE.MeshStandardMaterial({ color: 0x4a1e1e, roughness: 0.3, metalness: 0.8 });
  enemyGlassMat = new THREE.MeshStandardMaterial({
    color: 0x2a1a1a, roughness: 0.1, metalness: 0.5,
    emissive: 0x2a1a1a, emissiveIntensity: 0
  });
}

// --- build enemy patrol boat mesh (unique design, not a player recolor) ---
// angular, aggressive hull shape with ram bow and low-slung profile
function buildEnemyMesh() {
  ensureEnemyMats();
  var group = new THREE.Group();

  // hull — angular patrol boat with ram bow (distinct from player curves)
  var hullShape = new THREE.Shape();
  hullShape.moveTo(0, 2.0);
  hullShape.lineTo(0.35, 1.5);
  hullShape.lineTo(0.55, 0.8);
  hullShape.lineTo(0.6, 0);
  hullShape.lineTo(0.55, -0.8);
  hullShape.lineTo(0.45, -1.3);
  hullShape.lineTo(0.3, -1.5);
  hullShape.lineTo(-0.3, -1.5);
  hullShape.lineTo(-0.45, -1.3);
  hullShape.lineTo(-0.55, -0.8);
  hullShape.lineTo(-0.6, 0);
  hullShape.lineTo(-0.55, 0.8);
  hullShape.lineTo(-0.35, 1.5);
  hullShape.lineTo(0, 2.0);

  var hullGeo = new THREE.ExtrudeGeometry(hullShape, {
    depth: 0.38, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.03, bevelSegments: 1
  });
  var hull = new THREE.Mesh(hullGeo, enemyHullMat);
  hull.rotation.x = -Math.PI / 2;
  hull.position.y = -0.1;
  group.add(hull);

  // waterline
  var wlGeo = new THREE.PlaneGeometry(1.1, 3.2);
  var wlMat = new THREE.MeshStandardMaterial({ color: 0x1a0a0a, roughness: 0.9, metalness: 0 });
  var wl = new THREE.Mesh(wlGeo, wlMat);
  wl.rotation.x = -Math.PI / 2;
  wl.position.set(0, 0.01, 0.1);
  group.add(wl);

  // deck
  var deckGeo = new THREE.PlaneGeometry(0.85, 2.8);
  var deck = new THREE.Mesh(deckGeo, enemyDeckMat);
  deck.rotation.x = -Math.PI / 2;
  deck.position.set(0, 0.28, 0.1);
  group.add(deck);

  // pilothouse — squat, angular (different from player bridge style)
  var bridgeGeo = new THREE.BoxGeometry(0.45, 0.38, 0.5);
  var bridge = new THREE.Mesh(bridgeGeo, enemyBridgeMat);
  bridge.position.set(0, 0.47, -0.35);
  group.add(bridge);
  // window strip
  var winGeo = new THREE.PlaneGeometry(0.36, 0.14);
  var win = new THREE.Mesh(winGeo, enemyGlassMat);
  win.position.set(0, 0.52, -0.09);
  group.add(win);

  // turret — single fore-mounted
  var turretGeo = new THREE.CylinderGeometry(0.15, 0.2, 0.2, 8);
  var barrelGeo = new THREE.CylinderGeometry(0.025, 0.03, 0.5, 6);

  var turret = new THREE.Group();
  turret.position.set(0, 0.4, 0.6);
  turret.add(new THREE.Mesh(turretGeo, enemyTurretMat));
  var barrel = new THREE.Mesh(barrelGeo, enemyBarrelMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.06, 0.25);
  turret.add(barrel);
  group.add(turret);

  group.userData.turret = turret;

  // nav lights (red port, green starboard)
  var portMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  var stbdMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
  var lightGeo = new THREE.SphereGeometry(0.035, 4, 3);
  var port = new THREE.Mesh(lightGeo, portMat);
  port.position.set(-0.5, 0.28, 0.6);
  group.add(port);
  var stbd = new THREE.Mesh(lightGeo, stbdMat);
  stbd.position.set(0.5, 0.28, 0.6);
  group.add(stbd);

  return group;
}

// --- normalize angle to [-PI, PI] ---
function normalizeAngle(a) {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

// --- create the enemy manager ---
export function createEnemyManager() {
  ensureGeo();
  return {
    enemies: [],
    projectiles: [],
    particles: [],
    spawnTimer: 3,            // first spawn after 3s
    spawnInterval: INITIAL_SPAWN_INTERVAL,
    elapsed: 0,
    playerHp: PLAYER_HP,
    playerMaxHp: PLAYER_HP,
    playerArmor: 0,           // damage reduction 0-1 from upgrades
    onDeathCallback: null,    // called with (x, y, z) when enemy destroyed
    onHitCallback: null       // called with (x, y, z, dmg) on any enemy hit
  };
}

// --- reset enemy manager for restart ---
export function resetEnemyManager(manager, scene) {
  // remove all enemy meshes, projectiles, particles from scene
  for (var i = 0; i < manager.enemies.length; i++) {
    scene.remove(manager.enemies[i].mesh);
  }
  for (var i = 0; i < manager.projectiles.length; i++) {
    scene.remove(manager.projectiles[i].mesh);
  }
  for (var i = 0; i < manager.particles.length; i++) {
    scene.remove(manager.particles[i].mesh);
  }
  manager.enemies = [];
  manager.projectiles = [];
  manager.particles = [];
  manager.spawnTimer = 3;
  manager.spawnInterval = INITIAL_SPAWN_INTERVAL;
  manager.playerHp = PLAYER_HP;
  manager.playerMaxHp = PLAYER_HP;
  manager.playerArmor = 0;
}

// --- set callback for enemy death (used for pickup spawning) ---
export function setOnDeathCallback(manager, callback) {
  manager.onDeathCallback = callback;
}

// --- set callback for enemy hit (used for floating damage numbers) ---
export function setOnHitCallback(manager, callback) {
  manager.onHitCallback = callback;
}

// --- set player HP (used by repair system) ---
export function setPlayerHp(manager, hp) {
  manager.playerHp = Math.min(manager.playerMaxHp, Math.max(0, hp));
}

// --- spawn a single enemy at map edge with wave multipliers ---
function spawnEnemy(manager, playerX, playerZ, scene, waveConfig, terrain) {
  if (manager.enemies.length >= MAX_ENEMIES) return;

  var hpMult = waveConfig ? waveConfig.hpMult : 1;
  var speedMult = waveConfig ? waveConfig.speedMult : 1;
  var fireRateMult = waveConfig ? waveConfig.fireRateMult : 1;

  var x, z;
  var attempts = 0;
  do {
    var angle = Math.random() * Math.PI * 2;
    var dist = SPAWN_DIST_MIN + Math.random() * (SPAWN_DIST_MAX - SPAWN_DIST_MIN);
    x = playerX + Math.sin(angle) * dist;
    z = playerZ + Math.cos(angle) * dist;
    attempts++;
  } while (terrain && isLand(terrain, x, z) && attempts < 30);

  var mesh = buildEnemyMesh();
  mesh.position.set(x, 0.3, z);

  var heading = Math.atan2(playerX - x, playerZ - z);
  mesh.rotation.y = heading;

  var scaledHp = Math.round(ENEMY_HP * hpMult);

  var enemy = {
    mesh: mesh,
    hp: scaledHp,
    maxHp: scaledHp,
    alive: true,
    hitRadius: 2.0,
    posX: x,
    posZ: z,
    heading: heading,
    speed: ENEMY_SPEED * speedMult * (0.7 + Math.random() * 0.3),
    fireCooldown: FIRE_COOLDOWN / fireRateMult * (0.8 + Math.random() * 0.4),
    fireTimer: 1 + Math.random() * 2,
    // destruction state
    sinking: false,
    sinkTimer: 0,
    // smoothed buoyancy state
    _smoothY: 0.3,
    _smoothPitch: 0,
    _smoothRoll: 0
  };

  manager.enemies.push(enemy);
  scene.add(mesh);
}

// --- update all enemies ---
// waveMgr: wave manager from wave.js (optional, for spawn gating)
// waveConfig: current wave config with multipliers (optional)
export function updateEnemies(manager, ship, dt, scene, getWaveHeight, elapsed, waveMgr, waveConfig, terrain) {
  manager.elapsed = elapsed;

  // --- spawning gated by wave manager ---
  var shouldSpawn = false;
  if (waveMgr) {
    // import-free check: waveMgr has enemiesToSpawn > 0 and state is SPAWNING or ACTIVE
    shouldSpawn = waveMgr.enemiesToSpawn > 0 && (waveMgr.state === "SPAWNING" || waveMgr.state === "ACTIVE");
  }

  manager.spawnTimer -= dt;
  if (manager.spawnTimer <= 0 && shouldSpawn) {
    spawnEnemy(manager, ship.posX, ship.posZ, scene, waveConfig, terrain);
    if (waveMgr) waveMgr.enemiesToSpawn--;
    // transition wave state if all spawned
    if (waveMgr && waveMgr.enemiesToSpawn <= 0) {
      waveMgr.state = "ACTIVE";
    }
    manager.spawnInterval = Math.max(
      MIN_SPAWN_INTERVAL,
      manager.spawnInterval - SPAWN_ACCEL * manager.spawnInterval
    );
    manager.spawnTimer = manager.spawnInterval;
  }

  // --- update each enemy ---
  var alive = [];
  for (var i = 0; i < manager.enemies.length; i++) {
    var e = manager.enemies[i];

    if (e.sinking) {
      // sinking animation
      e.sinkTimer += dt;
      e.mesh.position.y -= SINK_SPEED * dt;
      e.mesh.rotation.z += dt * 0.5;
      var sinkAlpha = 1 - e.sinkTimer / SINK_DURATION;
      e.mesh.traverse(function (child) {
        if (child.isMesh && child.material) {
          child.material.transparent = true;
          child.material.opacity = Math.max(0, sinkAlpha);
        }
      });
      if (e.sinkTimer >= SINK_DURATION) {
        scene.remove(e.mesh);
        continue;
      }
      alive.push(e);
      continue;
    }

    if (!e.alive) continue;

    // --- chase AI: steer toward player, maintain engagement distance ---
    var dx = ship.posX - e.posX;
    var dz = ship.posZ - e.posZ;
    var dist = Math.sqrt(dx * dx + dz * dz);

    var targetAngle = Math.atan2(dx, dz);
    var angleDiff = normalizeAngle(targetAngle - e.heading);

    // steer toward player
    var maxTurn = ENEMY_TURN_SPEED * dt;
    if (Math.abs(angleDiff) < maxTurn) {
      e.heading = targetAngle;
    } else {
      e.heading += Math.sign(angleDiff) * maxTurn;
    }

    // speed: full speed when far, slow down near engagement distance
    var speedFactor = 1;
    if (dist < ENGAGE_DIST) {
      speedFactor = Math.max(0.1, (dist - ARRIVE_TOLERANCE) / (ENGAGE_DIST - ARRIVE_TOLERANCE));
    }

    var moveSpeed = e.speed * speedFactor;
    // only move forward when roughly facing target
    var ePrevX = e.posX;
    var ePrevZ = e.posZ;
    if (Math.abs(angleDiff) < Math.PI * 0.6) {
      e.posX += Math.sin(e.heading) * moveSpeed * dt;
      e.posZ += Math.cos(e.heading) * moveSpeed * dt;
    }

    // terrain collision for enemies
    if (terrain) {
      var ecol = collideWithTerrain(terrain, e.posX, e.posZ, ePrevX, ePrevZ);
      if (ecol.collided) {
        e.posX = ecol.newX;
        e.posZ = ecol.newZ;
      }
    }

    // apply position to mesh
    e.mesh.position.x = e.posX;
    e.mesh.position.z = e.posZ;
    e.mesh.rotation.y = e.heading;

    // buoyancy — smooth Y + pitch/roll from wave surface normal
    if (getWaveHeight) {
      var targetY = getWaveHeight(e.posX, e.posZ, elapsed) + FLOAT_OFFSET;

      var sampleDist = 1.2;
      var waveFore = getWaveHeight(e.posX + Math.sin(e.heading) * sampleDist, e.posZ + Math.cos(e.heading) * sampleDist, elapsed);
      var waveAft  = getWaveHeight(e.posX - Math.sin(e.heading) * sampleDist, e.posZ - Math.cos(e.heading) * sampleDist, elapsed);
      var wavePort = getWaveHeight(e.posX + Math.cos(e.heading) * sampleDist, e.posZ - Math.sin(e.heading) * sampleDist, elapsed);
      var waveStbd = getWaveHeight(e.posX - Math.cos(e.heading) * sampleDist, e.posZ + Math.sin(e.heading) * sampleDist, elapsed);

      var targetPitch = Math.atan2(waveFore - waveAft, sampleDist * 2) * TILT_DAMPING;
      var targetRoll  = Math.atan2(wavePort - waveStbd, sampleDist * 2) * TILT_DAMPING;

      var lerpFactor = 1 - Math.exp(-BUOYANCY_LERP * dt);
      var tiltFactor = 1 - Math.exp(-TILT_LERP * dt);
      e._smoothY += (targetY - e._smoothY) * lerpFactor;
      e._smoothPitch += (targetPitch - e._smoothPitch) * tiltFactor;
      e._smoothRoll += (targetRoll - e._smoothRoll) * tiltFactor;

      e.mesh.position.y = e._smoothY;
      e.mesh.rotation.x = e._smoothPitch;
      e.mesh.rotation.z = e._smoothRoll;
    }

    // aim turret at player
    var turret = e.mesh.userData.turret;
    if (turret) {
      var localAngle = targetAngle - e.heading;
      turret.rotation.y = localAngle;
    }

    // --- firing (blocked by terrain line-of-sight) ---
    e.fireTimer -= dt;
    var hasLOS = !terrain || !terrainBlocksLine(terrain, e.posX, e.posZ, ship.posX, ship.posZ);
    if (e.fireTimer <= 0 && dist < FIRE_RANGE && hasLOS) {
      enemyFire(manager, e, ship, scene);
      e.fireTimer = e.fireCooldown;
    }

    alive.push(e);
  }
  manager.enemies = alive;

  // --- update enemy projectiles ---
  updateEnemyProjectiles(manager, ship, dt, scene, terrain);

  // --- update explosion particles ---
  updateParticles(manager, dt, scene);
}

// --- enemy fires a projectile at player ---
function enemyFire(manager, enemy, ship, scene) {
  ensureGeo();

  // barrel tip in world space
  var turret = enemy.mesh.userData.turret;
  var barrelTip = new THREE.Vector3(0, 0.08, 0.5);
  if (turret) {
    turret.localToWorld(barrelTip);
  } else {
    barrelTip.set(enemy.posX, 1.0, enemy.posZ);
  }

  // direction toward player
  var dx = ship.posX - barrelTip.x;
  var dz = ship.posZ - barrelTip.z;
  var dist = Math.sqrt(dx * dx + dz * dz);
  if (dist < 0.1) return;

  var dirX = dx / dist;
  var dirZ = dz / dist;

  var velocity = new THREE.Vector3(
    dirX * ENEMY_PROJ_SPEED,
    ENEMY_PROJ_SPEED * 0.08,
    dirZ * ENEMY_PROJ_SPEED
  );

  var projMesh = new THREE.Mesh(enemyProjGeo, enemyProjMat);
  projMesh.position.copy(barrelTip);
  scene.add(projMesh);

  manager.projectiles.push({
    mesh: projMesh,
    velocity: velocity,
    origin: barrelTip.clone(),
    age: 0
  });
}

// --- update enemy projectiles and check hits on player ---
function updateEnemyProjectiles(manager, ship, dt, scene, terrain) {
  var alive = [];
  for (var i = 0; i < manager.projectiles.length; i++) {
    var p = manager.projectiles[i];
    p.age += dt;

    p.velocity.y -= ENEMY_PROJ_GRAVITY * dt;
    p.mesh.position.x += p.velocity.x * dt;
    p.mesh.position.y += p.velocity.y * dt;
    p.mesh.position.z += p.velocity.z * dt;

    // distance from origin
    var dx = p.mesh.position.x - p.origin.x;
    var dz = p.mesh.position.z - p.origin.z;
    var dist = Math.sqrt(dx * dx + dz * dz);

    // hit water or terrain
    var hitWater = p.mesh.position.y < 0.2;
    var hitTerrain = terrain && isLand(terrain, p.mesh.position.x, p.mesh.position.z);
    var outOfRange = dist > 50;

    // hit player
    var hitPlayer = false;
    var pdx = p.mesh.position.x - ship.posX;
    var pdz = p.mesh.position.z - ship.posZ;
    var pDistSq = pdx * pdx + pdz * pdz;
    if (pDistSq < 2.5 * 2.5) {
      hitPlayer = true;
      var incomingDmg = Math.max(0.1, 1 - (manager.playerArmor || 0));
      manager.playerHp = Math.max(0, manager.playerHp - incomingDmg);
    }

    if (hitWater || hitTerrain || outOfRange || hitPlayer) {
      scene.remove(p.mesh);
    } else {
      alive.push(p);
    }
  }
  manager.projectiles = alive;
}

// --- spawn explosion particles ---
function spawnExplosion(manager, x, y, z, scene) {
  ensureGeo();
  for (var i = 0; i < PARTICLE_COUNT; i++) {
    var mesh = new THREE.Mesh(particleGeo, particleMat.clone());
    mesh.position.set(x, y + 0.5, z);
    scene.add(mesh);

    var angle = Math.random() * Math.PI * 2;
    var upSpeed = 3 + Math.random() * 5;
    var outSpeed = PARTICLE_SPEED * (0.3 + Math.random() * 0.7);

    manager.particles.push({
      mesh: mesh,
      vx: Math.sin(angle) * outSpeed,
      vy: upSpeed,
      vz: Math.cos(angle) * outSpeed,
      life: PARTICLE_LIFE
    });
  }
}

// --- update explosion particles ---
function updateParticles(manager, dt, scene) {
  var alive = [];
  for (var i = 0; i < manager.particles.length; i++) {
    var p = manager.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      scene.remove(p.mesh);
      continue;
    }
    p.vy -= 9.8 * dt;
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    p.mesh.position.z += p.vz * dt;
    p.mesh.material.opacity = p.life / PARTICLE_LIFE;
    p.mesh.scale.setScalar(0.5 + (1 - p.life / PARTICLE_LIFE) * 1.5);
    alive.push(p);
  }
  manager.particles = alive;
}

// --- called when an enemy is hit by player projectile ---
// damageMult: multiplier from upgrades (optional, defaults to 1)
export function damageEnemy(manager, enemy, scene, damageMult) {
  var dmg = Math.round(1 * (damageMult || 1));
  if (dmg < 1) dmg = 1;
  enemy.hp -= dmg;
  if (manager.onHitCallback) {
    manager.onHitCallback(enemy.posX, enemy.mesh.position.y, enemy.posZ, dmg);
  }
  if (enemy.hp <= 0) {
    enemy.alive = false;
    enemy.sinking = true;
    enemy.sinkTimer = 0;
    spawnExplosion(manager, enemy.posX, enemy.mesh.position.y, enemy.posZ, scene);
    if (manager.onDeathCallback) {
      manager.onDeathCallback(enemy.posX, enemy.mesh.position.y, enemy.posZ);
    }
  }
}

// --- set player armor from upgrades ---
export function setPlayerArmor(manager, armor) {
  manager.playerArmor = armor;
}

// --- set player max HP from upgrades ---
export function setPlayerMaxHp(manager, maxHp) {
  manager.playerMaxHp = maxHp;
}

// --- get player hp info ---
export function getPlayerHp(manager) {
  return { hp: manager.playerHp, maxHp: manager.playerMaxHp };
}
