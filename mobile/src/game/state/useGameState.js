import { create } from 'zustand';
import {
  activateAbility,
  createAbilityState,
  getShipClass,
  updateAbility
} from '../logic/shipClasses';
import {
  consumeSpawn,
  createWaveManager,
  updateWaveState,
  WAVE_STATE_WAITING,
  WAVE_STATE_GAME_OVER,
  WAVE_STATE_SPAWNING,
  WAVE_STATE_VICTORY
} from '../logic/waveManager';
import {
  createCombatState,
  firePlayerProjectile,
  setBoost,
  setInputVector,
  spawnEnemy,
  stepCombat
} from '../logic/combatSimulator';
import { submitScore, unlockAchievement } from '../backend/progressionSync';
import { canUnlock, createTechState, getTechBonuses, unlockNode } from '../logic/techTree';
import { createEnvironmentState, cycleWeather, getTimeLabel, getWeatherPreset, tickEnvironment } from '../logic/weatherCycle';

var SAILING_ONLY_MODE = true;

function buildScorePayload(state) {
  return {
    playerId: 'local-dev-player',
    waveReached: state.waveManager.wave,
    score: (state.totalKills * 100) + (state.waveManager.wave * 250),
    shipClass: state.selectedClass,
    totalKills: state.totalKills
  };
}

async function submitRunSummary(state) {
  var scorePayload = buildScorePayload(state);
  await submitScore(scorePayload);

  if (state.totalKills >= 1) {
    await unlockAchievement({
      playerId: scorePayload.playerId,
      achievementId: 'first-blood',
      context: { totalKills: state.totalKills }
    });
  }
}

function createInitialState() {
  var selectedClass = 'destroyer';
  var techState = createTechState();
  var envState = createEnvironmentState();

  return {
    selectedClass: selectedClass,
    classConfig: getShipClass(selectedClass),
    abilityState: createAbilityState(selectedClass),
    waveManager: createWaveManager(),
    combat: createCombatState(),
    health: 100,
    ammo: 24,
    boosts: 2,
    totalKills: 0,
    gold: 0,
    techState: techState,
    techBonuses: getTechBonuses(techState),
    envState: envState,
    timeLabel: getTimeLabel(envState),
    weatherLabel: getWeatherPreset(envState).label,
    pendingFire: false,
    waveBanner: 'Prepare for battle',
    isPaused: false
  };
}

export var useGameState = create(function (set, get) {
  return {
    ...createInitialState(),

    setSteering: function (x, y) {
      set(function (state) {
        var combat = { ...state.combat, input: { ...state.combat.input } };
        setInputVector(combat, x, y);
        return { combat: combat };
      });
    },

    fire: function () {
      set({ pendingFire: true });
    },

    reload: function () {
      set({ ammo: 24 });
    },

    useBoost: function () {
      set(function (state) {
        if (state.boosts <= 0) {
          return state;
        }

        var combat = { ...state.combat, input: { ...state.combat.input } };
        setBoost(combat, true);

        return {
          boosts: state.boosts - 1,
          combat: combat
        };
      });
    },

    endBoost: function () {
      set(function (state) {
        var combat = { ...state.combat, input: { ...state.combat.input } };
        setBoost(combat, false);
        return { combat: combat };
      });
    },

    useAbility: function () {
      set(function (state) {
        var nextAbility = { ...state.abilityState };
        if (!activateAbility(nextAbility)) {
          return state;
        }

        return {
          abilityState: nextAbility,
          waveBanner: state.classConfig.ability.name + ' activated'
        };
      });
    },

    unlockTechNode: function (branchKey, nodeIndex) {
      set(function (state) {
        var nextTech = { unlocked: { ...state.techState.unlocked } };
        if (!canUnlock(nextTech, branchKey, nodeIndex, state.gold)) {
          return state;
        }

        var spent = unlockNode(nextTech, branchKey, nodeIndex, state.gold);
        var bonuses = getTechBonuses(nextTech);

        return {
          techState: nextTech,
          techBonuses: bonuses,
          gold: Math.max(0, state.gold - spent),
          waveBanner: 'Tech upgraded'
        };
      });
    },

    cycleWeatherNow: function () {
      set(function (state) {
        var env = { ...state.envState };
        cycleWeather(env);
        return {
          envState: env,
          weatherLabel: getWeatherPreset(env).label
        };
      });
    },

    restartRun: function () {
      set(createInitialState());
    },

    tick: function (dt) {
      var state = get();
      if (state.isPaused) {
        return null;
      }

      if (SAILING_ONLY_MODE) {
        var sailAbility = { ...state.abilityState };
        var sailEnv = { ...state.envState };
        var sailWave = {
          ...state.waveManager,
          state: WAVE_STATE_WAITING,
          pauseTimer: 3,
          enemiesToSpawn: 0,
          enemiesAlive: 0
        };
        var sailCombat = {
          ...state.combat,
          input: { ...state.combat.input },
          player: { ...state.combat.player },
          enemies: [],
          projectiles: [],
          spawnCooldown: 0,
          pendingPlayerDamage: 0,
          killsThisTick: 0
        };

        updateAbility(sailAbility, dt);
        stepCombat(sailCombat, dt);
        tickEnvironment(sailEnv, dt);

        set({
          abilityState: sailAbility,
          waveManager: sailWave,
          combat: sailCombat,
          pendingFire: false,
          health: 100,
          envState: sailEnv,
          timeLabel: getTimeLabel(sailEnv),
          weatherLabel: getWeatherPreset(sailEnv).label,
          waveBanner: 'Sailing mode: movement + waves'
        });
        return null;
      }

      var nextAbility = { ...state.abilityState };
      var nextWave = { ...state.waveManager };
      var nextEnv = { ...state.envState };
      var nextCombat = {
        ...state.combat,
        input: { ...state.combat.input },
        player: { ...state.combat.player },
        enemies: state.combat.enemies.map(function (e) { return { ...e }; }),
        projectiles: state.combat.projectiles.map(function (p) { return { ...p }; })
      };

      updateAbility(nextAbility, dt);

      if (nextWave.state === WAVE_STATE_SPAWNING && nextWave.enemiesToSpawn > 0) {
        nextCombat.spawnCooldown -= dt;
        if (nextCombat.spawnCooldown <= 0) {
          if (consumeSpawn(nextWave)) {
            spawnEnemy(nextCombat, nextWave.currentConfig.hpMult);
            nextCombat.spawnCooldown = 0.75;
          }
        }
      }

      if (state.pendingFire) {
        var damage = (nextAbility.active ? 20 : 12) * (1 + state.techBonuses.damage);
        var didFire = firePlayerProjectile(nextCombat, damage, state.ammo > 0);
        if (didFire) {
          set({ ammo: Math.max(0, state.ammo - 1) });
        }
      }

      var combatResult = stepCombat(nextCombat, dt);

      var nextHealth = Math.max(0, state.health - combatResult.pendingPlayerDamage);
      var event = updateWaveState(nextWave, combatResult.enemyCount, nextHealth, dt);

      tickEnvironment(nextEnv, dt);

      var patch = {
        abilityState: nextAbility,
        waveManager: nextWave,
        combat: nextCombat,
        pendingFire: false,
        health: nextHealth,
        totalKills: state.totalKills + combatResult.kills,
        gold: state.gold + Math.round(combatResult.kills * 20 * (1 + state.techBonuses.salvageBonus)),
        envState: nextEnv,
        timeLabel: getTimeLabel(nextEnv),
        weatherLabel: getWeatherPreset(nextEnv).label
      };

      if (event === 'wave_start') {
        patch.waveBanner = 'Wave ' + nextWave.wave + ' incoming';
        nextCombat.spawnCooldown = 0.25;
      } else if (event === 'wave_complete') {
        patch.boosts = state.boosts + 1;
        patch.ammo = 24;
        patch.waveBanner = 'Wave clear';
      } else if (event === 'game_over') {
        patch.waveBanner = 'Your ship was sunk';
      } else if (event === 'victory') {
        patch.waveBanner = 'Victory! All waves cleared';
      }

      if (nextWave.state === WAVE_STATE_GAME_OVER || nextWave.state === WAVE_STATE_VICTORY) {
        patch.isPaused = true;
        void submitRunSummary({
          ...state,
          waveManager: nextWave,
          totalKills: state.totalKills + combatResult.kills,
          gold: state.gold + Math.round(combatResult.kills * 20 * (1 + state.techBonuses.salvageBonus))
        });
      }

      set(patch);
      return event;
    }
  };
});
