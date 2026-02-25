// glbVisual.js — shared GLB loading/fit helpers for runtime model overrides
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { getQualityConfig } from "./mobile.js";

var cache = {};

// DRACOLoader singleton — created once and shared across all loads
var _dracoLoader = new DRACOLoader();
_dracoLoader.setDecoderPath("https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/");

var _loader = new GLTFLoader();
_loader.setDRACOLoader(_dracoLoader);

function markSharedResource(resource, sourcePath) {
  if (!resource) return;
  if (!resource.userData) resource.userData = {};
  resource.userData.__glbSharedTemplate = true;
  if (sourcePath && !resource.userData.__glbTemplatePath) {
    resource.userData.__glbTemplatePath = sourcePath;
  }
}

function markSharedMaterialResources(material, sourcePath) {
  if (!material) return;
  markSharedResource(material, sourcePath);
  for (var k in material) {
    if (!Object.prototype.hasOwnProperty.call(material, k)) continue;
    var v = material[k];
    if (v && v.isTexture) markSharedResource(v, sourcePath);
  }
}

function markTemplateResources(root, sourcePath) {
  if (!root) return;
  root.traverse(function (o) {
    if (o.geometry) markSharedResource(o.geometry, sourcePath);
    if (!o.material) return;
    if (Array.isArray(o.material)) {
      for (var i = 0; i < o.material.length; i++) {
        markSharedMaterialResources(o.material[i], sourcePath);
      }
    } else {
      markSharedMaterialResources(o.material, sourcePath);
    }
  });
}

function fitToSize(root, target) {
  var box = new THREE.Box3().setFromObject(root);
  var size = new THREE.Vector3();
  var center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  var maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim > 0.0001) root.scale.setScalar(target / maxDim);
  box.setFromObject(root);
  box.getCenter(center);
  root.position.x -= center.x;
  root.position.z -= center.z;
  root.position.y -= box.min.y;
}

function applyFlat(root) {
  root.traverse(function (o) {
    if (!o.isMesh || !o.material) return;
    var mats = Array.isArray(o.material) ? o.material : [o.material];
    var replaced = [];
    for (var i = 0; i < mats.length; i++) {
      var m = mats[i];
      var col = m.color ? m.color.clone() : new THREE.Color(0xcccccc);
      // boost saturation for cartoon vibrancy
      var hsl = {};
      col.getHSL(hsl);
      col.setHSL(hsl.h, Math.min(1, hsl.s * 1.3 + 0.05), hsl.l);
      var toon = new THREE.MeshToonMaterial({
        color: col,
        side: m.side !== undefined ? m.side : THREE.FrontSide
      });
      if (m.map) toon.map = m.map;
      if (m.transparent) { toon.transparent = true; toon.opacity = m.opacity; }
      replaced.push(toon);
    }
    o.material = Array.isArray(o.material) ? replaced : replaced[0];
  });
}

function countTriangles(root) {
  var total = 0;
  root.traverse(function (o) {
    if (!o.isMesh || !o.geometry) return;
    var geo = o.geometry;
    if (geo.index) {
      total += geo.index.count / 3;
    } else if (geo.attributes.position) {
      total += geo.attributes.position.count / 3;
    }
  });
  return Math.floor(total);
}

function decimateGeometry(geo, ratio) {
  if (!geo.index || ratio >= 1) return geo;
  var idx = geo.index;
  var triCount = Math.floor(idx.count / 3);
  var keep = Math.max(1, Math.floor(triCount * ratio));
  var step = triCount / keep;
  var newIndices = [];
  for (var i = 0; i < keep; i++) {
    var srcTri = Math.min(Math.floor(i * step), triCount - 1);
    var base = srcTri * 3;
    newIndices.push(idx.getX(base), idx.getX(base + 1), idx.getX(base + 2));
  }
  var newGeo = geo.clone();
  newGeo.setIndex(newIndices);
  return newGeo;
}

function enforceTriBudget(root, budget) {
  if (!budget || budget <= 0) return;
  var total = countTriangles(root);
  if (total <= budget) return;
  var ratio = budget / total;
  root.traverse(function (o) {
    if (!o.isMesh || !o.geometry) return;
    o.geometry = decimateGeometry(o.geometry, ratio);
  });
}

function loadTemplate(path) {
  if (cache[path]) return cache[path];
  cache[path] = new Promise(function (resolve, reject) {
    _loader.load(encodeURI(path), function (gltf) {
      markTemplateResources(gltf.scene, path);
      resolve(gltf.scene);
    }, undefined, reject);
  });
  return cache[path];
}

export async function loadGlbVisual(path, fitSize, flatShaded) {
  var tpl = await loadTemplate(path);
  var visual = tpl.clone(true);
  fitToSize(visual, fitSize || 10);
  if (flatShaded !== false) applyFlat(visual);
  var qCfg = getQualityConfig();
  if (qCfg.maxTriangles > 0) enforceTriBudget(visual, qCfg.maxTriangles);
  return visual;
}
