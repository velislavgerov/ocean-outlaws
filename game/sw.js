// sw.js — service worker: cache-first for offline play
var CACHE_NAME = "ocean-outlaws-v3";

var ASSETS = [
  "/ocean-outlaws/game/",
  "/ocean-outlaws/game/index.html",
  "/ocean-outlaws/game/manifest.json",
  "/ocean-outlaws/game/js/main.js",
  "/ocean-outlaws/game/js/camera.js",
  "/ocean-outlaws/game/js/health.js",
  "/ocean-outlaws/game/js/resource.js",
  "/ocean-outlaws/game/js/turret.js",
  "/ocean-outlaws/game/js/drone.js",
  "/ocean-outlaws/game/js/mapScreen.js",
  "/ocean-outlaws/game/js/bossHud.js",
  "/ocean-outlaws/game/js/mapData.js",
  "/ocean-outlaws/game/js/wave.js",
  "/ocean-outlaws/game/js/crew.js",
  "/ocean-outlaws/game/js/crewScreen.js",
  "/ocean-outlaws/game/js/techTree.js",
  "/ocean-outlaws/game/js/techScreen.js",
  "/ocean-outlaws/game/js/pickup.js",
  "/ocean-outlaws/game/js/input.js",
  "/ocean-outlaws/game/js/nav.js",
  "/ocean-outlaws/game/js/boss.js",
  "/ocean-outlaws/game/js/daynight.js",
  "/ocean-outlaws/game/js/shipClass.js",
  "/ocean-outlaws/game/js/port.js",
  "/ocean-outlaws/game/js/crate.js",
  "/ocean-outlaws/game/js/upgrade.js",
  "/ocean-outlaws/game/js/shipSelect.js",
  "/ocean-outlaws/game/js/uiEffects.js",
  "/ocean-outlaws/game/js/weather.js",
  "/ocean-outlaws/game/js/weapon.js",
  "/ocean-outlaws/game/js/upgradeScreen.js",
  "/ocean-outlaws/game/js/sound.js",
  "/ocean-outlaws/game/js/soundFx.js",
  "/ocean-outlaws/game/js/multiplayer.js",
  "/ocean-outlaws/game/js/netSync.js",
  "/ocean-outlaws/game/js/lobbyScreen.js",
  "/ocean-outlaws/game/js/minimap.js",
  "/ocean-outlaws/game/js/hud.js",
  "/ocean-outlaws/game/js/ocean.js",
  "/ocean-outlaws/game/js/terrain.js",
  "/ocean-outlaws/game/js/ship.js",
  "/ocean-outlaws/game/js/enemy.js",
  "/ocean-outlaws/game/js/bossModels.js",
  "/ocean-outlaws/game/js/shipParts.js",
  "/ocean-outlaws/game/js/shipModels.js",
  "/ocean-outlaws/game/js/save.js",
  "/ocean-outlaws/game/js/settingsMenu.js",
  "/ocean-outlaws/game/js/mobile.js",
  "/ocean-outlaws/game/icons/icon-192.png",
  "/ocean-outlaws/game/icons/icon-512.png"
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
