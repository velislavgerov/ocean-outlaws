// sw.js — service worker: cache-first for offline play
var CACHE_NAME = "ocean-outlaws-v2";

var ASSETS = [
  "/ocean-outlaws/",
  "/ocean-outlaws/index.html",
  "/ocean-outlaws/manifest.json",
  "/ocean-outlaws/js/main.js",
  "/ocean-outlaws/js/camera.js",
  "/ocean-outlaws/js/health.js",
  "/ocean-outlaws/js/resource.js",
  "/ocean-outlaws/js/turret.js",
  "/ocean-outlaws/js/drone.js",
  "/ocean-outlaws/js/mapScreen.js",
  "/ocean-outlaws/js/bossHud.js",
  "/ocean-outlaws/js/mapData.js",
  "/ocean-outlaws/js/wave.js",
  "/ocean-outlaws/js/crew.js",
  "/ocean-outlaws/js/crewScreen.js",
  "/ocean-outlaws/js/techTree.js",
  "/ocean-outlaws/js/techScreen.js",
  "/ocean-outlaws/js/pickup.js",
  "/ocean-outlaws/js/input.js",
  "/ocean-outlaws/js/nav.js",
  "/ocean-outlaws/js/boss.js",
  "/ocean-outlaws/js/daynight.js",
  "/ocean-outlaws/js/shipClass.js",
  "/ocean-outlaws/js/port.js",
  "/ocean-outlaws/js/crate.js",
  "/ocean-outlaws/js/upgrade.js",
  "/ocean-outlaws/js/shipSelect.js",
  "/ocean-outlaws/js/uiEffects.js",
  "/ocean-outlaws/js/weather.js",
  "/ocean-outlaws/js/weapon.js",
  "/ocean-outlaws/js/upgradeScreen.js",
  "/ocean-outlaws/js/sound.js",
  "/ocean-outlaws/js/soundFx.js",
  "/ocean-outlaws/js/multiplayer.js",
  "/ocean-outlaws/js/netSync.js",
  "/ocean-outlaws/js/lobbyScreen.js",
  "/ocean-outlaws/js/minimap.js",
  "/ocean-outlaws/js/hud.js",
  "/ocean-outlaws/js/ocean.js",
  "/ocean-outlaws/js/terrain.js",
  "/ocean-outlaws/js/ship.js",
  "/ocean-outlaws/js/enemy.js",
  "/ocean-outlaws/js/bossModels.js",
  "/ocean-outlaws/js/shipParts.js",
  "/ocean-outlaws/js/shipModels.js",
  "/ocean-outlaws/js/save.js",
  "/ocean-outlaws/js/settingsMenu.js",
  "/ocean-outlaws/js/mobile.js",
  "/ocean-outlaws/icons/icon-192.png",
  "/ocean-outlaws/icons/icon-512.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names.filter(function (n) { return n !== CACHE_NAME; })
          .map(function (n) { return caches.delete(n); })
      );
    })
  );
  self.clients.claim();
});

// network-first strategy: always try fresh, fall back to cache for offline
self.addEventListener("fetch", function (e) {
  e.respondWith(
    fetch(e.request).then(function (response) {
      // update cache with fresh response
      if (response.ok && e.request.url.indexOf(self.location.origin) !== -1) {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(e.request, clone);
        });
      }
      return response;
    }).catch(function () {
      // offline — serve from cache
      return caches.match(e.request);
    })
  );
});
