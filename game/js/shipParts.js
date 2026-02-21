// shipParts.js — shared materials and detail builders for ship models
import * as THREE from "three";

// --- shared materials (reused across builds) ---
var hullMats = {};
var deckMats = {};
var bridgeMats = {};
var turretMats = {};
var barrelMats = {};
var glassMat = null;
var metalMat = null;
var radarMat = null;
var flagMat = null;
var anchorMat = null;

export function ensureMaterials() {
  if (glassMat) return;
  glassMat = new THREE.MeshStandardMaterial({
    color: 0x1a2a3a, roughness: 0.1, metalness: 0.5,
    emissive: 0x1a2a3a, emissiveIntensity: 0
  });
  metalMat = new THREE.MeshStandardMaterial({
    color: 0x888899, roughness: 0.3, metalness: 0.8
  });
  radarMat = new THREE.MeshStandardMaterial({
    color: 0x667777, roughness: 0.4, metalness: 0.7
  });
  flagMat = new THREE.MeshStandardMaterial({
    color: 0xeeeeee, roughness: 0.9, metalness: 0.0, side: THREE.DoubleSide
  });
  anchorMat = new THREE.MeshStandardMaterial({
    color: 0x444444, roughness: 0.4, metalness: 0.9
  });
}

export function getMetalMat() { ensureMaterials(); return metalMat; }

export function getHullMat(color) {
  var key = color.toString(16);
  if (!hullMats[key]) {
    hullMats[key] = new THREE.MeshStandardMaterial({ color: color, roughness: 0.7, metalness: 0.1 });
  }
  return hullMats[key];
}

export function getDeckMat(color) {
  var key = color.toString(16);
  if (!deckMats[key]) {
    deckMats[key] = new THREE.MeshStandardMaterial({ color: color, roughness: 0.5, metalness: 0.05 });
  }
  return deckMats[key];
}

export function getBridgeMat(color) {
  var key = color.toString(16);
  if (!bridgeMats[key]) {
    bridgeMats[key] = new THREE.MeshStandardMaterial({ color: color, roughness: 0.5, metalness: 0.2 });
  }
  return bridgeMats[key];
}

export function getTurretMat(color) {
  var key = color.toString(16);
  if (!turretMats[key]) {
    turretMats[key] = new THREE.MeshStandardMaterial({ color: color, roughness: 0.35, metalness: 0.7 });
  }
  return turretMats[key];
}

export function getBarrelMat(color) {
  var key = color.toString(16);
  if (!barrelMats[key]) {
    barrelMats[key] = new THREE.MeshStandardMaterial({ color: color, roughness: 0.3, metalness: 0.8 });
  }
  return barrelMats[key];
}

// --- waterline stripe (dark band at hull base) ---
export function addWaterline(group, halfWidth, length, zOffset) {
  var wlGeo = new THREE.PlaneGeometry(halfWidth * 2, length);
  var wlMat = new THREE.MeshStandardMaterial({ color: 0x1a0a0a, roughness: 0.9, metalness: 0 });
  var wl = new THREE.Mesh(wlGeo, wlMat);
  wl.rotation.x = -Math.PI / 2;
  wl.position.set(0, 0.01, zOffset || 0);
  group.add(wl);
}

// --- navigation lights (red port, green starboard) ---
export function addNavLights(group, x, y, z) {
  var portMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  var stbdMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
  var lightGeo = new THREE.SphereGeometry(0.04, 4, 3);
  var port = new THREE.Mesh(lightGeo, portMat);
  port.position.set(-x, y, z);
  group.add(port);
  var stbd = new THREE.Mesh(lightGeo, stbdMat);
  stbd.position.set(x, y, z);
  group.add(stbd);
}

// --- flag at stern ---
export function addFlag(group, x, y, z) {
  ensureMaterials();
  var poleGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.4, 3);
  var pole = new THREE.Mesh(poleGeo, metalMat);
  pole.position.set(x, y + 0.2, z);
  group.add(pole);
  var fGeo = new THREE.PlaneGeometry(0.2, 0.12);
  var flag = new THREE.Mesh(fGeo, flagMat);
  flag.position.set(x + 0.1, y + 0.35, z);
  group.add(flag);
}

// --- anchor on bow ---
export function addAnchor(group, bowZ, y) {
  ensureMaterials();
  var shankGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.2, 4);
  var shank = new THREE.Mesh(shankGeo, anchorMat);
  shank.position.set(0.25, y, bowZ - 0.1);
  shank.rotation.z = 0.3;
  group.add(shank);
}

// --- radar dish (horizontal disc on mast) ---
export function addRadarDish(group, x, y, z) {
  ensureMaterials();
  var dishGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.02, 8);
  var dish = new THREE.Mesh(dishGeo, radarMat);
  dish.position.set(x, y, z);
  group.add(dish);
  var armGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.15, 3);
  var arm = new THREE.Mesh(armGeo, metalMat);
  arm.position.set(x, y - 0.08, z);
  group.add(arm);
}

// --- bridge windows (dark glass strip) ---
export function addBridgeWindows(group, bx, by, bz, width, height) {
  ensureMaterials();
  var winGeo = new THREE.PlaneGeometry(width * 0.8, height * 0.35);
  var winF = new THREE.Mesh(winGeo, glassMat);
  winF.position.set(bx, by + height * 0.1, bz + height * 0.51);
  group.add(winF);
  var winSideGeo = new THREE.PlaneGeometry(height * 0.6, height * 0.35);
  var winL = new THREE.Mesh(winSideGeo, glassMat);
  winL.rotation.y = Math.PI / 2;
  winL.position.set(bx - width * 0.51, by + height * 0.1, bz);
  group.add(winL);
  var winR = new THREE.Mesh(winSideGeo, glassMat);
  winR.rotation.y = -Math.PI / 2;
  winR.position.set(bx + width * 0.51, by + height * 0.1, bz);
  group.add(winR);
}

// --- smokestack ---
export function addSmokestack(group, x, y, z, radius, height) {
  var stackGeo = new THREE.CylinderGeometry(radius * 0.8, radius, height, 8);
  var stackMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.6, metalness: 0.3 });
  var stack = new THREE.Mesh(stackGeo, stackMat);
  stack.position.set(x, y + height / 2, z);
  group.add(stack);
  var rimGeo = new THREE.TorusGeometry(radius * 0.8, 0.02, 4, 8);
  var rimMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8, metalness: 0.2 });
  var rim = new THREE.Mesh(rimGeo, rimMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.set(x, y + height, z);
  group.add(rim);
}
