// ocean.js — flat-shaded CPU vertex-color ocean (low-poly aesthetic)
import * as THREE from "three";

var BASE_DEEP = new THREE.Color("#2a5577");
var BASE_SHALLOW = new THREE.Color("#4ea3c4");
var TMP_COLOR = new THREE.Color();

function createCompatUniforms() {
  return {
    uWaveAmp: { value: 1.0 },
    uWaveSteps: { value: 0.0 },
    uWaterTint: { value: new THREE.Vector3(0, 0, 0) },
    uShaderDetail: { value: 1.0 }
  };
}

function buildOceanGeometry(size, segments) {
  var geo = new THREE.PlaneGeometry(size, size, segments, segments);
  var colors = new Float32Array(geo.attributes.position.count * 3);
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geo;
}

export function createOcean(segments) {
  var segs = Math.max(8, Math.floor(segments || 56));
  var size = 400;
  var geometry = buildOceanGeometry(size, segs);
  var material = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
    flatShading: true,
    vertexColors: true
  });
  var mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 0;

  var uniforms = createCompatUniforms();
  uniforms.__oceanGeo = geometry;
  uniforms.__oceanMesh = mesh;
  uniforms.__size = size;
  uniforms.__segments = segs;

  return { mesh: mesh, uniforms: uniforms };
}

export function updateOcean(uniforms, elapsed, waveAmplitude, waveSteps, waterTint, dayNight, camera, weatherDim, foamIntensity, cloudShadow) {
  if (!uniforms || !uniforms.__oceanGeo) return;
  var geo = uniforms.__oceanGeo;
  var pos = geo.attributes.position;
  var cols = geo.attributes.color;

  var amp = waveAmplitude !== undefined ? waveAmplitude : uniforms.uWaveAmp.value;
  uniforms.uWaveAmp.value = amp;

  var steps = waveSteps !== undefined ? waveSteps : uniforms.uWaveSteps.value;
  uniforms.uWaveSteps.value = steps;

  if (waterTint) uniforms.uWaterTint.value.set(waterTint[0], waterTint[1], waterTint[2]);

  var tint = uniforms.uWaterTint.value;
  var dim = weatherDim !== undefined ? weatherDim : 1.0;

  var deepColor = BASE_DEEP.clone();
  var shallowColor = BASE_SHALLOW.clone();

  if (dayNight && dayNight.waterDeep && dayNight.waterCrest) {
    deepColor.setRGB(dayNight.waterDeep[0], dayNight.waterDeep[1], dayNight.waterDeep[2]);
    shallowColor.setRGB(dayNight.waterCrest[0], dayNight.waterCrest[1], dayNight.waterCrest[2]);
  }
  deepColor.multiplyScalar(dim);
  shallowColor.multiplyScalar(dim);
  deepColor.offsetHSL(0, 0, tint.z * 0.25 + tint.y * 0.1);
  shallowColor.offsetHSL(0, 0, tint.z * 0.25 + tint.y * 0.1);

  var safeAmp = Math.max(0.01, amp);
  for (var i = 0; i < pos.count; i++) {
    var x = pos.getX(i);
    var z = pos.getY(i);
    var h = 0;
    h += Math.sin(x * 0.22 + elapsed * 0.9) * 0.8 * amp;
    h += Math.sin(z * 0.18 + elapsed * 0.7) * 0.65 * amp;
    h += Math.sin(x * 0.55 + z * 0.4 + elapsed * 1.1) * 0.25 * amp;
    if (steps && steps > 0.5) h = Math.floor(h * steps) / steps;
    pos.setZ(i, h);

    var t = THREE.MathUtils.clamp((h / (safeAmp * 1.6) + 1) * 0.5, 0, 1);
    TMP_COLOR.copy(deepColor).lerp(shallowColor, t);
    cols.setXYZ(i, TMP_COLOR.r, TMP_COLOR.g, TMP_COLOR.b);
  }

  pos.needsUpdate = true;
  cols.needsUpdate = true;
  geo.computeVertexNormals();
}

export function getWaveHeight(worldX, worldZ, time, waveAmp, waveSteps) {
  var amp = waveAmp !== undefined ? waveAmp : 1.0;
  var h = 0;
  h += Math.sin(worldX * 0.22 + time * 0.9) * 0.8 * amp;
  h += Math.sin(worldZ * 0.18 + time * 0.7) * 0.65 * amp;
  h += Math.sin(worldX * 0.55 + worldZ * 0.4 + time * 1.1) * 0.25 * amp;
  if (waveSteps !== undefined && waveSteps > 0.5) h = Math.floor(h * waveSteps) / waveSteps;
  return h;
}
