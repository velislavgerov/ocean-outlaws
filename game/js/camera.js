import * as THREE from "three";

var ZOOM_MIN = 20;
var ZOOM_MAX = 120;
var ZOOM_SPEED = 4;
var LERP_FACTOR = 0.05;
var PITCH_ANGLE = (60 * Math.PI) / 180; // 60 degrees from horizontal

export function createCamera(aspect) {
  var camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);

  var state = {
    camera: camera,
    target: new THREE.Vector3(0, 0, 0),   // point the camera looks at
    distance: 60                           // current zoom distance
  };

  positionCamera(state);

  window.addEventListener("wheel", function (e) { onWheel(state, e); }, { passive: false });

  return state;
}

function onWheel(state, e) {
  e.preventDefault();
  state.distance += e.deltaY * 0.05 * ZOOM_SPEED;
  state.distance = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, state.distance));
}

function positionCamera(state) {
  // bird's eye: offset along Y (up) and Z based on pitch angle
  var height = Math.sin(PITCH_ANGLE) * state.distance;
  var offset = Math.cos(PITCH_ANGLE) * state.distance;

  state.camera.position.set(
    state.target.x,
    height,
    state.target.z + offset
  );
  state.camera.lookAt(state.target);
}

export function updateCamera(state, dt, followX, followZ) {
  // follow the ship position
  state.target.x += (followX - state.target.x) * LERP_FACTOR;
  state.target.z += (followZ - state.target.z) * LERP_FACTOR;

  // smooth interpolation toward desired position
  var height = Math.sin(PITCH_ANGLE) * state.distance;
  var offset = Math.cos(PITCH_ANGLE) * state.distance;

  var desiredX = state.target.x;
  var desiredY = height;
  var desiredZ = state.target.z + offset;

  state.camera.position.x += (desiredX - state.camera.position.x) * LERP_FACTOR;
  state.camera.position.y += (desiredY - state.camera.position.y) * LERP_FACTOR;
  state.camera.position.z += (desiredZ - state.camera.position.z) * LERP_FACTOR;

  state.camera.lookAt(state.target);
}

export function resizeCamera(state, aspect) {
  state.camera.aspect = aspect;
  state.camera.updateProjectionMatrix();
}
