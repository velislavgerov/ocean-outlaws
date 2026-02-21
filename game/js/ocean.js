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
  uniform sampler2D uTerrainMap;
  uniform float uHasTerrain;
  uniform float uShaderDetail; // 0=low, 1=medium, 2=high
  varying float vHeight;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vNormal;

  // --- procedural noise for surface detail ---
  // simple 2D hash
  vec2 hash22(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453);
  }

  // gradient noise
  float gnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(dot(hash22(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
          dot(hash22(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
      mix(dot(hash22(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
          dot(hash22(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  // scrolling normal map from two noise layers
  vec3 scrollingNormal(vec2 worldXZ, float time) {
    // layer A — larger ripples scrolling northeast
    vec2 uvA = worldXZ * 0.08 + vec2(time * 0.03, time * 0.02);
    float nAx = gnoise(uvA + vec2(0.5, 0.0)) - gnoise(uvA - vec2(0.5, 0.0));
    float nAy = gnoise(uvA + vec2(0.0, 0.5)) - gnoise(uvA - vec2(0.0, 0.5));

    // layer B — finer ripples scrolling southwest
    vec2 uvB = worldXZ * 0.18 + vec2(-time * 0.04, time * 0.025);
    float nBx = gnoise(uvB + vec2(0.5, 0.0)) - gnoise(uvB - vec2(0.5, 0.0));
    float nBy = gnoise(uvB + vec2(0.0, 0.5)) - gnoise(uvB - vec2(0.0, 0.5));

    // combine
    float nx = (nAx * 0.6 + nBx * 0.4) * 0.35;
    float ny = (nAy * 0.6 + nBy * 0.4) * 0.35;
    return normalize(vec3(nx, ny, 1.0));
  }

  void main() {
    // --- height-based water color ---
    float t = smoothstep(-2.0, 2.5, vHeight);
    vec3 col = mix(uDeepColor, uMidColor, smoothstep(0.0, 0.35, t));
    col = mix(col, uCrestColor, smoothstep(0.35, 0.7, t));
    col = mix(col, uFoamColor, smoothstep(0.8, 1.0, t));

    // weather tint
    col += uWaterTint;

    vec2 worldXZ = vec2(vWorldPos.x, vWorldPos.z);
    // use wave normal directly on low, perturbed on medium+
    vec3 worldNormal;
    if (uShaderDetail > 0.5) {
      // --- scrolling normal map for surface detail (medium+) ---
      vec3 detailNormal = scrollingNormal(worldXZ, uTime);
      vec3 perturbedLocal = normalize(vec3(
        vNormal.x + detailNormal.x,
        vNormal.y + detailNormal.y,
        vNormal.z
      ));
      worldNormal = normalize(vec3(perturbedLocal.x, perturbedLocal.z, -perturbedLocal.y));
    } else {
      worldNormal = normalize(vec3(vNormal.x, vNormal.z, -vNormal.y));
    }

    // --- foam / whitecaps on wave crests ---
    if (uShaderDetail > 0.5) {
      float foamThreshold = 0.75 - uFoamIntensity * 0.3;
      float foam = smoothstep(foamThreshold, foamThreshold + 0.15, t);
      float fn1 = gnoise(worldXZ * 0.5 + vec2(uTime * 0.15, -uTime * 0.1));
      float foamNoise = fn1;
      if (uShaderDetail > 1.5) {
        // high: full multi-octave foam
        float fn2 = gnoise(worldXZ * 1.2 + vec2(-uTime * 0.2, uTime * 0.18));
        float fn3 = gnoise(worldXZ * 3.0 + vec2(uTime * 0.3, uTime * 0.25));
        foamNoise = fn1 * 0.5 + fn2 * 0.35 + fn3 * 0.15;
      }
      foam *= smoothstep(-0.1, 0.4, foamNoise);
      float streak = sin(worldXZ.x * 2.0 + worldXZ.y * 0.5 + uTime * 0.3) * 0.5 + 0.5;
      foam *= 0.6 + streak * 0.4;
      vec3 foamCol = mix(vec3(0.55, 0.6, 0.65), vec3(0.7, 0.75, 0.8), foamNoise * 0.5 + 0.5);
      col = mix(col, foamCol, foam * 0.55 * uFoamIntensity);
    }

    // --- shore foam where water meets terrain (medium+) ---
    if (uHasTerrain > 0.5 && uShaderDetail > 0.5) {
      vec2 terrainUv = (worldXZ + 200.0) / 400.0;
      terrainUv = clamp(terrainUv, 0.0, 1.0);
      float terrainH = texture2D(uTerrainMap, terrainUv).r;
      float shoreProx = smoothstep(0.15, 0.5, terrainH);
      float shoreDist = (0.5 - terrainH) * 10.0;
      float roll1 = sin(shoreDist * 6.0 - uTime * 1.5) * 0.5 + 0.5;
      float roll2 = sin(shoreDist * 4.0 - uTime * 1.1 + 1.5) * 0.5 + 0.5;
      float rollFoam = max(roll1, roll2 * 0.7);
      if (uShaderDetail > 1.5) {
        float shoreNoise = gnoise(worldXZ * 0.4 + vec2(uTime * 0.1, -uTime * 0.08));
        rollFoam *= smoothstep(-0.3, 0.3, shoreNoise);
      }
      float shoreFoamMask = shoreProx * smoothstep(0.5, 0.42, terrainH);
      float shoreFoam = shoreFoamMask * rollFoam;
      vec3 shoreFoamCol = mix(vec3(0.65, 0.7, 0.75), vec3(0.8, 0.85, 0.9), roll1);
      col = mix(col, shoreFoamCol * (0.5 + uSunIntensity * 0.5), shoreFoam * 0.7);
    }

    // --- Fresnel reflection (sky color at glancing angles) ---
    vec3 viewDir = normalize(uCameraPos - vWorldPos);
    float fresnel = 1.0 - max(dot(viewDir, worldNormal), 0.0);
    fresnel = pow(fresnel, 3.0);
    col = mix(col, uSkyColor * 0.7, fresnel * 0.55);

    // --- specular sun/moon glint ---
    vec3 reflectDir = reflect(-uSunDir, worldNormal);
    float spec = max(dot(viewDir, reflectDir), 0.0);
    spec = pow(spec, uShaderDetail > 1.5 ? 128.0 : 32.0);
    col += uSunColor * spec * uSunIntensity * 1.5;

    // softer broad specular (high only)
    if (uShaderDetail > 1.5) {
      float specBroad = pow(max(dot(viewDir, reflectDir), 0.0), 16.0);
      col += uSunColor * specBroad * uSunIntensity * 0.15;
    }

    // --- cloud shadow patches ---
    float shadow = sin(vWorldPos.x * 0.02 + uTime * 0.15) * sin(vWorldPos.z * 0.025 - uTime * 0.12);
    shadow = smoothstep(0.3, 0.8, shadow);
    col *= 1.0 - shadow * uCloudShadow * 0.25;

    // --- subtle shimmer (high only) ---
    if (uShaderDetail > 1.5) {
      float shimmer = gnoise(worldXZ * 3.5 + vec2(uTime * 1.5, uTime * 1.2));
      col += vec3(0.012) * smoothstep(0.5, 1.0, shimmer) * t;
    }

    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createOcean(segments) {
  var segs = segments || 128;
  var geometry = new THREE.PlaneGeometry(400, 400, segs, segs);

  // default 1x1 black terrain texture (no terrain)
  var defaultTerrain = new THREE.DataTexture(
    new Uint8Array([0, 0, 0, 255]), 1, 1, THREE.RGBAFormat
  );
  defaultTerrain.needsUpdate = true;

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
    uCameraPos: { value: new THREE.Vector3(0, 60, 30) },
    uTerrainMap: { value: defaultTerrain },
    uHasTerrain: { value: 0.0 },
    uShaderDetail: { value: 2.0 }
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

export function setTerrainMap(uniforms, terrain) {
  if (!terrain || !terrain.heightmap) {
    uniforms.uHasTerrain.value = 0.0;
    return;
  }
  var hm = terrain.heightmap;
  var size = hm.size;
  var data = new Uint8Array(size * size * 4);
  for (var i = 0; i < size * size; i++) {
    // encode height: 0.5 = sea level, clamp to 0..1
    var h = hm.data[i];
    var encoded = Math.max(0, Math.min(255, Math.round((h * 0.25 + 0.5) * 255)));
    data[i * 4] = encoded;
    data[i * 4 + 1] = encoded;
    data[i * 4 + 2] = encoded;
    data[i * 4 + 3] = 255;
  }
  var tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;

  // dispose old terrain texture if it exists
  if (uniforms.uTerrainMap.value) {
    uniforms.uTerrainMap.value.dispose();
  }
  uniforms.uTerrainMap.value = tex;
  uniforms.uHasTerrain.value = 1.0;
}

export function clearTerrainMap(uniforms) {
  uniforms.uHasTerrain.value = 0.0;
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
