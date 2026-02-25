// ocean.js — tiled flat-shaded CPU vertex-color ocean for effectively infinite traversal
import * as THREE from "three";

var BASE_DEEP = new THREE.Color("#2a5577");
var BASE_SHALLOW = new THREE.Color("#4ea3c4");
var TMP_COLOR = new THREE.Color();

var OCEAN_SIZE = 400;
var OCEAN_TILE_RADIUS = 1; // 3x3 tiles around camera anchor

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

function buildOceanTile(size, segments, material) {
  var geometry = buildOceanGeometry(size, segments);
  var mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 0;
  return { mesh: mesh, geometry: geometry };
}

export function createOcean(segments) {
  var segs = Math.max(8, Math.floor(segments || 56));
  var size = OCEAN_SIZE;

  var tileMaterial = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
    flatShading: true,
    vertexColors: true
  });

  var group = new THREE.Group();
  var tiles = [];

  for (var tz = -OCEAN_TILE_RADIUS; tz <= OCEAN_TILE_RADIUS; tz++) {
    for (var tx = -OCEAN_TILE_RADIUS; tx <= OCEAN_TILE_RADIUS; tx++) {
      var tile = buildOceanTile(size, segs, tileMaterial);
      tile.gridX = tx;
      tile.gridZ = tz;
      group.add(tile.mesh);
      tiles.push(tile);
    }
  }

  var uniforms = createCompatUniforms();
  uniforms.__oceanMesh = group;
  uniforms.__oceanGeo = tiles[0].geometry;
  uniforms.__size = size;
  uniforms.__segments = segs;
  uniforms.__tiles = tiles;
  uniforms.__tileRadius = OCEAN_TILE_RADIUS;

  return { mesh: group, uniforms: uniforms };
}

function updateTileHeights(tile, elapsed, amp, steps, deepColor, shallowColor) {
  var pos = tile.geometry.attributes.position;
  var cols = tile.geometry.attributes.color;
  var tileX = tile.mesh.position.x;
  var tileZ = tile.mesh.position.z;

  var safeAmp = Math.max(0.01, amp);
  for (var i = 0; i < pos.count; i++) {
    var worldX = pos.getX(i) + tileX;
    // PlaneGeometry is in XY before mesh rotation. With -PI/2 around X, world Z = -local Y.
    var worldZ = -pos.getY(i) + tileZ;

    var h = getWaveHeight(worldX, worldZ, elapsed, amp, steps);
    pos.setZ(i, h);

    var t = THREE.MathUtils.clamp((h / (safeAmp * 1.6) + 1) * 0.5, 0, 1);
    TMP_COLOR.copy(deepColor).lerp(shallowColor, t);
    cols.setXYZ(i, TMP_COLOR.r, TMP_COLOR.g, TMP_COLOR.b);
  }

  pos.needsUpdate = true;
  cols.needsUpdate = true;
  tile.geometry.computeVertexNormals();
}

function positionTilesAroundCamera(uniforms, camera) {
  var tiles = uniforms.__tiles;
  if (!tiles || tiles.length === 0) return;

  var size = uniforms.__size || OCEAN_SIZE;
  var anchorX = camera ? Math.round(camera.position.x / size) * size : 0;
  var anchorZ = camera ? Math.round(camera.position.z / size) * size : 0;

  for (var i = 0; i < tiles.length; i++) {
    var tile = tiles[i];
    tile.mesh.position.x = anchorX + tile.gridX * size;
    tile.mesh.position.z = anchorZ + tile.gridZ * size;
  }
}

export function updateOcean(uniforms, elapsed, waveAmplitude, waveSteps, waterTint, dayNight, camera, weatherDim, foamIntensity, cloudShadow) {
  if (!uniforms || !uniforms.__tiles || uniforms.__tiles.length === 0) return;

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

  positionTilesAroundCamera(uniforms, camera);

  for (var i = 0; i < uniforms.__tiles.length; i++) {
    updateTileHeights(uniforms.__tiles[i], elapsed, amp, steps, deepColor, shallowColor);
  }
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
