// ship.js — procedural ship model, physics state, update loop
import * as THREE from "three";
import { buildClassMesh } from "./shipModels.js";
import { collideWithTerrain, applyEdgeBoundary } from "./terrain.js";

// --- default physics tuning (used as fallback) ---
var DEFAULT_MAX_SPEED = 10;
var DEFAULT_ACCEL = 7;
var DEFAULT_TURN_RATE = 2.2;
var REVERSE_ACCEL_RATIO = 0.5;  // reverse accel as fraction of forward accel
var DRAG = 4;
var TURN_SPEED_HIGH_RATIO = 0.36; // turn rate at max speed as ratio of base turn rate
var FLOAT_OFFSET = 1.2;
var BUOYANCY_LERP = 8;        // Y position smoothing speed (higher = tighter tracking)
var TILT_LERP = 6;            // pitch/roll smoothing speed

// --- auto-nav tuning ---
var NAV_ARRIVE_RADIUS = 3;
var NAV_SLOW_RADIUS = 15;
var NAV_TURN_SPEED = 2.5;

// --- fallback procedural ship geometry (original design) ---
function buildShipMesh() {
  var group = new THREE.Group();

  var hullShape = new THREE.Shape();
  hullShape.moveTo(0, 2.4);
  hullShape.lineTo(0.7, 1.0);
  hullShape.lineTo(0.8, -0.6);
  hullShape.lineTo(0.7, -1.8);
  hullShape.lineTo(0.5, -2.2);
  hullShape.lineTo(-0.5, -2.2);
  hullShape.lineTo(-0.7, -1.8);
  hullShape.lineTo(-0.8, -0.6);
  hullShape.lineTo(-0.7, 1.0);
  hullShape.lineTo(0, 2.4);

  var extrudeSettings = { depth: 0.5, bevelEnabled: false };
  var hullGeo = new THREE.ExtrudeGeometry(hullShape, extrudeSettings);
  var hullMat = new THREE.MeshLambertMaterial({ color: 0x556677 });
  var hull = new THREE.Mesh(hullGeo, hullMat);
  hull.rotation.x = -Math.PI / 2;
  hull.position.y = -0.1;
  group.add(hull);

  var deckGeo = new THREE.PlaneGeometry(1.2, 3.6);
  var deckMat = new THREE.MeshLambertMaterial({ color: 0x667788 });
  var deck = new THREE.Mesh(deckGeo, deckMat);
  deck.rotation.x = -Math.PI / 2;
  deck.position.y = 0.4;
  deck.position.z = -0.2;
  group.add(deck);

  var bridgeGeo = new THREE.BoxGeometry(0.7, 0.6, 0.8);
  var bridgeMat = new THREE.MeshLambertMaterial({ color: 0x778899 });
  var bridge = new THREE.Mesh(bridgeGeo, bridgeMat);
  bridge.position.set(0, 0.7, -0.6);
  group.add(bridge);

  var turretGeo = new THREE.CylinderGeometry(0.2, 0.25, 0.3, 6);
  var turretMat = new THREE.MeshLambertMaterial({ color: 0x445566 });
  var barrelGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.7, 4);
  var barrelMat = new THREE.MeshLambertMaterial({ color: 0x334455 });

  var fwdTurret = new THREE.Group();
  fwdTurret.position.set(0, 0.55, 0.8);
  fwdTurret.add(new THREE.Mesh(turretGeo, turretMat));
  var fwdBarrel = new THREE.Mesh(barrelGeo, barrelMat);
  fwdBarrel.rotation.x = Math.PI / 2;
  fwdBarrel.position.set(0, 0.1, 0.35);
  fwdTurret.add(fwdBarrel);
  group.add(fwdTurret);

  var rearTurret = new THREE.Group();
  rearTurret.position.set(0, 0.55, -1.4);
  rearTurret.add(new THREE.Mesh(turretGeo, turretMat));
  var rearBarrel = new THREE.Mesh(barrelGeo, barrelMat);
  rearBarrel.rotation.x = Math.PI / 2;
  rearBarrel.position.set(0, 0.1, 0.35);
  rearTurret.add(rearBarrel);
  group.add(rearTurret);

  group.userData.turrets = [fwdTurret, rearTurret];

  var mastGeo = new THREE.CylinderGeometry(0.02, 0.03, 1.0, 4);
  var mastMat = new THREE.MeshLambertMaterial({ color: 0x556677 });
  var mast = new THREE.Mesh(mastGeo, mastMat);
  mast.position.set(0, 1.3, -0.6);
  group.add(mast);

  return group;
}

// --- create ship ---
// classConfig: optional { stats: { maxSpeed, turnRate, accel, ... }, key: "destroyer" }
export function createShip(classConfig) {
  var mesh;
  if (classConfig && classConfig.key) {
    mesh = buildClassMesh(classConfig.key);
  } else {
    mesh = buildShipMesh();
  }

  var stats = classConfig ? classConfig.stats : null;

  var state = {
    mesh: mesh,
    speed: 0,
    heading: 0,
    posX: 0,
    posZ: 0,
    navTarget: null,
    classKey: classConfig ? classConfig.key : null,
    // base stats from class (or defaults)
    baseMaxSpeed: stats ? stats.maxSpeed : DEFAULT_MAX_SPEED,
    baseAccel: stats ? stats.accel : DEFAULT_ACCEL,
    baseTurnRate: stats ? stats.turnRate : DEFAULT_TURN_RATE,
    // smoothed buoyancy state
    _smoothY: 0,
    _smoothPitch: 0,
    _smoothRoll: 0
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

  // terrain collision — bounce/stop when hitting land
  if (terrain) {
    var col = collideWithTerrain(terrain, ship.posX, ship.posZ, prevX, prevZ);
    if (col.collided) {
      ship.posX = col.newX;
      ship.posZ = col.newZ;
      ship.speed *= -0.3;  // bounce back
      if (ship.navTarget) ship.navTarget = null;  // cancel nav on collision
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

    var targetPitch = Math.atan2(waveFore - waveAft, sampleDist * 2) * 0.3;
    var targetRoll  = Math.atan2(wavePort - waveStbd, sampleDist * 2) * 0.3;

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
