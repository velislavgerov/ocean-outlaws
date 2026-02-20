// wave.js — wave state machine with escalating difficulty

// --- wave config ---
var MAX_WAVE = 10;              // victory after surviving this wave
var BASE_ENEMIES = 3;           // enemies in wave 1
var ENEMIES_PER_WAVE = 2;       // extra enemies each wave
var PAUSE_DURATION = 4;         // seconds between waves
var REPAIR_PER_PART = 2;        // HP restored per part during pause

// --- states ---
var STATE_WAITING   = "WAITING";
var STATE_SPAWNING  = "SPAWNING";
var STATE_ACTIVE    = "ACTIVE";
var STATE_COMPLETE  = "WAVE_COMPLETE";
var STATE_GAME_OVER = "GAME_OVER";
var STATE_VICTORY   = "VICTORY";

// --- build wave config table ---
function buildWaveConfigs() {
  var configs = [];
  for (var i = 1; i <= MAX_WAVE; i++) {
    configs.push({
      wave: i,
      enemies: BASE_ENEMIES + ENEMIES_PER_WAVE * (i - 1),
      hpMult: 1.0 + (i - 1) * 0.15,
      speedMult: 1.0 + (i - 1) * 0.08,
      fireRateMult: 1.0 + (i - 1) * 0.1
    });
  }
  return configs;
}

// --- create wave manager ---
// optionally accepts external configs (e.g. from zone data)
export function createWaveManager(externalConfigs) {
  var configs = externalConfigs || buildWaveConfigs();
  var maxWave = configs.length;
  return {
    configs: configs,
    maxWave: maxWave,
    wave: 1,
    state: STATE_WAITING,
    pauseTimer: 3,              // initial countdown before wave 1
    enemiesToSpawn: 0,          // enemies yet to spawn this wave
    enemiesAlive: 0,            // living enemies on field
    repairDone: false,
    // expose current config for enemy spawning
    currentConfig: configs[0]
  };
}

// --- get current wave config ---
export function getWaveConfig(mgr) {
  return mgr.currentConfig;
}

// --- update wave state machine ---
// returns an event string when state transitions happen, or null
export function updateWaveState(mgr, activeEnemyCount, playerHp, playerMaxHp, resources, dt) {
  mgr.enemiesAlive = activeEnemyCount;

  // game over / victory are terminal
  if (mgr.state === STATE_GAME_OVER || mgr.state === STATE_VICTORY) {
    return null;
  }

  // check player death at any time
  if (playerHp <= 0) {
    mgr.state = STATE_GAME_OVER;
    return "game_over";
  }

  // --- WAITING: countdown before wave starts ---
  if (mgr.state === STATE_WAITING) {
    mgr.pauseTimer -= dt;

    // auto-repair during pause
    if (!mgr.repairDone && resources.parts > 0 && playerHp < playerMaxHp) {
      var result = doRepair(resources, playerHp, playerMaxHp);
      mgr.repairDone = true;
      if (result !== null) return "repair:" + result;
    }

    if (mgr.pauseTimer <= 0) {
      mgr.state = STATE_SPAWNING;
      var cfg = mgr.configs[mgr.wave - 1];
      mgr.currentConfig = cfg;
      mgr.enemiesToSpawn = cfg.enemies;
      return "wave_start";
    }
    return null;
  }

  // --- SPAWNING: enemies still need to spawn ---
  if (mgr.state === STATE_SPAWNING) {
    if (mgr.enemiesToSpawn <= 0) {
      mgr.state = STATE_ACTIVE;
      return null;
    }
    return null;
  }

  // --- ACTIVE: waiting for all enemies to die ---
  if (mgr.state === STATE_ACTIVE) {
    // also check if there are still enemies to spawn (late stragglers)
    if (mgr.enemiesToSpawn > 0) {
      mgr.state = STATE_SPAWNING;
      return null;
    }
    if (activeEnemyCount === 0) {
      mgr.state = STATE_COMPLETE;
      return "wave_complete";
    }
    return null;
  }

  // --- WAVE_COMPLETE: transition to next wave or victory ---
  if (mgr.state === STATE_COMPLETE) {
    if (mgr.wave >= mgr.maxWave) {
      mgr.state = STATE_VICTORY;
      return "victory";
    }
    // next wave
    mgr.wave++;
    mgr.pauseTimer = PAUSE_DURATION;
    mgr.repairDone = false;
    mgr.state = STATE_WAITING;
    return null;
  }

  return null;
}

// --- consume an enemy spawn slot (called by enemy spawner) ---
export function consumeSpawn(mgr) {
  if (mgr.enemiesToSpawn > 0) {
    mgr.enemiesToSpawn--;
    // transition to ACTIVE when all spawned
    if (mgr.enemiesToSpawn <= 0) {
      mgr.state = STATE_ACTIVE;
    }
    return true;
  }
  return false;
}

// --- can we spawn more enemies this wave? ---
export function canSpawn(mgr) {
  return (mgr.state === STATE_SPAWNING || mgr.state === STATE_ACTIVE) && mgr.enemiesToSpawn > 0;
}

// --- is wave actively running (enemies fighting)? ---
export function isWaveActive(mgr) {
  return mgr.state === STATE_SPAWNING || mgr.state === STATE_ACTIVE;
}

// --- get state for HUD ---
export function getWaveState(mgr) {
  return mgr.state;
}

// --- reset for restart ---
// optionally accepts external configs (e.g. from zone data)
export function resetWaveManager(mgr, externalConfigs) {
  var configs = externalConfigs || buildWaveConfigs();
  mgr.configs = configs;
  mgr.maxWave = configs.length;
  mgr.wave = 1;
  mgr.state = STATE_WAITING;
  mgr.pauseTimer = 3;
  mgr.enemiesToSpawn = 0;
  mgr.enemiesAlive = 0;
  mgr.repairDone = false;
  mgr.currentConfig = configs[0];
}

// --- repair logic (moved from resource.js) ---
function doRepair(res, playerHp, playerMaxHp) {
  if (res.parts <= 0 || playerHp >= playerMaxHp) return null;
  var hpNeeded = playerMaxHp - playerHp;
  var hpFromParts = res.parts * REPAIR_PER_PART;
  var hpRestored = Math.min(hpNeeded, hpFromParts);
  var partsUsed = Math.ceil(hpRestored / REPAIR_PER_PART);
  res.parts -= partsUsed;
  return playerHp + hpRestored;
}
