// bossModels.js — unique procedural 3D models for boss enemies
import * as THREE from "three";

// --- shared boss materials ---
var metalMat = null;
var glassMat = null;

function ensureBossMats() {
  if (metalMat) return;
  metalMat = new THREE.MeshStandardMaterial({ color: 0x888899, roughness: 0.3, metalness: 0.8 });
  glassMat = new THREE.MeshStandardMaterial({
    color: 0x1a2a3a, roughness: 0.1, metalness: 0.5,
    emissive: 0x1a2a3a, emissiveIntensity: 0
  });
}

function addBossNavLights(group, x, y, z) {
  var portMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  var stbdMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
  var lightGeo = new THREE.SphereGeometry(0.06, 4, 3);
  var port = new THREE.Mesh(lightGeo, portMat);
  port.position.set(-x, y, z);
  group.add(port);
  var stbd = new THREE.Mesh(lightGeo, stbdMat);
  stbd.position.set(x, y, z);
  group.add(stbd);
}

function addBossRadar(group, x, y, z) {
  ensureBossMats();
  var dishGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.03, 8);
  var dish = new THREE.Mesh(dishGeo, metalMat);
  dish.position.set(x, y, z);
  group.add(dish);
  var armGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.2, 3);
  var arm = new THREE.Mesh(armGeo, metalMat);
  arm.position.set(x, y - 0.1, z);
  group.add(arm);
}

function addBossWindows(group, bx, by, bz, width, height) {
  ensureBossMats();
  var winGeo = new THREE.PlaneGeometry(width * 0.8, height * 0.3);
  var winF = new THREE.Mesh(winGeo, glassMat);
  winF.position.set(bx, by + height * 0.1, bz + height * 0.52);
  group.add(winF);
  var winSideGeo = new THREE.PlaneGeometry(height * 0.5, height * 0.3);
  var winL = new THREE.Mesh(winSideGeo, glassMat);
  winL.rotation.y = Math.PI / 2;
  winL.position.set(bx - width * 0.52, by + height * 0.1, bz);
  group.add(winL);
  var winR = new THREE.Mesh(winSideGeo, glassMat);
  winR.rotation.y = -Math.PI / 2;
  winR.position.set(bx + width * 0.52, by + height * 0.1, bz);
  group.add(winR);
}

// --- build battleship boss mesh (large, armored, imposing) ---
function buildBattleshipMesh() {
  ensureBossMats();
  var group = new THREE.Group();

  // hull — smooth, massive curves
  var hullShape = new THREE.Shape();
  hullShape.moveTo(0, 5.5);
  hullShape.bezierCurveTo(0.5, 4.5, 1.0, 3.5, 1.4, 2.5);
  hullShape.bezierCurveTo(1.6, 1.5, 1.7, 0.5, 1.7, 0);
  hullShape.bezierCurveTo(1.7, -1.0, 1.6, -2.0, 1.4, -3.0);
  hullShape.bezierCurveTo(1.2, -3.8, 0.9, -4.3, 0, -5.0);
  hullShape.bezierCurveTo(-0.9, -4.3, -1.2, -3.8, -1.4, -3.0);
  hullShape.bezierCurveTo(-1.6, -2.0, -1.7, -1.0, -1.7, 0);
  hullShape.bezierCurveTo(-1.7, 0.5, -1.6, 1.5, -1.4, 2.5);
  hullShape.bezierCurveTo(-1.0, 3.5, -0.5, 4.5, 0, 5.5);

  var hullGeo = new THREE.ExtrudeGeometry(hullShape, {
    depth: 1.1, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.05, bevelSegments: 2
  });
  var hullMat = new THREE.MeshStandardMaterial({ color: 0x5a3a28, roughness: 0.65, metalness: 0.15 });
  var hull = new THREE.Mesh(hullGeo, hullMat);
  hull.rotation.x = -Math.PI / 2;
  hull.position.y = -0.2;
  group.add(hull);

  // waterline
  var wlGeo = new THREE.PlaneGeometry(3.0, 9.5);
  var wlMat = new THREE.MeshStandardMaterial({ color: 0x1a0808, roughness: 0.9, metalness: 0 });
  var wl = new THREE.Mesh(wlGeo, wlMat);
  wl.rotation.x = -Math.PI / 2;
  wl.position.set(0, 0.01, 0);
  group.add(wl);

  // deck
  var deckGeo = new THREE.PlaneGeometry(2.8, 8.5);
  var deckMat = new THREE.MeshStandardMaterial({ color: 0x6a4a38, roughness: 0.5, metalness: 0.05 });
  var deck = new THREE.Mesh(deckGeo, deckMat);
  deck.rotation.x = -Math.PI / 2;
  deck.position.y = 0.9;
  group.add(deck);

  // massive bridge — two tiers
  var bridgeGeo = new THREE.BoxGeometry(1.4, 1.2, 1.6);
  var bridgeMat = new THREE.MeshStandardMaterial({ color: 0x7a5a48, roughness: 0.45, metalness: 0.2 });
  var bridge = new THREE.Mesh(bridgeGeo, bridgeMat);
  bridge.position.set(0, 1.5, -1.5);
  group.add(bridge);
  var upperBridgeGeo = new THREE.BoxGeometry(1.0, 0.6, 1.0);
  var upperBridge = new THREE.Mesh(upperBridgeGeo, bridgeMat);
  upperBridge.position.set(0, 2.4, -1.5);
  group.add(upperBridge);
  addBossWindows(group, 0, 1.5, -1.5, 1.4, 1.2);

  // smokestacks (twin)
  var stackMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.6, metalness: 0.3 });
  for (var si = 0; si < 2; si++) {
    var stackGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.8, 8);
    var stack = new THREE.Mesh(stackGeo, stackMat);
    stack.position.set(0, 1.3, -0.3 - si * 1.2);
    group.add(stack);
  }

  // radar mast
  var mastGeo = new THREE.CylinderGeometry(0.025, 0.035, 1.8, 4);
  var mast = new THREE.Mesh(mastGeo, metalMat);
  mast.position.set(0, 2.8, -1.5);
  group.add(mast);
  addBossRadar(group, 0, 3.7, -1.5);

  // broadside turrets (4 total) — larger, more imposing
  var turretGeo = new THREE.CylinderGeometry(0.35, 0.45, 0.4, 8);
  var turretMat = new THREE.MeshStandardMaterial({ color: 0x4a2a1a, roughness: 0.35, metalness: 0.7 });
  var barrelGeo = new THREE.CylinderGeometry(0.06, 0.07, 1.1, 6);
  var barrelMat = new THREE.MeshStandardMaterial({ color: 0x3a2010, roughness: 0.3, metalness: 0.8 });

  var turrets = [];
  var turretPositions = [
    [0, 1.1, 3.0],
    [0, 1.1, 1.0],
    [0, 1.1, -0.2],
    [0, 1.1, -3.5]
  ];
  for (var i = 0; i < turretPositions.length; i++) {
    var t = new THREE.Group();
    t.position.set(turretPositions[i][0], turretPositions[i][1], turretPositions[i][2]);
    t.add(new THREE.Mesh(turretGeo, turretMat));
    var b = new THREE.Mesh(barrelGeo, barrelMat);
    b.rotation.x = Math.PI / 2;
    b.position.set(0, 0.15, 0.55);
    t.add(b);
    group.add(t);
    turrets.push(t);
  }

  // armor plating (decorative strips along sides)
  var plateMat = new THREE.MeshStandardMaterial({ color: 0x4a3828, roughness: 0.5, metalness: 0.4 });
  for (var side = -1; side <= 1; side += 2) {
    for (var pi = 0; pi < 4; pi++) {
      var plate = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.65, 1.6),
        plateMat
      );
      plate.position.set(side * 1.4, 0.65, pi * 2.2 - 2.5);
      group.add(plate);
    }
  }

  group.userData.turrets = turrets;

  addBossNavLights(group, 1.5, 0.9, 3.0);

  return group;
}

// --- build carrier boss mesh (large flat deck, hangars) ---
function buildCarrierBossMesh() {
  ensureBossMats();
  var group = new THREE.Group();

  // hull — massive smooth carrier
  var hullShape = new THREE.Shape();
  hullShape.moveTo(0, 6.0);
  hullShape.bezierCurveTo(0.6, 5.0, 1.2, 4.0, 1.8, 2.5);
  hullShape.bezierCurveTo(2.0, 1.5, 2.1, 0.5, 2.1, 0);
  hullShape.bezierCurveTo(2.1, -1.5, 2.0, -3.0, 1.8, -3.8);
  hullShape.bezierCurveTo(1.5, -4.5, 1.0, -5.0, 0, -5.5);
  hullShape.bezierCurveTo(-1.0, -5.0, -1.5, -4.5, -1.8, -3.8);
  hullShape.bezierCurveTo(-2.0, -3.0, -2.1, -1.5, -2.1, 0);
  hullShape.bezierCurveTo(-2.1, 0.5, -2.0, 1.5, -1.8, 2.5);
  hullShape.bezierCurveTo(-1.2, 4.0, -0.6, 5.0, 0, 6.0);

  var hullGeo = new THREE.ExtrudeGeometry(hullShape, {
    depth: 1.1, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.05, bevelSegments: 2
  });
  var hullMat = new THREE.MeshStandardMaterial({ color: 0x2a4a2a, roughness: 0.65, metalness: 0.15 });
  var hull = new THREE.Mesh(hullGeo, hullMat);
  hull.rotation.x = -Math.PI / 2;
  hull.position.y = -0.2;
  group.add(hull);

  // waterline
  var wlGeo = new THREE.PlaneGeometry(3.8, 10.5);
  var wlMat = new THREE.MeshStandardMaterial({ color: 0x0a1a0a, roughness: 0.9, metalness: 0 });
  var wl = new THREE.Mesh(wlGeo, wlMat);
  wl.rotation.x = -Math.PI / 2;
  wl.position.set(0, 0.01, 0);
  group.add(wl);

  // flight deck
  var deckGeo = new THREE.PlaneGeometry(3.6, 10.0);
  var deckMat = new THREE.MeshStandardMaterial({ color: 0x3a5a3a, roughness: 0.5, metalness: 0.05 });
  var deck = new THREE.Mesh(deckGeo, deckMat);
  deck.rotation.x = -Math.PI / 2;
  deck.position.y = 1.0;
  group.add(deck);

  // runway stripes
  var stripeMat = new THREE.MeshStandardMaterial({ color: 0xccccaa, roughness: 0.8, metalness: 0 });
  for (var s = 0; s < 3; s++) {
    var stripeGeo = new THREE.PlaneGeometry(0.08, 7.0);
    var stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set((s - 1) * 0.9, 1.01, 0);
    group.add(stripe);
  }

  // island tower (starboard side)
  var bridgeGeo = new THREE.BoxGeometry(0.9, 1.4, 1.4);
  var bridgeMat = new THREE.MeshStandardMaterial({ color: 0x4a6a4a, roughness: 0.45, metalness: 0.2 });
  var bridgeIs = new THREE.Mesh(bridgeGeo, bridgeMat);
  bridgeIs.position.set(1.4, 1.7, -1.5);
  group.add(bridgeIs);
  addBossWindows(group, 1.4, 1.7, -1.5, 0.9, 1.4);

  // radar mast on island
  var mastGeo = new THREE.CylinderGeometry(0.02, 0.03, 1.5, 4);
  var mast = new THREE.Mesh(mastGeo, metalMat);
  mast.position.set(1.4, 2.6, -1.5);
  group.add(mast);
  addBossRadar(group, 1.4, 3.4, -1.5);

  // hangar bays
  var hangarMat = new THREE.MeshStandardMaterial({ color: 0x2a3a2a, roughness: 0.6, metalness: 0.1 });
  for (var h = 0; h < 2; h++) {
    var hangar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 1.8), hangarMat);
    hangar.position.set(0, 0.8, h * 3.5 - 0.5);
    group.add(hangar);
  }

  // defensive turrets
  var turretGeo = new THREE.CylinderGeometry(0.28, 0.35, 0.3, 8);
  var turretMat = new THREE.MeshStandardMaterial({ color: 0x2a4a2a, roughness: 0.35, metalness: 0.7 });
  var barrelGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.8, 6);
  var barrelMat = new THREE.MeshStandardMaterial({ color: 0x1a3a1a, roughness: 0.3, metalness: 0.8 });

  var turrets = [];
  var tPos = [[0, 1.1, 3.5], [0, 1.1, -4.0]];
  for (var i = 0; i < tPos.length; i++) {
    var t = new THREE.Group();
    t.position.set(tPos[i][0], tPos[i][1], tPos[i][2]);
    t.add(new THREE.Mesh(turretGeo, turretMat));
    var b2 = new THREE.Mesh(barrelGeo, barrelMat);
    b2.rotation.x = Math.PI / 2;
    b2.position.set(0, 0.1, 0.4);
    t.add(b2);
    group.add(t);
    turrets.push(t);
  }

  group.userData.turrets = turrets;

  addBossNavLights(group, 1.8, 1.0, 4.0);

  return group;
}

// --- build kraken boss mesh (tentacles, non-ship) ---
function buildKrakenMesh() {
  ensureBossMats();
  var group = new THREE.Group();

  // body — large sphere-ish mass with PBR
  var bodyGeo = new THREE.SphereGeometry(3.0, 16, 12);
  var bodyMat = new THREE.MeshStandardMaterial({
    color: 0x4a2868, roughness: 0.6, metalness: 0.15
  });
  var body = new THREE.Mesh(bodyGeo, bodyMat);
  body.scale.set(1.0, 0.5, 1.2);
  body.position.y = 0.5;
  group.add(body);

  // mantle ridges (decorative bumps on top)
  var ridgeMat = new THREE.MeshStandardMaterial({
    color: 0x3a1a50, roughness: 0.5, metalness: 0.2
  });
  for (var ri = 0; ri < 5; ri++) {
    var ridgeGeo = new THREE.SphereGeometry(0.6, 6, 4);
    var ridge = new THREE.Mesh(ridgeGeo, ridgeMat);
    ridge.scale.set(1.0, 0.3, 0.6);
    ridge.position.set(
      (ri - 2) * 0.8,
      1.2,
      0
    );
    group.add(ridge);
  }

  // eyes — larger, glowing
  var eyeGeo = new THREE.SphereGeometry(0.5, 10, 8);
  var eyeMat = new THREE.MeshStandardMaterial({
    color: 0xffcc00, roughness: 0.2, metalness: 0.3,
    emissive: 0xffaa00, emissiveIntensity: 0.8
  });
  var eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-1.0, 1.1, 2.2);
  group.add(eyeL);
  var eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeR.position.set(1.0, 1.1, 2.2);
  group.add(eyeR);

  // pupils
  var pupilGeo = new THREE.SphereGeometry(0.2, 6, 4);
  var pupilMat = new THREE.MeshStandardMaterial({ color: 0x110800, roughness: 0.9, metalness: 0 });
  var pupilL = new THREE.Mesh(pupilGeo, pupilMat);
  pupilL.position.set(-1.0, 1.1, 2.6);
  group.add(pupilL);
  var pupilR = new THREE.Mesh(pupilGeo, pupilMat);
  pupilR.position.set(1.0, 1.1, 2.6);
  group.add(pupilR);

  // tentacles (stored for animation)
  var tentacles = [];
  var tentacleMat = new THREE.MeshStandardMaterial({
    color: 0x5a3078, roughness: 0.55, metalness: 0.1
  });
  var suckerMat = new THREE.MeshStandardMaterial({
    color: 0x8a60aa, roughness: 0.7, metalness: 0.05
  });
  for (var i = 0; i < 8; i++) {
    var angle = (i / 8) * Math.PI * 2;
    var tentGroup = new THREE.Group();
    tentGroup.position.set(
      Math.sin(angle) * 2.4,
      0.2,
      Math.cos(angle) * 2.4
    );

    // three segments per tentacle — tapered
    for (var s = 0; s < 3; s++) {
      var radius = 0.35 - s * 0.1;
      var segGeo = new THREE.CylinderGeometry(radius, radius + 0.06, 2.2, 8);
      var seg = new THREE.Mesh(segGeo, tentacleMat);
      seg.position.set(
        Math.sin(angle) * s * 1.5,
        -s * 0.3,
        Math.cos(angle) * s * 1.5
      );
      seg.rotation.z = angle + Math.PI / 2;
      seg.rotation.x = 0.3 * s;
      tentGroup.add(seg);

      // sucker detail (small spheres along underside)
      if (s < 2) {
        for (var si = 0; si < 3; si++) {
          var suckerGeo = new THREE.SphereGeometry(0.06, 4, 3);
          var sucker = new THREE.Mesh(suckerGeo, suckerMat);
          sucker.position.set(
            Math.sin(angle) * (s * 1.5 + si * 0.4),
            -s * 0.3 - 0.2,
            Math.cos(angle) * (s * 1.5 + si * 0.4)
          );
          tentGroup.add(sucker);
        }
      }
    }

    group.add(tentGroup);
    tentacles.push(tentGroup);
  }
  group.userData.tentacles = tentacles;

  return group;
}

// --- build boss mesh by type ---
export function buildBossMesh(bossType) {
  if (bossType === "battleship") return buildBattleshipMesh();
  if (bossType === "carrier") return buildCarrierBossMesh();
  if (bossType === "kraken") return buildKrakenMesh();
  return buildBattleshipMesh();
}
