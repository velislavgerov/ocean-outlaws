// drone.js — carrier drone: auto-attacking AI entity that circles and shoots nearest enemy
import * as THREE from "three";
import { damageEnemy } from "./enemy.js";

// --- drone tuning ---
var DRONE_SPEED = 22;
var DRONE_TURN_SPEED = 3.5;
var DRONE_FIRE_RANGE = 30;
var DRONE_FIRE_COOLDOWN = 0.8;
var DRONE_PROJ_SPEED = 50;
var DRONE_ORBIT_DIST = 12;
var DRONE_HEIGHT = 4;
var DRONE_PROJ_GRAVITY = 6;

// --- shared geometry ---
var droneGeo = null;
var droneMat = null;
var droneProjGeo = null;
var droneProjMat = null;

function ensureGeo() {
  if (droneGeo) return;
  // small quadcopter-like shape
  droneGeo = new THREE.BoxGeometry(0.6, 0.15, 0.6);
  droneMat = new THREE.MeshLambertMaterial({ color: 0x44dd66 });
  droneProjGeo = new THREE.SphereGeometry(0.08, 4, 3);
  droneProjMat = new THREE.MeshBasicMaterial({ color: 0x66ffaa });
}

function buildDroneMesh() {
  ensureGeo();
  var group = new THREE.Group();

  // body
  var body = new THREE.Mesh(droneGeo, droneMat);
  group.add(body);

  // rotor arms
  var armGeo = new THREE.BoxGeometry(1.0, 0.05, 0.08);
  var armMat = new THREE.MeshLambertMaterial({ color: 0x338844 });
  var arm1 = new THREE.Mesh(armGeo, armMat);
  arm1.rotation.y = Math.PI / 4;
  arm1.position.y = 0.05;
  group.add(arm1);

  var arm2 = new THREE.Mesh(armGeo, armMat);
  arm2.rotation.y = -Math.PI / 4;
  arm2.position.y = 0.05;
  group.add(arm2);

  return group;
}

// --- drone manager ---
export function createDroneManager() {
  return {
    drones: [],
    projectiles: []
  };
}

// --- spawn a drone near the ship ---
export function spawnDrone(mgr, shipX, shipZ, scene, duration) {
  ensureGeo();
  var mesh = buildDroneMesh();
  mesh.position.set(shipX + 2, DRONE_HEIGHT, shipZ + 2);
  scene.add(mesh);

  mgr.drones.push({
    mesh: mesh,
    posX: shipX + 2,
    posZ: shipZ + 2,
    heading: 0,
    fireTimer: 1.0,
    lifeTimer: duration || 15,
    alive: true
  });
}

// --- update all drones ---
export function updateDrones(mgr, ship, dt, scene, enemyMgr, getWaveHeight, elapsed) {
  var aliveDrones = [];

  for (var i = 0; i < mgr.drones.length; i++) {
    var d = mgr.drones[i];
    if (!d.alive) continue;

    d.lifeTimer -= dt;
    if (d.lifeTimer <= 0) {
      scene.remove(d.mesh);
      continue;
    }

    // find nearest alive enemy
    var nearestEnemy = null;
    var nearestDist = Infinity;
    if (enemyMgr) {
      for (var e = 0; e < enemyMgr.enemies.length; e++) {
        var en = enemyMgr.enemies[e];
        if (!en.alive) continue;
        var edx = en.posX - d.posX;
        var edz = en.posZ - d.posZ;
        var eDist = Math.sqrt(edx * edx + edz * edz);
        if (eDist < nearestDist) {
          nearestDist = eDist;
          nearestEnemy = en;
        }
      }
    }

    // movement: orbit ship if no enemy, chase enemy if one exists
    var targetX, targetZ;
    if (nearestEnemy && nearestDist < DRONE_FIRE_RANGE * 1.5) {
      // circle around enemy at orbit distance
      var eDx = nearestEnemy.posX - d.posX;
      var eDz = nearestEnemy.posZ - d.posZ;
      var angleToEnemy = Math.atan2(eDx, eDz);
      if (nearestDist > DRONE_ORBIT_DIST) {
        targetX = nearestEnemy.posX;
        targetZ = nearestEnemy.posZ;
      } else {
        // orbit perpendicular
        targetX = d.posX + Math.sin(angleToEnemy + Math.PI / 2) * 5;
        targetZ = d.posZ + Math.cos(angleToEnemy + Math.PI / 2) * 5;
      }
    } else {
      // orbit ship
      var orbitAngle = elapsed * 0.8 + i * Math.PI;
      targetX = ship.posX + Math.sin(orbitAngle) * DRONE_ORBIT_DIST;
      targetZ = ship.posZ + Math.cos(orbitAngle) * DRONE_ORBIT_DIST;
    }

    var dx = targetX - d.posX;
    var dz = targetZ - d.posZ;
    var dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > 1) {
      var targetAngle = Math.atan2(dx, dz);
      var angleDiff = targetAngle - d.heading;
      while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
      while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

      var maxTurn = DRONE_TURN_SPEED * dt;
      if (Math.abs(angleDiff) < maxTurn) {
        d.heading = targetAngle;
      } else {
        d.heading += Math.sign(angleDiff) * maxTurn;
      }

      d.posX += Math.sin(d.heading) * DRONE_SPEED * dt;
      d.posZ += Math.cos(d.heading) * DRONE_SPEED * dt;
    }

    // height bob
    var bobY = DRONE_HEIGHT + Math.sin(elapsed * 2 + i) * 0.3;
    d.mesh.position.set(d.posX, bobY, d.posZ);
    d.mesh.rotation.y = d.heading;

    // slight tilt in movement direction
    d.mesh.rotation.z = Math.sin(elapsed * 3) * 0.1;

    // fire at nearest enemy
    d.fireTimer -= dt;
    if (d.fireTimer <= 0 && nearestEnemy && nearestDist < DRONE_FIRE_RANGE) {
      droneFire(mgr, d, nearestEnemy, scene);
      d.fireTimer = DRONE_FIRE_COOLDOWN;
    }

    aliveDrones.push(d);
  }
  mgr.drones = aliveDrones;

  // update drone projectiles
  updateDroneProjectiles(mgr, dt, scene, enemyMgr);
}

// --- drone fires at enemy ---
function droneFire(mgr, drone, enemy, scene) {
  ensureGeo();
  var startPos = new THREE.Vector3(drone.posX, DRONE_HEIGHT - 0.2, drone.posZ);
  var dx = enemy.posX - drone.posX;
  var dz = enemy.posZ - drone.posZ;
  var dist = Math.sqrt(dx * dx + dz * dz);
  if (dist < 0.1) return;

  var dirX = dx / dist;
  var dirZ = dz / dist;

  var projMesh = new THREE.Mesh(droneProjGeo, droneProjMat);
  projMesh.position.copy(startPos);
  scene.add(projMesh);

  mgr.projectiles.push({
    mesh: projMesh,
    vx: dirX * DRONE_PROJ_SPEED,
    vy: 0,
    vz: dirZ * DRONE_PROJ_SPEED,
    age: 0
  });
}

// --- update drone projectiles ---
function updateDroneProjectiles(mgr, dt, scene, enemyMgr) {
  var alive = [];
  for (var i = 0; i < mgr.projectiles.length; i++) {
    var p = mgr.projectiles[i];
    p.age += dt;
    p.vy -= DRONE_PROJ_GRAVITY * dt;
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    p.mesh.position.z += p.vz * dt;

    var hitWater = p.mesh.position.y < 0.2;
    var tooOld = p.age > 3;

    // hit enemy check
    var hitEnemy = false;
    if (enemyMgr) {
      for (var e = 0; e < enemyMgr.enemies.length; e++) {
        var en = enemyMgr.enemies[e];
        if (!en.alive) continue;
        var edx = p.mesh.position.x - en.posX;
        var edz = p.mesh.position.z - en.posZ;
        if (edx * edx + edz * edz < 2.5 * 2.5) {
          damageEnemy(enemyMgr, en, scene, 1);
          hitEnemy = true;
          break;
        }
      }
    }

    if (hitWater || tooOld || hitEnemy) {
      scene.remove(p.mesh);
    } else {
      alive.push(p);
    }
  }
  mgr.projectiles = alive;
}

// --- remove all drones (for restart) ---
export function resetDrones(mgr, scene) {
  for (var i = 0; i < mgr.drones.length; i++) {
    scene.remove(mgr.drones[i].mesh);
  }
  for (var i = 0; i < mgr.projectiles.length; i++) {
    scene.remove(mgr.projectiles[i].mesh);
  }
  mgr.drones = [];
  mgr.projectiles = [];
}
