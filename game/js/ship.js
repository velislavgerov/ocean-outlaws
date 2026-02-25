// ship.js — ship physics state, GLB model loading, update loop
import * as THREE from "three";
import { buildClassMesh } from "./shipModels.js";
import { collideWithTerrain, applyEdgeBoundary, getTerrainAvoidance } from "./terrain.js";
import { slideCollision, createStuckDetector, updateStuck, isStuck, nudgeToOpenWater } from "./collision.js";
import { getOverridePath, getOverrideSize } from "./artOverrides.js";
import { loadGlbVisual } from "./glbVisual.js";

// --- error placeholder for failed model loads ---
// Returns a group with a bright magenta box and fire points so turret code doesn't break
export function createErrorPlaceholder(size) {
  var s = size || 2;
  var group = new THREE.Group();
  group.add(new THREE.Mesh(
    new THREE.BoxGeometry(s * 0.5, s * 0.3, s),
    new THREE.MeshBasicMaterial({ color: 0xff00ff })
  ));
  var portFP = new THREE.Object3D(); portFP.position.set(-s * 0.3, s * 0.15, 0); group.add(portFP);
  var stbdFP = new THREE.Object3D(); stbdFP.position.set(s * 0.3, s * 0.15, 0); group.add(stbdFP);
  var bowFP  = new THREE.Object3D(); bowFP.position.set(0, s * 0.15, s * 0.6); group.add(bowFP);
  group.userData.turrets = [portFP, stbdFP, bowFP];
  return group;
}

// --- default physics tuning (used as fallback) ---
var DEFAULT_MAX_SPEED = 10;
var DEFAULT_ACCEL = 7;
var DEFAULT_TURN_RATE = 2.2;
var REVERSE_ACCEL_RATIO = 0.5;  // reverse accel as fraction of forward accel
var DRAG = 4;
var TURN_SPEED_HIGH_RATIO = 0.36; // turn rate at max speed as ratio of base turn rate
var FLOAT_OFFSET = 1.6;
var BUOYANCY_LERP = 12;       // Y position smoothing speed (higher = tighter tracking)
var TILT_LERP = 8;            // pitch/roll smoothing speed
var TILT_DAMPING = 0.3;       // tilt scaling — gentle, not extreme

// --- auto-nav tuning ---
var NAV_ARRIVE_RADIUS = 3;
var NAV_SLOW_RADIUS = 15;
var NAV_TURN_SPEED = 2.5;
var TERRAIN_AVOID_RANGE = 15;
var TERRAIN_SLOW_MULT = 0.72;
var TERRAIN_AVOID_TURN = 5.5;

// --- async GLB override: replace placeholder mesh with Palmov GLB model ---
export function applyShipOverrideAsync(mesh, classKey) {
  var path = getOverridePath(classKey);
  if (!path) return null;
  var fitSize = getOverrideSize(classKey) || 8;
  var firePoints = mesh.userData.turrets || [];
  return loadGlbVisual(path, fitSize, true, { noDecimate: true }).then(function (visual) {
    // snapshot children to preserve (fire points and lights like lantern)
    var keep = [];
    for (var i = 0; i < mesh.children.length; i++) {
      var child = mesh.children[i];
      if (firePoints.indexOf(child) !== -1 || child.isLight) {
        keep.push(child);
      }
    }
    while (mesh.children.length) mesh.remove(mesh.children[0]);
    mesh.add(visual);
    // re-attach fire points and lights so they move with the ship
    for (var i = 0; i < keep.length; i++) {
      mesh.add(keep[i]);
    }
    mesh.userData.turrets = firePoints;
  }).catch(function () {
    console.error("Failed to load ship model: " + path);
    while (mesh.children.length) mesh.remove(mesh.children[0]);
    mesh.add(new THREE.Mesh(
      new THREE.BoxGeometry(2, 1, 4),
      new THREE.MeshBasicMaterial({ color: 0xff00ff })
    ));
    for (var j = 0; j < firePoints.length; j++) {
      mesh.add(firePoints[j]);
    }
    mesh.userData.turrets = firePoints;
  });
}

// --- create ship ---
// classConfig: optional { stats: { maxSpeed, turnRate, accel, ... }, key: "destroyer" }
export function createShip(classConfig) {
  var mesh;
  if (classConfig && classConfig.key) {
    mesh = buildClassMesh(classConfig.key);
  } else {
    mesh = createErrorPlaceholder(3);
  }

  // attempt to load GLB model override (async, shows error placeholder on failure)
  if (classConfig && classConfig.key) {
    applyShipOverrideAsync(mesh, classConfig.key);
  }

  var stats = classConfig ? classConfig.stats : null;

  // ship lantern — warm PointLight that glows at night for visibility
  var lantern = new THREE.PointLight(0xffcc66, 0, 18);
  lantern.position.set(0, 2.5, 0);
  mesh.add(lantern);

  var state = {
    mesh: mesh,
    speed: 0,
    heading: 0,
    posX: 0,
    posZ: 0,
    navTarget: null,
    classKey: classConfig ? classConfig.key : null,
    lantern: lantern,
    // base stats from class (or defaults)
    baseMaxSpeed: stats ? stats.maxSpeed : DEFAULT_MAX_SPEED,
    baseAccel: stats ? stats.accel : DEFAULT_ACCEL,
    baseTurnRate: stats ? stats.turnRate : DEFAULT_TURN_RATE,
    // smoothed buoyancy state (initialized on first update frame)
    _smoothY: 0,
    _smoothPitch: 0,
    _smoothRoll: 0,
    _buoyancyInit: false,
    _stuckDetector: createStuckDetector()
  };

  return state;
}

// --- set auto-nav destination ---
export function setNavTarget(ship, x, z) {
  ship.navTarget = { x: x, z: z };
}

// --- clear auto-nav ---
export function clearNavTarget(ship) {
  ship.navTarget = null;
}

// --- normalize angle to [-PI, PI] ---
function normalizeAngle(a) {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

// --- update ship physics (click-to-move only, no keyboard controls) ---
export function updateShip(ship, input, dt, getWaveHeight, elapsed, fuelMult, upgradeMults, terrain) {
  var speedMult = upgradeMults ? upgradeMults.maxSpeed : 1;
  var accelMult = upgradeMults ? upgradeMults.accel : 1;

  var baseMax = ship.baseMaxSpeed || DEFAULT_MAX_SPEED;
  var baseAccel = ship.baseAccel || DEFAULT_ACCEL;

  var effectiveMaxSpeed = baseMax * speedMult * (fuelMult !== undefined ? fuelMult : 1);
  var effectiveAccel = baseAccel * accelMult;
  var avoid = terrain ? getTerrainAvoidance(terrain, ship.posX, ship.posZ, TERRAIN_AVOID_RANGE) : { factor: 0, awayX: 0, awayZ: 0 };

  if (ship.navTarget) {
    var dx = ship.navTarget.x - ship.posX;
    var dz = ship.navTarget.z - ship.posZ;
    var dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < NAV_ARRIVE_RADIUS) {
      ship.navTarget = null;
      ship.speed *= 0.8;
    } else {
      var targetAngle = Math.atan2(dx, dz);
      var angleDiff = normalizeAngle(targetAngle - ship.heading);

      var maxTurn = NAV_TURN_SPEED * dt;
      if (Math.abs(angleDiff) < maxTurn) {
        ship.heading = targetAngle;
      } else {
        ship.heading += Math.sign(angleDiff) * maxTurn;
      }

      var speedFactor = Math.min(1, dist / NAV_SLOW_RADIUS);
      var desiredSpeed = effectiveMaxSpeed * speedFactor;
      if (avoid.factor > 0) desiredSpeed *= Math.max(0.18, 1 - avoid.factor * TERRAIN_SLOW_MULT);
      if (Math.abs(angleDiff) < Math.PI * 0.5) {
        if (ship.speed < desiredSpeed) {
          ship.speed += effectiveAccel * dt;
          if (ship.speed > desiredSpeed) ship.speed = desiredSpeed;
        } else {
          ship.speed -= DRAG * dt;
          if (ship.speed < desiredSpeed) ship.speed = desiredSpeed;
        }
      } else {
        ship.speed -= DRAG * dt;
        if (ship.speed < 0) ship.speed = 0;
      }

      if (avoid.factor > 0.12) {
        var awayHeading = Math.atan2(avoid.awayX, avoid.awayZ);
        var awayDiff = normalizeAngle(awayHeading - ship.heading);
        var avoidTurn = TERRAIN_AVOID_TURN * avoid.factor * dt;
        if (Math.abs(awayDiff) < avoidTurn) ship.heading = awayHeading;
        else ship.heading += Math.sign(awayDiff) * avoidTurn;
      }
    }
  } else {
    // no nav target — decelerate to stop
    if (ship.speed > 0) {
      ship.speed -= DRAG * dt;
      if (ship.speed < 0) ship.speed = 0;
    } else if (ship.speed < 0) {
      ship.speed += DRAG * dt;
      if (ship.speed > 0) ship.speed = 0;
    }
    if (avoid.factor > 0.12) {
      var awayHeadingIdle = Math.atan2(avoid.awayX, avoid.awayZ);
      var awayDiffIdle = normalizeAngle(awayHeadingIdle - ship.heading);
      var idleTurn = TERRAIN_AVOID_TURN * Math.max(0.25, avoid.factor) * dt;
      if (Math.abs(awayDiffIdle) < idleTurn) ship.heading = awayHeadingIdle;
      else ship.heading += Math.sign(awayDiffIdle) * idleTurn;
      ship.speed = Math.max(ship.speed, effectiveMaxSpeed * 0.18 * avoid.factor);
    }
  }

  var maxReverse = effectiveMaxSpeed * 0.3;
  ship.speed = Math.max(-maxReverse, Math.min(effectiveMaxSpeed, ship.speed));

  var prevX = ship.posX;
  var prevZ = ship.posZ;
  ship.posX += Math.sin(ship.heading) * ship.speed * dt;
  ship.posZ += Math.cos(ship.heading) * ship.speed * dt;

  // wind force (from weather system) — capped so it never overpowers player input
  var MAX_WIND_DISPLACEMENT = 1.5;  // max units/sec of drift from wind
  if (upgradeMults && (upgradeMults.windX || upgradeMults.windZ)) {
    var rawWindX = upgradeMults.windX || 0;
    var rawWindZ = upgradeMults.windZ || 0;
    var windMag = Math.sqrt(rawWindX * rawWindX + rawWindZ * rawWindZ);
    if (windMag > MAX_WIND_DISPLACEMENT) {
      var windScale = MAX_WIND_DISPLACEMENT / windMag;
      rawWindX *= windScale;
      rawWindZ *= windScale;
    }
    // reduce wind effect when player is actively navigating
    var windDampen = ship.navTarget ? 0.4 : 1.0;
    ship.posX += rawWindX * windDampen * dt;
    ship.posZ += rawWindZ * windDampen * dt;
  }

  // terrain collision — slide along surfaces
  if (terrain) {
    var col = slideCollision(terrain, ship.posX, ship.posZ, prevX, prevZ, ship.heading, ship.speed, dt);
    if (col.collided) {
      ship.posX = col.newX;
      ship.posZ = col.newZ;
      var slideDiff = col.slideHeading - ship.heading;
      while (slideDiff > Math.PI) slideDiff -= 2 * Math.PI;
      while (slideDiff < -Math.PI) slideDiff += 2 * Math.PI;
      ship.heading += slideDiff * 0.5;
      ship.speed = col.slideSpeed;
      if (ship.speed < 0) ship.speed = 0;
    }
  }

  // stuck detection — nudge to open water if ship is stuck for >3s
  if (ship._stuckDetector) {
    updateStuck(ship._stuckDetector, ship.posX, ship.posZ, dt);
    if ((ship.speed > 0.1 || ship.navTarget) && isStuck(ship._stuckDetector) && terrain) {
      var safe = nudgeToOpenWater(terrain, ship.posX, ship.posZ);
      ship.posX = safe.x;
      ship.posZ = safe.z;
      ship.speed = 0;
      ship._stuckDetector = createStuckDetector();
    }
  }

  // map edge boundary — soft push-back toward center
  var edge = applyEdgeBoundary(ship.posX, ship.posZ);
  if (edge.pushed) {
    ship.posX = edge.posX;
    ship.posZ = edge.posZ;
    ship.speed *= 0.95;  // gentle slowdown near edge
  }

  ship.mesh.position.x = ship.posX;
  ship.mesh.position.z = ship.posZ;
  ship.mesh.rotation.y = ship.heading;

  if (getWaveHeight) {
    var targetY = getWaveHeight(ship.posX, ship.posZ, elapsed) + FLOAT_OFFSET;

    var sampleDist = 1.5;
    var waveFore = getWaveHeight(ship.posX + Math.sin(ship.heading) * sampleDist, ship.posZ + Math.cos(ship.heading) * sampleDist, elapsed);
    var waveAft  = getWaveHeight(ship.posX - Math.sin(ship.heading) * sampleDist, ship.posZ - Math.cos(ship.heading) * sampleDist, elapsed);
    var wavePort = getWaveHeight(ship.posX + Math.cos(ship.heading) * sampleDist, ship.posZ - Math.sin(ship.heading) * sampleDist, elapsed);
    var waveStbd = getWaveHeight(ship.posX - Math.cos(ship.heading) * sampleDist, ship.posZ + Math.sin(ship.heading) * sampleDist, elapsed);

    var targetPitch = Math.atan2(waveFore - waveAft, sampleDist * 2) * TILT_DAMPING;
    var targetRoll  = Math.atan2(wavePort - waveStbd, sampleDist * 2) * TILT_DAMPING;

    // snap to surface on first frame so ship never starts underwater
    if (!ship._buoyancyInit) {
      ship._buoyancyInit = true;
      ship._smoothY = targetY;
      ship._smoothPitch = targetPitch;
      ship._smoothRoll = targetRoll;
    }

    // smooth interpolation to prevent jitter and snapping
    var lerpFactor = 1 - Math.exp(-BUOYANCY_LERP * dt);
    var tiltFactor = 1 - Math.exp(-TILT_LERP * dt);
    ship._smoothY += (targetY - ship._smoothY) * lerpFactor;
    ship._smoothPitch += (targetPitch - ship._smoothPitch) * tiltFactor;
    ship._smoothRoll += (targetRoll - ship._smoothRoll) * tiltFactor;

    ship.mesh.position.y = ship._smoothY;
    ship.mesh.rotation.x = ship._smoothPitch;
    ship.mesh.rotation.z = ship._smoothRoll;
  }
}

// --- get normalized speed for HUD (0-1) ---
export function getSpeedRatio(ship) {
  return Math.abs(ship.speed) / (ship.baseMaxSpeed || DEFAULT_MAX_SPEED);
}

// --- get speed in display units (knots-like) ---
export function getDisplaySpeed(ship) {
  return Math.abs(ship.speed);
}

// --- update ship lantern intensity based on nightness (0=day, 1=night) ---
export function updateShipLantern(ship, nightness) {
  if (!ship || !ship.lantern) return;
  ship.lantern.intensity = nightness * 1.8;
}
