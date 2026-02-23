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
  WAVE_STATE_ACTIVE,
  WAVE_STATE_SPAWNING,
  WAVE_STATE_WAITING
} from '../logic/waveManager';

export var useGameState = create(function (set, get) {
  var selectedClass = 'destroyer';
  var abilityState = createAbilityState(selectedClass);
  var waveManager = createWaveManager();

  return {
    selectedClass: selectedClass,
    classConfig: getShipClass(selectedClass),
    abilityState: abilityState,
    waveManager: waveManager,
    health: 100,
    ammo: 24,
    boosts: 2,
    enemyCount: 0,

    fire: function () {
      set(function (state) {
        if (state.ammo <= 0) {
          return state;
        }

        return { ammo: state.ammo - 1 };
      });
    },

    reload: function () {
      set({ ammo: 24 });
    },

    takeDamage: function (amount) {
      set(function (state) {
        return { health: Math.max(0, state.health - amount) };
      });
    },

    spawnEnemy: function () {
      set(function (state) {
        if (!consumeSpawn(state.waveManager)) {
          return state;
        }

        return {
          enemyCount: state.enemyCount + 1
        };
      });
    },

    clearEnemy: function () {
      set(function (state) {
        return {
          enemyCount: Math.max(0, state.enemyCount - 1)
        };
      });
    },

    useBoost: function () {
      set(function (state) {
        if (state.boosts <= 0) {
          return state;
        }

        return { boosts: state.boosts - 1 };
      });
    },

    useAbility: function () {
      set(function (state) {
        var nextAbility = { ...state.abilityState };
        if (!activateAbility(nextAbility)) {
          return state;
        }

        return { abilityState: nextAbility };
      });
    },

    tick: function (dt) {
      var state = get();
      var nextAbility = { ...state.abilityState };
      var nextWave = { ...state.waveManager };

      updateAbility(nextAbility, dt);
      var event = updateWaveState(nextWave, state.enemyCount, state.health, dt);

      var patch = {
        abilityState: nextAbility,
        waveManager: nextWave
      };

      if (event === 'wave_start') {
        patch.enemyCount = 0;
      }

      if (event === 'wave_complete') {
        patch.ammo = 24;
        patch.boosts = state.boosts + 1;
      }

      set(patch);
      return event;
    },

    debugAdvance: function () {
      var state = get();
      if (state.waveManager.state === WAVE_STATE_WAITING) {
        return get().tick(4);
      }

      if (state.waveManager.state === WAVE_STATE_SPAWNING) {
        while (consumeSpawn(state.waveManager)) {
          // consume all pending spawns for quick prototype flow
        }
        set({ waveManager: { ...state.waveManager } });
      }

      if (state.waveManager.state === WAVE_STATE_ACTIVE) {
        set({ enemyCount: 0 });
        return get().tick(0.016);
      }

      return get().tick(0.016);
    }
  };
});
