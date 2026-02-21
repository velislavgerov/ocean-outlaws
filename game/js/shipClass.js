// shipClass.js — ship class definitions, stats, and ability configs

// --- ship class configs ---
var SHIP_CLASSES = {
  destroyer: {
    key: "destroyer",
    name: "Destroyer",
    description: "Fast and agile, but fragile",
    color: "#44aaff",
    stats: {
      hp: 8,
      maxSpeed: 14,
      turnRate: 2.8,
      accel: 9,
      armor: 0
    },
    ability: {
      name: "Speed Boost",
      key: "Q",
      cooldown: 12,
      duration: 3,
      description: "2x speed for 3 seconds"
    }
  },
  cruiser: {
    key: "cruiser",
    name: "Cruiser",
    description: "Balanced all-rounder",
    color: "#ffcc44",
    stats: {
      hp: 10,
      maxSpeed: 10,
      turnRate: 2.2,
      accel: 7,
      armor: 0.1
    },
    ability: {
      name: "Broadside",
      key: "Q",
      cooldown: 10,
      duration: 0,
      description: "Fire all weapons at once"
    }
  },
  carrier: {
    key: "carrier",
    name: "Carrier",
    description: "Slow but launches attack drones",
    color: "#44dd66",
    stats: {
      hp: 14,
      maxSpeed: 7,
      turnRate: 1.4,
      accel: 5,
      armor: 0.15
    },
    ability: {
      name: "Launch Drone",
      key: "Q",
      cooldown: 20,
      duration: 15,
      description: "Deploy an auto-attacking drone for 15s"
    }
  },
  submarine: {
    key: "submarine",
    name: "Submarine",
    description: "Stealth vessel with torpedo focus",
    color: "#cc66ff",
    stats: {
      hp: 9,
      maxSpeed: 9,
      turnRate: 1.8,
      accel: 6,
      armor: 0.05
    },
    ability: {
      name: "Dive",
      key: "Q",
      cooldown: 15,
      duration: 3,
      description: "Dive underwater — invulnerable for 3s, can't fire"
    }
  }
};

var CLASS_ORDER = ["destroyer", "cruiser", "carrier", "submarine"];

// --- create ability state for a ship class ---
export function createAbilityState(classKey) {
  var cfg = SHIP_CLASSES[classKey];
  if (!cfg) return null;
  return {
    classKey: classKey,
    cooldownTimer: 0,
    active: false,
    activeTimer: 0,
    cooldown: cfg.ability.cooldown,
    duration: cfg.ability.duration
  };
}

// --- try to activate ability; returns true if activated ---
export function activateAbility(abilityState) {
  if (abilityState.cooldownTimer > 0) return false;
  if (abilityState.active) return false;
  abilityState.active = true;
  abilityState.activeTimer = abilityState.duration;
  if (abilityState.duration <= 0) {
    // instant ability (broadside) — set a tiny active window then go on cooldown
    abilityState.active = false;
    abilityState.cooldownTimer = abilityState.cooldown;
  }
  return true;
}

// --- update ability timers ---
export function updateAbility(abilityState, dt) {
  if (abilityState.active) {
    abilityState.activeTimer -= dt;
    if (abilityState.activeTimer <= 0) {
      abilityState.active = false;
      abilityState.cooldownTimer = abilityState.cooldown;
    }
  } else if (abilityState.cooldownTimer > 0) {
    abilityState.cooldownTimer -= dt;
    if (abilityState.cooldownTimer < 0) abilityState.cooldownTimer = 0;
  }
}

// --- get class config ---
export function getShipClass(key) {
  return SHIP_CLASSES[key];
}

// --- get class list ---
export function getClassOrder() {
  return CLASS_ORDER;
}

// --- get all class configs ---
export function getAllClasses() {
  return SHIP_CLASSES;
}
