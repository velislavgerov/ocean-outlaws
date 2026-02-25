// shipModels.js — lightweight placeholder mesh for ship classes
// Procedural builders removed; GLB models are required via artOverrides/glbVisual
import * as THREE from "three";

// --- build a lightweight placeholder group with fire points ---
// Shown briefly while GLB model loads; replaced by GLB on success, or error box on failure
function buildPlaceholderMesh() {
  var group = new THREE.Group();
  group.add(new THREE.Mesh(
    new THREE.BoxGeometry(1, 0.5, 2),
    new THREE.MeshBasicMaterial({ color: 0xff00ff })
  ));
  var portFP = new THREE.Object3D(); portFP.position.set(-0.6, 0.4, 0.3); group.add(portFP);
  var stbdFP = new THREE.Object3D(); stbdFP.position.set(0.6, 0.4, 0.3); group.add(stbdFP);
  var bowFP  = new THREE.Object3D(); bowFP.position.set(0, 0.4, 1.2); group.add(bowFP);
  group.userData.turrets = [portFP, stbdFP, bowFP];
  return group;
}

// --- build mesh by class key ---
export function buildClassMesh(classKey) {
  return buildPlaceholderMesh();
}
