// enemy.js — enemy patrol boats: spawn, faction AI, firing, health, destruction
import * as THREE from "three";
import { isLand, collideWithTerrain, terrainBlocksLine } from "./terrain.js";
import { getOverridePath, getOverrideSize } from "./artOverrides.js";
import { loadFbxVisual } from "./fbxVisual.js";
import { nextRandom } from "./rng.js";

// --- faction definitions ---
var FACTIONS = {
  pirate: {
    label: "Pirate",
    hullColor: 0xaa2828, deckColor: 0x882020, bridgeColor: 0x993030,
    turretColor: 0x881818, barrelColor: 0x771010, glassColor: 0x4a1818,
    speed: 18, turnSpeed: 2.2, engageDist: 12, fireRange: 25, fireCooldown: 1.2,
    hp: 2, goldMult: 1.0, groupSize: [3, 5],
    announce: "Pirate Fleet Approaching!"
  },
  navy: {
    label: "Royal Navy",
    hullColor: 0x2a4a88, deckColor: 0x3a5a99, bridgeColor: 0x4a6aaa,
    turretColor: 0x2a4a77, barrelColor: 0x1a3a66, glassColor: 0x1a3a66,
    speed: 12, turnSpeed: 1.4, engageDist: 30, fireRange: 38, fireCooldown: 1.0,
    hp: 5, goldMult: 2.0, groupSize: [2, 4],
    announce: "Royal Navy Patrol!"
  },
  merchant: {
    label: "Merchant",
    hullColor: 0x886838, deckColor: 0x997848, bridgeColor: 0xaa8858,
    turretColor: 0x775828, barrelColor: 0x664820, glassColor: 0x4a3820,
    speed: 10, turnSpeed: 1.6, engageDist: 50, fireRange: 20, fireCooldown: 2.5,
    hp: 3, goldMult: 3.0, groupSize: [1, 3],
    announce: "Merchant Convoy Spotted!"
  }
};

export function getFactions() { return FACTIONS; }
export function getFactionAnnounce(faction) {
  var f = FACTIONS[faction];
  return f ? f.announce : "Fleet Approaching!";
}
export function getFactionGoldMult(faction) {
  var f = FACTIONS[faction];
  return f ? f.goldMult : 1;
}

// --- tuning ---
var ENEMY_SPEED = 14;
var ENEMY_TURN_SPEED = 1.8;
var ENGAGE_DIST = 25;
var ARRIVE_TOLERANCE = 5;
var FIRE_RANGE = 30;
var FIRE_COOLDOWN = 1.5;
var ENEMY_PROJ_SPEED = 30;
var ENEMY_PROJ_GRAVITY = 9.8;
var FLOAT_OFFSET = 1.4;
var BUOYANCY_LERP = 12;
var TILT_LERP = 8;
var TILT_DAMPING = 0.3;

// spawn tuning
var SPAWN_DIST_MIN = 80;
var SPAWN_DIST_MAX = 120;
var INITIAL_SPAWN_INTERVAL = 6;
var MIN_SPAWN_INTERVAL = 2;
var SPAWN_ACCEL = 0.02;
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

// --- per-faction PBR material cache ---
var factionMats = {};

function getFactionMats(faction) {
  if (factionMats[faction]) return factionMats[faction];
  var f = FACTIONS[faction] || FACTIONS.pirate;
  factionMats[faction] = {
    hull: new THREE.MeshToonMaterial({ color: f.hullColor }),
    deck: new THREE.MeshToonMaterial({ color: f.deckColor }),
    bridge: new THREE.MeshToonMaterial({ color: f.bridgeColor }),
    turret: new THREE.MeshToonMaterial({ color: f.turretColor }),
    barrel: new THREE.MeshToonMaterial({ color: f.barrelColor }),
    glass: new THREE.MeshToonMaterial({ color: f.glassColor })
  };
  return factionMats[faction];
}

// --- build enemy patrol boat mesh with faction colors ---
function buildEnemyMesh(faction) {
  var mats = getFactionMats(faction || "pirate");
  var group = new THREE.Group();

  // hull — angular patrol boat with ram bow
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
  var hull = new THREE.Mesh(hullGeo, mats.hull);
  hull.rotation.x = -Math.PI / 2;
  hull.position.y = -0.1;
  group.add(hull);

  var wlGeo = new THREE.PlaneGeometry(1.1, 3.2);
  var wlMat = new THREE.MeshToonMaterial({ color: 0x1a0a0a });
  var wl = new THREE.Mesh(wlGeo, wlMat);
  wl.rotation.x = -Math.PI / 2;
  wl.position.set(0, 0.01, 0.1);
  group.add(wl);

  var deckGeo = new THREE.PlaneGeometry(0.85, 2.8);
  var deck = new THREE.Mesh(deckGeo, mats.deck);
  deck.rotation.x = -Math.PI / 2;
  deck.position.set(0, 0.28, 0.1);
  group.add(deck);

  var bridgeGeo = new THREE.BoxGeometry(0.45, 0.38, 0.5);
  var bridge = new THREE.Mesh(bridgeGeo, mats.bridge);
  bridge.position.set(0, 0.47, -0.35);
  group.add(bridge);
  var winGeo = new THREE.PlaneGeometry(0.36, 0.14);
  var win = new THREE.Mesh(winGeo, mats.glass);
  win.position.set(0, 0.52, -0.09);
  group.add(win);

  var turretGeo = new THREE.CylinderGeometry(0.15, 0.2, 0.2, 8);
  var barrelGeo = new THREE.CylinderGeometry(0.025, 0.03, 0.5, 6);
  var turret = new THREE.Group();
  turret.position.set(0, 0.4, 0.6);
  turret.add(new THREE.Mesh(turretGeo, mats.turret));
  var barrel = new THREE.Mesh(barrelGeo, mats.barrel);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.06, 0.25);
  turret.add(barrel);
  group.add(turret);
  group.userData.turret = turret;

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

function placeEnemyTurretFromBounds(mesh, turret) {
  if (!turret) return;
  var box = new THREE.Box3().setFromObject(mesh);
  var size = new THREE.Vector3();
  box.getSize(size);
  var y = box.min.y + Math.max(0.2, size.y * 0.4);
  var z = box.max.z - Math.max(0.4, size.z * 0.18);
  turret.position.set(0, y, z);
  turret.rotation.set(0, 0, 0);
  turret.visible = false;
  if (!turret.parent) mesh.add(turret);
}

function applyEnemyOverrideAsync(mesh) {
  var path = getOverridePath("enemy_patrol");
  if (!path) return;
  var fitSize = getOverrideSize("enemy_patrol") || 6;
  var turret = mesh.userData.turret || null;
  loadFbxVisual(path, fitSize, true).then(function (visual) {
    while (mesh.children.length) mesh.remove(mesh.children[0]);
    mesh.add(visual);
    placeEnemyTurretFromBounds(mesh, turret);
    mesh.userData.turret = turret;
  }).catch(function () {
    // keep procedural fallback on failure
  });
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
  var faction = (waveConfig && waveConfig.faction) ? waveConfig.faction : "pirate";
  var fDef = FACTIONS[faction] || FACTIONS.pirate;

  var x, z;
  var attempts = 0;
  do {
    var angle = nextRandom() * Math.PI * 2;
    var dist = SPAWN_DIST_MIN + nextRandom() * (SPAWN_DIST_MAX - SPAWN_DIST_MIN);
    x = playerX + Math.sin(angle) * dist;
    z = playerZ + Math.cos(angle) * dist;
    attempts++;
  } while (terrain && isLand(terrain, x, z) && attempts < 30);

  var mesh = buildEnemyMesh(faction);
  applyEnemyOverrideAsync(mesh);
  mesh.position.set(x, 0.3, z);

  var heading = Math.atan2(playerX - x, playerZ - z);
  mesh.rotation.y = heading;

  var scaledHp = Math.round(fDef.hp * hpMult);

  var enemy = {
    mesh: mesh,
    faction: faction,
    hp: scaledHp,
    maxHp: scaledHp,
    alive: true,
    hitRadius: 2.0,
    posX: x,
    posZ: z,
    heading: heading,
    speed: fDef.speed * speedMult * (0.7 + nextRandom() * 0.3),
    turnSpeed: fDef.turnSpeed,
    engageDist: fDef.engageDist,
    fireRange: fDef.fireRange,
    fireCooldown: fDef.fireCooldown / fireRateMult * (0.8 + nextRandom() * 0.4),
    fireTimer: 1 + nextRandom() * 2,
    sinking: false,
    sinkTimer: 0,
    _smoothY: 0.3,
    _smoothPitch: 0,
    _smoothRoll: 0,
    _buoyancyInit: false
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

    // --- faction AI ---
    var dx = ship.posX - e.posX;
    var dz = ship.posZ - e.posZ;
    var dist = Math.sqrt(dx * dx + dz * dz);
    var targetAngle = Math.atan2(dx, dz);
    var fleeAngle = normalizeAngle(targetAngle + Math.PI);
    var eTurnSpeed = e.turnSpeed || ENEMY_TURN_SPEED;
    var eEngageDist = e.engageDist || ENGAGE_DIST;
    var maxTurn = eTurnSpeed * dt;
    var moveSpeed = e.speed;
    var steerAngle = targetAngle;
    var ePrevX = e.posX;
    var ePrevZ = e.posZ;

    if (e.faction === "merchant") {
      // Merchant AI: flee from player, only fire backward when cornered
      steerAngle = fleeAngle;
      if (dist < 15) moveSpeed = e.speed * 1.3; // panic burst
    } else if (e.faction === "navy") {
      // Navy AI: hold formation at engagement range, broadside fire
      if (dist < eEngageDist) {
        // circle strafe — perpendicular to player
        steerAngle = normalizeAngle(targetAngle + Math.PI * 0.5);
        moveSpeed = e.speed * 0.6;
      }
    } else {
      // Pirate AI: aggressive rush, close distance fast
      if (dist < eEngageDist) {
        moveSpeed = e.speed * Math.max(0.3, dist / eEngageDist);
      }
    }

    var angleDiff = normalizeAngle(steerAngle - e.heading);
    if (Math.abs(angleDiff) < maxTurn) {
      e.heading = steerAngle;
    } else {
      e.heading += Math.sign(angleDiff) * maxTurn;
    }

    if (Math.abs(angleDiff) < Math.PI * 0.6) {
      e.posX += Math.sin(e.heading) * moveSpeed * dt;
      e.posZ += Math.cos(e.heading) * moveSpeed * dt;
    }

    if (terrain) {
      var ecol = collideWithTerrain(terrain, e.posX, e.posZ, ePrevX, ePrevZ);
      if (ecol.collided) {
        e.posX = ecol.newX;
        e.posZ = ecol.newZ;
      }
    }

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

      // snap to surface on first frame so enemy never starts underwater
      if (!e._buoyancyInit) {
        e._buoyancyInit = true;
        e._smoothY = targetY;
        e._smoothPitch = targetPitch;
        e._smoothRoll = targetRoll;
      }

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

    // --- firing (faction-aware) ---
    var eFireRange = e.fireRange || FIRE_RANGE;
    e.fireTimer -= dt;
    var hasLOS = !terrain || !terrainBlocksLine(terrain, e.posX, e.posZ, ship.posX, ship.posZ);
    var canFire = e.fireTimer <= 0 && dist < eFireRange && hasLOS;
    // Merchant: only fires when cornered (player close behind)
    if (canFire && e.faction === "merchant") {
      var rearAngle = Math.abs(normalizeAngle(targetAngle - e.heading));
      canFire = rearAngle > Math.PI * 0.5 && dist < 20;
    }
    if (canFire) {
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

// --- OBB player ship hit test (heading-aligned bounding box) ---
var PLAYER_OBB_HALF_L = 1.5;  // half-length along heading
var PLAYER_OBB_HALF_W = 0.9;  // half-width perpendicular

function pointInPlayerOBB(px, pz, ship) {
  var dx = px - ship.posX;
  var dz = pz - ship.posZ;
  var cosH = Math.cos(ship.heading);
  var sinH = Math.sin(ship.heading);
  var localZ = dx * sinH + dz * cosH;
  var localX = dx * cosH - dz * sinH;
  return Math.abs(localZ) <= PLAYER_OBB_HALF_L && Math.abs(localX) <= PLAYER_OBB_HALF_W;
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

    // hit player — OBB aligned to ship heading
    var hitPlayer = false;
    var pdx = p.mesh.position.x - ship.posX;
    var pdz = p.mesh.position.z - ship.posZ;
    var pDistSq = pdx * pdx + pdz * pdz;
    // broad-phase radius check
    if (pDistSq < 2.5 * 2.5) {
      // narrow-phase OBB
      if (pointInPlayerOBB(p.mesh.position.x, p.mesh.position.z, ship)) {
        hitPlayer = true;
        var incomingDmg = Math.max(0.1, 1 - (manager.playerArmor || 0));
        manager.playerHp = Math.max(0, manager.playerHp - incomingDmg);
      }
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

    var angle = nextRandom() * Math.PI * 2;
    var upSpeed = 3 + nextRandom() * 5;
    var outSpeed = PARTICLE_SPEED * (0.3 + nextRandom() * 0.7);

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
      manager.onDeathCallback(enemy.posX, enemy.mesh.position.y, enemy.posZ, enemy.faction);
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
