// boss.js — boss definitions, state machine, attacks, telegraphs, loot
import * as THREE from "three";
import { buildBossMesh } from "./bossModels.js";
import { collideWithTerrain, isLand } from "./terrain.js";

// --- boss definitions ---
var BOSS_DEFS = {
  battleship: {
    name: "Iron Leviathan",
    hp: 80,
    hitRadius: 5.0,
    speed: 6,
    turnSpeed: 0.8,
    phases: [
      { threshold: 1.0, attack: "broadside", interval: 3.0, projCount: 5, spread: 0.4 },
      { threshold: 0.5, attack: "broadside", interval: 2.0, projCount: 8, spread: 0.6 },
      { threshold: 0.25, attack: "barrage", interval: 1.5, projCount: 12, spread: 1.0 }
    ],
    color: 0x884444
  },
  carrier: {
    name: "Swarm Mother",
    hp: 60,
    hitRadius: 6.0,
    speed: 5,
    turnSpeed: 0.6,
    phases: [
      { threshold: 1.0, attack: "drones", interval: 5.0, droneCount: 2 },
      { threshold: 0.5, attack: "drones", interval: 3.5, droneCount: 4 },
      { threshold: 0.25, attack: "drones_barrage", interval: 2.5, droneCount: 6, projCount: 6, spread: 0.8 }
    ],
    color: 0x448844
  },
  kraken: {
    name: "The Kraken",
    hp: 100,
    hitRadius: 4.0,
    speed: 8,
    turnSpeed: 1.2,
    phases: [
      { threshold: 1.0, attack: "tentacle_sweep", interval: 4.0, tentacleCount: 3 },
      { threshold: 0.5, attack: "tentacle_grab", interval: 3.0, tentacleCount: 5 },
      { threshold: 0.25, attack: "tentacle_frenzy", interval: 2.0, tentacleCount: 8 }
    ],
    color: 0x664488
  }
};

// --- shared geometry ---
var BOSS_FLOAT_OFFSET = 1.5;
var BUOYANCY_LERP = 8;
var TILT_LERP = 6;
var TILT_DAMPING = 0.2;        // bosses are big, less tilt

var projGeo = null;
var projMat = null;

function ensureGeo() {
  if (projGeo) return;
  projGeo = new THREE.SphereGeometry(0.2, 6, 4);
  projMat = new THREE.MeshBasicMaterial({ color: 0xff4422 });
}

// --- get boss definition ---
export function getBossDef(bossType) {
  return BOSS_DEFS[bossType] || null;
}

// --- create boss state ---
export function createBoss(bossType, playerX, playerZ, scene, zoneDifficulty) {
  ensureGeo();
  var def = BOSS_DEFS[bossType];
  if (!def) return null;

  var mesh = buildBossMesh(bossType);
  var spawnDist = 80;
  var angle = Math.random() * Math.PI * 2;
  var x = playerX + Math.sin(angle) * spawnDist;
  var z = playerZ + Math.cos(angle) * spawnDist;
  mesh.position.set(x, 0.5, z);
  scene.add(mesh);

  var hpScale = 1 + (zoneDifficulty - 1) * 0.2;

  return {
    type: bossType,
    def: def,
    mesh: mesh,
    posX: x,
    posZ: z,
    heading: Math.atan2(playerX - x, playerZ - z),
    hp: Math.round(def.hp * hpScale),
    maxHp: Math.round(def.hp * hpScale),
    alive: true,
    hitRadius: def.hitRadius,
    phase: 0,
    attackTimer: 3.0,
    projectiles: [],
    telegraphs: [],
    droneSpawns: [],
    tentacleAttacks: [],
    sinking: false,
    sinkTimer: 0,
    defeated: false,
    // smoothed buoyancy state
    _smoothY: 0.5,
    _smoothPitch: 0,
    _smoothRoll: 0
  };
}

// --- get current phase index ---
function getCurrentPhase(boss) {
  var ratio = boss.hp / boss.maxHp;
  var phases = boss.def.phases;
  var phaseIdx = 0;
  for (var i = phases.length - 1; i >= 0; i--) {
    if (ratio <= phases[i].threshold) {
      phaseIdx = i;
    }
  }
  return phaseIdx;
}

// --- damage boss ---
export function damageBoss(boss, amount, scene) {
  if (!boss || !boss.alive) return;
  boss.hp -= amount;
  if (boss.hp <= 0) {
    boss.hp = 0;
    boss.alive = false;
    boss.sinking = true;
    boss.sinkTimer = 0;
    boss.defeated = true;
  } else {
    var newPhase = getCurrentPhase(boss);
    if (newPhase !== boss.phase) {
      boss.phase = newPhase;
      boss.mesh.traverse(function (child) {
        if (child.isMesh && child.material && child.material.color) {
          var origColor = child.material.color.getHex();
          child.material.color.setHex(0xffffff);
          setTimeout(function () {
            child.material.color.setHex(origColor);
          }, 150);
        }
      });
    }
  }
}

// --- spawn telegraph warning zone on water ---
function spawnTelegraph(boss, targetX, targetZ, radius, duration, scene) {
  var geo = new THREE.RingGeometry(0.5, radius, 24);
  var mat = new THREE.MeshBasicMaterial({
    color: 0xff2200, transparent: true, opacity: 0.0, side: THREE.DoubleSide
  });
  var mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(targetX, 0.4, targetZ);
  mesh.rotation.x = -Math.PI / 2;
  scene.add(mesh);

  boss.telegraphs.push({
    mesh: mesh,
    radius: radius,
    timer: duration,
    maxTimer: duration
  });
}

// --- fire a single boss projectile ---
function fireBossProjectile(boss, angle, speed, scene) {
  ensureGeo();
  var startX = boss.posX + Math.sin(angle) * 3;
  var startZ = boss.posZ + Math.cos(angle) * 3;
  var mesh = new THREE.Mesh(projGeo, projMat.clone());
  mesh.position.set(startX, 1.5, startZ);
  scene.add(mesh);

  boss.projectiles.push({
    mesh: mesh,
    vx: Math.sin(angle) * speed,
    vy: speed * 0.06,
    vz: Math.cos(angle) * speed,
    age: 0
  });
}

// --- broadside: aimed fan of projectiles ---
function attackBroadside(boss, ship, scene, phase) {
  var count = phase.projCount || 5;
  var spread = phase.spread || 0.4;

  var perpAngle = boss.heading + Math.PI / 2;
  var cx = boss.posX + Math.sin(boss.heading) * 5;
  var cz = boss.posZ + Math.cos(boss.heading) * 5;
  for (var i = 0; i < 3; i++) {
    var off = (i - 1) * 8;
    spawnTelegraph(boss, cx + Math.sin(perpAngle) * off, cz + Math.cos(perpAngle) * off, 5, 1.5, scene);
  }

  setTimeout(function () {
    if (!boss.alive) return;
    var baseAngle = Math.atan2(ship.posX - boss.posX, ship.posZ - boss.posZ);
    for (var i = 0; i < count; i++) {
      var ao = (i - (count - 1) / 2) * spread / count;
      fireBossProjectile(boss, baseAngle + ao, 45, scene);
    }
  }, 1500);
}

// --- barrage: 360-degree ring of projectiles ---
function attackBarrage(boss, scene, phase) {
  var count = phase.projCount || 12;
  spawnTelegraph(boss, boss.posX, boss.posZ, 12, 1.2, scene);

  setTimeout(function () {
    if (!boss.alive) return;
    for (var i = 0; i < count; i++) {
      fireBossProjectile(boss, (i / count) * Math.PI * 2, 35, scene);
    }
  }, 1200);
}

// --- drone swarm: burst of projectiles in ring ---
function attackDrones(boss, scene, phase) {
  var count = phase.droneCount || 2;
  spawnTelegraph(boss, boss.posX, boss.posZ, 8, 1.0, scene);
  boss.droneSpawns.push({ timer: 1.0, count: count });
}

// --- kraken tentacle sweep ---
function attackTentacleSweep(boss, ship, scene, phase) {
  var count = phase.tentacleCount || 3;
  var dx = ship.posX - boss.posX;
  var dz = ship.posZ - boss.posZ;
  var dist = Math.sqrt(dx * dx + dz * dz);
  var baseAngle = Math.atan2(dx, dz);

  for (var i = 0; i < count; i++) {
    var as = (i - (count - 1) / 2) * 0.3;
    var a = baseAngle + as;
    var td = Math.min(dist, 30);
    var tx = boss.posX + Math.sin(a) * td;
    var tz = boss.posZ + Math.cos(a) * td;
    spawnTelegraph(boss, tx, tz, 4, 1.0, scene);
    boss.tentacleAttacks.push({
      x: tx, z: tz, delay: 1.0, active: false,
      activeTimer: 0, duration: 1.5, radius: 4, mesh: null, damaged: false
    });
  }
}

// --- execute attack based on phase config ---
function executeAttack(boss, ship, scene, phase) {
  var atk = phase.attack;
  if (atk === "broadside") {
    attackBroadside(boss, ship, scene, phase);
  } else if (atk === "barrage") {
    attackBarrage(boss, scene, phase);
  } else if (atk === "drones" || atk === "drones_barrage") {
    attackDrones(boss, scene, phase);
    if (atk === "drones_barrage") attackBarrage(boss, scene, phase);
  } else if (atk === "tentacle_sweep" || atk === "tentacle_grab" || atk === "tentacle_frenzy") {
    attackTentacleSweep(boss, ship, scene, phase);
  }
}

// --- update boss (called every frame) ---
export function updateBoss(boss, ship, dt, scene, getWaveHeight, elapsed, enemyMgr, terrain) {
  if (!boss || boss.defeated) return;

  if (boss.sinking) {
    boss.sinkTimer += dt;
    boss.mesh.position.y -= 1.0 * dt;
    boss.mesh.rotation.z += dt * 0.3;
    var alpha = 1 - boss.sinkTimer / 5.0;
    boss.mesh.traverse(function (child) {
      if (child.isMesh && child.material) {
        child.material.transparent = true;
        child.material.opacity = Math.max(0, alpha);
      }
    });
    if (boss.sinkTimer >= 5.0) scene.remove(boss.mesh);
    updateBossProjectiles(boss, ship, dt, scene, enemyMgr, terrain);
    updateTelegraphs(boss, dt, scene);
    return;
  }

  if (!boss.alive) return;

  // movement: chase player
  var dx = ship.posX - boss.posX;
  var dz = ship.posZ - boss.posZ;
  var dist = Math.sqrt(dx * dx + dz * dz);
  var targetAngle = Math.atan2(dx, dz);
  var angleDiff = targetAngle - boss.heading;
  while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
  while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

  var maxTurn = boss.def.turnSpeed * dt;
  if (Math.abs(angleDiff) < maxTurn) {
    boss.heading = targetAngle;
  } else {
    boss.heading += Math.sign(angleDiff) * maxTurn;
  }

  var engageDist = 25;
  var sf = dist < engageDist ? Math.max(0.1, (dist - 5) / (engageDist - 5)) : 1;
  var bossPrevX = boss.posX;
  var bossPrevZ = boss.posZ;
  if (Math.abs(angleDiff) < Math.PI * 0.6) {
    boss.posX += Math.sin(boss.heading) * boss.def.speed * sf * dt;
    boss.posZ += Math.cos(boss.heading) * boss.def.speed * sf * dt;
  }

  // terrain collision for boss
  if (terrain) {
    var bcol = collideWithTerrain(terrain, boss.posX, boss.posZ, bossPrevX, bossPrevZ);
    if (bcol.collided) {
      boss.posX = bcol.newX;
      boss.posZ = bcol.newZ;
    }
  }

  boss.mesh.position.x = boss.posX;
  boss.mesh.position.z = boss.posZ;
  boss.mesh.rotation.y = boss.heading;

  if (getWaveHeight) {
    var targetY = getWaveHeight(boss.posX, boss.posZ, elapsed) + BOSS_FLOAT_OFFSET;

    var sampleDist = 3.0;
    var waveFore = getWaveHeight(boss.posX + Math.sin(boss.heading) * sampleDist, boss.posZ + Math.cos(boss.heading) * sampleDist, elapsed);
    var waveAft  = getWaveHeight(boss.posX - Math.sin(boss.heading) * sampleDist, boss.posZ - Math.cos(boss.heading) * sampleDist, elapsed);
    var wavePort = getWaveHeight(boss.posX + Math.cos(boss.heading) * sampleDist, boss.posZ - Math.sin(boss.heading) * sampleDist, elapsed);
    var waveStbd = getWaveHeight(boss.posX - Math.cos(boss.heading) * sampleDist, boss.posZ + Math.sin(boss.heading) * sampleDist, elapsed);

    var targetPitch = Math.atan2(waveFore - waveAft, sampleDist * 2) * TILT_DAMPING;
    var targetRoll  = Math.atan2(wavePort - waveStbd, sampleDist * 2) * TILT_DAMPING;

    var lerpFactor = 1 - Math.exp(-BUOYANCY_LERP * dt);
    var tiltFactor = 1 - Math.exp(-TILT_LERP * dt);
    boss._smoothY += (targetY - boss._smoothY) * lerpFactor;
    boss._smoothPitch += (targetPitch - boss._smoothPitch) * tiltFactor;
    boss._smoothRoll += (targetRoll - boss._smoothRoll) * tiltFactor;

    boss.mesh.position.y = boss._smoothY;
    boss.mesh.rotation.x = boss._smoothPitch;
    boss.mesh.rotation.z = boss._smoothRoll;
  }

  // animate kraken tentacles
  if (boss.type === "kraken" && boss.mesh.userData.tentacles) {
    var tents = boss.mesh.userData.tentacles;
    for (var i = 0; i < tents.length; i++) {
      tents[i].rotation.y = Math.sin(elapsed * 0.8 + i * 0.7) * 0.3;
      tents[i].position.y = 0.2 + Math.sin(elapsed * 1.2 + i) * 0.2;
    }
  }

  // attack timer
  var phaseIdx = getCurrentPhase(boss);
  boss.phase = phaseIdx;
  var phase = boss.def.phases[phaseIdx];
  boss.attackTimer -= dt;
  if (boss.attackTimer <= 0) {
    boss.attackTimer = phase.interval;
    executeAttack(boss, ship, scene, phase);
  }

  updateBossProjectiles(boss, ship, dt, scene, enemyMgr, terrain);
  updateTelegraphs(boss, dt, scene);
  updateDroneSpawns(boss, dt, scene);
  updateTentacleAttacks(boss, ship, dt, scene, enemyMgr);
}

// --- update boss projectiles ---
function updateBossProjectiles(boss, ship, dt, scene, enemyMgr, terrain) {
  var alive = [];
  for (var i = 0; i < boss.projectiles.length; i++) {
    var p = boss.projectiles[i];
    p.age += dt;
    p.vy -= 9.8 * dt;
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    p.mesh.position.z += p.vz * dt;

    var hitWater = p.mesh.position.y < 0.2;
    var hitTerrain = terrain && isLand(terrain, p.mesh.position.x, p.mesh.position.z);
    var tooOld = p.age > 5;
    var hitPlayer = false;
    var pdx = p.mesh.position.x - ship.posX;
    var pdz = p.mesh.position.z - ship.posZ;
    if (pdx * pdx + pdz * pdz < 3.0 * 3.0) {
      hitPlayer = true;
      if (enemyMgr) {
        var dmg = Math.max(0.2, 2 * (1 - (enemyMgr.playerArmor || 0)));
        enemyMgr.playerHp = Math.max(0, enemyMgr.playerHp - dmg);
      }
    }

    if (hitWater || hitTerrain || tooOld || hitPlayer) {
      scene.remove(p.mesh);
    } else {
      alive.push(p);
    }
  }
  boss.projectiles = alive;
}

// --- update telegraph warning zones ---
function updateTelegraphs(boss, dt, scene) {
  var alive = [];
  for (var i = 0; i < boss.telegraphs.length; i++) {
    var t = boss.telegraphs[i];
    t.timer -= dt;
    var progress = 1 - t.timer / t.maxTimer;
    t.mesh.material.opacity = (progress < 0.5 ? progress : 1 - progress) * 0.6;
    t.mesh.scale.setScalar(1.0 + Math.sin(progress * Math.PI * 4) * 0.1);
    if (t.timer <= 0) {
      scene.remove(t.mesh);
    } else {
      alive.push(t);
    }
  }
  boss.telegraphs = alive;
}

// --- update drone spawn timers ---
function updateDroneSpawns(boss, dt, scene) {
  var alive = [];
  for (var i = 0; i < boss.droneSpawns.length; i++) {
    var ds = boss.droneSpawns[i];
    ds.timer -= dt;
    if (ds.timer <= 0) {
      for (var d = 0; d < ds.count; d++) {
        var angle = (d / ds.count) * Math.PI * 2 + Math.random() * 0.3;
        fireBossProjectile(boss, angle, 25, scene);
      }
    } else {
      alive.push(ds);
    }
  }
  boss.droneSpawns = alive;
}

// --- update tentacle attack zones ---
function updateTentacleAttacks(boss, ship, dt, scene, enemyMgr) {
  var alive = [];
  for (var i = 0; i < boss.tentacleAttacks.length; i++) {
    var ta = boss.tentacleAttacks[i];

    if (!ta.active) {
      ta.delay -= dt;
      if (ta.delay <= 0) {
        ta.active = true;
        var tentMat = new THREE.MeshLambertMaterial({ color: 0x664488, transparent: true, opacity: 0.8 });
        var tentGeo = new THREE.CylinderGeometry(0.4, 0.8, 6, 8);
        ta.mesh = new THREE.Mesh(tentGeo, tentMat);
        ta.mesh.position.set(ta.x, 3, ta.z);
        scene.add(ta.mesh);
      }
      alive.push(ta);
      continue;
    }

    ta.activeTimer += dt;
    if (ta.mesh) {
      var prog = ta.activeTimer / ta.duration;
      if (prog < 0.3) {
        ta.mesh.position.y = prog / 0.3 * 3;
      } else if (prog < 0.7) {
        ta.mesh.position.y = 3;
        ta.mesh.rotation.z = Math.sin(ta.activeTimer * 8) * 0.3;
      } else {
        ta.mesh.position.y = 3 * (1 - (prog - 0.7) / 0.3);
        ta.mesh.material.opacity = (1 - (prog - 0.7) / 0.3) * 0.8;
      }
    }

    if (!ta.damaged && enemyMgr) {
      var tdx = ship.posX - ta.x;
      var tdz = ship.posZ - ta.z;
      if (tdx * tdx + tdz * tdz < ta.radius * ta.radius) {
        var dmg2 = Math.max(0.3, 3 * (1 - (enemyMgr.playerArmor || 0)));
        enemyMgr.playerHp = Math.max(0, enemyMgr.playerHp - dmg2);
        ta.damaged = true;
      }
    }

    if (ta.activeTimer >= ta.duration) {
      if (ta.mesh) scene.remove(ta.mesh);
    } else {
      alive.push(ta);
    }
  }
  boss.tentacleAttacks = alive;
}

// --- remove boss from scene ---
export function removeBoss(boss, scene) {
  if (!boss) return;
  scene.remove(boss.mesh);
  for (var i = 0; i < boss.projectiles.length; i++) {
    scene.remove(boss.projectiles[i].mesh);
  }
  for (var i = 0; i < boss.telegraphs.length; i++) {
    scene.remove(boss.telegraphs[i].mesh);
  }
  for (var i = 0; i < boss.tentacleAttacks.length; i++) {
    if (boss.tentacleAttacks[i].mesh) scene.remove(boss.tentacleAttacks[i].mesh);
  }
}

// --- loot table ---
var LOOT_TABLE = [
  { type: "upgrade", label: "+25% Damage", stat: "damage", value: 0.25 },
  { type: "upgrade", label: "+30% Max HP", stat: "maxHp", value: 0.30 },
  { type: "upgrade", label: "+20% Fire Rate", stat: "fireRate", value: 0.20 },
  { type: "upgrade", label: "+20% Speed", stat: "maxSpeed", value: 0.20 },
  { type: "salvage", label: "+100 Salvage", value: 100 },
  { type: "repair", label: "Full Repair", value: 1.0 }
];

export function rollBossLoot() {
  return LOOT_TABLE[Math.floor(Math.random() * LOOT_TABLE.length)];
}

export function applyBossLoot(loot, upgrades, enemyMgr) {
  if (loot.type === "salvage") {
    upgrades.salvage += loot.value;
  } else if (loot.type === "repair") {
    enemyMgr.playerHp = enemyMgr.playerMaxHp;
  } else if (loot.type === "upgrade") {
    if (!upgrades.bossBonus) upgrades.bossBonus = {};
    if (!upgrades.bossBonus[loot.stat]) upgrades.bossBonus[loot.stat] = 0;
    upgrades.bossBonus[loot.stat] += loot.value;
  }
  return loot;
}
