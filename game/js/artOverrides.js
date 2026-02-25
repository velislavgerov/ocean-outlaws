// artOverrides.js — maps ship/enemy/boss keys to GLB model paths via manifest
var _manifest = null;
var _manifestPromise = null;

function loadManifest() {
  if (_manifestPromise) return _manifestPromise;
  _manifestPromise = fetch("assets/manifest.json")
    .then(function (res) {
      if (!res.ok) throw new Error("manifest fetch failed");
      return res.json();
    })
    .then(function (data) {
      _manifest = data;
      return data;
    })
    .catch(function () {
      _manifest = null;
      return null;
    });
  return _manifestPromise;
}

// Eagerly start loading manifest on module init
loadManifest();

export function getOverridePath(slot) {
  if (!_manifest || !_manifest.ships) return null;
  var entry = _manifest.ships[slot];
  if (!entry || !entry.model) return null;
  return "assets/" + entry.model;
}

export function getOverrideSize(slot) {
  if (!_manifest || !_manifest.ships) return null;
  var entry = _manifest.ships[slot];
  return entry ? entry.size : null;
}

export function getManifest() {
  return _manifest;
}

export function ensureManifest() {
  return loadManifest();
}
