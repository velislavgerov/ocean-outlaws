// bossModels.js — unique procedural 3D models for boss enemies
import * as THREE from "three";

// --- build battleship boss mesh (large, armored) ---
function buildBattleshipMesh() {
  var group = new THREE.Group();

  var hullShape = new THREE.Shape();
  hullShape.moveTo(0, 5.0);
  hullShape.lineTo(1.4, 2.5);
  hullShape.lineTo(1.6, 0);
  hullShape.lineTo(1.4, -3.0);
  hullShape.lineTo(0.8, -4.5);
  hullShape.lineTo(-0.8, -4.5);
  hullShape.lineTo(-1.4, -3.0);
  hullShape.lineTo(-1.6, 0);
  hullShape.lineTo(-1.4, 2.5);
  hullShape.lineTo(0, 5.0);

  var hullGeo = new THREE.ExtrudeGeometry(hullShape, { depth: 1.0, bevelEnabled: false });
  var hullMat = new THREE.MeshLambertMaterial({ color: 0x664433 });
  var hull = new THREE.Mesh(hullGeo, hullMat);
  hull.rotation.x = -Math.PI / 2;
  hull.position.y = -0.2;
  group.add(hull);

  var deckGeo = new THREE.PlaneGeometry(2.6, 8.0);
  var deckMat = new THREE.MeshLambertMaterial({ color: 0x775544 });
  var deck = new THREE.Mesh(deckGeo, deckMat);
  deck.rotation.x = -Math.PI / 2;
  deck.position.y = 0.8;
  group.add(deck);

  // massive bridge
  var bridgeGeo = new THREE.BoxGeometry(1.4, 1.4, 1.8);
  var bridgeMat = new THREE.MeshLambertMaterial({ color: 0x886655 });
  var bridge = new THREE.Mesh(bridgeGeo, bridgeMat);
  bridge.position.set(0, 1.5, -1.5);
  group.add(bridge);

  // broadside turrets (4 total)
  var turretGeo = new THREE.CylinderGeometry(0.3, 0.4, 0.4, 6);
  var turretMat = new THREE.MeshLambertMaterial({ color: 0x553322 });
  var barrelGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.0, 4);
  var barrelMat = new THREE.MeshLambertMaterial({ color: 0x442211 });

  var turrets = [];
  var turretPositions = [
    [0, 1.0, 2.5],
    [0, 1.0, 0.5],
    [0, 1.0, -0.5],
    [0, 1.0, -3.0]
  ];
  for (var i = 0; i < turretPositions.length; i++) {
    var t = new THREE.Group();
    t.position.set(turretPositions[i][0], turretPositions[i][1], turretPositions[i][2]);
    t.add(new THREE.Mesh(turretGeo, turretMat));
    var b = new THREE.Mesh(barrelGeo, barrelMat);
    b.rotation.x = Math.PI / 2;
    b.position.set(0, 0.15, 0.5);
    t.add(b);
    group.add(t);
    turrets.push(t);
  }

  // armor plating (decorative boxes along sides)
  var plateMat = new THREE.MeshLambertMaterial({ color: 0x554433 });
  for (var side = -1; side <= 1; side += 2) {
    for (var pi = 0; pi < 3; pi++) {
      var plate = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.6, 1.5),
        plateMat
      );
      plate.position.set(side * 1.3, 0.6, pi * 2.5 - 2.0);
      group.add(plate);
    }
  }

  group.userData.turrets = turrets;
  return group;
}

// --- build carrier boss mesh (large flat deck, hangars) ---
function buildCarrierBossMesh() {
  var group = new THREE.Group();

  var hullShape = new THREE.Shape();
  hullShape.moveTo(0, 5.5);
  hullShape.lineTo(1.8, 2.5);
  hullShape.lineTo(2.0, 0);
  hullShape.lineTo(1.8, -3.5);
  hullShape.lineTo(1.2, -5.0);
  hullShape.lineTo(-1.2, -5.0);
  hullShape.lineTo(-1.8, -3.5);
  hullShape.lineTo(-2.0, 0);
  hullShape.lineTo(-1.8, 2.5);
  hullShape.lineTo(0, 5.5);

  var hullGeo = new THREE.ExtrudeGeometry(hullShape, { depth: 1.0, bevelEnabled: false });
  var hullMat = new THREE.MeshLambertMaterial({ color: 0x335533 });
  var hull = new THREE.Mesh(hullGeo, hullMat);
  hull.rotation.x = -Math.PI / 2;
  hull.position.y = -0.2;
  group.add(hull);

  // flight deck
  var deckGeo = new THREE.PlaneGeometry(3.4, 9.0);
  var deckMat = new THREE.MeshLambertMaterial({ color: 0x446644 });
  var deck = new THREE.Mesh(deckGeo, deckMat);
  deck.rotation.x = -Math.PI / 2;
  deck.position.y = 0.9;
  group.add(deck);

  // runway stripes
  for (var s = 0; s < 3; s++) {
    var stripeGeo = new THREE.PlaneGeometry(0.08, 6.0);
    var stripeMat = new THREE.MeshLambertMaterial({ color: 0xccccaa });
    var stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set((s - 1) * 0.8, 0.91, 0);
    group.add(stripe);
  }

  // island
  var bridgeGeo = new THREE.BoxGeometry(0.8, 1.2, 1.2);
  var bridgeMat = new THREE.MeshLambertMaterial({ color: 0x557755 });
  var bridgeIs = new THREE.Mesh(bridgeGeo, bridgeMat);
  bridgeIs.position.set(1.2, 1.5, -1.5);
  group.add(bridgeIs);

  // hangar bays
  var hangarMat = new THREE.MeshLambertMaterial({ color: 0x334433 });
  for (var h = 0; h < 2; h++) {
    var hangar = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 1.5), hangarMat);
    hangar.position.set(0, 0.7, h * 3.0 - 0.5);
    group.add(hangar);
  }

  // defensive turrets
  var turretGeo = new THREE.CylinderGeometry(0.25, 0.3, 0.3, 6);
  var turretMat = new THREE.MeshLambertMaterial({ color: 0x334433 });
  var barrelGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.7, 4);
  var barrelMat = new THREE.MeshLambertMaterial({ color: 0x223322 });

  var turrets = [];
  var tPos = [[0, 1.0, 3.0], [0, 1.0, -3.5]];
  for (var i = 0; i < tPos.length; i++) {
    var t = new THREE.Group();
    t.position.set(tPos[i][0], tPos[i][1], tPos[i][2]);
    t.add(new THREE.Mesh(turretGeo, turretMat));
    var b2 = new THREE.Mesh(barrelGeo, barrelMat);
    b2.rotation.x = Math.PI / 2;
    b2.position.set(0, 0.1, 0.35);
    t.add(b2);
    group.add(t);
    turrets.push(t);
  }

  group.userData.turrets = turrets;
  return group;
}

// --- build kraken boss mesh (tentacles, non-ship) ---
function buildKrakenMesh() {
  var group = new THREE.Group();

  // body — large sphere-ish mass
  var bodyGeo = new THREE.SphereGeometry(2.5, 12, 8);
  var bodyMat = new THREE.MeshLambertMaterial({ color: 0x553377 });
  var body = new THREE.Mesh(bodyGeo, bodyMat);
  body.scale.set(1.0, 0.5, 1.2);
  body.position.y = 0.5;
  group.add(body);

  // eyes
  var eyeGeo = new THREE.SphereGeometry(0.4, 8, 6);
  var eyeMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
  var eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.8, 1.0, 1.8);
  group.add(eyeL);
  var eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeR.position.set(0.8, 1.0, 1.8);
  group.add(eyeR);

  // tentacles (stored for animation)
  var tentacles = [];
  var tentacleMat = new THREE.MeshLambertMaterial({ color: 0x664488 });
  for (var i = 0; i < 8; i++) {
    var angle = (i / 8) * Math.PI * 2;
    var tentGroup = new THREE.Group();
    tentGroup.position.set(
      Math.sin(angle) * 2.0,
      0.2,
      Math.cos(angle) * 2.0
    );

    // three segments per tentacle
    for (var s = 0; s < 3; s++) {
      var radius = 0.3 - s * 0.08;
      var segGeo = new THREE.CylinderGeometry(radius, radius + 0.05, 2.0, 6);
      var seg = new THREE.Mesh(segGeo, tentacleMat);
      seg.position.set(
        Math.sin(angle) * s * 1.5,
        -s * 0.3,
        Math.cos(angle) * s * 1.5
      );
      seg.rotation.z = angle + Math.PI / 2;
      seg.rotation.x = 0.3 * s;
      tentGroup.add(seg);
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
