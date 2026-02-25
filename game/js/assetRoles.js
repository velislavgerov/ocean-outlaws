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
