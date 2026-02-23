import { create } from 'zustand';

export var useGameState = create(function (set) {
  return {
    health: 100,
    ammo: 24,
    wave: 1,
    boosts: 2,
    fire: function () {
      set(function (state) {
        if (state.ammo <= 0) {
          return state;
        }

        return {
          ammo: state.ammo - 1
        };
      });
    },
    reload: function () {
      set({ ammo: 24 });
    },
    takeDamage: function (amount) {
      set(function (state) {
        return {
          health: Math.max(0, state.health - amount)
        };
      });
    },
    nextWave: function () {
      set(function (state) {
        return {
          wave: state.wave + 1,
          ammo: 24,
          boosts: state.boosts + 1
        };
      });
    },
    useBoost: function () {
      set(function (state) {
        if (state.boosts <= 0) {
          return state;
        }

        return {
          boosts: state.boosts - 1
        };
      });
    }
  };
});
