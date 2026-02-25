// assetRoles.js — shared runtime registry for model role mappings

var ASSET_ROLE_REGISTRY_PATH = "data/assetRoleRegistry.json";
var _assetRoles = null;
var _assetRolesPromise = null;

function loadAssetRoles() {
  if (_assetRolesPromise) return _assetRolesPromise;
  _assetRolesPromise = fetch(ASSET_ROLE_REGISTRY_PATH)
    .then(function (res) {
      if (!res.ok) throw new Error("asset role registry fetch failed");
      return res.json();
    })
    .then(function (data) {
      _assetRoles = data && data.roles ? data.roles : null;
      return _assetRoles;
    })
    .catch(function () {
      _assetRoles = null;
      return null;
    });
  return _assetRolesPromise;
}

// Eager load so early spawns can use role overrides
loadAssetRoles();

export function ensureAssetRoles() {
  return loadAssetRoles();
}

export function getRoleVariants(roleKey) {
  if (!_assetRoles || !roleKey) return null;
  var v = _assetRoles[roleKey];
  return Array.isArray(v) ? v : null;
}

function getWeight(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return 1;
  var w = Number(entry.weight);
  if (!isFinite(w) || w <= 0) return 1;
  return w;
}

function unwrapEntry(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return entry;
  if (entry.value !== undefined) return entry.value;
  if (entry.variant !== undefined) return entry.variant;
  if (Array.isArray(entry.modules)) return entry.modules;
  return entry;
}

function pickFromPool(pool, rngFn) {
  if (!pool || pool.length === 0) return null;
  var random = typeof rngFn === "function" ? rngFn : Math.random;

  var totalWeight = 0;
  var hasCustomWeight = false;
  for (var i = 0; i < pool.length; i++) {
    var w = getWeight(pool[i]);
    totalWeight += w;
    if (w !== 1) hasCustomWeight = true;
  }
  if (totalWeight <= 0) return null;

  if (!hasCustomWeight) {
    var idx = Math.floor(random() * pool.length);
    if (idx < 0 || idx >= pool.length) idx = 0;
    return unwrapEntry(pool[idx]);
  }

  var roll = random() * totalWeight;
  for (var j = 0; j < pool.length; j++) {
    roll -= getWeight(pool[j]);
    if (roll <= 0) return unwrapEntry(pool[j]);
  }
  return unwrapEntry(pool[pool.length - 1]);
}

export function pickRoleVariant(roleKey, fallbackPool, rngFn) {
  var rolePool = getRoleVariants(roleKey);
  var pool = rolePool && rolePool.length ? rolePool : fallbackPool;
  if (!Array.isArray(pool)) return null;
  return pickFromPool(pool, rngFn);
}
