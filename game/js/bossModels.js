// bossModels.js — boss model placeholders with fire points and tentacle groups
// Procedural builders removed; GLB models are required via artOverrides/glbVisual
import * as THREE from "three";

// --- build a lightweight placeholder for each boss type ---
// Preserves fire points (turrets) and tentacle groups required by boss.js
function buildBossPlaceholder(bossType) {
  var group = new THREE.Group();
  group.add(new THREE.Mesh(
    new THREE.BoxGeometry(3, 2, 6),
    new THREE.MeshBasicMaterial({ color: 0xff00ff })
  ));

  if (bossType === "carrier") {
    // carrier boss: 2 fire points
    var turrets = [];
    var tPos = [[0, 1.1, 3.5], [0, 1.1, -4.0]];
    for (var i = 0; i < tPos.length; i++) {
      var fp = new THREE.Object3D();
      fp.position.set(tPos[i][0], tPos[i][1], tPos[i][2]);
      group.add(fp);
      turrets.push(fp);
    }
    group.userData.turrets = turrets;
  } else if (bossType === "kraken") {
    // kraken: 8 empty tentacle groups for animation, no turrets
    var tentacles = [];
    for (var i = 0; i < 8; i++) {
      var angle = (i / 8) * Math.PI * 2;
      var tentGroup = new THREE.Group();
      tentGroup.position.set(
        Math.sin(angle) * 2.4,
        0.2,
        Math.cos(angle) * 2.4
      );
      group.add(tentGroup);
      tentacles.push(tentGroup);
    }
    group.userData.tentacles = tentacles;
  } else {
    // battleship (default): 4 fire points
    var turrets = [];
    var firePositions = [
      [0, 1.1, 3.0],
      [0, 1.1, 1.0],
      [0, 1.1, -0.2],
      [0, 1.1, -3.5]
    ];
    for (var i = 0; i < firePositions.length; i++) {
      var fp = new THREE.Object3D();
      fp.position.set(firePositions[i][0], firePositions[i][1], firePositions[i][2]);
      group.add(fp);
      turrets.push(fp);
    }
    group.userData.turrets = turrets;
  }

  return group;
}

// --- build boss mesh by type ---
export function buildBossMesh(bossType) {
  return buildBossPlaceholder(bossType);
}
