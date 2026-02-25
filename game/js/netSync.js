// netSync.js — network state synchronization: ship positions, events, dead reckoning
import * as THREE from "three";
import { broadcast, getOtherPlayerIds } from "./multiplayer.js";
import { buildClassMesh } from "./shipModels.js";
import { applyShipOverrideAsync } from "./ship.js";

// --- tuning ---
var SEND_RATE = 12;                     // state updates per second (cap)
var SEND_INTERVAL = 1000 / SEND_RATE;   // ms between sends
var REMOTE_PROJ_SPEED = 60;             // visual speed for remote projectiles
var REMOTE_PROJ_LIFE = 1.5;             // seconds before despawn
var POSITION_THRESHOLD = 0.3;           // min distance before sending update
var ROTATION_THRESHOLD = 0.05;          // min heading change before sending
var LERP_SPEED = 8;                     // interpolation speed for remote ships
var PREDICTION_DECAY = 0.95;            // velocity damping for dead reckoning
var REMOTE_SHIP_FADE_TIME = 5;          // seconds to fade out disconnected ship

// --- remote player ships ---
var remoteShips = {};   // { playerId: { mesh, posX, posZ, heading, speed, targetX, targetZ, targetHeading, shipClass, health, lastUpdate, _smoothY, _smoothPitch, _smoothRoll, fading, fadeTimer } }
var lastSendTime = 0;
var lastSentState = { posX: 0, posZ: 0, heading: 0, speed: 0, health: 0 };

// --- remote projectiles (visual only) ---
var remoteProjectiles = [];
var remoteProjGeo = null;
var remoteProjMat = null;

function ensureRemoteProjGeo() {
  if (remoteProjGeo) return;
  remoteProjGeo = new THREE.SphereGeometry(0.15, 6, 4);
  remoteProjMat = new THREE.MeshBasicMaterial({ color: 0x44aaff });
}

// --- floating username labels (HTML overlay) ---
var labelContainer = null;
var labelElements = {};   // { playerId: HTMLDivElement }
var labelVec = new THREE.Vector3();
var LABEL_COLORS = ["#44aaff", "#44dd66", "#ff9944", "#aa66ff"];

export function initRemoteLabels() {
  if (labelContainer) return;
  labelContainer = document.createElement("div");
  labelContainer.style.cssText = [
    "position:fixed", "top:0", "left:0", "width:100%", "height:100%",
    "pointer-events:none", "z-index:6"
  ].join(";");
  document.body.appendChild(labelContainer);
}

function ensureLabel(playerId, username, playerIndex) {
  if (labelElements[playerId]) return labelElements[playerId];
  var el = document.createElement("div");
  var color = LABEL_COLORS[playerIndex % LABEL_COLORS.length];
  el.style.cssText = [
    "position:absolute", "font-family:monospace", "font-size:11px",
    "color:" + color, "text-align:center", "white-space:nowrap",
    "text-shadow:0 0 4px rgba(0,0,0,0.8), 0 1px 2px rgba(0,0,0,0.6)",
    "transform:translate(-50%, -100%)", "pointer-events:none"
  ].join(";");
  el.textContent = username || "";
  labelContainer.appendChild(el);
  labelElements[playerId] = el;
  return el;
}

export function updateRemoteLabels(camera) {
  if (!labelContainer || !camera) return;
  var halfW = window.innerWidth / 2;
  var halfH = window.innerHeight / 2;

  // hide labels for ships that no longer exist
  for (var lid in labelElements) {
    if (!remoteShips[lid] || remoteShips[lid].fading) {
      labelElements[lid].style.display = "none";
    }
  }

  for (var pid in remoteShips) {
    var r = remoteShips[pid];
    if (r.fading) continue;

    var el = ensureLabel(pid, r.username, r.playerIndex || 0);
    el.textContent = r.username || pid.substring(0, 8);

    labelVec.set(r.posX, (r._smoothY || 1.2) + 2.8, r.posZ);
    labelVec.project(camera);

    if (labelVec.z > 1) {
      el.style.display = "none";
      continue;
    }

    var sx = (labelVec.x * halfW) + halfW;
    var sy = -(labelVec.y * halfH) + halfH;

    if (sx < -80 || sx > window.innerWidth + 80 || sy < -30 || sy > window.innerHeight + 30) {
      el.style.display = "none";
      continue;
    }

    el.style.display = "block";
    el.style.left = sx + "px";
    el.style.top = sy + "px";
  }
}

function clearRemoteLabels() {
  for (var lid in labelElements) {
    if (labelElements[lid].parentNode) {
      labelElements[lid].parentNode.removeChild(labelElements[lid]);
    }
  }
  labelElements = {};
}

// --- apply player tint color to all mesh materials ---
function applyPlayerTint(mesh, tintColor) {
  var color = new THREE.Color(tintColor);
  mesh.traverse(function (child) {
    if (child.isMesh && child.material) {
      child.material = child.material.clone();
      child.material.color.lerp(color, 0.3);
    }
  });
}

// --- create remote ship mesh with tinted color ---
function createRemoteShipMesh(shipClass, playerIndex) {
  var mesh = buildClassMesh(shipClass || "cruiser");
  var colors = [0x44aaff, 0x44dd66, 0xff9944, 0xaa66ff];
  var tint = colors[playerIndex % colors.length];
  // tint procedural placeholder immediately
  applyPlayerTint(mesh, tint);
  // async swap to GLB model, then re-apply tint over new materials
  var promise = applyShipOverrideAsync(mesh, shipClass || "cruiser");
  if (promise) {
    promise.then(function () {
      applyPlayerTint(mesh, tint);
    });
  }
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
    shipClass: mpState.players[mpState.playerId] ? mpState.players[mpState.playerId].shipClass : "cruiser",
    username: mpState.username
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
      s: Math.round((e.speed || 0) * 100) / 100,
      hp: e.hp,
      maxHp: e.maxHp,
      alive: e.alive,
      sinking: e.sinking,
      faction: e.faction
    });
  }
  broadcast(mpState, { type: "enemy_state", enemies: data });
}

// --- handle incoming broadcast message ---
// Returns the message type if it was NOT handled here (for combat routing in main.js)
export function handleBroadcastMessage(msg, scene, mpState) {
  if (!msg || !msg.senderId) return null;

  if (msg.type === "ship_state") {
    updateRemoteShip(msg.senderId, msg, scene, mpState);
    return null;
  } else if (msg.type === "game_start") {
    return "game_start";
  } else if (msg.type === "fire") {
    spawnRemoteProjectile(msg, scene);
    return null;
  }
  // Return message type for combat sync handling in main.js
  return msg.type;
}

// --- spawn a visual projectile from a remote player's fire event ---
function spawnRemoteProjectile(msg, scene) {
  ensureRemoteProjGeo();
  var mesh = new THREE.Mesh(remoteProjGeo, remoteProjMat);
  mesh.position.set(msg.ox, 1.2, msg.oz);
  scene.add(mesh);
  remoteProjectiles.push({
    mesh: mesh,
    vx: msg.dx * REMOTE_PROJ_SPEED,
    vz: msg.dz * REMOTE_PROJ_SPEED,
    life: REMOTE_PROJ_LIFE
  });
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
      username: data.username || "",
      health: data.health || 10,
      maxHealth: data.maxHealth || 10,
      playerIndex: playerIdx,
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
  if (data.username) remote.username = data.username;
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
        if (labelElements[pid]) {
          if (labelElements[pid].parentNode) labelElements[pid].parentNode.removeChild(labelElements[pid]);
          delete labelElements[pid];
        }
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

  // update remote projectiles
  var aliveProj = [];
  for (var pi = 0; pi < remoteProjectiles.length; pi++) {
    var rp = remoteProjectiles[pi];
    rp.life -= dt;
    if (rp.life <= 0) {
      scene.remove(rp.mesh);
      continue;
    }
    rp.mesh.position.x += rp.vx * dt;
    rp.mesh.position.z += rp.vz * dt;
    rp.mesh.position.y -= 4.0 * dt; // gentle arc
    if (rp.mesh.position.y < 0.2) {
      scene.remove(rp.mesh);
      continue;
    }
    aliveProj.push(rp);
  }
  remoteProjectiles = aliveProj;
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
  // clear remote projectiles
  for (var pi = 0; pi < remoteProjectiles.length; pi++) {
    scene.remove(remoteProjectiles[pi].mesh);
  }
  remoteProjectiles = [];
  clearRemoteLabels();
  lastSendTime = 0;
  lastSentState = { posX: 0, posZ: 0, heading: 0, speed: 0, health: 0 };
}

// --- remove a specific remote ship ---
export function removeRemoteShip(playerId, scene) {
  if (remoteShips[playerId]) {
    scene.remove(remoteShips[playerId].mesh);
    delete remoteShips[playerId];
  }
  if (labelElements[playerId]) {
    if (labelElements[playerId].parentNode) {
      labelElements[playerId].parentNode.removeChild(labelElements[playerId]);
    }
    delete labelElements[playerId];
  }
}

// --- start graceful fade-out for a disconnected player's ship ---
export function fadeRemoteShip(playerId) {
  var r = remoteShips[playerId];
  if (r && !r.fading) {
    r.fading = true;
    r.fadeTimer = 0;
  }
}

// --- reset send state (e.g. on game restart) ---
export function resetSendState() {
  lastSendTime = 0;
  lastSentState = { posX: 0, posZ: 0, heading: 0, speed: 0, health: 0 };
}
