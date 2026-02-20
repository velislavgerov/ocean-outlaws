import * as THREE from "three";

var vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uWaveAmp;
  varying float vHeight;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vNormal;

  void main() {
    vUv = uv;
    vec3 pos = position;

    float amp = uWaveAmp;

    // layer 1 — broad swells
    pos.z += sin(pos.x * 0.3 + uTime * 0.8) * 0.4 * amp;
    pos.z += sin(pos.y * 0.2 + uTime * 0.6) * 0.35 * amp;

    // layer 2 — medium chop
    pos.z += sin(pos.x * 0.8 + pos.y * 0.6 + uTime * 1.4) * 0.18 * amp;

    // layer 3 — small ripples
    pos.z += sin(pos.x * 2.0 + uTime * 2.0) * 0.06 * amp;
    pos.z += sin(pos.y * 2.5 + uTime * 1.8) * 0.05 * amp;

    vHeight = pos.z;

    // compute normal via finite differences
    float eps = 0.5;
    float hR = sin((pos.x + eps) * 0.3 + uTime * 0.8) * 0.4 * amp
             + sin(pos.y * 0.2 + uTime * 0.6) * 0.35 * amp
             + sin((pos.x + eps) * 0.8 + pos.y * 0.6 + uTime * 1.4) * 0.18 * amp
             + sin((pos.x + eps) * 2.0 + uTime * 2.0) * 0.06 * amp
             + sin(pos.y * 2.5 + uTime * 1.8) * 0.05 * amp;
    float hF = sin(pos.x * 0.3 + uTime * 0.8) * 0.4 * amp
             + sin((pos.y + eps) * 0.2 + uTime * 0.6) * 0.35 * amp
             + sin(pos.x * 0.8 + (pos.y + eps) * 0.6 + uTime * 1.4) * 0.18 * amp
             + sin(pos.x * 2.0 + uTime * 2.0) * 0.06 * amp
             + sin((pos.y + eps) * 2.5 + uTime * 1.8) * 0.05 * amp;
    // normal in local plane space (x, y are plane coords, z is up)
    vNormal = normalize(vec3(-(hR - pos.z) / eps, -(hF - pos.z) / eps, 1.0));

    // world position for specular (the plane is rotated, so transform)
    vec4 wp = modelMatrix * vec4(pos, 1.0);
    vWorldPos = wp.xyz;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

var fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uWaterTint;
  uniform vec3 uSkyColor;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform float uSunIntensity;
  uniform vec3 uDeepColor;
  uniform vec3 uMidColor;
  uniform vec3 uCrestColor;
  uniform vec3 uFoamColor;
  uniform float uFoamIntensity;
  uniform float uCloudShadow;
  uniform vec3 uCameraPos;
  varying float vHeight;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vNormal;

  void main() {
    // --- height-based water color ---
    float t = smoothstep(-2.0, 2.5, vHeight);
    vec3 col = mix(uDeepColor, uMidColor, smoothstep(0.0, 0.35, t));
    col = mix(col, uCrestColor, smoothstep(0.35, 0.7, t));
    col = mix(col, uFoamColor, smoothstep(0.8, 1.0, t));

    // weather tint
    col += uWaterTint;

    // --- foam / whitecaps on wave crests ---
    float foamThreshold = 0.75 - uFoamIntensity * 0.3;
    float foam = smoothstep(foamThreshold, foamThreshold + 0.15, t);
    // add high-frequency noise to break up foam
    float foamNoise = sin(vUv.x * 120.0 + uTime * 0.8) * sin(vUv.y * 100.0 - uTime * 0.6);
    foam *= smoothstep(0.1, 0.7, foamNoise);
    col = mix(col, vec3(0.6, 0.65, 0.7), foam * 0.5 * uFoamIntensity);

    // --- Fresnel reflection (sky color at glancing angles) ---
    vec3 viewDir = normalize(uCameraPos - vWorldPos);
    // transform vNormal from plane-local to world (plane is rotated -PI/2 on X)
    vec3 worldNormal = normalize(vec3(vNormal.x, vNormal.z, -vNormal.y));
    float fresnel = 1.0 - max(dot(viewDir, worldNormal), 0.0);
    fresnel = pow(fresnel, 3.0);
    col = mix(col, uSkyColor * 0.6, fresnel * 0.5);

    // --- specular sun/moon glint ---
    vec3 reflectDir = reflect(-uSunDir, worldNormal);
    float spec = max(dot(viewDir, reflectDir), 0.0);
    spec = pow(spec, 128.0);
    col += uSunColor * spec * uSunIntensity * 1.5;

    // softer broad specular highlight
    float specBroad = pow(max(dot(viewDir, reflectDir), 0.0), 16.0);
    col += uSunColor * specBroad * uSunIntensity * 0.15;

    // --- cloud shadow patches ---
    float shadow = sin(vWorldPos.x * 0.02 + uTime * 0.15) * sin(vWorldPos.z * 0.025 - uTime * 0.12);
    shadow = smoothstep(0.3, 0.8, shadow);
    col *= 1.0 - shadow * uCloudShadow * 0.25;

    // --- subtle shimmer ---
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
    uWaterTint: { value: new THREE.Vector3(0, 0, 0) },
    uSkyColor: { value: new THREE.Vector3(0.3, 0.45, 0.7) },
    uSunDir: { value: new THREE.Vector3(0.3, 0.8, 0.5) },
    uSunColor: { value: new THREE.Vector3(1.0, 0.95, 0.85) },
    uSunIntensity: { value: 0.9 },
    uDeepColor: { value: new THREE.Vector3(0.02, 0.04, 0.10) },
    uMidColor: { value: new THREE.Vector3(0.04, 0.08, 0.18) },
    uCrestColor: { value: new THREE.Vector3(0.08, 0.14, 0.26) },
    uFoamColor: { value: new THREE.Vector3(0.15, 0.22, 0.35) },
    uFoamIntensity: { value: 0.5 },
    uCloudShadow: { value: 0.0 },
    uCameraPos: { value: new THREE.Vector3(0, 60, 30) }
  };

  var material = new THREE.ShaderMaterial({
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
    uniforms: uniforms,
    side: THREE.DoubleSide,
    transparent: false,
    depthWrite: false
  });

  var mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2; // lay flat
  mesh.renderOrder = 0;

  return { mesh: mesh, uniforms: uniforms };
}

export function updateOcean(uniforms, elapsed, waveAmplitude, waterTint, dayNight, camera, weatherDim, foamIntensity, cloudShadow) {
  uniforms.uTime.value = elapsed;
  if (waveAmplitude !== undefined) {
    uniforms.uWaveAmp.value = waveAmplitude;
  }
  if (waterTint) {
    uniforms.uWaterTint.value.set(waterTint[0], waterTint[1], waterTint[2]);
  }
  if (dayNight) {
    var dim = weatherDim !== undefined ? weatherDim : 1.0;
    uniforms.uSkyColor.value.set(dayNight.skyColor[0] * dim, dayNight.skyColor[1] * dim, dayNight.skyColor[2] * dim);
    uniforms.uSunDir.value.copy(dayNight.sunDirection);
    uniforms.uSunColor.value.set(dayNight.sunColor[0], dayNight.sunColor[1], dayNight.sunColor[2]);
    uniforms.uSunIntensity.value = dayNight.sunIntensity * dim;
    uniforms.uDeepColor.value.set(dayNight.waterDeep[0] * dim, dayNight.waterDeep[1] * dim, dayNight.waterDeep[2] * dim);
    uniforms.uMidColor.value.set(dayNight.waterMid[0] * dim, dayNight.waterMid[1] * dim, dayNight.waterMid[2] * dim);
    uniforms.uCrestColor.value.set(dayNight.waterCrest[0] * dim, dayNight.waterCrest[1] * dim, dayNight.waterCrest[2] * dim);
    uniforms.uFoamColor.value.set(dayNight.waterFoam[0] * dim, dayNight.waterFoam[1] * dim, dayNight.waterFoam[2] * dim);
  }
  if (foamIntensity !== undefined) {
    uniforms.uFoamIntensity.value = foamIntensity;
  }
  if (cloudShadow !== undefined) {
    uniforms.uCloudShadow.value = cloudShadow;
  }
  if (camera) {
    uniforms.uCameraPos.value.copy(camera.position);
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
