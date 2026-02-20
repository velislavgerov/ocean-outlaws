import * as THREE from "three";
import { createOcean, updateOcean, getWaveHeight } from "./ocean.js";
import { createCamera, updateCamera, resizeCamera } from "./camera.js";
import { createShip, updateShip, getSpeedRatio, getDisplaySpeed } from "./ship.js";
import { initInput, getInput, getMouse, consumeClick, getKeyActions, getAutofire, toggleAutofire, setAutofire } from "./input.js";
import { createHUD, updateHUD, showBanner, showGameOver, showVictory, setRestartCallback, hideOverlay, setWeaponSwitchCallback, setAbilityCallback, setAutofireToggleCallback } from "./hud.js";
import { initNav, updateNav, handleClick, getCombatTarget, setCombatTarget } from "./nav.js";
import { createWeaponState, fireWeapon, updateWeapons, switchWeapon, getWeaponOrder, getWeaponConfig, findNearestEnemy, getActiveWeaponRange, aimAtEnemy } from "./weapon.js";
import { createEnemyManager, updateEnemies, getPlayerHp, setOnDeathCallback, setPlayerHp, setPlayerArmor, setPlayerMaxHp, resetEnemyManager } from "./enemy.js";
import { initHealthBars, updateHealthBars } from "./health.js";
import { createResources, consumeFuel, getFuelSpeedMult, resetResources } from "./resource.js";
import { createPickupManager, spawnPickup, updatePickups, clearPickups } from "./pickup.js";
import { createWaveManager, updateWaveState, getWaveConfig, getWaveState, resetWaveManager } from "./wave.js";
import { createUpgradeState, resetUpgrades, addSalvage, getMultipliers, buildCombinedMults } from "./upgrade.js";
import { createUpgradeScreen, showUpgradeScreen, hideUpgradeScreen } from "./upgradeScreen.js";
import { getShipClass } from "./shipClass.js";
import { createAbilityState, activateAbility, updateAbility } from "./shipClass.js";
import { createShipSelectScreen, showShipSelectScreen, hideShipSelectScreen } from "./shipSelect.js";
import { createDroneManager, spawnDrone, updateDrones, resetDrones } from "./drone.js";
import { createMapScreen, showMapScreen, hideMapScreen } from "./mapScreen.js";
import { loadMapState, getZone, calcStars, completeZone, buildZoneWaveConfigs, saveMapState } from "./mapData.js";
import { createWeather, setWeather, getWeatherPreset, getWeatherLabel, maybeChangeWeather, createRain, updateWeather } from "./weather.js";
import { createBoss, updateBoss, removeBoss, rollBossLoot, applyBossLoot } from "./boss.js";
import { createBossHud, showBossHud, hideBossHud, updateBossHud, showLootBanner } from "./bossHud.js";
import { createCrewState, resetCrew, generateOfficerReward, addOfficer, getCrewBonuses } from "./crew.js";
import { createCrewScreen, showCrewScreen, hideCrewScreen } from "./crewScreen.js";
import { loadTechState, getTechBonuses } from "./techTree.js";
import { createTechScreen, showTechScreen, hideTechScreen } from "./techScreen.js";
import { createTerrain, removeTerrain, collideWithTerrain, isLand } from "./terrain.js";

var SALVAGE_PER_KILL = 10;

var renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x0a0e1a);
document.body.appendChild(renderer.domElement);

var scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0a0e1a, 0.006);
var ambient = new THREE.AmbientLight(0x1a2040, 0.6);
scene.add(ambient);
var sun = new THREE.DirectionalLight(0x4466aa, 0.8);
sun.position.set(50, 80, 30);
scene.add(sun);
var hemi = new THREE.HemisphereLight(0x1a1a3a, 0x050510, 0.3);
scene.add(hemi);

var ocean = createOcean();
scene.add(ocean.mesh);

var weather = createWeather("calm");
weather.fogRef = scene.fog;
weather.ambientRef = ambient;
weather.sunRef = sun;
var rain = createRain(scene);
weather.rain = rain;

var ship = null;
var weapons = null;
var abilityState = null;
var selectedClass = null;
var gameFrozen = true;
var upgradeScreenOpen = false;
var gameStarted = false;
var activeBoss = null;
var crewScreenOpen = false;
var techScreenOpen = false;
var mapState = loadMapState();
var activeZoneId = null;
var activeTerrain = null;
var resources = createResources();
var pickupMgr = createPickupManager();
var enemyMgr = createEnemyManager();
var droneMgr = createDroneManager();
var upgrades = createUpgradeState();
createUpgradeScreen();
var crew = createCrewState();
createCrewScreen();
var techState = loadTechState();
createTechScreen();

setOnDeathCallback(enemyMgr, function (x, y, z) {
  spawnPickup(pickupMgr, x, y, z, scene);
  var techB = getTechBonuses(techState);
  addSalvage(upgrades, Math.round(SALVAGE_PER_KILL * (1 + techB.salvageBonus)));
});

var waveMgr = createWaveManager();
initInput();
createHUD();

setWeaponSwitchCallback(function (index) {
  if (weapons) switchWeapon(weapons, index);
});
setAbilityCallback(function () {
  if (!abilityState || !weapons || gameFrozen) return;
  var activated = activateAbility(abilityState);
  if (activated) {
    var mults = buildCombinedMults(upgrades, getCrewBonuses(crew), getTechBonuses(techState));
    if (selectedClass === "cruiser") {
      for (var bs = 0; bs < 3; bs++) {
        fireWeapon(weapons, scene, resources, mults);
        weapons.cooldown = 0;
      }
    } else if (selectedClass === "carrier") {
      spawnDrone(droneMgr, ship.posX, ship.posZ, scene, 15);
    }
  }
});
setAutofireToggleCallback(function () {
  toggleAutofire();
});

initHealthBars();
createBossHud();
var cam = createCamera(window.innerWidth / window.innerHeight);
createMapScreen();
createShipSelectScreen();
showShipSelectScreen(function (classKey) {
  selectedClass = classKey;
  hideShipSelectScreen();
  openTechThenMap();
});

function openTechThenMap() {
  techState = loadTechState();
  techScreenOpen = true;
  showTechScreen(techState, {
    get: function () { return upgrades.salvage; },
    spend: function (cost) { upgrades.salvage -= cost; }
  }, function () {
    techScreenOpen = false;
    openMap();
  });
}

function openMap() {
  mapState = loadMapState();
  showMapScreen(mapState, function (zoneId) {
    hideMapScreen();
    activeZoneId = zoneId;
    startZoneCombat(selectedClass, zoneId);
  });
}

function startZoneCombat(classKey, zoneId) {
  var classCfg = getShipClass(classKey);
  var zone = getZone(zoneId);
  resetWaveManager(waveMgr, buildZoneWaveConfigs(zone));
  resetResources(resources);
  resetEnemyManager(enemyMgr, scene);
  resetUpgrades(upgrades);
  resetDrones(droneMgr, scene);
  resetCrew(crew);
  if (activeBoss) { removeBoss(activeBoss, scene); activeBoss = null; }
  hideBossHud();
  if (activeTerrain) { removeTerrain(activeTerrain, scene); activeTerrain = null; }
  // generate terrain: seed from zone id hash + random, difficulty scales land coverage
  var terrainSeed = 0;
  for (var si = 0; si < zoneId.length; si++) terrainSeed += zoneId.charCodeAt(si) * (si + 1);
  terrainSeed += Math.floor(Math.random() * 10000);
  activeTerrain = createTerrain(terrainSeed, zone.difficulty);
  scene.add(activeTerrain.mesh);
  if (ship && ship.mesh) scene.remove(ship.mesh);
  ship = createShip(classCfg);
  scene.add(ship.mesh);
  setPlayerMaxHp(enemyMgr, classCfg.stats.hp);
  setPlayerHp(enemyMgr, classCfg.stats.hp);
  setPlayerArmor(enemyMgr, classCfg.stats.armor);
  weapons = createWeaponState(ship);
  abilityState = createAbilityState(classKey);
  initNav(cam.camera, ship, scene, enemyMgr, activeTerrain);
  resetDrones(droneMgr, scene);
  setWeather(weather, zone.condition === "stormy" ? "storm" : zone.condition || "calm");
  gameFrozen = false;
  gameStarted = true;
  upgradeScreenOpen = false;
  showBanner(zone.name + " — Wave 1", 3);
}

function handleZoneVictory() {
  var hpInfo = getPlayerHp(enemyMgr);
  var stars = calcStars(hpInfo.hp, hpInfo.maxHp);
  mapState = completeZone(mapState, activeZoneId, stars);
  saveMapState(mapState);
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
  resetWaveManager(waveMgr);
  resetResources(resources);
  resetEnemyManager(enemyMgr, scene);
  resetUpgrades(upgrades);
  resetDrones(droneMgr, scene);
  resetCrew(crew);
  if (activeBoss) { removeBoss(activeBoss, scene); activeBoss = null; }
  hideBossHud();
  if (activeTerrain) { removeTerrain(activeTerrain, scene); activeTerrain = null; }
  if (ship) { ship.posX = 0; ship.posZ = 0; ship.speed = 0; ship.heading = 0; ship.navTarget = null; }
  if (weapons) { weapons.activeWeapon = 0; weapons.projectiles = []; weapons.effects = []; weapons.cooldown = 0; }
  upgradeScreenOpen = false; crewScreenOpen = false; techScreenOpen = false;
  setAutofire(false);
  setWeather(weather, "calm");
  hideUpgradeScreen(); hideCrewScreen(); hideTechScreen(); hideOverlay();
  openTechThenMap();
});

window.addEventListener("resize", function () {
  renderer.setSize(window.innerWidth, window.innerHeight);
  resizeCamera(cam, window.innerWidth / window.innerHeight);
});

var clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  var dt = Math.min(clock.getDelta(), 0.1);
  var elapsed = clock.getElapsedTime();
  var input = getInput();
  var mouse = getMouse();

  if (!gameFrozen && !upgradeScreenOpen && !crewScreenOpen && !techScreenOpen && gameStarted) {
    var mults = buildCombinedMults(upgrades, getCrewBonuses(crew), getTechBonuses(techState));

    // process keyboard actions
    var actions = getKeyActions();
    for (var ki = 0; ki < actions.length; ki++) {
      var act = actions[ki];
      if (act === "toggleAutofire") {
        toggleAutofire();
      } else if (act === "weapon0") {
        if (weapons) switchWeapon(weapons, 0);
      } else if (act === "weapon1") {
        if (weapons) switchWeapon(weapons, 1);
      } else if (act === "weapon2") {
        if (weapons) switchWeapon(weapons, 2);
      } else if (act === "ability") {
        if (abilityState && weapons && !gameFrozen) {
          var kActivated = activateAbility(abilityState);
          if (kActivated) {
            if (selectedClass === "cruiser") {
              for (var bs = 0; bs < 3; bs++) {
                fireWeapon(weapons, scene, resources, mults);
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
      var clickResult = handleClick(mouse.x, mouse.y);
      if (clickResult === "enemy") clickedEnemy = true;
      consumeClick();
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
    var weatherWaveHeight = function (wx, wz, wt) { return getWaveHeight(wx, wz, wt, waveAmp); };
    // ocean must update before ships so wave height is current-frame
    updateOcean(ocean.uniforms, elapsed, wp.waveAmplitude, wp.waterTint);
    updateWeather(weather, dt, scene, ship.posX, ship.posZ);
    maybeChangeWeather(weather);
    updateShip(ship, input, dt, weatherWaveHeight, elapsed, fuelMult, mults, activeTerrain);
    var speedRatio = getSpeedRatio(ship);
    consumeFuel(resources, speedRatio, dt);
    updateNav(ship, elapsed);
    updateCamera(cam, dt, ship.posX, ship.posZ);
    // auto-targeting: acquire nearest enemy if no combat target
    var target = getCombatTarget();
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
    // aim at combat target; fire based on autofire state or click
    if (target && target.alive) {
      aimAtEnemy(weapons, target);
      if (canFire) {
        var fdx = target.posX - ship.posX;
        var fdz = target.posZ - ship.posZ;
        var inRange = Math.sqrt(fdx * fdx + fdz * fdz) <= getActiveWeaponRange(weapons);
        if (inRange) {
          if (getAutofire()) {
            // autofire ON: fire continuously
            fireWeapon(weapons, scene, resources, mults);
          } else if (clickedEnemy) {
            // autofire OFF: fire on click
            fireWeapon(weapons, scene, resources, mults);
          }
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
        hideBossHud();
        var bossOfficer = generateOfficerReward(Math.random() < 0.5 ? 2 : 3);
        addOfficer(crew, bossOfficer);
        showBanner("Officer recruited: " + bossOfficer.portrait + " " + bossOfficer.name, 4);
      }
    }

    updateEnemies(enemyMgr, ship, dt, scene, weatherWaveHeight, elapsed, waveMgr, getWaveConfig(waveMgr), activeTerrain);
    updatePickups(pickupMgr, ship, resources, dt, elapsed, weatherWaveHeight, scene);
    if (mults.autoRepair) {
      var arHp = getPlayerHp(enemyMgr);
      if (arHp.hp < arHp.maxHp) setPlayerHp(enemyMgr, Math.min(arHp.maxHp, arHp.hp + dt));
    }
    var hpInfo = getPlayerHp(enemyMgr);
    var aliveEnemyCount = 0;
    for (var i = 0; i < enemyMgr.enemies.length; i++) {
      if (enemyMgr.enemies[i].alive) aliveEnemyCount++;
    }
    var bossAlive = activeBoss && activeBoss.alive;
    var event = updateWaveState(waveMgr, aliveEnemyCount, hpInfo.hp, hpInfo.maxHp, resources, dt, bossAlive);

    if (event) {
      if (event === "wave_start") {
        showBanner("Wave " + waveMgr.wave + " incoming!", 3);
      } else if (event.indexOf("wave_start_boss:") === 0) {
        var bossType = event.split(":")[1];
        var zone = getZone(activeZoneId);
        var difficulty = zone ? zone.difficulty : 1;
        activeBoss = createBoss(bossType, ship.posX, ship.posZ, scene, difficulty);
        if (activeBoss) {
          showBossHud(activeBoss.def.name);
          showBanner("BOSS: " + activeBoss.def.name + "!", 4);
        } else {
          showBanner("Wave " + waveMgr.wave + " incoming!", 3);
        }
      } else if (event === "wave_complete") {
        showBanner("Wave " + waveMgr.wave + " cleared!", 2.5);
        clearPickups(pickupMgr, scene);
        if (activeBoss) {
          removeBoss(activeBoss, scene);
          activeBoss = null;
          hideBossHud();
        }
        if (Math.random() < 0.5) {
          var waveOfficer = generateOfficerReward(1);
          addOfficer(crew, waveOfficer);
          showBanner("Officer recruited: " + waveOfficer.portrait + " " + waveOfficer.name, 3);
        }
        if (waveMgr.wave < waveMgr.maxWave) {
          upgradeScreenOpen = true;
          showUpgradeScreen(upgrades, function () {
            upgradeScreenOpen = false;
            applyUpgrades();
            crewScreenOpen = true;
            showCrewScreen(crew, function () {
              crewScreenOpen = false;
            });
          });
        }
      } else if (event === "game_over") {
        showGameOver(waveMgr.wave);
        gameFrozen = true;
        hideBossHud();
      } else if (event === "victory") {
        handleZoneVictory();
        showVictory(waveMgr.wave);
        gameFrozen = true;
        hideBossHud();
      } else if (event.indexOf("repair:") === 0) {
        var newHp = parseFloat(event.split(":")[1]);
        setPlayerHp(enemyMgr, newHp);
        hpInfo = getPlayerHp(enemyMgr);
      }
    }

    updateHealthBars(cam.camera, enemyMgr.enemies, ship, hpInfo.hp, hpInfo.maxHp);
    var waveState = getWaveState(waveMgr);
    var weaponOrder = getWeaponOrder();
    var ammoCosts = [];
    for (var wi = 0; wi < weaponOrder.length; wi++) ammoCosts.push(getWeaponConfig(weaponOrder[wi]).ammoCost);
    var weaponInfo = { activeIndex: weapons.activeWeapon, ammoCosts: ammoCosts };
    var abilityHudInfo = null;
    if (abilityState && selectedClass) {
      var classCfg = getShipClass(selectedClass);
      abilityHudInfo = { name: classCfg.ability.name, color: classCfg.color, active: abilityState.active,
        activeTimer: abilityState.activeTimer, duration: abilityState.duration,
        cooldownTimer: abilityState.cooldownTimer, cooldown: abilityState.cooldown };
    }
    updateHUD(speedRatio, getDisplaySpeed(ship), ship.heading, resources.ammo, resources.maxAmmo,
      hpInfo.hp, hpInfo.maxHp, resources.fuel, resources.maxFuel, resources.parts,
      waveMgr.wave, waveState, dt, upgrades.salvage, weaponInfo, abilityHudInfo, getWeatherLabel(weather), getAutofire());
  } else {
    var wpIdle = getWeatherPreset(weather);
    updateOcean(ocean.uniforms, elapsed, wpIdle.waveAmplitude, wpIdle.waterTint);
    updateWeather(weather, dt, scene, ship ? ship.posX : 0, ship ? ship.posZ : 0);
    if (ship) {
      updateCamera(cam, dt, ship.posX, ship.posZ);
    } else {
      updateCamera(cam, dt, 0, 0);
    }
  }

  renderer.render(scene, cam.camera);
}

animate();
