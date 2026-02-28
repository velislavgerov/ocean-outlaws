import * as THREE from 'three/webgpu';

const canvas = document.querySelector('#canvas');
const fallbackEl = document.querySelector('#fallback');
const fallbackMessageEl = document.querySelector('#fallback-message');

const state = {
  mode: 'booting',
  renderer: 'none',
  elapsed: 0,
  frame: 0,
  cubeRotationY: 0,
  error: null,
};

let renderer;
let scene;
let camera;
let cube;
let lastTime = performance.now();

function renderGameToText() {
  return JSON.stringify({
    mode: state.mode,
    renderer: state.renderer,
    frame: state.frame,
    elapsed: Number(state.elapsed.toFixed(3)),
    cube: {
      rotationY: Number(state.cubeRotationY.toFixed(3)),
    },
    coordinateSystem: {
      origin: 'scene_center',
      x: 'right',
      y: 'up',
      z: 'toward_viewer_negative',
    },
    error: state.error,
  });
}

window.render_game_to_text = renderGameToText;

function showFallback(message) {
  state.mode = 'unsupported';
  state.renderer = 'none';
  state.error = message;
  fallbackMessageEl.textContent = message;
  fallbackEl.hidden = false;
}

function setupScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1d2f);

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 1.2, 3.2);

  const ambient = new THREE.AmbientLight(0x9cccf2, 0.6);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(2.5, 3.5, 2);
  scene.add(key);

  const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
  const cubeMaterial = new THREE.MeshStandardMaterial({
    color: 0x2e8bc0,
    metalness: 0.22,
    roughness: 0.35,
  });

  cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
  scene.add(cube);

  const floorGeometry = new THREE.CircleGeometry(2.8, 48);
  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x153955,
    metalness: 0.05,
    roughness: 0.85,
  });
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.position.y = -0.9;
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
}

function update(deltaSeconds) {
  if (state.mode !== 'running') return;

  state.elapsed += deltaSeconds;
  cube.rotation.x += deltaSeconds * 0.5;
  cube.rotation.y += deltaSeconds * 0.85;
  state.cubeRotationY = cube.rotation.y;
  state.frame += 1;
}

function render() {
  if (state.mode !== 'running') return;
  renderer.render(scene, camera);
}

function resize() {
  if (!renderer || !camera) return;

  const width = window.innerWidth;
  const height = window.innerHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

function loop(now) {
  const deltaSeconds = Math.min((now - lastTime) / 1000, 1 / 20);
  lastTime = now;

  update(deltaSeconds);
  render();
  window.requestAnimationFrame(loop);
}

window.advanceTime = async (ms) => {
  const durationMs = Math.max(0, Number(ms) || 0);
  if (durationMs === 0) return;

  const steps = Math.max(1, Math.round(durationMs / (1000 / 60)));
  const stepDelta = durationMs / 1000 / steps;

  for (let i = 0; i < steps; i += 1) {
    update(stepDelta);
    render();
  }
};

async function init() {
  const query = new URLSearchParams(window.location.search);
  if (query.has('forceFallback')) {
    showFallback('WebGPU fallback was forced via query parameter.');
    return;
  }

  if (!('gpu' in navigator)) {
    showFallback('WebGPU is not available in this browser.');
    return;
  }

  try {
    renderer = new THREE.WebGPURenderer({ canvas, antialias: true });
    await renderer.init();

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    setupScene();

    state.mode = 'running';
    state.renderer = 'webgpu';
    state.error = null;

    window.addEventListener('resize', resize);
    window.requestAnimationFrame(loop);
  } catch (error) {
    console.error('WebGPU bootstrap failed', error);
    showFallback('Failed to initialize WebGPU renderer.');
  }
}

init();
