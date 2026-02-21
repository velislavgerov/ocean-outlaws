// shipModels.js — unique procedural 3D models for each ship class
import * as THREE from "three";
import {
  ensureMaterials, getMetalMat, getHullMat, getDeckMat, getBridgeMat,
  getTurretMat, getBarrelMat, addWaterline, addNavLights, addFlag,
  addAnchor, addRadarDish, addBridgeWindows, addSmokestack
} from "./shipParts.js";

// --- Destroyer: sleek and narrow, low profile ---
function buildDestroyerMesh() {
  ensureMaterials();
  var group = new THREE.Group();
  var metalMat = getMetalMat();

  // hull — smoother curves with bezier
  var hullShape = new THREE.Shape();
  hullShape.moveTo(0, 3.2);
  hullShape.bezierCurveTo(0.15, 2.8, 0.4, 2.2, 0.52, 1.6);
  hullShape.bezierCurveTo(0.6, 1.0, 0.65, 0.3, 0.65, 0);
  hullShape.bezierCurveTo(0.65, -0.5, 0.62, -1.2, 0.55, -1.8);
  hullShape.bezierCurveTo(0.45, -2.2, 0.3, -2.4, 0, -2.6);
  hullShape.bezierCurveTo(-0.3, -2.4, -0.45, -2.2, -0.55, -1.8);
  hullShape.bezierCurveTo(-0.62, -1.2, -0.65, -0.5, -0.65, 0);
  hullShape.bezierCurveTo(-0.65, 0.3, -0.6, 1.0, -0.52, 1.6);
  hullShape.bezierCurveTo(-0.4, 2.2, -0.15, 2.8, 0, 3.2);

  var hullGeo = new THREE.ExtrudeGeometry(hullShape, {
    depth: 0.45, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.03, bevelSegments: 2
  });
  var hull = new THREE.Mesh(hullGeo, getHullMat(0x2e5a8c));
  hull.rotation.x = -Math.PI / 2;
  hull.position.y = -0.1;
  group.add(hull);

  addWaterline(group, 0.6, 5.2, 0.2);

  // deck
  var deckGeo = new THREE.PlaneGeometry(0.95, 4.6);
  var deck = new THREE.Mesh(deckGeo, getDeckMat(0x3a6b9e));
  deck.rotation.x = -Math.PI / 2;
  deck.position.set(0, 0.35, 0.1);
  group.add(deck);

  // bridge — compact, low
  var bridgeGeo = new THREE.BoxGeometry(0.5, 0.4, 0.55);
  var bridge = new THREE.Mesh(bridgeGeo, getBridgeMat(0x4a7aaa));
  bridge.position.set(0, 0.55, -0.4);
  group.add(bridge);
  addBridgeWindows(group, 0, 0.55, -0.4, 0.5, 0.4);

  // radar mast
  var mastGeo = new THREE.CylinderGeometry(0.012, 0.022, 0.9, 4);
  var mast = new THREE.Mesh(mastGeo, metalMat);
  mast.position.set(0, 1.05, -0.4);
  group.add(mast);
  addRadarDish(group, 0, 1.55, -0.4);

  // turrets — two, fore and aft
  var turretGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.22, 8);
  var barrelGeo = new THREE.CylinderGeometry(0.03, 0.035, 0.7, 6);
  var tMat = getTurretMat(0x1e4a7a);
  var bMat = getBarrelMat(0x1a3e6a);

  var fwdTurret = new THREE.Group();
  fwdTurret.position.set(0, 0.48, 1.2);
  fwdTurret.add(new THREE.Mesh(turretGeo, tMat));
  var fwdBarrel = new THREE.Mesh(barrelGeo, bMat);
  fwdBarrel.rotation.x = Math.PI / 2;
  fwdBarrel.position.set(0, 0.08, 0.35);
  fwdTurret.add(fwdBarrel);
  group.add(fwdTurret);

  var rearTurret = new THREE.Group();
  rearTurret.position.set(0, 0.48, -1.4);
  rearTurret.add(new THREE.Mesh(turretGeo, tMat));
  var rearBarrel = new THREE.Mesh(barrelGeo, bMat);
  rearBarrel.rotation.x = Math.PI / 2;
  rearBarrel.position.set(0, 0.08, 0.35);
  rearTurret.add(rearBarrel);
  group.add(rearTurret);

  group.userData.turrets = [fwdTurret, rearTurret];

  addNavLights(group, 0.55, 0.35, 0.8);
  addFlag(group, 0, 0.35, -2.4);
  addAnchor(group, 3.0, 0.1);

  return group;
}

// --- Cruiser: wider, more superstructure, imposing ---
function buildCruiserMesh() {
  ensureMaterials();
  var group = new THREE.Group();
  var metalMat = getMetalMat();

  var hullShape = new THREE.Shape();
  hullShape.moveTo(0, 2.8);
  hullShape.bezierCurveTo(0.3, 2.4, 0.65, 1.8, 0.85, 1.2);
  hullShape.bezierCurveTo(0.95, 0.6, 1.0, 0, 1.0, -0.4);
  hullShape.bezierCurveTo(1.0, -1.0, 0.9, -1.6, 0.8, -2.0);
  hullShape.bezierCurveTo(0.65, -2.4, 0.4, -2.6, 0, -2.8);
  hullShape.bezierCurveTo(-0.4, -2.6, -0.65, -2.4, -0.8, -2.0);
  hullShape.bezierCurveTo(-0.9, -1.6, -1.0, -1.0, -1.0, -0.4);
  hullShape.bezierCurveTo(-1.0, 0, -0.95, 0.6, -0.85, 1.2);
  hullShape.bezierCurveTo(-0.65, 1.8, -0.3, 2.4, 0, 2.8);

  var hullGeo = new THREE.ExtrudeGeometry(hullShape, {
    depth: 0.6, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.04, bevelSegments: 2
  });
  var hull = new THREE.Mesh(hullGeo, getHullMat(0x6a5530));
  hull.rotation.x = -Math.PI / 2;
  hull.position.y = -0.1;
  group.add(hull);

  addWaterline(group, 0.9, 5.0, 0);

  var deckGeo = new THREE.PlaneGeometry(1.5, 4.4);
  var deck = new THREE.Mesh(deckGeo, getDeckMat(0x7a6640));
  deck.rotation.x = -Math.PI / 2;
  deck.position.set(0, 0.5, -0.1);
  group.add(deck);

  // large bridge with two tiers
  var bridgeGeo = new THREE.BoxGeometry(0.8, 0.55, 0.8);
  var bridge = new THREE.Mesh(bridgeGeo, getBridgeMat(0x8a7750));
  bridge.position.set(0, 0.78, -0.4);
  group.add(bridge);
  var upperBridgeGeo = new THREE.BoxGeometry(0.55, 0.3, 0.55);
  var upperBridge = new THREE.Mesh(upperBridgeGeo, getBridgeMat(0x907d58));
  upperBridge.position.set(0, 1.2, -0.4);
  group.add(upperBridge);
  addBridgeWindows(group, 0, 0.78, -0.4, 0.8, 0.55);

  addSmokestack(group, 0, 1.05, -1.0, 0.12, 0.5);

  // radar mast
  var mastGeo = new THREE.CylinderGeometry(0.02, 0.03, 1.3, 4);
  var mast = new THREE.Mesh(mastGeo, metalMat);
  mast.position.set(0, 1.65, -0.4);
  group.add(mast);
  addRadarDish(group, 0, 2.35, -0.4);

  // three turrets
  var turretGeo = new THREE.CylinderGeometry(0.22, 0.27, 0.28, 8);
  var barrelGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.75, 6);
  var tMat = getTurretMat(0x5a4520);
  var bMat = getBarrelMat(0x4a3a18);

  var turrets = [];
  var positions = [[0, 0.6, 1.2], [0, 0.6, -0.1], [0, 0.6, -1.6]];
  for (var i = 0; i < positions.length; i++) {
    var t = new THREE.Group();
    t.position.set(positions[i][0], positions[i][1], positions[i][2]);
    t.add(new THREE.Mesh(turretGeo, tMat));
    var b = new THREE.Mesh(barrelGeo, bMat);
    b.rotation.x = Math.PI / 2;
    b.position.set(0, 0.1, 0.38);
    t.add(b);
    group.add(t);
    turrets.push(t);
  }
  group.userData.turrets = turrets;

  addNavLights(group, 0.85, 0.5, 1.0);
  addFlag(group, 0, 0.5, -2.6);
  addAnchor(group, 2.6, 0.15);

  return group;
}

// --- Carrier: flat deck dominates, island tower to one side ---
function buildCarrierMesh() {
  ensureMaterials();
  var group = new THREE.Group();
  var metalMat = getMetalMat();

  var hullShape = new THREE.Shape();
  hullShape.moveTo(0, 3.0);
  hullShape.bezierCurveTo(0.4, 2.4, 0.8, 1.8, 1.05, 1.2);
  hullShape.bezierCurveTo(1.15, 0.6, 1.2, 0, 1.2, -0.4);
  hullShape.bezierCurveTo(1.2, -1.2, 1.1, -2.0, 1.0, -2.4);
  hullShape.bezierCurveTo(0.85, -2.8, 0.6, -3.0, 0, -3.2);
  hullShape.bezierCurveTo(-0.6, -3.0, -0.85, -2.8, -1.0, -2.4);
  hullShape.bezierCurveTo(-1.1, -2.0, -1.2, -1.2, -1.2, -0.4);
  hullShape.bezierCurveTo(-1.2, 0, -1.15, 0.6, -1.05, 1.2);
  hullShape.bezierCurveTo(-0.8, 1.8, -0.4, 2.4, 0, 3.0);

  var hullGeo = new THREE.ExtrudeGeometry(hullShape, {
    depth: 0.65, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.04, bevelSegments: 2
  });
  var hull = new THREE.Mesh(hullGeo, getHullMat(0x2e5e40));
  hull.rotation.x = -Math.PI / 2;
  hull.position.y = -0.1;
  group.add(hull);

  addWaterline(group, 1.1, 5.6, -0.2);

  // flight deck
  var deckGeo = new THREE.PlaneGeometry(2.0, 5.0);
  var deck = new THREE.Mesh(deckGeo, getDeckMat(0x3a6a4a));
  deck.rotation.x = -Math.PI / 2;
  deck.position.set(0, 0.55, -0.1);
  group.add(deck);

  // runway markings
  var stripeMat = new THREE.MeshStandardMaterial({ color: 0xccccaa, roughness: 0.8, metalness: 0 });
  var stripeGeo = new THREE.PlaneGeometry(0.06, 3.8);
  var stripe = new THREE.Mesh(stripeGeo, stripeMat);
  stripe.rotation.x = -Math.PI / 2;
  stripe.position.set(0, 0.56, 0.2);
  group.add(stripe);
  for (var ds = -1; ds <= 1; ds += 2) {
    for (var di = 0; di < 4; di++) {
      var dashGeo = new THREE.PlaneGeometry(0.04, 0.4);
      var dash = new THREE.Mesh(dashGeo, stripeMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(ds * 0.7, 0.56, di * 1.2 - 1.5);
      group.add(dash);
    }
  }

  // island tower (starboard side)
  var bridgeGeo = new THREE.BoxGeometry(0.55, 0.9, 0.75);
  var bridge = new THREE.Mesh(bridgeGeo, getBridgeMat(0x4a7a5a));
  bridge.position.set(0.75, 1.0, -0.8);
  group.add(bridge);
  addBridgeWindows(group, 0.75, 1.0, -0.8, 0.55, 0.9);

  // radar mast on island
  var mastGeo = new THREE.CylinderGeometry(0.015, 0.025, 1.1, 4);
  var mast = new THREE.Mesh(mastGeo, metalMat);
  mast.position.set(0.75, 1.6, -0.8);
  group.add(mast);
  addRadarDish(group, 0.75, 2.2, -0.8);

  // defensive turrets
  var turretGeo = new THREE.CylinderGeometry(0.2, 0.25, 0.22, 8);
  var barrelGeo = new THREE.CylinderGeometry(0.03, 0.035, 0.6, 6);
  var tMat = getTurretMat(0x2a5a3a);
  var bMat = getBarrelMat(0x1e4a2e);

  var fwdTurret = new THREE.Group();
  fwdTurret.position.set(0, 0.6, 1.5);
  fwdTurret.add(new THREE.Mesh(turretGeo, tMat));
  var fwdBarrel = new THREE.Mesh(barrelGeo, bMat);
  fwdBarrel.rotation.x = Math.PI / 2;
  fwdBarrel.position.set(0, 0.08, 0.3);
  fwdTurret.add(fwdBarrel);
  group.add(fwdTurret);

  var rearTurret = new THREE.Group();
  rearTurret.position.set(0, 0.6, -2.2);
  rearTurret.add(new THREE.Mesh(turretGeo, tMat));
  var rearBarrel = new THREE.Mesh(barrelGeo, bMat);
  rearBarrel.rotation.x = Math.PI / 2;
  rearBarrel.position.set(0, 0.08, 0.3);
  rearTurret.add(rearBarrel);
  group.add(rearTurret);

  group.userData.turrets = [fwdTurret, rearTurret];

  addNavLights(group, 1.0, 0.55, 1.2);
  addFlag(group, 0, 0.55, -3.0);
  addAnchor(group, 2.8, 0.1);

  return group;
}

// --- Submarine: smooth cylindrical hull, conning tower, minimal deck ---
function buildSubmarineMesh() {
  ensureMaterials();
  var group = new THREE.Group();
  var metalMat = getMetalMat();

  // elongated smooth hull
  var hullShape = new THREE.Shape();
  hullShape.moveTo(0, 2.5);
  hullShape.bezierCurveTo(0.12, 2.2, 0.3, 1.8, 0.42, 1.4);
  hullShape.bezierCurveTo(0.5, 0.8, 0.52, 0.2, 0.52, 0);
  hullShape.bezierCurveTo(0.52, -0.6, 0.5, -1.2, 0.45, -1.6);
  hullShape.bezierCurveTo(0.38, -2.0, 0.25, -2.3, 0, -2.5);
  hullShape.bezierCurveTo(-0.25, -2.3, -0.38, -2.0, -0.45, -1.6);
  hullShape.bezierCurveTo(-0.5, -1.2, -0.52, -0.6, -0.52, 0);
  hullShape.bezierCurveTo(-0.52, 0.2, -0.5, 0.8, -0.42, 1.4);
  hullShape.bezierCurveTo(-0.3, 1.8, -0.12, 2.2, 0, 2.5);

  var hullGeo = new THREE.ExtrudeGeometry(hullShape, {
    depth: 0.4, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 3
  });
  var hull = new THREE.Mesh(hullGeo, getHullMat(0x3a4a5a));
  hull.rotation.x = -Math.PI / 2;
  hull.position.y = -0.15;
  group.add(hull);

  addWaterline(group, 0.45, 4.4, 0);

  // minimal deck
  var deckGeo = new THREE.PlaneGeometry(0.7, 3.8);
  var deck = new THREE.Mesh(deckGeo, getDeckMat(0x4a5a6a));
  deck.rotation.x = -Math.PI / 2;
  deck.position.set(0, 0.25, 0);
  group.add(deck);

  // conning tower
  var towerGeo = new THREE.BoxGeometry(0.38, 0.7, 0.5);
  var tower = new THREE.Mesh(towerGeo, getBridgeMat(0x5a6a7a));
  tower.position.set(0, 0.6, -0.15);
  group.add(tower);
  addBridgeWindows(group, 0, 0.6, -0.15, 0.38, 0.7);

  // periscope / mast
  var periGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.7, 4);
  var peri = new THREE.Mesh(periGeo, metalMat);
  peri.position.set(0, 1.3, -0.15);
  group.add(peri);
  addRadarDish(group, 0, 1.7, -0.15);

  // dive planes (horizontal fins)
  var finGeo = new THREE.BoxGeometry(0.6, 0.03, 0.15);
  var finMat = new THREE.MeshStandardMaterial({ color: 0x3a4a5a, roughness: 0.5, metalness: 0.4 });
  var finFwd = new THREE.Mesh(finGeo, finMat);
  finFwd.position.set(0, 0.15, 1.5);
  group.add(finFwd);
  var finAft = new THREE.Mesh(finGeo, finMat);
  finAft.position.set(0, 0.15, -1.8);
  group.add(finAft);

  // turrets (low profile)
  var turretGeo = new THREE.CylinderGeometry(0.14, 0.18, 0.18, 8);
  var barrelGeo = new THREE.CylinderGeometry(0.025, 0.03, 0.5, 6);
  var tMat = getTurretMat(0x2a3a4a);
  var bMat = getBarrelMat(0x1e2e3e);

  var fwdTurret = new THREE.Group();
  fwdTurret.position.set(0, 0.35, 0.9);
  fwdTurret.add(new THREE.Mesh(turretGeo, tMat));
  var fwdBarrel = new THREE.Mesh(barrelGeo, bMat);
  fwdBarrel.rotation.x = Math.PI / 2;
  fwdBarrel.position.set(0, 0.06, 0.25);
  fwdTurret.add(fwdBarrel);
  group.add(fwdTurret);

  var rearTurret = new THREE.Group();
  rearTurret.position.set(0, 0.35, -1.3);
  rearTurret.add(new THREE.Mesh(turretGeo, tMat));
  var rearBarrel2 = new THREE.Mesh(barrelGeo, bMat);
  rearBarrel2.rotation.x = Math.PI / 2;
  rearBarrel2.position.set(0, 0.06, 0.25);
  rearTurret.add(rearBarrel2);
  group.add(rearTurret);

  group.userData.turrets = [fwdTurret, rearTurret];

  addNavLights(group, 0.4, 0.25, 0.6);
  addFlag(group, 0, 0.25, -2.3);

  return group;
}

// --- build mesh by class key ---
export function buildClassMesh(classKey) {
  if (classKey === "destroyer") return buildDestroyerMesh();
  if (classKey === "cruiser") return buildCruiserMesh();
  if (classKey === "carrier") return buildCarrierMesh();
  if (classKey === "submarine") return buildSubmarineMesh();
  return buildCruiserMesh();
}
