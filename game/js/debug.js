// debug.js — debug panel activated by #debug in URL
// Uses Tweakpane loaded from CDN. Inspired by folio-2025 debug system.

var pane = null;
var active = false;

function isDebugActive() {
  return typeof window !== "undefined" && window.location.hash.indexOf("debug") !== -1;
}

export function initDebug() {
  if (!isDebugActive()) return Promise.resolve(null);

  return import("https://cdn.jsdelivr.net/npm/tweakpane@4/dist/tweakpane.min.js").then(function (module) {
    var Tweakpane = module.Pane || (module.default && module.default.Pane) || module;
    pane = new Tweakpane({ title: "Ocean Outlaws Debug", expanded: true });
    active = true;
    return pane;
  }).catch(function (err) {
    console.warn("[debug] Failed to load Tweakpane:", err);
    return null;
  });
}

export function getDebugPane() {
  return pane;
}

export function isDebugMode() {
  return active;
}

export function addDebugFolder(title) {
  if (!pane) return null;
  return pane.addFolder({ title: title, expanded: false });
}

export function addDebugBinding(folder, obj, key, params) {
  if (!folder) return null;
  return folder.addBinding(obj, key, params);
}

// Manual/auto toggle binding — folio-2025 pattern
// When manual is true, the value is user-controlled via the slider.
// When manual is false, the value is driven by game logic.
export function addManualBinding(folder, obj, key, params) {
  if (!folder) return null;
  var state = { manual: false };
  var binding = folder.addBinding(obj, key, params);
  folder.addBinding(state, "manual", { label: key + " manual" });

  return {
    binding: binding,
    isManual: function () { return state.manual; },
    refresh: function () { if (!state.manual) binding.refresh(); }
  };
}

// FPS tracking
var fpsObj = { fps: 60 };
var frameCount = 0;
var fpsTime = 0;
var fpsBinding = null;

export function updateDebugFPS(dt) {
  if (!active) return;
  frameCount++;
  fpsTime += dt;
  if (fpsTime >= 0.5) {
    fpsObj.fps = Math.round(frameCount / fpsTime);
    frameCount = 0;
    fpsTime = 0;
    if (fpsBinding) fpsBinding.refresh();
  }
}

// Call after pane is created to add FPS monitor
export function addFPSMonitor() {
  if (!pane) return;
  fpsBinding = pane.addBinding(fpsObj, "fps", { readonly: true, label: "FPS" });
}
