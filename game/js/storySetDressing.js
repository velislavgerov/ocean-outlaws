// storySetDressing.js — narrative decorative GLB kits for voyage encounters

import * as THREE from "three";
import { loadGlbVisual } from "./glbVisual.js";
import { pickRoleVariant } from "./assetRoles.js";

function hashString(text) {
  var s = String(text || "");
  var h = 2166136261 >>> 0;
  for (var i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  var t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    var x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

var REGION_FALLBACK = {
  frontier_isles: [
    { path: "assets/models/environment/wooden-platforms/wooden-platform.glb", fit: 11.5, x: -46, y: 1.8, z: -26, ry: Math.PI * 0.12 },
    { path: "assets/models/environment/wooden-piers/wooden-pier-4.glb", fit: 12, x: 38, y: 1.8, z: 18, ry: Math.PI * 0.75 },
    { path: "assets/models/environment/boxes/box-2.glb", fit: 2.0, x: 40, y: 3.0, z: 20, ry: 0.4 }
  ],
  storm_belt: [
    { path: "assets/models/environment/smoke-black.glb", fit: 14, x: -22, y: 2.2, z: 36, ry: 0 },
    { path: "assets/models/environment/destroyed-wooden-pier.glb", fit: 10, x: -36, y: 1.4, z: 32, ry: Math.PI * 1.1 },
    { path: "assets/models/stones/ancient/ancient-stone-11.glb", fit: 11, x: 44, y: 1.2, z: -10, ry: 0.3 }
  ],
  forgotten_depths: [
    { path: "assets/models/environment/tentacles/tentacles-3.glb", fit: 16, x: -26, y: 1.0, z: 24, ry: 0.15 },
    { path: "assets/models/stones/ancient/ancient-stone-13.glb", fit: 12, x: 42, y: 1.2, z: -18, ry: 0.6 },
    { path: "assets/models/environment/smoke-white.glb", fit: 12, x: -14, y: 2.0, z: -34, ry: 0 }
  ]
};

function copyModules(modules) {
  var out = [];
  if (!Array.isArray(modules)) return out;
  for (var i = 0; i < modules.length; i++) {
    var m = modules[i];
    if (!m || typeof m !== "object" || !m.path) continue;
    out.push({
      path: m.path,
      fit: m.fit,
      x: m.x,
      y: m.y,
      z: m.z,
      ry: m.ry
    });
  }
  return out;
}

function normalizeToken(value, fallback) {
  if (value === null || value === undefined) return fallback || null;
  var t = String(value).trim().toLowerCase().replace(/[^a-z0-9_\\-]/g, "_");
  return t || fallback || null;
}

function pickSetpieceModules(regionId, encounterType, sceneRole, rng) {
  var region = normalizeToken(regionId, "frontier_isles");
  var encounter = normalizeToken(encounterType, null);
  var scene = normalizeToken(sceneRole, null);
  var keys = [];
  if (encounter) keys.push("story.setpiece.region." + region + ".encounter." + encounter);
  if (scene) keys.push("story.setpiece.region." + region + ".scene." + scene);
  keys.push("story.setpiece.region." + region);
  keys.push("story.setpiece.default");

  for (var i = 0; i < keys.length; i++) {
    var pick = pickRoleVariant(keys[i], null, rng);
    var modules = copyModules(pick);
    if (modules.length) return modules;
  }
  return copyModules(REGION_FALLBACK[region] || REGION_FALLBACK.frontier_isles);
}

export function createStorySetDressing() {
  return {
    root: null,
    terrain: null,
    seed: 0,
    items: []
  };
}

export function clearStorySetDressing(manager) {
  if (!manager || !manager.root) return;
  if (manager.root.parent) manager.root.parent.remove(manager.root);
  manager.root = null;
  manager.terrain = null;
  manager.seed = 0;
  manager.items = [];
}

export function shiftStorySetDressing(manager, shiftX, shiftZ) {
  if (!manager || !manager.root) return;
  manager.root.position.x -= shiftX;
  manager.root.position.z -= shiftZ;
}

export function spawnStorySetDressing(manager, terrain, context) {
  if (!manager) return Promise.resolve(0);
  clearStorySetDressing(manager);
  if (!terrain || !terrain.mesh) return Promise.resolve(0);

  var ctx = context || {};
  var region = normalizeToken(ctx.storyRegion, "frontier_isles");
  var encounter = normalizeToken(ctx.encounterType, null);
  var sceneRole = normalizeToken(ctx.sceneRole, null);
  var seed = (Number(ctx.seed) || 0) ^ hashString(region) ^ hashString(encounter || "none") ^ hashString(sceneRole || "none");
  var rng = mulberry32(seed >>> 0);
  var modules = pickSetpieceModules(region, encounter, sceneRole, rng);
  if (!modules.length) return Promise.resolve(0);

  var root = new THREE.Group();
  root.name = "story_set_dressing";
  terrain.mesh.add(root);

  manager.root = root;
  manager.terrain = terrain;
  manager.seed = seed >>> 0;
  manager.items = [];

  var placed = 0;
  var tasks = [];
  for (var i = 0; i < modules.length; i++) {
    (function (mod, index) {
      var posX = mod.x;
      var posY = mod.y;
      var posZ = mod.z;
      if (posX === undefined || posZ === undefined) {
        var ang = rng() * Math.PI * 2;
        var dist = 28 + rng() * 30;
        posX = Math.cos(ang) * dist;
        posZ = Math.sin(ang) * dist;
      }
      if (posY === undefined) posY = 1.2 + rng() * 0.8;

      tasks.push(
        loadGlbVisual(mod.path, mod.fit || 10, true, { noDecimate: true }).then(function (obj) {
          obj.position.set(posX, posY, posZ);
          obj.rotation.y = mod.ry !== undefined ? mod.ry : (rng() - 0.5) * Math.PI * 0.5;
          root.add(obj);
          manager.items.push({
            path: mod.path,
            x: posX,
            y: posY,
            z: posZ,
            idx: index
          });
          placed++;
        }).catch(function () {
          // keep going even if one decorative model fails
        })
      );
    })(modules[i], i);
  }

  return Promise.all(tasks).then(function () {
    return placed;
  });
}
