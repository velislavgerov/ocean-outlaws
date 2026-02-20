import * as THREE from "three";

var vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uWaveAmp;
  varying float vHeight;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec3 pos = position;

    float amp = uWaveAmp;

    // layer 1 — broad swells
    pos.z += sin(pos.x * 0.3 + uTime * 0.8) * 1.2 * amp;
    pos.z += sin(pos.y * 0.2 + uTime * 0.6) * 1.0 * amp;

    // layer 2 — medium chop
    pos.z += sin(pos.x * 0.8 + pos.y * 0.6 + uTime * 1.4) * 0.5 * amp;

    // layer 3 — small ripples
    pos.z += sin(pos.x * 2.0 + uTime * 2.0) * 0.15 * amp;
    pos.z += sin(pos.y * 2.5 + uTime * 1.8) * 0.12 * amp;

    vHeight = pos.z;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

var fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uWaterTint;
  varying float vHeight;
  varying vec2 vUv;

  void main() {
    // dark atmospheric base
    vec3 deep    = vec3(0.02, 0.04, 0.10);
    vec3 mid     = vec3(0.04, 0.08, 0.18);
    vec3 crest   = vec3(0.08, 0.14, 0.26);
    vec3 foam    = vec3(0.15, 0.22, 0.35);

    // map height to colour
    float t = smoothstep(-2.0, 2.5, vHeight);
    vec3 col = mix(deep, mid, smoothstep(0.0, 0.35, t));
    col = mix(col, crest, smoothstep(0.35, 0.7, t));
    col = mix(col, foam, smoothstep(0.8, 1.0, t));

    // weather tint
    col += uWaterTint;

    // subtle shimmer
    float shimmer = sin(vUv.x * 60.0 + uTime * 1.5) * sin(vUv.y * 60.0 + uTime * 1.2);
    col += vec3(0.01) * smoothstep(0.6, 1.0, shimmer) * t;

    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createOcean() {
  var geometry = new THREE.PlaneGeometry(400, 400, 128, 128);

  var uniforms = {
    uTime: { value: 0 },
    uWaveAmp: { value: 1.0 },
    uWaterTint: { value: new THREE.Vector3(0, 0, 0) }
  };

  var material = new THREE.ShaderMaterial({
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
    uniforms: uniforms,
    side: THREE.DoubleSide
  });

  var mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2; // lay flat

  return { mesh: mesh, uniforms: uniforms };
}

export function updateOcean(uniforms, elapsed, waveAmplitude, waterTint) {
  uniforms.uTime.value = elapsed;
  if (waveAmplitude !== undefined) {
    uniforms.uWaveAmp.value = waveAmplitude;
  }
  if (waterTint) {
    uniforms.uWaterTint.value.set(waterTint[0], waterTint[1], waterTint[2]);
  }
}

// mirror the vertex shader wave function on the CPU
// the plane is rotated -PI/2 around X, so shader pos.x = worldX, shader pos.y = worldZ
// waveAmp: optional amplitude multiplier (defaults to 1)
export function getWaveHeight(worldX, worldZ, time, waveAmp) {
  var x = worldX;
  var y = worldZ;
  var amp = waveAmp !== undefined ? waveAmp : 1;
  var h = 0;

  // layer 1 — broad swells
  h += Math.sin(x * 0.3 + time * 0.8) * 1.2 * amp;
  h += Math.sin(y * 0.2 + time * 0.6) * 1.0 * amp;

  // layer 2 — medium chop
  h += Math.sin(x * 0.8 + y * 0.6 + time * 1.4) * 0.5 * amp;

  // layer 3 — small ripples
  h += Math.sin(x * 2.0 + time * 2.0) * 0.15 * amp;
  h += Math.sin(y * 2.5 + time * 1.8) * 0.12 * amp;

  return h;
}
