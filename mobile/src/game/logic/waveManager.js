// Shared wave progression logic extracted from web game for mobile reuse.

export var WAVE_STATE_WAITING = 'WAITING';
export var WAVE_STATE_SPAWNING = 'SPAWNING';
export var WAVE_STATE_ACTIVE = 'ACTIVE';
export var WAVE_STATE_COMPLETE = 'WAVE_COMPLETE';
export var WAVE_STATE_GAME_OVER = 'GAME_OVER';
export var WAVE_STATE_VICTORY = 'VICTORY';

var MAX_WAVE = 10;
var BASE_ENEMIES = 3;
var ENEMIES_PER_WAVE = 2;
var PAUSE_DURATION = 4;

function buildWaveConfigs() {
  var configs = [];

  for (var i = 1; i <= MAX_WAVE; i++) {
    configs.push({
      wave: i,
      enemies: BASE_ENEMIES + ENEMIES_PER_WAVE * (i - 1),
      hpMult: 1 + (i - 1) * 0.15,
      speedMult: 1 + (i - 1) * 0.08,
      fireRateMult: 1 + (i - 1) * 0.1
    });
  }

  return configs;
}

export function createWaveManager(externalConfigs) {
  var configs = externalConfigs || buildWaveConfigs();

  return {
    configs: configs,
    maxWave: configs.length,
    wave: 1,
    state: WAVE_STATE_WAITING,
    pauseTimer: 3,
    enemiesToSpawn: 0,
    enemiesAlive: 0,
    currentConfig: configs[0]
  };
}

export function consumeSpawn(manager) {
  if (manager.enemiesToSpawn <= 0) {
    return false;
  }

  manager.enemiesToSpawn -= 1;
  if (manager.enemiesToSpawn <= 0) {
    manager.state = WAVE_STATE_ACTIVE;
  }

  return true;
}

export function updateWaveState(manager, activeEnemyCount, playerHp, dt) {
  manager.enemiesAlive = activeEnemyCount;

  if (manager.state === WAVE_STATE_GAME_OVER || manager.state === WAVE_STATE_VICTORY) {
    return null;
  }

  if (playerHp <= 0) {
    manager.state = WAVE_STATE_GAME_OVER;
    return 'game_over';
  }

  if (manager.state === WAVE_STATE_WAITING) {
    manager.pauseTimer -= dt;
    if (manager.pauseTimer <= 0) {
      manager.state = WAVE_STATE_SPAWNING;
      manager.currentConfig = manager.configs[manager.wave - 1];
      manager.enemiesToSpawn = manager.currentConfig.enemies;
      return 'wave_start';
    }
    return null;
  }

  if (manager.state === WAVE_STATE_SPAWNING) {
    if (manager.enemiesToSpawn <= 0) {
      manager.state = WAVE_STATE_ACTIVE;
    }
    return null;
  }

  if (manager.state === WAVE_STATE_ACTIVE) {
    if (manager.enemiesToSpawn > 0) {
      manager.state = WAVE_STATE_SPAWNING;
      return null;
    }

    if (activeEnemyCount === 0) {
      manager.state = WAVE_STATE_COMPLETE;
      return 'wave_complete';
    }

    return null;
  }

  if (manager.state === WAVE_STATE_COMPLETE) {
    if (manager.wave >= manager.maxWave) {
      manager.state = WAVE_STATE_VICTORY;
      return 'victory';
    }

    manager.wave += 1;
    manager.pauseTimer = PAUSE_DURATION;
    manager.state = WAVE_STATE_WAITING;
  }

  return null;
}
