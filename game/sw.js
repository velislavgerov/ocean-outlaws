// sw.js — service worker: cache-first for offline play
var CACHE_NAME = "ocean-outlaws-v4";

var ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./js/main.js",
  "./js/camera.js",
  "./js/health.js",
  "./js/resource.js",
  "./js/drone.js",
  "./js/mapScreen.js",
  "./js/bossHud.js",
  "./js/mapData.js",
  "./js/wave.js",
  "./js/crew.js",
  "./js/techTree.js",
  "./js/techScreen.js",
  "./js/pickup.js",
  "./js/input.js",
  "./js/nav.js",
  "./js/boss.js",
  "./js/daynight.js",
  "./js/shipClass.js",
  "./js/port.js",
  "./js/crate.js",
  "./js/upgrade.js",
  "./js/shipSelect.js",
  "./js/uiEffects.js",
  "./js/weather.js",
  "./js/weapon.js",
  "./js/sound.js",
  "./js/soundFx.js",
  "./js/storyState.js",
  "./js/voyageEvents.js",
  "./js/eventEngine.js",
  "./js/eventModal.js",
  "./js/storyAudio.js",
  "./js/storySetDressing.js",
  "./js/multiplayer.js",
  "./js/netSync.js",
  "./js/lobbyScreen.js",
  "./js/minimap.js",
  "./js/hud.js",
  "./js/ocean.js",
  "./js/terrain.js",
  "./js/ship.js",
  "./js/enemy.js",
  "./js/bossModels.js",
  "./js/shipModels.js",
  "./js/save.js",
  "./js/settingsMenu.js",
  "./js/mobile.js",
  "./assets/audio/story/event-open.wav",
  "./assets/audio/story/event-hover.wav",
  "./assets/audio/story/event-confirm.wav",
  "./assets/audio/story/event-positive.wav",
  "./assets/audio/story/event-negative.wav",
  "./assets/audio/story/reputation-up.wav",
  "./assets/audio/story/reputation-down.wav",
  "./assets/audio/story/region-transition.wav",
  "./assets/audio/story/journal-update.wav",
  "./assets/audio/story/boss-omen.wav",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
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
