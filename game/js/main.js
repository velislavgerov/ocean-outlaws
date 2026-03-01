import * as THREE from "three";
import { createOcean, updateOcean, getWaveHeight, rebuildOceanForQuality } from "./ocean.js";
import { createCamera, updateCamera, resizeCamera } from "./camera.js";
import { createShip, updateShip, getSpeedRatio, getDisplaySpeed, updateShipLantern, setNavTarget, clearNavTarget } from "./ship.js";
import { initInput, getInput, getMouse, consumeClick, getKeyActions } from "./input.js";
import { isMobile } from "./mobile.js";
import { initMobileControls, getJoystickState } from "./mobileControls.js";
import { createHUD, updateHUD, updateMinimap, showBanner, showGameOver, showVictory, setRestartCallback, hideOverlay, setAbilityBarCallback, setMuteCallback, setVolumeCallback, setSettingsDataCallback } from "./hud.js";
import { showDamageIndicator, showFloatingNumber, addKillFeedEntry, triggerScreenShake, updateUIEffects, getShakeOffset, fadeOut, fadeIn, updateLowHullVignette } from "./uiEffects.js";
import { unlockAudio, updateSailing, setSailClass, updateAmbience, updateMusic, updateLowHpWarning, toggleMute, setMasterVolume, isMuted, fadeGameAudio, resumeGameAudio } from "./sound.js";
import { playWeaponSound, playExplosion, playPlayerHit, playClick, playUpgrade, playWaveHorn, playHitConfirm, playKillConfirm } from "./soundFx.js";
import { initNav, updateNav, handleClick, handleHold, stopHold, getCombatTarget, setCombatTarget, clearCombatTarget, setNavBoss } from "./nav.js";
import { createWeaponState, fireWeapon, updateWeapons, switchWeapon, getWeaponOrder, getWeaponConfig, findNearestEnemy, getActiveWeaponRange, aimAtEnemy, setWeaponHitCallback, rollWeaponUpgradeKey, getEffectiveConfig } from "./weapon.js";
import { createEnemyManager, updateEnemies, getPlayerHp, setOnDeathCallback, setOnHitCallback, setPlayerHp, setPlayerArmor, setPlayerMaxHp, resetEnemyManager, getFactionAnnounce, getFactionGoldMult, damageEnemy, spawnEnemy } from "./enemy.js";
import { initHealthBars, updateHealthBars } from "./health.js";
import { createResources, consumeFuel, getFuelSpeedMult, resetResources } from "./resource.js";
import { createPickupManager, spawnPickup, updatePickups, clearPickups, setPickupCollectCallback, setPickupRoleContext, spawnWeaponUpgradePickup, preloadPickupModels } from "./pickup.js";
import { createWaveManager, updateWaveState, getWaveConfig, getWaveState, resetWaveManager } from "./wave.js";
import { createUpgradeState, resetUpgrades, addGold, getMultipliers, buildCombinedMults, getRepairCost, applyFreeUpgrade } from "./upgrade.js";
import { createCardPicker, showCardPicker, hideCardPicker } from "./cardPicker.js";
import { generateUpgradeCards } from "./cardGen.js";
import { getShipClass } from "./shipClass.js";
import { createAbilityState, activateAbility, updateAbility } from "./shipClass.js";
import { createShipSelectScreen, showShipSelectScreen, hideShipSelectScreen, getShipSelectOverlay } from "./shipSelect.js";
import { createDroneManager, spawnDrone, updateDrones, resetDrones } from "./drone.js";
import { createMapScreen, showMapScreen, hideMapScreen, isMapScreenVisible } from "./mapScreen.js";
import { loadMapState, resetMapState, getZone } from "./mapData.js";
import { createWeather, setWeather, getWeatherPreset, getWeatherLabel, getWeatherDim, getWeatherFoam, getWeatherCloudShadow, maybeChangeWeather, createRain, createSplashes, updateWeather } from "./weather.js";
import { createDayNight, updateDayNight, applyDayNight, createStars, updateStars, getNightness, setTimeOfDay } from "./daynight.js";
import { createBoss, updateBoss, removeBoss, rollBossLoot, applyBossLoot, damageBoss } from "./boss.js";
import { createBossHud, showBossHud, hideBossHud, updateBossHud, showLootBanner } from "./bossHud.js";
import { createCrewState, resetCrew, generateOfficerReward, addOfficer, getCrewBonuses, isCrewFull, removeOfficer, autoAssignOfficer } from "./crew.js";
import { createCrewPickupManager, spawnCrewPickup, updateCrewPickups, clearCrewPickups, setCrewPickupCallback, setCrewPickupClaimCallback, removeCrewPickup } from "./crewPickup.js";
import { createCrewSwap, showCrewSwap, hideCrewSwap } from "./crewSwap.js";
import { loadTechState, getTechBonuses, resetTechState } from "./techTree.js";
import { createTechScreen, showTechScreen, hideTechScreen } from "./techScreen.js";
import { createTerrain, removeTerrain, getTerrainMinimapMarkers, updateTerrainStreaming, shiftTerrainOrigin, preloadTerrainModels } from "./terrain.js";
import { createPortManager, initPorts, clearPorts, updatePorts, getPortsInfo, consumeCityEvents } from "./port.js";
import { createPortScreen, showPortScreen, hidePortScreen } from "./portScreen.js";
import { createCrateManager, clearCrates, updateCrates } from "./crate.js";
import { createMerchantManager, updateMerchants, clearMerchants, setMerchantPlayerSpeed } from "./merchant.js";
import { createMultiplayerState, createRoom, joinRoom, setReady, setShipClass, setUsername, startGame, allPlayersReady, leaveRoom, isMultiplayerActive, broadcast, getPlayerCount } from "./multiplayer.js";
import { sendShipState, sendEnemyState, sendFireEvent, handleBroadcastMessage, updateRemoteShips, getRemoteShipsForMinimap, clearRemoteShips, resetSendState, initRemoteLabels, updateRemoteLabels, fadeRemoteShip } from "./netSync.js";
import { sendHitEvent, sendBossState, sendBossSpawn, sendBossDefeated, sendBossAttack, sendWaveEvent, sendWeatherChange, sendWeatherSync, sendPickupClaim, sendKillFeedEntry, sendGameOverEvent, handleCombatMessage, resetCombatSync, applyEnemyStateFromHost, deadReckonEnemies, sendCrewPickupClaim, sendCrewPickupConfirmed } from "./combatSync.js";
import { createLobbyScreen, createMultiplayerButton, showLobbyChoice, showLobby, hideLobbyScreen, updatePlayerList, updateReadyButton, updateStartButton, setLobbyCallbacks } from "./lobbyScreen.js";
import { autoSave, loadSave, hasSave, deleteSave, exportSave, importSave } from "./save.js";
import { createSettingsMenu, isSettingsOpen, updateSettingsData, updateMuteButton, updateVolumeSlider } from "./settingsMenu.js";
import { getQualityConfig, createOrientationPrompt, onQualityChange } from "./mobile.js";
import { seedRNG, nextRandom, getRNGState, getRNGCount } from "./rng.js";
import { loadInfamy, addInfamy, calcRunInfamy, getLegendLevel, getLegendProgress } from "./infamy.js";
import { createInfamyScreen, showInfamyScreen, hideInfamyScreen } from "./infamyScreen.js";
import { createMainMenu, showMainMenu, hideMainMenu } from "./mainMenu.js";
import { saveRunState as saveRun, loadRunState, clearRunState } from "./runState.js";
import { createWorldDebugView, updateWorldDebugView, toggleWorldDebugView, isWorldDebugVisible, zoomWorldDebugView, getWorldDebugState } from "./worldDebugView.js";
import { getRolePickStats, resetRolePickStats } from "./assetRoles.js";
import { createRendererRuntime } from "./rendererRuntime.js";
import { createTicker } from "./ticker.js";
import { initDebug, addDebugFolder, addDebugBinding, addFPSMonitor, updateDebugFPS } from "./debug.js";
import { updateTimeUniforms, updateCameraUniforms, updateWindUniforms, updateDayNightUniforms, updateWeatherUniforms } from "./sharedUniforms.js";
import { preCompileShaders } from "./preRenderer.js";

var GOLD_PER_KILL = 25;
var prevPlayerHp = -1;
var lastZoneResult = null; // "victory" or "game_over"
var wasHeld = false; // tracks previous frame hold state for release detection
var wasJoystickActive = false; // tracks previous frame joystick state for release detection
var HOLD_THRESHOLD = 200; // ms — presses shorter than this count as click, not hold
var runEnemiesSunk = 0; // enemies sunk during current run
var runGoldLooted = 0; // gold earned during current run
var runZonesReached = 0; // zones visited during current run
var currentRoleContext = null; // active zone/node context for role-based model selection

// --- Open world spatial spawning ---
var PATROL_SPAWN_RADIUS = 120;
var PATROL_DESPAWN_RADIUS = 180;
var PATROL_MAX_ENEMIES = 8;
var PATROL_SPAWN_INTERVAL = 4.0;
var patrolSpawnTimer = 0;

// --- Boss zones ---
var BOSS_ZONE_RADIUS = 60;
var bossZones = [];
var bossZonesInitialized = false;

var batteryTargetWorld = new THREE.Vector3();
var batteryHudWorld = new THREE.Vector3();

function findNearestHostileBatteryTarget(shipRef, portManager) {
  if (!shipRef || !portManager || !portManager.ports) return null;
  var best = null;
  var bestDistSq = Infinity;
  for (var i = 0; i < portManager.ports.length; i++) {
    var port = portManager.ports[i];
    if (!port || !port.hostileCity || !port.batteries) continue;
    for (var bi = 0; bi < port.batteries.length; bi++) {
      var battery = port.batteries[bi];
      if (!battery || !battery.alive || !battery.mesh || !battery.mesh.parent || !battery.mesh.visible) continue;
      battery.mesh.getWorldPosition(batteryTargetWorld);
      var dx = batteryTargetWorld.x - shipRef.posX;
      var dz = batteryTargetWorld.z - shipRef.posZ;
      var distSq = dx * dx + dz * dz;
      if (distSq >= bestDistSq) continue;
      battery.posX = batteryTargetWorld.x;
      battery.posZ = batteryTargetWorld.z;
      best = battery;
      bestDistSq = distSq;
    }
  }
  return best;
}

function collectHostileBatteryTargets(portManager) {
  var out = [];
  if (!portManager || !portManager.ports) return out;
  for (var i = 0; i < portManager.ports.length; i++) {
    var port = portManager.ports[i];
    if (!port || !port.hostileCity || !port.batteries) continue;
    for (var bi = 0; bi < port.batteries.length; bi++) {
      var battery = port.batteries[bi];
      if (!battery || !battery.alive || !battery.mesh || !battery.mesh.parent || !battery.mesh.visible) continue;
      battery.mesh.getWorldPosition(batteryHudWorld);
      out.push({
        x: batteryHudWorld.x,
        y: batteryHudWorld.y,
        z: batteryHudWorld.z,
        hp: battery.hp,
        maxHp: battery.maxHp || 1,
        alive: true
      });
    }
  }
  return out;
}

function fireWithSound(w, s, r, m) {
  var before = w.projectiles.length;
  fireWeapon(w, s, r, m);
  if (w.projectiles.length > before) {
    var wOrder = getWeaponOrder();
    playWeaponSound(wOrder[w.activeWeapon]);
  }
}

// --- Loading screen helpers (two-phase init, folio-2025 pattern) ---
function updateLoadingBar(pct, text) {
  var bar = document.getElementById("loading-bar");
  var label = document.getElementById("loading-text");
  if (bar) bar.style.width = Math.min(100, Math.round(pct)) + "%";
  if (label) label.textContent = text || "Loading...";
}

function hideLoadingScreen() {
  var screen = document.getElementById("loading-screen");
  if (screen) {
    screen.style.transition = "opacity 0.5s";
    screen.style.opacity = "0";
    setTimeout(function () { screen.style.display = "none"; }, 500);
  }
}

function showLoadingScreen(text) {
  var screen = document.getElementById("loading-screen");
  if (!screen) return;
  screen.style.display = "flex";
  screen.style.transition = "";
  screen.style.opacity = "1";
  updateLoadingBar(0, text || "Loading...");
}

var qCfg = getQualityConfig();
var rendererRuntime = createRendererRuntime(THREE, qCfg);
var renderer = rendererRuntime.renderer;
if (typeof window !== "undefined") {
  window.__ooRendererObject = renderer;
  window.__ooRendererBackend = rendererRuntime && rendererRuntime.backend ? rendererRuntime.backend : "webgl";
}
if (renderer.domElement && !renderer.domElement.parentNode) {
  document.body.appendChild(renderer.domElement);
}
updateLoadingBar(10, "Renderer ready...");

var scene = new THREE.Scene();
preloadPickupModels(scene);
scene.fog = new THREE.FogExp2(0x0a0e1a, 0.006);
var ambient = new THREE.AmbientLight(0x1a2040, 0.6);
scene.add(ambient);
var sun = new THREE.DirectionalLight(0x4466aa, 0.8);
sun.position.set(50, 80, 30);
scene.add(sun);
var hemi = new THREE.HemisphereLight(0x1a1a3a, 0x050510, 0.3);
scene.add(hemi);

function getWaterQualityHint(cfg) {
  if (!cfg) return "high";
  if (cfg.shaderDetail <= 0 || cfg.oceanSegments <= 64) return "low";
  if (cfg.shaderDetail <= 1 || cfg.oceanSegments <= 96) return "medium";
  return "high";
}

var ocean = createOcean(qCfg.oceanSegments, {
  renderer: renderer,
  qualityHint: getWaterQualityHint(qCfg)
});
ocean.uniforms.uShaderDetail.value = qCfg.shaderDetail;
scene.add(ocean.mesh);

var weather = createWeather("calm");
weather.fogRef = scene.fog;
weather.ambientRef = ambient;
weather.sunRef = sun;
var rain = createRain(scene, qCfg.rainCount);
weather.rain = rain;
var splashes = createSplashes(scene, qCfg.splashCount);
weather.splashes = splashes;

updateLoadingBar(30, "Ocean ready...");
var dayNight = createDayNight();
var stars = createStars(scene);

// Debug panel — activated by #debug in URL (folio-2025 pattern)
initDebug().then(function (debugPane) {
  if (!debugPane) return;
  addFPSMonitor();
  var oceanFolder = addDebugFolder("Ocean");
  if (oceanFolder && ocean.uniforms) {
    addDebugBinding(oceanFolder, ocean.uniforms.uWaveAmp, "value", { label: "Wave Amplitude", min: 0, max: 5, step: 0.1 });
  }
  var fogFolder = addDebugFolder("Fog");
  if (fogFolder && scene.fog) {
    addDebugBinding(fogFolder, scene.fog, "density", { label: "Fog Density", min: 0, max: 0.05, step: 0.001 });
  }
  var rendererFolder = addDebugFolder("Renderer");
  if (rendererFolder) {
    addDebugBinding(rendererFolder, { backend: rendererRuntime.backend }, "backend", { readonly: true, label: "Backend" });
  }
});

var ship = null;
var weapons = null;
var abilityState = null;
var selectedClass = null;
var gameFrozen = true;
var cardPickerOpen = false;
var gameStarted = false;
var activeBoss = null;
var crewSwapOpen = false;
var techScreenOpen = false;
var portScreenOpen = false;
var mapState = loadMapState();
var activeZoneId = null;
var activeTerrain = null;
var resources = createResources();
var pickupMgr = createPickupManager();
pickupMgr.onWeaponUpgrade = function (weaponKey) {
  if (!weapons || !weapons.weaponTiers) return;
  var tier = weapons.weaponTiers[weaponKey] || 0;
  if (tier < 2) {
    weapons.weaponTiers[weaponKey] = tier + 1;
    var cfg = getEffectiveConfig(weaponKey, tier + 1);
    showBanner((cfg.name || weaponKey) + " Upgraded!", 3);
    saveRun({ weaponTiers: weapons.weaponTiers });
  }
};
var portMgr = createPortManager();
var crateMgr = createCrateManager();
var merchantMgr = createMerchantManager();
var enemyMgr = createEnemyManager();
var droneMgr = createDroneManager();
var upgrades = createUpgradeState();
createCardPicker();
var crew = createCrewState();
var crewPickupMgr = createCrewPickupManager();
createCrewSwap();
var techState = loadTechState();
createTechScreen();
createPortScreen();
var infamyState = loadInfamy();
createInfamyScreen();
createMainMenu();
updateLoadingBar(50, "Systems ready...");

setOnDeathCallback(enemyMgr, function (x, y, z, faction) {
  spawnPickup(pickupMgr, x, y, z, scene);
  if (faction === "merchant") {
    spawnPickup(pickupMgr, x, y, z, scene); // extra drop for merchants
  }
  // rare crew pickup drop (~5%)
  if (nextRandom() < 0.05) {
    var dropOfficer = generateOfficerReward(1);
    spawnCrewPickup(crewPickupMgr, x, 0, z, scene, dropOfficer);
  }
  // rare weapon upgrade drop (~10%)
  if (weapons && nextRandom() < 0.10) {
    var upgradeKey = rollWeaponUpgradeKey(weapons.weaponTiers);
    if (upgradeKey) spawnWeaponUpgradePickup(pickupMgr, x, 0, z, scene, upgradeKey);
  }
  var techB = getTechBonuses(techState);
  var factionMult = getFactionGoldMult(faction);
  var lootMult = 1;
  if (activeTerrain && activeTerrain.getDensityAt) {
    lootMult = activeTerrain.getDensityAt(x, z).lootMult;
  }
  var gld = Math.round(GOLD_PER_KILL * factionMult * (1 + techB.salvageBonus) * lootMult);
  addGold(upgrades, gld);
  runEnemiesSunk++;
  runGoldLooted += gld;
  playExplosion();
  playKillConfirm();
  var killText = (mpState.username || "You") + " destroyed enemy  +" + gld + " gold";
  addKillFeedEntry(killText, "#ffcc44");
  triggerScreenShake(0.3);
  // Broadcast kill to other players
  if (isMultiplayerActive(mpState)) {
    sendKillFeedEntry(mpState, killText, "#ffcc44");
  }
});

setOnHitCallback(enemyMgr, function (x, y, z, dmg) {
  playHitConfirm();
  // project 3D position to screen for floating numbers
  if (!cam || !cam.camera) return;
  var pos = new THREE.Vector3(x, y + 1.5, z);
  pos.project(cam.camera);
  var sx = (pos.x * 0.5 + 0.5) * window.innerWidth;
  var sy = (-pos.y * 0.5 + 0.5) * window.innerHeight;
  if (pos.z > 0 && pos.z < 1) {
    showFloatingNumber(sx, sy, "-" + dmg, "#ffcc44");
  }
});

var waveMgr = createWaveManager();
initInput(renderer.domElement);
initMobileControls();
createHUD();
createWorldDebugView();

var audioUnlockHandler = function () {
  unlockAudio();
  ["click", "touchstart", "keydown"].forEach(function (e) { window.removeEventListener(e, audioUnlockHandler); });
};
["click", "touchstart", "keydown"].forEach(function (e) { window.addEventListener(e, audioUnlockHandler); });
setMuteCallback(function () { updateMuteButton(toggleMute()); });
setVolumeCallback(function (vol) { setMasterVolume(vol); });

setAbilityBarCallback(function (slotIndex) {
  if (gameFrozen || !weapons) return;
  if (slotIndex < 3) {
    // Q/W/E = weapon switch + fire
    switchWeapon(weapons, slotIndex);
    playClick();
    var mults = buildCombinedMults(upgrades, getCrewBonuses(crew), getTechBonuses(techState));
    fireWithSound(weapons, scene, resources, mults);
  } else {
    // R = class ability
    if (!abilityState) return;
    playClick();
    var activated = activateAbility(abilityState);
    if (activated) {
      var mults2 = buildCombinedMults(upgrades, getCrewBonuses(crew), getTechBonuses(techState));
      if (selectedClass === "cruiser") {
        for (var bs = 0; bs < 3; bs++) {
          fireWithSound(weapons, scene, resources, mults2);
          weapons.cooldown = 0;
        }
      } else if (selectedClass === "carrier") {
        spawnDrone(droneMgr, ship.posX, ship.posZ, scene, 15);
      }
    }
  }
});
setSettingsDataCallback(function (data) { updateSettingsData(data); });

initHealthBars();
createBossHud();
var cam = createCamera(window.innerWidth / window.innerHeight);
createMapScreen();
createShipSelectScreen();

// --- settings menu ---
createSettingsMenu({
  onMute: function () { updateMuteButton(toggleMute()); },
  onVolume: function (vol) { setMasterVolume(vol); },
  onNewGame: function () {
    gameFrozen = true;
    gameStarted = false;
    clearCombatTarget();
    resetWaveManager(waveMgr);
    resetResources(resources);
    resetEnemyManager(enemyMgr, scene);
    resetUpgrades(upgrades);
    upgrades.gold = 0;
    resetDrones(droneMgr, scene);
    resetCrew(crew);
    clearRemoteShips(scene);
    resetSendState();
    resetCombatSync();
    if (activeBoss) { removeBoss(activeBoss, scene); activeBoss = null; setNavBoss(null); }
    hideBossHud();
    clearPorts(portMgr, scene);
    clearCrates(crateMgr, scene);
    clearMerchants(merchantMgr, scene);
    if (activeTerrain) { removeTerrain(activeTerrain, scene); activeTerrain = null; }
    if (weapons) { weapons.activeWeapon = 0; weapons.projectiles = []; weapons.effects = []; weapons.cooldown = 0; }
    cardPickerOpen = false; crewSwapOpen = false; techScreenOpen = false; portScreenOpen = false;

    setWeather(weather, "calm");
    hideCardPicker(); hideCrewSwap(); hideTechScreen(); hidePortScreen(); hideOverlay(); hideInfamyScreen();
    if (isMultiplayerActive(mpState)) { leaveRoom(mpState); mpReady = false; }
    mapState = resetMapState();
    clearRunState();
    resetTechState(techState);
    techState = loadTechState();
    selectedClass = null;
    showMainMenu(startNewRun, null, false);
  }
});

// --- service worker registration ---
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(function () {});
}

// --- mobile: orientation prompt + quality change handler ---
createOrientationPrompt();
onQualityChange(function () {
  var cfg = getQualityConfig();
  rendererRuntime.setQualityPixelRatio(cfg);
  ocean.uniforms.uShaderDetail.value = cfg.shaderDetail;
  if (ocean.uniforms.__setQualityHint) {
    ocean.uniforms.__setQualityHint(getWaterQualityHint(cfg));
  }
  rebuildOceanForQuality(ocean, cfg);
});

// --- multiplayer ---
var mpState = createMultiplayerState();
var mpReady = false;
createLobbyScreen();
initRemoteLabels();

// Set pickup collection callback for multiplayer sync
setPickupCollectCallback(pickupMgr, function (index) {
  if (isMultiplayerActive(mpState)) {
    sendPickupClaim(mpState, index);
  }
});

// Crew pickup collection callback (single-player or after multiplayer confirmation)
function applyCrewOfficer(officer) {
  if (isCrewFull(crew)) {
    crewSwapOpen = true;
    showCrewSwap(crew.roster, officer, function (choice) {
      crewSwapOpen = false;
      if (choice.action === "swap") {
        removeOfficer(crew, choice.replaceId);
        autoAssignOfficer(crew, choice.newOfficer);
        showBanner("Officer swapped: " + choice.newOfficer.portrait + " " + choice.newOfficer.name, 3);
      }
    });
  } else {
    var station = autoAssignOfficer(crew, officer);
    var stationText = station ? " \u2192 " + station : "";
    showBanner("Officer recruited: " + officer.portrait + " " + officer.name + stationText, 3);
  }
}

setCrewPickupCallback(crewPickupMgr, function (officer) {
  applyCrewOfficer(officer);
});

// Multiplayer crew pickup claim: instead of immediately collecting, broadcast claim to host
setCrewPickupClaimCallback(crewPickupMgr, function (index, officer) {
  if (isMultiplayerActive(mpState)) {
    sendCrewPickupClaim(mpState, index);
    // Remove mesh locally — host will confirm and other clients will remove theirs
    var p = crewPickupMgr.pickups[index];
    if (p && p.mesh && p.mesh.parent) p.mesh.parent.remove(p.mesh);
    // Speculatively award the officer locally (host-confirmed removal will suppress double-award)
    applyCrewOfficer(officer);
  } else {
    // Single-player fallback (shouldn't normally reach here)
    var sp = crewPickupMgr.pickups[index];
    if (sp && sp.mesh && sp.mesh.parent) sp.mesh.parent.remove(sp.mesh);
    applyCrewOfficer(officer);
  }
});

// inject multiplayer button into ship select overlay directly
createMultiplayerButton(getShipSelectOverlay(), function () {
  hideShipSelectScreen();
  showLobbyChoice(mpState.username);
});

setLobbyCallbacks({
  onCreate: function () {
    createRoom(mpState, selectedClass || "cruiser").then(function (code) {
      showLobby(code, true);
      updatePlayerList(mpState.players, mpState.playerId);
    });
  },
  onJoin: function (code) {
    joinRoom(mpState, code, selectedClass || "cruiser").then(function () {
      showLobby(mpState.roomCode, false);
      updatePlayerList(mpState.players, mpState.playerId);
      // Also broadcast rejoin request — if game is in progress, host will respond
      // with rejoin_state and we'll jump into the game. If still in lobby, nothing happens.
      broadcast(mpState, {
        type: "player_rejoin",
        id: mpState.playerId,
        username: mpState.username,
        shipClass: selectedClass || "cruiser"
      });
    });
  },
  onReady: function () {
    mpReady = !mpReady;
    setReady(mpState, mpReady);
    updateReadyButton(mpReady);
  },
  onStart: function () {
    if (mpState.isHost) {
      var started = startGame(mpState);
      if (started) {
        hideLobbyScreen();
        startMultiplayerCombat();
      }
    }
  },
  onClassChange: function (key) {
    selectedClass = key;
    setShipClass(mpState, key);
  },
  onUsernameChange: function (name) {
    setUsername(mpState, name);
  },
  onBack: function () {
    leaveRoom(mpState);
    hideLobbyScreen();
    showMainMenu(startNewRun, null, false);
  }
});

// Update lobby when players change
mpState.onPlayersChanged = function () {
  updatePlayerList(mpState.players, mpState.playerId);
  updateStartButton(mpState.isHost && allPlayersReady(mpState) && getPlayerCount(mpState) > 1);
};

// Handle broadcast messages
mpState.onBroadcast = function (msg) {
  if (msg.type === "game_start") {
    mpState.gameStarted = true;
    mpState.terrainSeed = msg.terrainSeed;
    mpState.hostId = msg.hostId;
    hideLobbyScreen();
    startMultiplayerCombat();
    return;
  }
  // Host migration confirmation from new host
  if (msg.type === "host_migrated") {
    mpState.hostId = msg.newHostId;
    if (msg.newHostId !== mpState.playerId) {
      // We are not the new host — update our hostId reference
      mpState.isHost = false;
    }
    return;
  }
  // Player rejoin request — host sends current game state (only during active game)
  if (msg.type === "player_rejoin" && mpState.isHost && gameStarted) {
    var rejoinId = msg.id;
    var rejoinName = msg.username || "Player";
    addKillFeedEntry(rejoinName + " rejoined!", "#44dd66");
    sendKillFeedEntry(mpState, rejoinName + " rejoined!", "#44dd66");
    // Build enemy snapshot for rejoining player
    var enemySnap = [];
    for (var ei = 0; ei < enemyMgr.enemies.length; ei++) {
      var en = enemyMgr.enemies[ei];
      if (!en.alive && !en.sinking) continue;
      enemySnap.push({
        id: ei, x: en.posX, z: en.posZ, h: en.heading,
        hp: en.hp, maxHp: en.maxHp, alive: en.alive, sinking: en.sinking, faction: en.faction
      });
    }
    // Build boss snapshot
    var bossSnap = null;
    if (activeBoss && activeBoss.alive) {
      bossSnap = {
        type: activeBoss.type, x: activeBoss.posX, z: activeBoss.posZ,
        h: activeBoss.heading, hp: activeBoss.hp, maxHp: activeBoss.maxHp,
        phase: activeBoss.phase
      };
    }
    broadcast(mpState, {
      type: "rejoin_state",
      targetId: rejoinId,
      terrainSeed: mpState.terrainSeed,
      wave: waveMgr.wave,
      waveState: waveMgr.state,
      weather: weather.current,
      timeOfDay: Math.round(dayNight.timeOfDay * 10000) / 10000,
      enemies: enemySnap,
      boss: bossSnap,
      hostId: mpState.playerId
    });
    return;
  }
  // Receive rejoin state from host (only if targeted at us)
  if (msg.type === "rejoin_state" && msg.targetId === mpState.playerId) {
    mpState.terrainSeed = msg.terrainSeed;
    mpState.hostId = msg.hostId;
    mpState.isHost = false;
    hideLobbyScreen();
    startMultiplayerCombat();
    // Restore wave state from host
    waveMgr.wave = msg.wave || 1;
    waveMgr.state = msg.waveState || "ACTIVE";
    waveMgr.currentConfig = waveMgr.configs[Math.min(waveMgr.wave - 1, waveMgr.configs.length - 1)];
    // Restore weather and day/night
    if (msg.weather) setWeather(weather, msg.weather);
    if (msg.timeOfDay !== undefined) setTimeOfDay(dayNight, msg.timeOfDay);
    // Restore boss
    if (msg.boss && !activeBoss) {
      activeBoss = createBoss(msg.boss.type, msg.boss.x, msg.boss.z, scene, 1);
      if (activeBoss) {
        activeBoss.hp = msg.boss.hp;
        activeBoss.maxHp = msg.boss.maxHp;
        activeBoss.phase = msg.boss.phase;
        setNavBoss(activeBoss);
        showBossHud(activeBoss.def.name);
      }
    }
    showBanner("Rejoined!", 2);
    addKillFeedEntry("Rejoined the game", "#44dd66");
    return;
  }
  // Let netSync handle ship_state and fire visuals
  if (msg.type === "ship_state" || msg.type === "fire") {
    handleBroadcastMessage(msg, scene, mpState);
    return;
  }
  // Enemy state from host — apply positions on non-host clients
  if (msg.type === "enemy_state" && !mpState.isHost) {
    applyEnemyStateFromHost(msg, enemyMgr, scene);
    return;
  }
  // Combat sync messages
  var combat = handleCombatMessage(msg);
  if (combat) {
    processCombatAction(combat);
    return;
  }
  // Legacy pickup_claim (backwards compat)
  if (msg.type === "pickup_claim") {
    if (pickupMgr.pickups && msg.index < pickupMgr.pickups.length) {
      var claimed = pickupMgr.pickups[msg.index];
      if (claimed && !claimed.collected) {
        claimed.collected = true;
        scene.remove(claimed.mesh);
      }
    }
  }
};

function processCombatAction(action) {
  if (action.action === "apply_hit") {
    // Remote player hit an enemy or boss — apply damage locally
    if (action.targetType === "enemy") {
      var enemy = enemyMgr.enemies[action.targetId];
      if (enemy && enemy.alive) {
        damageEnemy(enemyMgr, enemy, scene, action.damage);
      }
    } else if (action.targetType === "boss" && activeBoss && activeBoss.alive) {
      damageBoss(activeBoss, action.damage, scene);
    }
  } else if (action.action === "enemy_death") {
    // Host reports enemy death — trigger visual on clients
    var deadEnemy = enemyMgr.enemies[action.enemyId];
    if (deadEnemy && deadEnemy.alive) {
      deadEnemy.alive = false;
      deadEnemy.sinking = true;
      deadEnemy.sinkTimer = 0;
    }
  } else if (action.action === "update_boss" && !mpState.isHost) {
    // Non-host: update boss position/state from host
    if (activeBoss) {
      activeBoss.posX = action.x;
      activeBoss.posZ = action.z;
      activeBoss.heading = action.h;
      activeBoss.hp = action.hp;
      activeBoss.maxHp = action.maxHp;
      activeBoss.phase = action.phase;
      activeBoss.mesh.position.x = action.x;
      activeBoss.mesh.position.z = action.z;
      activeBoss.mesh.rotation.y = action.h;
    }
  } else if (action.action === "spawn_boss" && !mpState.isHost) {
    // Non-host: spawn boss locally when host signals
    if (!activeBoss) {
      activeBoss = createBoss(action.bossType, action.x, action.z, scene, 1);
      if (activeBoss) {
        setNavBoss(activeBoss);
        showBossHud(activeBoss.def.name);
        showBanner("BOSS: " + activeBoss.def.name + "!", 4);
      }
    }
  } else if (action.action === "boss_defeated") {
    // Boss defeated on all clients
    if (activeBoss && activeBoss.alive) {
      activeBoss.hp = 0;
      activeBoss.alive = false;
      activeBoss.sinking = true;
      activeBoss.sinkTimer = 0;
      activeBoss.defeated = true;
    }
  } else if (action.action === "wave_event" && !mpState.isHost) {
    // Non-host: sync wave state from host
    if (action.event === "wave_start") {
      waveMgr.wave = action.wave || waveMgr.wave;
      waveMgr.state = "SPAWNING";
      var faction = action.faction || "pirate";
      showBanner(getFactionAnnounce(faction), 3);
      addKillFeedEntry("Wave " + waveMgr.wave + " — " + getFactionAnnounce(faction), "#44aaff");
      playWaveHorn();
    } else if (action.event === "wave_start_boss") {
      waveMgr.wave = action.wave || waveMgr.wave;
      waveMgr.state = "ACTIVE";
      // Boss spawn handled by boss_spawn message
    } else if (action.event === "wave_complete") {
      waveMgr.state = "WAVE_COMPLETE";
      showBanner("Fleet " + (action.wave || waveMgr.wave) + " defeated!", 2.5);
      addKillFeedEntry("Fleet " + (action.wave || waveMgr.wave) + " defeated!", "#44dd66");
      clearPickups(pickupMgr, scene);
      clearCrates(crateMgr, scene);
      clearMerchants(merchantMgr, scene);
      if (activeBoss) {
        removeBoss(activeBoss, scene);
        activeBoss = null;
        setNavBoss(null);
        hideBossHud();
      }
      // Show card picker (each player upgrades independently)
      if (waveMgr.wave < waveMgr.maxWave) {
        var mpWaveCards = generateUpgradeCards(upgrades, 3);
        if (mpWaveCards.length > 0) {
          cardPickerOpen = true;
          fadeGameAudio();
          showCardPicker(mpWaveCards, function (picked) {
            applyFreeUpgrade(upgrades, picked.key);
            applyUpgrades();
            cardPickerOpen = false;
            resumeGameAudio();
          });
        }
      }
    } else if (action.event === "game_over") {
      lastZoneResult = "game_over";
      gameFrozen = true;
      upgrades.gold = 0;
      hideBossHud();
      var mpGoData = awardRunInfamy("defeat");
      fadeOut(0.4, function () {
        showInfamyScreen(mpGoData, function () {
          showGameOver(action.wave || waveMgr.wave);
        });
        fadeIn(0.4);
      });
    } else if (action.event === "victory") {
      lastZoneResult = "victory";
      gameFrozen = true;
      hideBossHud();
      var mpVicData = awardRunInfamy("victory");
      fadeOut(0.4, function () {
        showInfamyScreen(mpVicData, function () {
          showVictory(action.wave || waveMgr.wave);
        });
        fadeIn(0.4);
      });
    }
  } else if (action.action === "weather_change") {
    // Sync weather from host
    setWeather(weather, action.weather);
  } else if (action.action === "weather_sync" && !mpState.isHost) {
    // Periodic weather + day/night correction from host
    if (action.weather && action.weather !== weather.current) {
      setWeather(weather, action.weather);
    }
    if (action.timeOfDay !== undefined) {
      setTimeOfDay(dayNight, action.timeOfDay);
    }
  } else if (action.action === "pickup_claim") {
    // Remove picked-up pickup on other clients
    if (pickupMgr.pickups && action.index < pickupMgr.pickups.length) {
      var claimedP = pickupMgr.pickups[action.index];
      if (claimedP && !claimedP.collected) {
        claimedP.collected = true;
        scene.remove(claimedP.mesh);
      }
    }
  } else if (action.action === "crew_pickup_claim") {
    // Host arbitrates crew pickup claims — first claimer wins
    if (mpState.isHost) {
      var crewIdx = action.index;
      var cp = crewPickupMgr.pickups[crewIdx];
      if (cp && !cp._claimed) {
        cp._claimed = true;
        sendCrewPickupConfirmed(mpState, crewIdx, action.senderId);
      }
    }
  } else if (action.action === "crew_pickup_confirmed") {
    // All clients: remove the pickup; only the confirmed player already collected
    var confIdx = action.index;
    var confP = crewPickupMgr.pickups[confIdx];
    if (confP && !confP._hostConfirmed) {
      confP._hostConfirmed = true;
      if (confP.mesh && confP.mesh.parent) confP.mesh.parent.remove(confP.mesh);
      confP.collected = true;
    }
  } else if (action.action === "kill_feed") {
    // Show kill feed entry from other player
    addKillFeedEntry(action.text, action.color || "#ffffff");
  } else if (action.action === "game_over" && !mpState.isHost) {
    lastZoneResult = "game_over";
    gameFrozen = true;
    upgrades.gold = 0;
    hideBossHud();
    var remGoData = awardRunInfamy("defeat");
    fadeOut(0.4, function () {
      showInfamyScreen(remGoData, function () {
        showGameOver(action.wave || waveMgr.wave);
      });
      fadeIn(0.4);
    });
  } else if (action.action === "victory" && !mpState.isHost) {
    lastZoneResult = "victory";
    gameFrozen = true;
    hideBossHud();
    var remVicData = awardRunInfamy("victory");
    fadeOut(0.4, function () {
      showInfamyScreen(remVicData, function () {
        showVictory(action.wave || waveMgr.wave);
      });
      fadeIn(0.4);
    });
  }
}


mpState.onDisconnect = function (playerId, username) {
  var name = username || "Player";
  addKillFeedEntry(name + " disconnected", "#cc6644");
  // Start graceful ship fade-out
  fadeRemoteShip(playerId);
  // Broadcast disconnect notice to others
  if (isMultiplayerActive(mpState)) {
    sendKillFeedEntry(mpState, name + " disconnected", "#cc6644");
  }
};

mpState.onHostMigrated = function (newHostId) {
  if (newHostId === mpState.playerId) {
    showBanner("HOST MIGRATION", 2);
    addKillFeedEntry("Host migrated to you — taking over", "#ffcc44");
    // New host immediately starts running enemy AI / boss / wave / weather
    // No explicit state transfer needed — new host already has synced enemy positions
    // and wave state from being a client. The host flag switch in multiplayer.js
    // means sendEnemyState/sendBossState will now fire from this client.
  } else {
    showBanner("HOST MIGRATION", 2);
    addKillFeedEntry("New host: " + (mpState.players[newHostId] ? mpState.players[newHostId].username : "Player"), "#ffcc44");
  }
};

function startMultiplayerCombat() {
  runEnemiesSunk = 0;
  runGoldLooted = 0;
  runZonesReached = 1;
  clearCombatTarget();
  // Use the first zone for multiplayer, with shared terrain seed
  selectedClass = mpState.players[mpState.playerId].shipClass || selectedClass || "cruiser";
  var classCfg = getShipClass(selectedClass);
  setMerchantPlayerSpeed(merchantMgr, classCfg.stats.maxSpeed);
  resetWaveManager(waveMgr, null, 1);
  resetResources(resources);
  resetEnemyManager(enemyMgr, scene);
  resetUpgrades(upgrades);
  resetDrones(droneMgr, scene);
  resetCrew(crew);
  clearRemoteShips(scene);
  resetSendState();
  if (activeBoss) { removeBoss(activeBoss, scene); activeBoss = null; setNavBoss(null); }
  hideBossHud();
  if (activeTerrain) { removeTerrain(activeTerrain, scene); activeTerrain = null; }
  // Seed PRNG from shared terrain seed for deterministic simulation
  var seed = mpState.terrainSeed || Math.floor(Math.random() * 999999);
  seedRNG(seed);
  activeTerrain = createTerrain(seed, 2);
  scene.add(activeTerrain.mesh);
  showLoadingScreen("Generating world...");
  updateLoadingBar(5, "Generating world...");
  var _totalChunks = activeTerrain.initialChunkCount || 1;
  var _readyChunks = 0;
  activeTerrain.onChunkReady = function () {
    _readyChunks++;
    updateLoadingBar(Math.round((_readyChunks / _totalChunks) * 100), "Generating world...");
  };
  Promise.all([activeTerrain.initialReady, preloadTerrainModels()]).then(function () {
    activeTerrain.onChunkReady = null;
    hideLoadingScreen();
  });
  var mpPortRoleContext = { zoneId: "multiplayer", condition: "calm", difficulty: 2 };
  currentRoleContext = mpPortRoleContext;
  clearPorts(portMgr, scene);
  initPorts(portMgr, activeTerrain, scene, mpPortRoleContext);
  clearCrates(crateMgr, scene);
  clearMerchants(merchantMgr, scene);
  setPickupRoleContext(pickupMgr, mpPortRoleContext);
  if (ship && ship.mesh) scene.remove(ship.mesh);
  ship = createShip(classCfg);
  scene.add(ship.mesh);
  setPlayerMaxHp(enemyMgr, classCfg.stats.hp);
  setPlayerHp(enemyMgr, classCfg.stats.hp);
  setPlayerArmor(enemyMgr, classCfg.stats.armor);
  weapons = createWeaponState(ship);
  setWeaponHitCallback(weapons, function (targetType, targetId, damage) {
    sendHitEvent(mpState, targetType, targetId, damage);
  });
  abilityState = createAbilityState(selectedClass);
  initNav(cam.camera, ship, scene, enemyMgr, activeTerrain, portMgr);
  resetDrones(droneMgr, scene);
  setWeather(weather, "calm");
  setTimeOfDay(dayNight, 0.35);
  setSailClass(selectedClass);
  gameFrozen = false;
  gameStarted = true;
  cardPickerOpen = false;
  activeZoneId = null;
  fadeIn(0.6);
  showBanner("Multiplayer — Fleet Approaching!", 3);
}

function initBossZones() {
  bossZones = [
    { x: 300, z: 300, type: "battleship", difficulty: 2, defeated: false, label: "Pirate Stronghold" },
    { x: -400, z: 200, type: "battleship", difficulty: 3, defeated: false, label: "Navy Blockade" },
    { x: 0, z: -500, type: "kraken", difficulty: 4, defeated: false, label: "Kraken's Lair" },
    { x: 500, z: -300, type: "carrier", difficulty: 5, defeated: false, label: "Armada Flagship" }
  ];
  bossZonesInitialized = true;
}

function updatePatrolSpawning(dt) {
  if (!ship || !gameStarted || gameFrozen) return;
  if (waveMgr && waveMgr.maxWave > 0) return; // in boss combat, skip patrol spawning
  patrolSpawnTimer -= dt;
  if (patrolSpawnTimer > 0) return;
  patrolSpawnTimer = PATROL_SPAWN_INTERVAL;

  var aliveCount = 0;
  for (var i = 0; i < enemyMgr.enemies.length; i++) {
    if (enemyMgr.enemies[i].alive && !enemyMgr.enemies[i].ambient) aliveCount++;
  }
  if (aliveCount >= PATROL_MAX_ENEMIES) return;

  var distFromOrigin = Math.sqrt(ship.posX * ship.posX + ship.posZ * ship.posZ);
  var difficultyScale = Math.min(6, 1 + Math.floor(distFromOrigin / 200));

  var faction = "pirate";
  if (distFromOrigin > 600) faction = (nextRandom() < 0.5) ? "pirate" : "navy";
  else if (distFromOrigin > 300) faction = nextRandom() < 0.6 ? "pirate" : "navy";

  var angle = nextRandom() * Math.PI * 2;
  var spawnDist = PATROL_SPAWN_RADIUS * (0.8 + nextRandom() * 0.4);
  var spawnX = ship.posX + Math.cos(angle) * spawnDist;
  var spawnZ = ship.posZ + Math.sin(angle) * spawnDist;

  var waveConfig = {
    hpMult: 1.0 + (difficultyScale - 1) * 0.2,
    speedMult: 1.0 + (difficultyScale - 1) * 0.05,
    fireRateMult: 1.0 + (difficultyScale - 1) * 0.1,
    faction: faction
  };
  spawnEnemy(enemyMgr, spawnX, spawnZ, scene, waveConfig, activeTerrain, currentRoleContext);
}

function despawnDistantEnemies() {
  if (!ship) return;
  for (var i = 0; i < enemyMgr.enemies.length; i++) {
    var e = enemyMgr.enemies[i];
    if (!e.alive || e.ambient) continue;
    var dx = e.posX - ship.posX;
    var dz = e.posZ - ship.posZ;
    if (dx * dx + dz * dz > PATROL_DESPAWN_RADIUS * PATROL_DESPAWN_RADIUS) {
      e.alive = false;
      if (e.mesh) scene.remove(e.mesh);
    }
  }
}

function checkBossZoneEntry() {
  if (!ship || !gameStarted || gameFrozen) return;
  if (activeBoss && activeBoss.alive) return;
  if (waveMgr && waveMgr.maxWave > 0) return; // already in wave combat

  for (var i = 0; i < bossZones.length; i++) {
    var zone = bossZones[i];
    if (zone.defeated || zone._active) continue;
    var dx = ship.posX - zone.x;
    var dz = ship.posZ - zone.z;
    if (dx * dx + dz * dz < BOSS_ZONE_RADIUS * BOSS_ZONE_RADIUS) {
      activeBoss = createBoss(zone.type, zone.x, zone.z, scene, zone.difficulty);
      if (activeBoss) {
        setNavBoss(activeBoss);
        showBossHud(activeBoss.def.name);
        showBanner("BOSS: " + zone.label + "!", 4);
        playWaveHorn();
        triggerScreenShake(0.8);
        var bossWaves = [
          { wave: 1, enemies: 2 + zone.difficulty, hpMult: 1.0 + zone.difficulty * 0.2, speedMult: 1.0, fireRateMult: 1.0, faction: "pirate" },
          { wave: 2, enemies: 1 + Math.floor(zone.difficulty / 2), hpMult: 1.0 + zone.difficulty * 0.3, speedMult: 1.1, fireRateMult: 1.1, faction: "navy", boss: zone.type, bossDifficulty: zone.difficulty }
        ];
        resetWaveManager(waveMgr, bossWaves);
        zone._active = true;
      }
      return;
    }
  }
}

function handleShipSelect(classKey) {
  selectedClass = classKey;
  hideShipSelectScreen();
  startOpenWorld(classKey);
}

function startOpenWorld(classKey) {
  runEnemiesSunk = 0;
  runGoldLooted = 0;
  runZonesReached = 0;
  clearCombatTarget();
  var classCfg = getShipClass(classKey);
  setMerchantPlayerSpeed(merchantMgr, classCfg.stats.maxSpeed);
  resetResources(resources);
  resetEnemyManager(enemyMgr, scene);
  resetUpgrades(upgrades);
  resetDrones(droneMgr, scene);
  resetCrew(crew);
  if (activeBoss) { removeBoss(activeBoss, scene); activeBoss = null; setNavBoss(null); }
  hideBossHud();
  if (activeTerrain) { removeTerrain(activeTerrain, scene); activeTerrain = null; }

  var worldSeed = Date.now() + Math.floor(Math.random() * 10000);
  seedRNG(worldSeed);
  activeTerrain = createTerrain(worldSeed, 3);
  scene.add(activeTerrain.mesh);
  showLoadingScreen("Generating world...");
  updateLoadingBar(5, "Generating world...");
  var _totalChunks = activeTerrain.initialChunkCount || 1;
  var _readyChunks = 0;
  activeTerrain.onChunkReady = function () {
    _readyChunks++;
    updateLoadingBar(Math.round((_readyChunks / _totalChunks) * 100), "Generating world...");
  };
  Promise.all([activeTerrain.initialReady, preloadTerrainModels()]).then(function () {
    activeTerrain.onChunkReady = null;
    hideLoadingScreen();
  });

  var worldRoleContext = {
    zoneId: "open_world",
    condition: "calm",
    difficulty: 3
  };
  currentRoleContext = worldRoleContext;
  clearPorts(portMgr, scene);
  initPorts(portMgr, activeTerrain, scene, worldRoleContext);
  clearCrates(crateMgr, scene);
  clearMerchants(merchantMgr, scene);
  setPickupRoleContext(pickupMgr, worldRoleContext);

  if (ship && ship.mesh) scene.remove(ship.mesh);
  ship = createShip(classCfg);
  scene.add(ship.mesh);
  setPlayerMaxHp(enemyMgr, classCfg.stats.hp);
  setPlayerHp(enemyMgr, classCfg.stats.hp);
  setPlayerArmor(enemyMgr, classCfg.stats.armor);
  weapons = createWeaponState(ship);
  var savedRunTiers = loadRunState();
  if (savedRunTiers && savedRunTiers.weaponTiers) {
    weapons.weaponTiers = savedRunTiers.weaponTiers;
  }
  abilityState = createAbilityState(classKey);
  initNav(cam.camera, ship, scene, enemyMgr, activeTerrain, portMgr);
  resetDrones(droneMgr, scene);
  setWeather(weather, "calm");
  setTimeOfDay(dayNight, 0.35);
  setSailClass(classKey);
  gameFrozen = false;
  gameStarted = true;
  cardPickerOpen = false;
  activeZoneId = "open_world";
  // No waves until a boss zone is entered
  resetWaveManager(waveMgr, []);
  initBossZones();
  fadeIn(0.6);
  showBanner("Open Seas — Explore at Will!", 3);
}

// --- load save on startup ---
var savedGame = loadSave();
if (savedGame) {
  if (savedGame.mapState) mapState = savedGame.mapState;
  if (savedGame.techTree && savedGame.techTree.unlocked) techState = savedGame.techTree;
  if (savedGame.officers && savedGame.officers.roster) crew = savedGame.officers;
  if (savedGame.selectedClass) selectedClass = savedGame.selectedClass;
}

// --- main menu on startup ---
showMainMenu(startNewRun, null, false);

function startNewRun() {
  hideMainMenu();
  clearCombatTarget();
  clearRunState();
  runEnemiesSunk = 0;
  runGoldLooted = 0;
  runZonesReached = 0;
  resetUpgrades(upgrades);
  upgrades.gold = 0;
  resetCrew(crew);
  showShipSelectScreen(handleShipSelect, upgrades, infamyState);
}


function handleCityEvents(cityEvents) {
  if (!cityEvents || !cityEvents.length) return;
  var rewardGoldTotal = 0;
  for (var i = 0; i < cityEvents.length; i++) {
    var ev = cityEvents[i];
    if (!ev || !ev.type) continue;
    var cityName = ev.cityName || "Harbor City";
    var rewardGold = Math.max(0, Math.floor(Number(ev.rewardGold) || 0));
    if (ev.type === "city_warning") {
      showBanner("Hostile Batteries: " + cityName, 2.2);
    } else if (ev.type === "city_battery_destroyed") {
      showBanner("Battery Silenced — " + cityName + (rewardGold > 0 ? "  +" + rewardGold + " gold" : ""), 1.8);
      if (rewardGold > 0) {
        rewardGoldTotal += rewardGold;
        runGoldLooted += rewardGold;
        addKillFeedEntry(cityName + " battery destroyed +" + rewardGold + " gold", "#ffcc44");
      }
    } else if (ev.type === "city_pacified") {
      showBanner("City Pacified: " + cityName + (rewardGold > 0 ? "  +" + rewardGold + " gold" : ""), 2.8);
      if (rewardGold > 0) {
        rewardGoldTotal += rewardGold;
        runGoldLooted += rewardGold;
        addKillFeedEntry(cityName + " pacified +" + rewardGold + " gold", "#44dd66");
      }
    }
  }
  if (rewardGoldTotal > 0) {
    showFloatingNumber(window.innerWidth * 0.5, window.innerHeight * 0.45, "+" + rewardGoldTotal, "#ffcc44");
  }
}


function cleanupCombatScene() {
  clearCombatTarget();
  if (activeTerrain) { removeTerrain(activeTerrain, scene); activeTerrain = null; }
  resetEnemyManager(enemyMgr, scene);
  clearPorts(portMgr, scene);
  clearCrates(crateMgr, scene);
  clearMerchants(merchantMgr, scene);
  clearPickups(pickupMgr, scene);
  setPickupRoleContext(pickupMgr, null);
  clearCrewPickups(crewPickupMgr, scene);
  resetDrones(droneMgr, scene);
  if (activeBoss) { removeBoss(activeBoss, scene); activeBoss = null; setNavBoss(null); }
  currentRoleContext = null;
  hideBossHud();
}

function startZoneCombat(classKey, zoneId) {
  runEnemiesSunk = 0;
  runGoldLooted = 0;
  runZonesReached = (runZonesReached || 0) + 1;
  clearCombatTarget();
  var classCfg = getShipClass(classKey);
  setMerchantPlayerSpeed(merchantMgr, classCfg.stats.maxSpeed);
  var zone = getZone(zoneId);
  resetWaveManager(waveMgr, []);
  resetResources(resources);
  resetEnemyManager(enemyMgr, scene);
  resetUpgrades(upgrades);
  resetDrones(droneMgr, scene);
  resetCrew(crew);
  if (activeBoss) { removeBoss(activeBoss, scene); activeBoss = null; setNavBoss(null); }
  hideBossHud();
  if (activeTerrain) { removeTerrain(activeTerrain, scene); activeTerrain = null; }
  // generate terrain: seed from zone id hash, difficulty scales land coverage
  var terrainSeed = 0;
  for (var si = 0; si < zoneId.length; si++) terrainSeed += zoneId.charCodeAt(si) * (si + 1);
  terrainSeed += Math.floor(Math.random() * 10000);
  // Seed PRNG for deterministic simulation
  seedRNG(terrainSeed);
  activeTerrain = createTerrain(terrainSeed, zone.difficulty);
  scene.add(activeTerrain.mesh);
  showLoadingScreen("Generating world...");
  updateLoadingBar(5, "Generating world...");
  var _totalChunks = activeTerrain.initialChunkCount || 1;
  var _readyChunks = 0;
  activeTerrain.onChunkReady = function () {
    _readyChunks++;
    updateLoadingBar(Math.round((_readyChunks / _totalChunks) * 100), "Generating world...");
  };
  Promise.all([activeTerrain.initialReady, preloadTerrainModels()]).then(function () {
    activeTerrain.onChunkReady = null;
    hideLoadingScreen();
  });
  var zonePortRoleContext = {
    zoneId: zoneId,
    condition: zone.condition || "calm",
    difficulty: zone.difficulty
  };
  currentRoleContext = zonePortRoleContext;
  clearPorts(portMgr, scene);
  initPorts(portMgr, activeTerrain, scene, zonePortRoleContext);
  clearCrates(crateMgr, scene);
  clearMerchants(merchantMgr, scene);
  setPickupRoleContext(pickupMgr, zonePortRoleContext);
  if (ship && ship.mesh) scene.remove(ship.mesh);
  ship = createShip(classCfg);
  scene.add(ship.mesh);
  setPlayerMaxHp(enemyMgr, classCfg.stats.hp);
  setPlayerHp(enemyMgr, classCfg.stats.hp);
  setPlayerArmor(enemyMgr, classCfg.stats.armor);
  weapons = createWeaponState(ship);
  abilityState = createAbilityState(classKey);
  initNav(cam.camera, ship, scene, enemyMgr, activeTerrain, portMgr);
  resetDrones(droneMgr, scene);
  setWeather(weather, zone.condition === "stormy" ? "storm" : zone.condition || "calm");
  setSailClass(classKey);
  gameFrozen = false;
  gameStarted = true;
  cardPickerOpen = false;
  fadeIn(0.6);
  showBanner(zone.name + " — Fleet Approaching!", 3);
}


function awardRunInfamy(result) {
  var earned = calcRunInfamy(runGoldLooted, runEnemiesSunk, runZonesReached);
  addInfamy(infamyState, earned);
  return {
    goldLooted: runGoldLooted,
    enemiesSunk: runEnemiesSunk,
    zonesReached: runZonesReached,
    infamyEarned: earned,
    totalInfamy: infamyState.total,
    legendLevel: getLegendLevel(infamyState),
    legendProgress: getLegendProgress(infamyState),
    result: result
  };
}

function performAutoSave() {
  autoSave({
    zone: activeZoneId,
    selectedClass: selectedClass,
    upgrades: upgrades,
    techTree: techState,
    officers: crew,
    currency: upgrades ? upgrades.gold : 0,
    skins: [],
    mapState: mapState
  });
}

function applyUpgrades() {
  var m = getMultipliers(upgrades);
  setPlayerArmor(enemyMgr, m.armor + (getShipClass(selectedClass).stats.armor || 0));
  var baseMaxHp = getShipClass(selectedClass).stats.hp;
  var newMaxHp = Math.round(baseMaxHp * m.maxHp);
  var oldMaxHp = enemyMgr.playerMaxHp;
  setPlayerMaxHp(enemyMgr, newMaxHp);
  if (newMaxHp > oldMaxHp) {
    var hpGain = newMaxHp - oldMaxHp;
    setPlayerHp(enemyMgr, enemyMgr.playerHp + hpGain);
  }
}

function handleAbility(mults) {
  if (!abilityState || !selectedClass) return;
  if (selectedClass === "destroyer") {
    ship.speedBoostActive = abilityState.active;
  } else if (selectedClass === "submarine") {
    ship.diveActive = abilityState.active;
    if (abilityState.active) {
      ship.mesh.traverse(function (child) {
        if (child.isMesh && child.material) {
          child.material.transparent = true;
          child.material.opacity = 0.3;
        }
      });
      enemyMgr.playerArmor = 1.0;
    } else {
      ship.mesh.traverse(function (child) {
        if (child.isMesh && child.material) {
          child.material.transparent = false;
          child.material.opacity = 1.0;
        }
      });
      var classArmor = getShipClass(selectedClass).stats.armor || 0;
      var m = getMultipliers(upgrades);
      enemyMgr.playerArmor = m.armor + classArmor;
    }
  }
}

setRestartCallback(function () {
  gameFrozen = true;
  gameStarted = false;
  clearCombatTarget();
  resetWaveManager(waveMgr);
  resetResources(resources);
  resetEnemyManager(enemyMgr, scene);
  resetUpgrades(upgrades);
  upgrades.gold = 0;
  resetDrones(droneMgr, scene);
  resetCrew(crew);
  clearRemoteShips(scene);
  resetSendState();
  if (activeBoss) { removeBoss(activeBoss, scene); activeBoss = null; setNavBoss(null); }
  hideBossHud();
  clearPorts(portMgr, scene);
  clearCrates(crateMgr, scene);
  clearMerchants(merchantMgr, scene);
  if (activeTerrain) { removeTerrain(activeTerrain, scene); activeTerrain = null; }
  if (weapons) { weapons.activeWeapon = 0; weapons.projectiles = []; weapons.effects = []; weapons.cooldown = 0; }
  cardPickerOpen = false; crewSwapOpen = false; techScreenOpen = false; portScreenOpen = false;
  setWeather(weather, "calm");
  hideCardPicker(); hideCrewSwap(); hideTechScreen(); hidePortScreen(); hideOverlay(); hideInfamyScreen();
  clearRunState();
  if (isMultiplayerActive(mpState)) {
    leaveRoom(mpState);
    mpReady = false;
  }
  lastZoneResult = null;
  showMainMenu(startNewRun, null, false);
});

// Resize handler registered after ticker is created (see below)

var ROLLING_ORIGIN_THRESHOLD = 2200;
var ROLLING_ORIGIN_THRESHOLD_SQ = ROLLING_ORIGIN_THRESHOLD * ROLLING_ORIGIN_THRESHOLD;
var rollingOriginShifts = 0;

function shiftMeshXZ(mesh, shiftX, shiftZ) {
  if (!mesh) return;
  mesh.position.x -= shiftX;
  mesh.position.z -= shiftZ;
}

function shiftPosXZ(obj, shiftX, shiftZ) {
  if (!obj) return;
  if (obj.posX !== undefined) obj.posX -= shiftX;
  if (obj.posZ !== undefined) obj.posZ -= shiftZ;
  if (obj.x !== undefined) obj.x -= shiftX;
  if (obj.z !== undefined) obj.z -= shiftZ;
  if (obj.dockX !== undefined) obj.dockX -= shiftX;
  if (obj.dockZ !== undefined) obj.dockZ -= shiftZ;
  if (obj.cityAnchorX !== undefined) obj.cityAnchorX -= shiftX;
  if (obj.cityAnchorZ !== undefined) obj.cityAnchorZ -= shiftZ;
  shiftMeshXZ(obj.mesh, shiftX, shiftZ);
}

function applyRollingOriginShift(shiftX, shiftZ) {
  if ((!shiftX && !shiftZ) || !ship) return;

  // player + camera anchors
  ship.posX -= shiftX;
  ship.posZ -= shiftZ;
  if (ship.navTarget) {
    ship.navTarget.x -= shiftX;
    ship.navTarget.z -= shiftZ;
  }
  shiftMeshXZ(ship.mesh, shiftX, shiftZ);
  cam.target.x -= shiftX;
  cam.target.z -= shiftZ;
  cam.camera.position.x -= shiftX;
  cam.camera.position.z -= shiftZ;

  // enemies + projectiles + effects
  for (var ei = 0; ei < enemyMgr.enemies.length; ei++) {
    var en = enemyMgr.enemies[ei];
    shiftPosXZ(en, shiftX, shiftZ);
    if (en.tradeRoute) {
      if (en.tradeRoute.startX !== undefined) en.tradeRoute.startX -= shiftX;
      if (en.tradeRoute.startZ !== undefined) en.tradeRoute.startZ -= shiftZ;
      if (en.tradeRoute.endX !== undefined) en.tradeRoute.endX -= shiftX;
      if (en.tradeRoute.endZ !== undefined) en.tradeRoute.endZ -= shiftZ;
    }
    if (en.routeCenterX !== undefined) en.routeCenterX -= shiftX;
    if (en.routeCenterZ !== undefined) en.routeCenterZ -= shiftZ;
  }
  for (var ep = 0; ep < enemyMgr.projectiles.length; ep++) {
    var eproj = enemyMgr.projectiles[ep];
    shiftMeshXZ(eproj.mesh, shiftX, shiftZ);
    if (eproj.origin) {
      eproj.origin.x -= shiftX;
      eproj.origin.z -= shiftZ;
    }
  }
  for (var epa = 0; epa < enemyMgr.particles.length; epa++) shiftMeshXZ(enemyMgr.particles[epa].mesh, shiftX, shiftZ);
  for (var efe = 0; efe < (enemyMgr.effects || []).length; efe++) shiftMeshXZ(enemyMgr.effects[efe].mesh, shiftX, shiftZ);

  // player weapons and effects
  if (weapons) {
    for (var wp = 0; wp < weapons.projectiles.length; wp++) {
      var p = weapons.projectiles[wp];
      shiftMeshXZ(p.mesh, shiftX, shiftZ);
      if (p.origin) {
        p.origin.x -= shiftX;
        p.origin.z -= shiftZ;
      }
    }
    for (var we = 0; we < weapons.effects.length; we++) shiftMeshXZ(weapons.effects[we].mesh, shiftX, shiftZ);
  }

  // boss
  if (activeBoss) {
    shiftPosXZ(activeBoss, shiftX, shiftZ);
    for (var bp = 0; bp < activeBoss.projectiles.length; bp++) shiftMeshXZ(activeBoss.projectiles[bp].mesh, shiftX, shiftZ);
    for (var bt = 0; bt < activeBoss.telegraphs.length; bt++) shiftMeshXZ(activeBoss.telegraphs[bt].mesh, shiftX, shiftZ);
    for (var bd = 0; bd < activeBoss.droneSpawns.length; bd++) shiftPosXZ(activeBoss.droneSpawns[bd], shiftX, shiftZ);
    for (var bta = 0; bta < activeBoss.tentacleAttacks.length; bta++) shiftPosXZ(activeBoss.tentacleAttacks[bta], shiftX, shiftZ);
    for (var bfx = 0; bfx < activeBoss.effects.length; bfx++) shiftMeshXZ(activeBoss.effects[bfx].mesh, shiftX, shiftZ);
  }

  // pickups / crates / crew pickups
  for (var pi = 0; pi < pickupMgr.pickups.length; pi++) shiftPosXZ(pickupMgr.pickups[pi], shiftX, shiftZ);
  for (var ci = 0; ci < crateMgr.crates.length; ci++) shiftPosXZ(crateMgr.crates[ci], shiftX, shiftZ);
  for (var cpi = 0; cpi < crewPickupMgr.pickups.length; cpi++) shiftPosXZ(crewPickupMgr.pickups[cpi], shiftX, shiftZ);

  // ports
  for (var por = 0; por < portMgr.ports.length; por++) shiftPosXZ(portMgr.ports[por], shiftX, shiftZ);
  if (portMgr.cityProjectiles) {
    for (var cpp = 0; cpp < portMgr.cityProjectiles.length; cpp++) {
      var cp = portMgr.cityProjectiles[cpp];
      shiftMeshXZ(cp.mesh, shiftX, shiftZ);
      if (cp.origin) {
        cp.origin.x -= shiftX;
        cp.origin.z -= shiftZ;
      }
    }
  }

  // drones
  for (var dr = 0; dr < droneMgr.drones.length; dr++) shiftPosXZ(droneMgr.drones[dr], shiftX, shiftZ);
  for (var dp = 0; dp < droneMgr.projectiles.length; dp++) shiftMeshXZ(droneMgr.projectiles[dp].mesh, shiftX, shiftZ);

  // streamed terrain chunks
  if (activeTerrain) shiftTerrainOrigin(activeTerrain, shiftX, shiftZ);

  rollingOriginShifts++;
}

function maybeApplyRollingOrigin() {
  if (!ship || !activeTerrain || isMultiplayerActive(mpState)) return;
  var distSq = ship.posX * ship.posX + ship.posZ * ship.posZ;
  if (distSq < ROLLING_ORIGIN_THRESHOLD_SQ) return;
  var shiftX = Math.round(ship.posX);
  var shiftZ = Math.round(ship.posZ);
  applyRollingOriginShift(shiftX, shiftZ);
}

var ticker = createTicker();
var simElapsed = 0;

// Route resize through ticker event bus (folio-2025 pattern)
ticker.events.on("resize", function (width, height) {
  rendererRuntime.resize(width, height);
  resizeCamera(cam, width / height);
});
window.addEventListener("resize", function () {
  ticker.events.trigger("resize", window.innerWidth, window.innerHeight);
});

function buildWorldDebugSnapshot() {
  var terrainState = activeTerrain && activeTerrain.getDebugState ? activeTerrain.getDebugState() : null;
  var chunkSize = terrainState && terrainState.chunkSize ? terrainState.chunkSize : 400;
  var chunks = [];
  if (activeTerrain && activeTerrain.chunks && activeTerrain.chunks.forEach) {
    activeTerrain.chunks.forEach(function (chunk) {
      if (!chunk) return;
      chunks.push({
        key: chunk.key,
        cx: chunk.cx,
        cy: chunk.cy,
        state: chunk.state,
        ready: !!chunk.ready,
        placedModelCount: chunk.placedModelCount || 0,
        minimapMarkerCount: chunk.minimapMarkers ? chunk.minimapMarkers.length : 0
      });
    });
  }

  var markers = activeTerrain ? getTerrainMinimapMarkers(activeTerrain) : [];
  var enemies = [];
  for (var i = 0; i < enemyMgr.enemies.length; i++) {
    var e = enemyMgr.enemies[i];
    if (!e || !e.alive) continue;
    enemies.push({ x: e.posX, z: e.posZ });
  }

  return {
    chunkSize: chunkSize,
    simElapsed: simElapsed,
    player: ship ? { x: ship.posX, z: ship.posZ, heading: ship.heading } : null,
    chunks: chunks,
    markers: markers,
    enemies: enemies,
    terrain: terrainState
  };
}

function runFrame(dt) {
  dt = Math.min(dt || 0, 0.1);
  simElapsed += dt;
  updateTimeUniforms(dt, simElapsed);
  updateDebugFPS(dt);
  var elapsed = simElapsed;
  var input = getInput();
  var mouse = getMouse();
  var actions = getKeyActions();
  var combatActions = [];
  for (var ai = 0; ai < actions.length; ai++) {
    var action = actions[ai];
    if (action === "worldDebugToggle") {
      toggleWorldDebugView();
    } else if (action === "worldDebugZoomIn") {
      zoomWorldDebugView(1.15);
    } else if (action === "worldDebugZoomOut") {
      zoomWorldDebugView(1 / 1.15);
    } else if (action === "toggleMap") {
      if (gameStarted && ship) {
        if (isMapScreenVisible()) {
          hideMapScreen();
        } else {
          showMapScreen({ x: ship.posX, z: ship.posZ }, bossZones);
        }
      }
    } else {
      combatActions.push(action);
    }
  }

  if (!gameFrozen && !cardPickerOpen && !crewSwapOpen && !techScreenOpen && !portScreenOpen && !isSettingsOpen() && gameStarted) {
    var mults = buildCombinedMults(upgrades, getCrewBonuses(crew), getTechBonuses(techState));

    // process keyboard actions (QWER ability bar)
    for (var ki = 0; ki < combatActions.length; ki++) {
      var act = combatActions[ki];
      if (act === "slot0" || act === "slot1" || act === "slot2") {
        var slotIdx = parseInt(act.charAt(4));
        if (weapons) {
          switchWeapon(weapons, slotIdx);
          fireWithSound(weapons, scene, resources, mults);
        }
      } else if (act === "slot3") {
        if (abilityState && weapons && !gameFrozen) {
          var kActivated = activateAbility(abilityState);
          if (kActivated) {
            if (selectedClass === "cruiser") {
              for (var bs = 0; bs < 3; bs++) {
                fireWithSound(weapons, scene, resources, mults);
                weapons.cooldown = 0;
              }
            } else if (selectedClass === "carrier") {
              spawnDrone(droneMgr, ship.posX, ship.posZ, scene, 15);
            }
          }
        }
      }
    }

    // handle click: nav or enemy targeting
    var clickedEnemy = false;
    if (mouse.clicked && !mouse.clickConsumed) {
      if (isMobile()) {
        // Mobile: tap only targets enemies, joystick handles movement
        var clickResult = handleClick(mouse.x, mouse.y);
        if (clickResult === "enemy") clickedEnemy = true;
        else if (clickResult === "nav") clearNavTarget(ship);
      } else {
        var clickResult = handleClick(mouse.x, mouse.y);
        if (clickResult === "enemy") clickedEnemy = true;
      }
      consumeClick();
    }

    // mobile joystick movement
    if (isMobile()) {
      var joy = getJoystickState();
      if (joy.active) {
        var joyMag = Math.sqrt(joy.dx * joy.dx + joy.dy * joy.dy);
        if (joyMag > 0.15) {
          var NAV_JOYSTICK_DIST = 25;
          var scaledDist = NAV_JOYSTICK_DIST * joyMag;
          var dirX = joy.dx / joyMag;
          var dirZ = joy.dy / joyMag;
          setNavTarget(ship, ship.posX + dirX * scaledDist, ship.posZ + dirZ * scaledDist);
        }
        wasJoystickActive = true;
      } else if (wasJoystickActive) {
        clearNavTarget(ship);
        wasJoystickActive = false;
      }
    } else {
      // desktop: press-and-hold continuous movement
      var holdElapsed = mouse.held ? performance.now() - mouse.holdStart : 0;
      if (mouse.held && holdElapsed >= HOLD_THRESHOLD) {
        handleHold(mouse.x, mouse.y);
        wasHeld = true;
      } else if (!mouse.held && wasHeld) {
        stopHold();
        wasHeld = false;
      } else if (!mouse.held) {
        wasHeld = false;
      }
    }

    if (abilityState) {
      updateAbility(abilityState, dt);
      handleAbility(mults);
    }

    var fuelMult = getFuelSpeedMult(resources);
    if (ship.speedBoostActive) { mults = Object.assign({}, mults); mults.maxSpeed = mults.maxSpeed * 2; }
    var canFire = !ship.diveActive;
    var wp = getWeatherPreset(weather);
    mults = Object.assign({}, mults);
    mults.windX = wp.windX;
    mults.windZ = wp.windZ;
    var waveAmp = wp.waveAmplitude;
    var waveSteps = wp.waveSteps !== undefined ? wp.waveSteps : 0;
    var weatherWaveHeight = function (wx, wz, wt) { return getWaveHeight(wx, wz, wt, waveAmp, waveSteps); };
    // day/night, ocean, and weather visual updates extracted to tick order 8
    // Weather changes: host-only in multiplayer, broadcast to all
    var prevWeather = weather.current;
    if (!isMultiplayerActive(mpState) || mpState.isHost) {
      maybeChangeWeather(weather);
    }
    if (isMultiplayerActive(mpState) && mpState.isHost && weather.current !== prevWeather) {
      sendWeatherChange(mpState, weather.current);
    }
    // Periodic weather + day/night sync from host (~2Hz)
    if (isMultiplayerActive(mpState) && mpState.isHost) {
      sendWeatherSync(mpState, weather.current, dayNight.timeOfDay);
    }
    updateShip(ship, input, dt, weatherWaveHeight, elapsed, fuelMult, mults, activeTerrain);
    if (activeTerrain) {
      updateTerrainStreaming(activeTerrain, ship.posX, ship.posZ, ship.heading, ship.speed);
    }
    maybeApplyRollingOrigin();
    var speedRatio = getSpeedRatio(ship);
    consumeFuel(resources, speedRatio, dt);
    updateNav(ship, elapsed);
    updateCamera(cam, dt, ship.posX, ship.posZ);
    updateCameraUniforms(cam.camera.position.x, cam.camera.position.z);
    // auto-targeting: acquire nearest enemy if no combat target
    var target = getCombatTarget();
    if (!target) {
      // prioritize boss
      if (activeBoss && activeBoss.alive) {
        var bdx = activeBoss.posX - ship.posX;
        var bdz = activeBoss.posZ - ship.posZ;
        if (Math.sqrt(bdx * bdx + bdz * bdz) <= getActiveWeaponRange(weapons)) {
          setCombatTarget(activeBoss);
          target = activeBoss;
        }
      }
      if (!target) {
        var nearest = findNearestEnemy(ship, enemyMgr.enemies);
        if (nearest) {
          var tdx = nearest.posX - ship.posX;
          var tdz = nearest.posZ - ship.posZ;
          if (Math.sqrt(tdx * tdx + tdz * tdz) <= getActiveWeaponRange(weapons)) {
            setCombatTarget(nearest);
            target = nearest;
          }
        }
      }
      if (!target) {
        var nearestBattery = findNearestHostileBatteryTarget(ship, portMgr);
        if (nearestBattery) {
          var cdx = nearestBattery.posX - ship.posX;
          var cdz = nearestBattery.posZ - ship.posZ;
          if (Math.sqrt(cdx * cdx + cdz * cdz) <= getActiveWeaponRange(weapons)) {
            setCombatTarget(nearestBattery);
            target = nearestBattery;
          }
        }
      }
    }
    // aim at combat target; fire on click/tap
    if (target && target.alive) {
      aimAtEnemy(weapons, target);
      if (canFire && clickedEnemy) {
        var fdx = target.posX - ship.posX;
        var fdz = target.posZ - ship.posZ;
        var inRange = Math.sqrt(fdx * fdx + fdz * fdz) <= getActiveWeaponRange(weapons);
        if (inRange) {
          fireWithSound(weapons, scene, resources, mults);
        }
      }
    }
    updateWeapons(weapons, dt, scene, enemyMgr, activeBoss, activeTerrain);
    updateDrones(droneMgr, ship, dt, scene, enemyMgr, weatherWaveHeight, elapsed);
    if (activeBoss) {
      updateBoss(activeBoss, ship, dt, scene, weatherWaveHeight, elapsed, enemyMgr, activeTerrain);
      updateBossHud(activeBoss, dt);
      if (activeBoss.defeated && !activeBoss._lootGiven) {
        activeBoss._lootGiven = true;
        var loot = rollBossLoot();
        applyBossLoot(loot, upgrades, enemyMgr);
        showLootBanner(loot.label);
        showBanner("BOSS DEFEATED!", 3);
        addKillFeedEntry("BOSS DEFEATED! " + loot.label, "#ff6644");
        triggerScreenShake(1.5);
        hideBossHud();
        var bossOfficer = generateOfficerReward(nextRandom() < 0.5 ? 2 : 3);
        spawnCrewPickup(crewPickupMgr, activeBoss.posX, 0, activeBoss.posZ + 3, scene, bossOfficer);
        showBanner("Officer spotted — sail to collect!", 4);
      }
    }

    var activeZone = activeZoneId ? getZone(activeZoneId) : null;
    var roleContext = activeZone ? {
      zoneId: activeZoneId,
      condition: activeZone.condition,
      difficulty: activeZone.difficulty
    } : currentRoleContext;
    if (activeZone && roleContext) currentRoleContext = roleContext;
    updateEnemies(enemyMgr, ship, dt, scene, weatherWaveHeight, elapsed, waveMgr, getWaveConfig(waveMgr), activeTerrain, roleContext);
    updatePatrolSpawning(dt);
    despawnDistantEnemies();
    checkBossZoneEntry();
    updatePickups(pickupMgr, ship, resources, dt, elapsed, weatherWaveHeight, scene, upgrades);
    updateCrewPickups(crewPickupMgr, ship, dt, elapsed, weatherWaveHeight, scene);
    updatePorts(portMgr, ship, resources, enemyMgr, dt, upgrades, selectedClass, activeTerrain, scene, weapons);
    handleCityEvents(consumeCityEvents(portMgr));
    updateCrates(crateMgr, ship, resources, activeTerrain, dt, elapsed, weatherWaveHeight, scene, upgrades);
    updateMerchants(merchantMgr, ship, dt, scene, activeTerrain, elapsed, weatherWaveHeight, enemyMgr, activeZone, activeZoneId, roleContext);
    if (mults.autoRepair) {
      var arHp = getPlayerHp(enemyMgr);
      if (arHp.hp < arHp.maxHp) setPlayerHp(enemyMgr, Math.min(arHp.maxHp, arHp.hp + dt));
    }
    var hpInfo = getPlayerHp(enemyMgr);
    var aliveEnemyCount = 0;
    for (var i = 0; i < enemyMgr.enemies.length; i++) {
      if (enemyMgr.enemies[i].alive && !enemyMgr.enemies[i].ambient) aliveEnemyCount++;
    }
    var bossAlive = activeBoss && activeBoss.alive;
    var event = updateWaveState(waveMgr, aliveEnemyCount, hpInfo.hp, hpInfo.maxHp, resources, dt, bossAlive);

    // On non-host in multiplayer, skip local wave state — host drives it
    var mpActive = isMultiplayerActive(mpState);
    if (mpActive && !mpState.isHost) {
      event = null; // non-host ignores local wave transitions
    }

    if (event) {
      if (event === "wave_start") {
        var waveFaction = waveMgr.currentConfig.faction;
        var waveAnnounce = getFactionAnnounce(waveFaction);
        showBanner(waveAnnounce, 3);
        addKillFeedEntry("Wave " + waveMgr.wave + " — " + waveAnnounce, "#44aaff");
        playWaveHorn();
        if (mpActive && mpState.isHost) {
          sendWaveEvent(mpState, "wave_start", { wave: waveMgr.wave, faction: waveFaction });
        }
      } else if (event.indexOf("wave_start_boss:") === 0) {
        var bossType = event.split(":")[1];
        var zone = getZone(activeZoneId);
        var difficulty = zone ? zone.difficulty : (waveMgr.currentConfig.bossDifficulty || 1);
        activeBoss = createBoss(bossType, ship.posX, ship.posZ, scene, difficulty);
        setNavBoss(activeBoss);
        playWaveHorn();
        if (activeBoss) {
          showBossHud(activeBoss.def.name);
          showBanner("BOSS: " + activeBoss.def.name + "!", 4);
          if (mpActive && mpState.isHost) {
            sendWaveEvent(mpState, "wave_start_boss", { wave: waveMgr.wave, boss: bossType });
            sendBossSpawn(mpState, bossType, activeBoss.posX, activeBoss.posZ);
          }
        } else {
          showBanner("Fleet " + waveMgr.wave + " Approaching!", 3);
        }
      } else if (event === "wave_complete") {
        clearCombatTarget();
        showBanner("Fleet " + waveMgr.wave + " defeated!", 2.5);
        addKillFeedEntry("Fleet " + waveMgr.wave + " defeated!", "#44dd66");
        clearPickups(pickupMgr, scene);
        clearCrates(crateMgr, scene);
        clearMerchants(merchantMgr, scene);
        if (activeBoss) {
          removeBoss(activeBoss, scene);
          activeBoss = null; setNavBoss(null);
          hideBossHud();
        }
        // 15% chance of crew pickup dropping near player
        if (nextRandom() < 0.15 && ship) {
          var waveOfficer = generateOfficerReward(1);
          var ox = ship.posX + (nextRandom() - 0.5) * 10;
          var oz = ship.posZ + (nextRandom() - 0.5) * 10;
          spawnCrewPickup(crewPickupMgr, ox, 0, oz, scene, waveOfficer);
        }
        performAutoSave();
        if (mpActive && mpState.isHost) {
          sendWaveEvent(mpState, "wave_complete", { wave: waveMgr.wave });
        }
        if (waveMgr.wave < waveMgr.maxWave) {
          var waveCards = generateUpgradeCards(upgrades, 3);
          if (waveCards.length > 0) {
            cardPickerOpen = true;
            fadeGameAudio();
            showCardPicker(waveCards, function (picked) {
              applyFreeUpgrade(upgrades, picked.key);
              applyUpgrades();
              cardPickerOpen = false;
              resumeGameAudio();
            });
          }
        }
      } else if (event === "game_over") {
        clearCombatTarget();
        if (mpActive && mpState.isHost) {
          sendWaveEvent(mpState, "game_over", { wave: waveMgr.wave });
        }
        for (var bzig = 0; bzig < bossZones.length; bzig++) {
          if (bossZones[bzig]._active) bossZones[bzig]._active = false;
        }
        resetWaveManager(waveMgr, []);
        lastZoneResult = "game_over";
        gameFrozen = true;
        upgrades.gold = 0;
        hideBossHud();
        var goData = awardRunInfamy("defeat");
        fadeOut(0.4, function () {
          showInfamyScreen(goData, function () {
            showGameOver(waveMgr.wave);
          });
          fadeIn(0.4);
        });
      } else if (event === "victory") {
        clearCombatTarget();
        if (mpActive && mpState.isHost) {
          sendWaveEvent(mpState, "victory", { wave: waveMgr.wave });
        }
        for (var bziv = 0; bziv < bossZones.length; bziv++) {
          if (bossZones[bziv]._active) {
            bossZones[bziv].defeated = true;
            bossZones[bziv]._active = false;
          }
        }
        // guaranteed weapon upgrade drop on boss defeat
        if (weapons) {
          var bossUpgradeKey = rollWeaponUpgradeKey(weapons.weaponTiers);
          if (bossUpgradeKey) {
            spawnWeaponUpgradePickup(pickupMgr, ship.posX, 0, ship.posZ, scene, bossUpgradeKey);
          }
        }
        resetWaveManager(waveMgr, []);
        lastZoneResult = "victory";
        performAutoSave();
        gameFrozen = true;
        hideBossHud();
        var vicData = awardRunInfamy("victory");
        fadeOut(0.4, function () {
          showInfamyScreen(vicData, function () {
            // Return to open world after boss defeat
            gameFrozen = false;
            fadeIn(0.4);
            showBanner("Boss defeated! Continue exploring.", 3);
          });
          fadeIn(0.4);
        });
      } else if (event.indexOf("repair:") === 0) {
        var newHp = parseFloat(event.split(":")[1]);
        setPlayerHp(enemyMgr, newHp);
        hpInfo = getPlayerHp(enemyMgr);
      }
    }

    var hostileBatteryTargets = collectHostileBatteryTargets(portMgr);
    updateHealthBars(cam.camera, enemyMgr.enemies, ship, hpInfo.hp, hpInfo.maxHp, hostileBatteryTargets);
    var waveState = getWaveState(waveMgr);
    var weaponOrder = getWeaponOrder();
    var weaponIcons = ["\u2022", "\u25C6", "\u25AC"];
    var weaponColors = ["#ffcc44", "#ff6644", "#44aaff"];

    // Build QWER ability bar info (4 slots)
    var abilityBarSlots = [];
    for (var si = 0; si < 3; si++) {
      var wCfg = getWeaponConfig(weaponOrder[si]);
      var wCooldownPct = 1;
      var wCooldownSecs = 0;
      if (weapons.activeWeapon === si && weapons.cooldown > 0) {
        wCooldownPct = 1 - weapons.cooldown / (wCfg.fireRate || 1);
        wCooldownSecs = weapons.cooldown;
      }
      abilityBarSlots.push({
        icon: weaponIcons[si], color: weaponColors[si],
        active: false, cooldownPct: wCooldownPct, cooldownSecs: wCooldownSecs,
        isActiveSlot: false
      });
    }
    // R slot = class ability
    var rSlot = { icon: "\u26A1", color: "#cc66ff", active: false, cooldownPct: 1, cooldownSecs: 0, isActiveSlot: false };
    if (abilityState && selectedClass) {
      var classCfg = getShipClass(selectedClass);
      rSlot.color = classCfg.color;
      if (abilityState.active) {
        rSlot.active = true;
        rSlot.cooldownPct = abilityState.activeTimer / abilityState.duration;
        rSlot.cooldownSecs = abilityState.activeTimer;
      } else if (abilityState.cooldownTimer > 0) {
        rSlot.cooldownPct = 1 - abilityState.cooldownTimer / abilityState.cooldown;
        rSlot.cooldownSecs = abilityState.cooldownTimer;
      }
    }
    abilityBarSlots.push(rSlot);

    var weaponInfo = { activeIndex: weapons.activeWeapon };
    var abilityHudInfo = null;
    var portInfo = getPortsInfo(portMgr, ship);
    updateHUD(speedRatio, getDisplaySpeed(ship), ship.heading, resources.ammo, resources.maxAmmo,
      hpInfo.hp, hpInfo.maxHp, resources.fuel, resources.maxFuel, resources.parts,
      waveMgr.wave, waveState, dt, upgrades.gold, weaponInfo, abilityHudInfo, getWeatherLabel(weather), false, portInfo, abilityBarSlots, crew);

    // minimap: collect port positions
    var portPositions = [];
    if (portMgr.ports) {
      for (var mpi = 0; mpi < portMgr.ports.length; mpi++) {
        var mp = portMgr.ports[mpi];
        var isHostileCity = !!mp.hostileCity;
        var px = isHostileCity && mp.cityAnchorX !== undefined ? mp.cityAnchorX : (mp.dockX !== undefined ? mp.dockX : mp.posX);
        var pz = isHostileCity && mp.cityAnchorZ !== undefined ? mp.cityAnchorZ : (mp.dockZ !== undefined ? mp.dockZ : mp.posZ);
        portPositions.push({
          x: px,
          z: pz,
          type: isHostileCity ? "port_hostile" : (mp.isCity ? "port_city" : "port")
        });
      }
    }
    var pickupList = pickupMgr.pickups || [];
    var crateList = crateMgr.crates || [];
    var allPickups = pickupList.concat(crateList);
    // multiplayer: pass remote players to minimap
    var mpRemoteShips = isMultiplayerActive(mpState) ? getRemoteShipsForMinimap() : [];
    var terrainMarkers = getTerrainMinimapMarkers(activeTerrain);
    updateMinimap(ship.posX, ship.posZ, ship.heading, enemyMgr.enemies, allPickups, portPositions, terrainMarkers, mpRemoteShips);

    // multiplayer: send ship state and update remote ships
    if (isMultiplayerActive(mpState)) {
      sendShipState(mpState, ship, hpInfo.hp, hpInfo.maxHp, weapons.activeWeapon, false);
      updateRemoteShips(dt, weatherWaveHeight, elapsed, scene);
      updateRemoteLabels(cam.camera);
      // Host sends enemy state and boss state to other clients
      if (mpState.isHost) {
        sendEnemyState(mpState, enemyMgr.enemies);
        if (activeBoss && activeBoss.alive) {
          sendBossState(mpState, activeBoss);
        }
        if (activeBoss && activeBoss.defeated && !activeBoss._netDeathSent) {
          activeBoss._netDeathSent = true;
          sendBossDefeated(mpState, activeBoss.type);
        }
      }
      // Non-host: dead-reckon enemy positions between host updates
      if (!mpState.isHost) {
        deadReckonEnemies(enemyMgr, dt);
      }
    }

    // screen shake — apply camera offset
    var shake = getShakeOffset();
    if (shake.intensity > 0.01) {
      cam.camera.position.x += shake.offsetX;
      cam.camera.position.z += shake.offsetY;
    }

    // sound updates extracted to tick order 11
    if (prevPlayerHp >= 0 && hpInfo.hp < prevPlayerHp) {
      playPlayerHit();
      var dmgAmount = prevPlayerHp - hpInfo.hp;
      // find nearest enemy projectile direction for indicator
      var hitAngle = 0;
      for (var di = 0; di < enemyMgr.enemies.length; di++) {
        var de = enemyMgr.enemies[di];
        if (!de.alive) continue;
        hitAngle = Math.atan2(de.posX - ship.posX, de.posZ - ship.posZ) - ship.heading;
        break;
      }
      showDamageIndicator(hitAngle);
      if (dmgAmount >= 2) triggerScreenShake(0.6 + dmgAmount * 0.2);
      else triggerScreenShake(0.2);
      showFloatingNumber(window.innerWidth / 2, window.innerHeight / 2 - 30,
        "-" + dmgAmount.toFixed(1), "#ff4444");
    }
    prevPlayerHp = hpInfo.hp;
  } else {
    // day/night, ocean, and weather extracted to tick order 8
    if (ship) {
      updateCamera(cam, dt, ship.posX, ship.posZ);
    } else {
      updateCamera(cam, dt, 0, 0);
    }
  }

}

// Register the game loop at tick order 0 (highest priority)
ticker.events.on("tick", function (dt) {
  runFrame(dt);
}, 0);

// Day/night and weather visual updates at tick order 8 (folio-2025 pattern)
ticker.events.on("tick", function (dt) {
  var wp = getWeatherPreset(weather);
  var wDim = getWeatherDim(weather);
  var lightDim = weather.lightningActive ? 3.0 : wDim;

  updateDayNight(dayNight, dt);
  updateDayNightUniforms(dayNight.timeOfDay || 0);
  updateWindUniforms(wp.windX || 0, wp.windZ || 0, 1.0);
  updateWeatherUniforms(wDim, scene.fog.density);
  applyDayNight(dayNight, ambient, sun, hemi, scene.fog, renderer, lightDim);
  updateStars(stars, dayNight.timeOfDay);
  if (ship) updateShipLantern(ship, getNightness(dayNight.timeOfDay));

  updateOcean(ocean.uniforms, simElapsed, wp.waveAmplitude,
    wp.waveSteps !== undefined ? wp.waveSteps : 0,
    wp.waterTint, dayNight, cam.camera, wDim,
    getWeatherFoam(weather), getWeatherCloudShadow(weather));
  updateWeather(weather, dt, scene,
    ship ? ship.posX : 0, ship ? ship.posZ : 0);
}, 8);

// Register UI effects at tick order 10
ticker.events.on("tick", function (dt) {
  updateUIEffects(dt);
}, 10);

// Sound updates at tick order 11
ticker.events.on("tick", function (dt) {
  if (gameFrozen || !gameStarted) return;
  var speedRatio = ship ? getSpeedRatio(ship) : 0;
  updateSailing(speedRatio);
  updateAmbience(weather.current, dt);
  var hpInfo = getPlayerHp(enemyMgr);
  var hpRatio = hpInfo.hp / hpInfo.maxHp;
  updateLowHpWarning(hpRatio);
  updateLowHullVignette(hpRatio);

  var aliveEnemyCount = 0;
  for (var i = 0; i < enemyMgr.enemies.length; i++) {
    if (enemyMgr.enemies[i].alive && !enemyMgr.enemies[i].ambient) aliveEnemyCount++;
  }
  var bossAlive = activeBoss && activeBoss.alive;
  var musicMode = "calm";
  if (portScreenOpen) musicMode = "port";
  else if (bossAlive) musicMode = "boss";
  else if (aliveEnemyCount > 0) musicMode = "combat";
  updateMusic(musicMode);
}, 11);

// Register render pass at tick order 998 (last)
ticker.events.on("tick", function () {
  if (isWorldDebugVisible()) {
    updateWorldDebugView(buildWorldDebugSnapshot());
  }
  renderer.render(scene, cam.camera);
}, 998);

// Pre-compile shaders before starting the loop
updateLoadingBar(90, "Compiling shaders...");
preCompileShaders(renderer, scene, cam.camera);
updateLoadingBar(100, "Starting...");
ticker.start();
hideLoadingScreen();

window.advanceTime = function (ms) {
  var add = Number(ms) || 0;
  if (add <= 0) return Promise.resolve();
  var steps = Math.max(1, Math.round(add / (1000 / 60)));
  var dt = (add / 1000) / steps;
  for (var i = 0; i < steps; i++) {
    ticker.manualTick(dt);
  }
  return Promise.resolve();
};

window.render_game_to_text = function () {
  var hp = getPlayerHp(enemyMgr);
  var terrainState = activeTerrain && activeTerrain.getDebugState ? activeTerrain.getDebugState() : null;
  var aliveEnemies = [];
  var enemyPlaceholders = 0;
  var enemyModeled = 0;
  for (var i = 0; i < enemyMgr.enemies.length; i++) {
    var e = enemyMgr.enemies[i];
    if (!e.alive) continue;
    var isPlaceholder = false;
    if (e.mesh && e.mesh.children && e.mesh.children.length > 0) {
      var head = e.mesh.children[0];
      if (head.isMesh && head.material && head.material.color && head.material.color.getHex) {
        var hex = head.material.color.getHex();
        isPlaceholder = (hex === 0xff00ff || hex === 0x446688) && head.geometry && head.geometry.type === "BoxGeometry";
      }
    }
    if (isPlaceholder) enemyPlaceholders++;
    else enemyModeled++;

    aliveEnemies.push({
      x: Math.round(e.posX * 10) / 10,
      z: Math.round(e.posZ * 10) / 10,
      hp: e.hp,
      modelLoaded: !isPlaceholder
    });
    if (aliveEnemies.length >= 12) break;
  }

  var visualChunkCount = 0;
  var visualModelCount = 0;
  var terrainMarkerCount = 0;
  if (activeTerrain && activeTerrain.chunks && activeTerrain.chunks.forEach) {
    activeTerrain.chunks.forEach(function (chunk) {
      if (!chunk || chunk.state !== "active") return;
      if ((chunk.placedModelCount || 0) > 0) {
        visualChunkCount++;
        visualModelCount += chunk.placedModelCount || 0;
      }
      if (chunk.minimapMarkers && chunk.minimapMarkers.length) {
        terrainMarkerCount += chunk.minimapMarkers.length;
      }
    });
  }

  var cityPorts = 0;
  var hostileCities = 0;
  var hostileBatteries = 0;
  if (portMgr && portMgr.ports) {
    for (var pidx = 0; pidx < portMgr.ports.length; pidx++) {
      var p = portMgr.ports[pidx];
      if (!p || !p.isCity) continue;
      cityPorts++;
      if (p.hostileCity) hostileCities++;
      if (p.hostileCity && p.batteries) {
        for (var bi = 0; bi < p.batteries.length; bi++) {
          if (p.batteries[bi] && p.batteries[bi].alive) hostileBatteries++;
        }
      }
    }
  }

  var combatTarget = getCombatTarget();
  var combatTargetInfo = null;
  if (combatTarget) {
    var targetKind = "enemy";
    if (activeBoss && combatTarget === activeBoss) targetKind = "boss";
    else if (combatTarget.mesh && combatTarget.mesh.userData && combatTarget.mesh.userData.cityBattery) targetKind = "city_battery";
    combatTargetInfo = {
      kind: targetKind,
      x: Math.round(combatTarget.posX * 10) / 10,
      z: Math.round(combatTarget.posZ * 10) / 10,
      alive: !!combatTarget.alive
    };
  }

  var payload = {
    renderer: {
      backend: rendererRuntime && rendererRuntime.backend ? rendererRuntime.backend : "unknown",
      className: renderer && renderer.constructor ? renderer.constructor.name : "unknown",
      requested: window.__ooRequestedRenderer || "default",
      fallbackReason: window.__ooRendererFallbackReason || null
    },
    water: {
      requested: window.__ooWaterRequested || "legacy",
      backend: window.__ooWaterBackend || "legacy",
      fallbackReason: window.__ooWaterFallbackReason || null,
      visualMode: ocean && ocean.uniforms ? ocean.uniforms.__waterVisualMode || "legacy" : "legacy"
    },
    coordinateSystem: "X right/east, Z forward/south, Y up. Values are current rebased world coordinates.",
    mode: gameStarted ? (gameFrozen ? "frozen" : "combat") : "menu",
    weather: weather ? weather.current : "calm",
    player: ship ? {
      x: Math.round(ship.posX * 10) / 10,
      z: Math.round(ship.posZ * 10) / 10,
      heading: Math.round(ship.heading * 100) / 100,
      speed: Math.round(ship.speed * 100) / 100,
      hp: Math.round(hp.hp * 100) / 100,
      maxHp: Math.round(hp.maxHp * 100) / 100,
      navTarget: ship.navTarget ? {
        x: Math.round(ship.navTarget.x * 10) / 10,
        z: Math.round(ship.navTarget.z * 10) / 10
      } : null
    } : null,
    target: combatTargetInfo,
    enemies: aliveEnemies,
    pickups: pickupMgr && pickupMgr.pickups ? pickupMgr.pickups.length : 0,
    crates: crateMgr && crateMgr.crates ? crateMgr.crates.length : 0,
    ports: portMgr && portMgr.ports ? portMgr.ports.length : 0,
    portCities: {
      cities: cityPorts,
      hostileCities: hostileCities,
      hostileBatteries: hostileBatteries
    },
    enemyModels: {
      modeled: enemyModeled,
      placeholders: enemyPlaceholders
    },
    terrain: terrainState,
    terrainVisuals: {
      activeVisualChunks: visualChunkCount,
      placedModels: visualModelCount,
      minimapMarkers: terrainMarkerCount
    },
    story: null,
    worldDebug: getWorldDebugState(),
    rollingOriginShifts: rollingOriginShifts,
    simElapsed: Math.round(simElapsed * 100) / 100
  };

  return JSON.stringify(payload);
};

// Debug helpers for tuning weighted role entries during playtests.
window.get_role_pick_stats = function () {
  return getRolePickStats();
};
window.reset_role_pick_stats = function () {
  resetRolePickStats();
};
