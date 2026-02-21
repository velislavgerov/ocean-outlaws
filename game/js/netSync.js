// netSync.js — network state synchronization: ship positions, events, dead reckoning
import * as THREE from "three";
import { broadcast, getOtherPlayerIds } from "./multiplayer.js";
import { buildClassMesh } from "./shipModels.js";

// --- tuning ---
var SEND_RATE = 12;                     // state updates per second (cap)
var SEND_INTERVAL = 1000 / SEND_RATE;   // ms between sends
var POSITION_THRESHOLD = 0.3;           // min distance before sending update
var ROTATION_THRESHOLD = 0.05;          // min heading change before sending
var LERP_SPEED = 8;                     // interpolation speed for remote ships
var PREDICTION_DECAY = 0.95;            // velocity damping for dead reckoning
var REMOTE_SHIP_FADE_TIME = 5;          // seconds to fade out disconnected ship

// --- remote player ships ---
var remoteShips = {};   // { playerId: { mesh, posX, posZ, heading, speed, targetX, targetZ, targetHeading, shipClass, health, lastUpdate, _smoothY, _smoothPitch, _smoothRoll, fading, fadeTimer } }
var lastSendTime = 0;
var lastSentState = { posX: 0, posZ: 0, heading: 0, speed: 0, health: 0 };

// --- create remote ship mesh with tinted color ---
function createRemoteShipMesh(shipClass, playerIndex) {
  var mesh = buildClassMesh(shipClass || "cruiser");
  // tint the hull slightly to differentiate
  var colors = [0x44aaff, 0xff6644, 0x44dd66, 0xffcc44];
  var tint = colors[playerIndex % colors.length];
  mesh.traverse(function (child) {
    if (child.isMesh && child.material) {
      child.material = child.material.clone();
      child.material.color.lerp(new THREE.Color(tint), 0.3);
    }
  });
  return mesh;
}

// --- send local ship state ---
export function sendShipState(mpState, ship, health, maxHealth, weaponIndex, autofireOn) {
  if (!mpState || !mpState.active) return;

  var now = Date.now();
  if (now - lastSendTime < SEND_INTERVAL) return;

  // Only send if state changed beyond threshold
  var dx = ship.posX - lastSentState.posX;
  var dz = ship.posZ - lastSentState.posZ;
  var distSq = dx * dx + dz * dz;
  var headingDiff = Math.abs(ship.heading - lastSentState.heading);
  var speedDiff = Math.abs(ship.speed - lastSentState.speed);
  var healthDiff = Math.abs(health - lastSentState.health);

  if (distSq < POSITION_THRESHOLD * POSITION_THRESHOLD &&
      headingDiff < ROTATION_THRESHOLD &&
      speedDiff < 0.5 && healthDiff < 0.1) {
    return;
  }

  lastSendTime = now;
  lastSentState.posX = ship.posX;
  lastSentState.posZ = ship.posZ;
  lastSentState.heading = ship.heading;
  lastSentState.speed = ship.speed;
  lastSentState.health = health;

  broadcast(mpState, {
    type: "ship_state",
    posX: Math.round(ship.posX * 100) / 100,
    posZ: Math.round(ship.posZ * 100) / 100,
    heading: Math.round(ship.heading * 1000) / 1000,
    speed: Math.round(ship.speed * 100) / 100,
    health: Math.round(health * 10) / 10,
    maxHealth: maxHealth,
    weapon: weaponIndex,
    autofire: autofireOn,
    shipClass: mpState.players[mpState.playerId] ? mpState.players[mpState.playerId].shipClass : "cruiser"
  });
}

// --- send fire event ---
export function sendFireEvent(mpState, weaponKey, originX, originZ, dirX, dirZ) {
  if (!mpState || !mpState.active) return;
  broadcast(mpState, {
    type: "fire",
    weapon: weaponKey,
    ox: Math.round(originX * 100) / 100,
    oz: Math.round(originZ * 100) / 100,
    dx: Math.round(dirX * 1000) / 1000,
    dz: Math.round(dirZ * 1000) / 1000
  });
}

// --- send hit event ---
export function sendHitEvent(mpState, targetType, targetId, damage) {
  if (!mpState || !mpState.active) return;
  broadcast(mpState, {
    type: "hit",
    targetType: targetType,
    targetId: targetId,
    damage: damage
  });
}

// --- send enemy state (host only) ---
export function sendEnemyState(mpState, enemies) {
  if (!mpState || !mpState.active || !mpState.isHost) return;
  var now = Date.now();
  // Throttle enemy sync to ~5 Hz
  if (now - (sendEnemyState._lastSend || 0) < 200) return;
  sendEnemyState._lastSend = now;

  var data = [];
  for (var i = 0; i < enemies.length; i++) {
    var e = enemies[i];
    if (!e.alive && !e.sinking) continue;
    data.push({
      id: i,
      x: Math.round(e.posX * 100) / 100,
      z: Math.round(e.posZ * 100) / 100,
      h: Math.round(e.heading * 1000) / 1000,
      hp: e.hp,
      alive: e.alive,
      sinking: e.sinking
    });
  }
  broadcast(mpState, { type: "enemy_state", enemies: data });
}

// --- send wave start (host only) ---
export function sendWaveStart(mpState, wave, enemyCount) {
  if (!mpState || !mpState.active || !mpState.isHost) return;
  broadcast(mpState, { type: "wave_start", wave: wave, enemies: enemyCount });
}

// --- send pickup claim ---
export function sendPickupClaim(mpState, pickupIndex) {
  if (!mpState || !mpState.active) return;
  broadcast(mpState, { type: "pickup_claim", index: pickupIndex });
}

// --- send game over / victory ---
export function sendGameEvent(mpState, eventType, data) {
  if (!mpState || !mpState.active) return;
  var msg = { type: eventType };
  if (data) {
    for (var k in data) msg[k] = data[k];
  }
  broadcast(mpState, msg);
}

// --- handle incoming broadcast message ---
export function handleBroadcastMessage(msg, scene, mpState) {
  if (!msg || !msg.senderId) return;

  if (msg.type === "ship_state") {
    updateRemoteShip(msg.senderId, msg, scene, mpState);
  } else if (msg.type === "game_start") {
    // Handled in main.js
  } else if (msg.type === "fire") {
    // Visual-only: remote player fired — could spawn a visual projectile
  }
}

// --- update a remote player's ship position ---
function updateRemoteShip(playerId, data, scene, mpState) {
  var remote = remoteShips[playerId];

  if (!remote) {
    // Find player index for coloring
    var pids = Object.keys(mpState.players);
    var playerIdx = pids.indexOf(playerId);
    if (playerIdx < 0) playerIdx = Object.keys(remoteShips).length;

    var mesh = createRemoteShipMesh(data.shipClass, playerIdx);
    mesh.position.set(data.posX, 0.5, data.posZ);
    mesh.rotation.y = data.heading;
    scene.add(mesh);

    remote = {
      mesh: mesh,
      posX: data.posX,
      posZ: data.posZ,
      heading: data.heading,
      speed: data.speed || 0,
      targetX: data.posX,
      targetZ: data.posZ,
      targetHeading: data.heading,
      shipClass: data.shipClass,
      health: data.health || 10,
      maxHealth: data.maxHealth || 10,
      lastUpdate: Date.now(),
      _smoothY: 0.5,
      _smoothPitch: 0,
      _smoothRoll: 0,
      fading: false,
      fadeTimer: 0
    };
    remoteShips[playerId] = remote;
    return;
  }

  // Update targets for interpolation
  remote.targetX = data.posX;
  remote.targetZ = data.posZ;
  remote.targetHeading = data.heading;
  remote.speed = data.speed || 0;
  remote.health = data.health;
  remote.maxHealth = data.maxHealth;
  remote.lastUpdate = Date.now();
  remote.fading = false;
  remote.fadeTimer = 0;

  // If ship class changed, rebuild mesh
  if (data.shipClass && data.shipClass !== remote.shipClass) {
    scene.remove(remote.mesh);
    var pids = Object.keys(mpState.players);
    var playerIdx = pids.indexOf(playerId);
    remote.mesh = createRemoteShipMesh(data.shipClass, playerIdx);
    remote.mesh.position.set(remote.posX, remote._smoothY, remote.posZ);
    remote.mesh.rotation.y = remote.heading;
    scene.add(remote.mesh);
    remote.shipClass = data.shipClass;
  }
}

// --- update all remote ships (called each frame) ---
export function updateRemoteShips(dt, getWaveHeight, elapsed, scene) {
  var now = Date.now();

  for (var pid in remoteShips) {
    var r = remoteShips[pid];

    // Check for stale (disconnected) — start fading after 5 seconds
    var age = (now - r.lastUpdate) / 1000;
    if (age > REMOTE_SHIP_FADE_TIME && !r.fading) {
      r.fading = true;
      r.fadeTimer = 0;
    }

    if (r.fading) {
      r.fadeTimer += dt;
      var fadeAlpha = Math.max(0, 1 - r.fadeTimer / 3); // fade over 3 seconds
      r.mesh.traverse(function (child) {
        if (child.isMesh && child.material) {
          child.material.transparent = true;
          child.material.opacity = fadeAlpha;
        }
      });
      if (fadeAlpha <= 0) {
        scene.remove(r.mesh);
        delete remoteShips[pid];
        continue;
      }
    }

    // Dead reckoning: predict position using velocity
    var lerpFactor = 1 - Math.exp(-LERP_SPEED * dt);

    // Interpolate position toward target
    r.posX += (r.targetX - r.posX) * lerpFactor;
    r.posZ += (r.targetZ - r.posZ) * lerpFactor;

    // Also apply velocity-based prediction between updates
    if (age < 0.5) {
      r.posX += Math.sin(r.heading) * r.speed * dt * 0.5;
      r.posZ += Math.cos(r.heading) * r.speed * dt * 0.5;
    }

    // Interpolate heading (handle wrapping)
    var headingDiff = r.targetHeading - r.heading;
    while (headingDiff > Math.PI) headingDiff -= 2 * Math.PI;
    while (headingDiff < -Math.PI) headingDiff += 2 * Math.PI;
    r.heading += headingDiff * lerpFactor;

    // Apply to mesh
    r.mesh.position.x = r.posX;
    r.mesh.position.z = r.posZ;
    r.mesh.rotation.y = r.heading;

    // Buoyancy
    if (getWaveHeight) {
      var targetY = getWaveHeight(r.posX, r.posZ, elapsed) + 1.2;
      var sampleDist = 1.2;
      var waveFore = getWaveHeight(r.posX + Math.sin(r.heading) * sampleDist, r.posZ + Math.cos(r.heading) * sampleDist, elapsed);
      var waveAft = getWaveHeight(r.posX - Math.sin(r.heading) * sampleDist, r.posZ - Math.cos(r.heading) * sampleDist, elapsed);
      var wavePort = getWaveHeight(r.posX + Math.cos(r.heading) * sampleDist, r.posZ - Math.sin(r.heading) * sampleDist, elapsed);
      var waveStbd = getWaveHeight(r.posX - Math.cos(r.heading) * sampleDist, r.posZ + Math.sin(r.heading) * sampleDist, elapsed);

      var targetPitch = Math.atan2(waveFore - waveAft, sampleDist * 2) * 0.3;
      var targetRoll = Math.atan2(wavePort - waveStbd, sampleDist * 2) * 0.3;

      var buoyancyLerp = 1 - Math.exp(-8 * dt);
      var tiltLerp = 1 - Math.exp(-6 * dt);
      r._smoothY += (targetY - r._smoothY) * buoyancyLerp;
      r._smoothPitch += (targetPitch - r._smoothPitch) * tiltLerp;
      r._smoothRoll += (targetRoll - r._smoothRoll) * tiltLerp;

      r.mesh.position.y = r._smoothY;
      r.mesh.rotation.x = r._smoothPitch;
      r.mesh.rotation.z = r._smoothRoll;
    }
  }
}

// --- get remote ships data for minimap ---
export function getRemoteShipsForMinimap() {
  var ships = [];
  for (var pid in remoteShips) {
    var r = remoteShips[pid];
    if (!r.fading) {
      ships.push({ posX: r.posX, posZ: r.posZ, heading: r.heading });
    }
  }
  return ships;
}

// --- get remote ships for health bars ---
export function getRemoteShipsForHealth() {
  var ships = [];
  for (var pid in remoteShips) {
    var r = remoteShips[pid];
    if (!r.fading) {
      ships.push({
        mesh: r.mesh,
        posX: r.posX,
        posZ: r.posZ,
        health: r.health,
        maxHealth: r.maxHealth,
        playerId: pid
      });
    }
  }
  return ships;
}

// --- remove all remote ships from scene ---
export function clearRemoteShips(scene) {
  for (var pid in remoteShips) {
    scene.remove(remoteShips[pid].mesh);
  }
  remoteShips = {};
  lastSendTime = 0;
  lastSentState = { posX: 0, posZ: 0, heading: 0, speed: 0, health: 0 };
}

// --- remove a specific remote ship ---
export function removeRemoteShip(playerId, scene) {
  if (remoteShips[playerId]) {
    scene.remove(remoteShips[playerId].mesh);
    delete remoteShips[playerId];
  }
}

// --- reset send state (e.g. on game restart) ---
export function resetSendState() {
  lastSendTime = 0;
  lastSentState = { posX: 0, posZ: 0, heading: 0, speed: 0, health: 0 };
}
