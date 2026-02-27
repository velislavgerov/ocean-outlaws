// Shared ship class logic extracted from web game for mobile reuse.

var SHIP_CLASSES = {
  destroyer: {
    key: 'destroyer',
    name: 'Sloop',
    description: 'Fast and agile, but fragile',
    color: '#44aaff',
    stats: { hp: 8, maxSpeed: 14, turnRate: 2.8, accel: 9, armor: 0 },
    ability: { name: 'Speed Boost', cooldown: 12, duration: 3 }
  },
  cruiser: {
    key: 'cruiser',
    name: 'Brigantine',
    description: 'Balanced all-rounder',
    color: '#ffcc44',
    stats: { hp: 10, maxSpeed: 10, turnRate: 2.2, accel: 7, armor: 0.1 },
    ability: { name: 'Broadside', cooldown: 10, duration: 0 }
  },
  carrier: {
    key: 'carrier',
    name: 'Galleon',
    description: 'Slow but launches attack drones',
    color: '#44dd66',
    stats: { hp: 14, maxSpeed: 7, turnRate: 1.4, accel: 5, armor: 0.15 },
    ability: { name: 'Launch Drone', cooldown: 20, duration: 15 }
  },
  submarine: {
    key: 'submarine',
    name: "Man-o'-War",
    description: 'Stealth vessel with fire bomb focus',
    color: '#cc66ff',
    stats: { hp: 9, maxSpeed: 9, turnRate: 1.8, accel: 6, armor: 0.05 },
    ability: { name: 'Dive', cooldown: 15, duration: 3 }
  }
};

var CLASS_ORDER = ['destroyer', 'cruiser', 'carrier', 'submarine'];

export function getClassOrder() {
  return CLASS_ORDER;
}

export function getShipClass(classKey) {
  return SHIP_CLASSES[classKey] || SHIP_CLASSES.destroyer;
}

export function createAbilityState(classKey) {
  var cls = getShipClass(classKey);

  return {
    classKey: cls.key,
    active: false,
    activeTimer: 0,
    cooldownTimer: 0,
    cooldown: cls.ability.cooldown,
    duration: cls.ability.duration
  };
}

export function activateAbility(abilityState) {
  if (abilityState.active || abilityState.cooldownTimer > 0) {
    return false;
  }

  abilityState.active = true;
  abilityState.activeTimer = abilityState.duration;

  if (abilityState.duration <= 0) {
    abilityState.active = false;
    abilityState.cooldownTimer = abilityState.cooldown;
  }

  return true;
}

export function updateAbility(abilityState, dt) {
  if (abilityState.active) {
    abilityState.activeTimer -= dt;
    if (abilityState.activeTimer <= 0) {
      abilityState.active = false;
      abilityState.activeTimer = 0;
      abilityState.cooldownTimer = abilityState.cooldown;
    }
    return;
  }

  if (abilityState.cooldownTimer > 0) {
    abilityState.cooldownTimer -= dt;
    if (abilityState.cooldownTimer < 0) {
      abilityState.cooldownTimer = 0;
    }
  }
}
