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

function createInitialState() {
  var selectedClass = 'destroyer';

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

    restartRun: function () {
      set(createInitialState());
    },

    tick: function (dt) {
      var state = get();
      if (state.isPaused) {
        return null;
      }

      var nextAbility = { ...state.abilityState };
      var nextWave = { ...state.waveManager };
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
        var damage = nextAbility.active ? 20 : 12;
        var didFire = firePlayerProjectile(nextCombat, damage, state.ammo > 0);
        if (didFire) {
          set({ ammo: Math.max(0, state.ammo - 1) });
        }
      }

      var combatResult = stepCombat(nextCombat, dt);

      var nextHealth = Math.max(0, state.health - combatResult.pendingPlayerDamage);
      var event = updateWaveState(nextWave, combatResult.enemyCount, nextHealth, dt);

      var patch = {
        abilityState: nextAbility,
        waveManager: nextWave,
        combat: nextCombat,
        pendingFire: false,
        health: nextHealth,
        totalKills: state.totalKills + combatResult.kills
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
      }

      set(patch);
      return event;
    }
  };
});
