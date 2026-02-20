// upgrade.js — upgrade config, state, and multiplier logic

// --- upgrade tree definition ---
// Each category has 3 upgrades, each with 3 tiers.
// Costs increase per tier. Multipliers stack additively per tier.
var UPGRADE_TREE = {
  weapons: {
    label: "Weapons",
    color: "#ffaa22",
    upgrades: [
      { key: "damage",     label: "+Damage",          stat: "damage",         perTier: [0.15, 0.20, 0.30], costs: [30, 60, 120] },
      { key: "fireRate",   label: "+Fire Rate",       stat: "fireRate",       perTier: [0.10, 0.15, 0.25], costs: [25, 50, 100] },
      { key: "projSpeed",  label: "+Projectile Spd",  stat: "projSpeed",      perTier: [0.10, 0.15, 0.20], costs: [20, 45, 90]  }
    ]
  },
  propulsion: {
    label: "Propulsion",
    color: "#22aaff",
    upgrades: [
      { key: "maxSpeed",   label: "+Max Speed",       stat: "maxSpeed",       perTier: [0.10, 0.15, 0.20], costs: [25, 50, 100] },
      { key: "turnRate",   label: "+Turn Rate",       stat: "turnRate",       perTier: [0.10, 0.15, 0.20], costs: [20, 45, 90]  },
      { key: "accel",      label: "+Acceleration",    stat: "accel",          perTier: [0.10, 0.15, 0.25], costs: [20, 45, 90]  }
    ]
  },
  defense: {
    label: "Defense",
    color: "#44dd66",
    upgrades: [
      { key: "maxHp",      label: "+Max HP",          stat: "maxHp",          perTier: [0.15, 0.20, 0.30], costs: [30, 60, 120] },
      { key: "armor",      label: "+Armor",           stat: "armor",          perTier: [0.10, 0.15, 0.20], costs: [25, 55, 110] },
      { key: "repair",     label: "+Repair Eff.",     stat: "repair",         perTier: [0.20, 0.30, 0.50], costs: [20, 40, 80]  }
    ]
  },
  radar: {
    label: "Radar",
    color: "#cc66ff",
    upgrades: [
      { key: "enemyRange", label: "+Enemy Range",     stat: "enemyRange",     perTier: [0.20, 0.30, 0.50], costs: [20, 40, 80]  },
      { key: "pickupRange",label: "+Pickup Range",    stat: "pickupRange",    perTier: [0.25, 0.35, 0.50], costs: [15, 35, 70]  },
      { key: "minimap",    label: "Minimap",          stat: "minimap",        perTier: [1, 0, 0],          costs: [50, 0, 0]    }
    ]
  }
};

// --- create upgrade state (all tiers at 0) ---
export function createUpgradeState() {
  var state = {
    salvage: 0,
    levels: {}
  };
  var cats = Object.keys(UPGRADE_TREE);
  for (var c = 0; c < cats.length; c++) {
    var upgrades = UPGRADE_TREE[cats[c]].upgrades;
    for (var u = 0; u < upgrades.length; u++) {
      state.levels[upgrades[u].key] = 0;
    }
  }
  return state;
}

// --- reset upgrades (on game over restart) ---
export function resetUpgrades(state) {
  state.salvage = 0;
  var keys = Object.keys(state.levels);
  for (var i = 0; i < keys.length; i++) {
    state.levels[keys[i]] = 0;
  }
}

// --- add salvage points ---
export function addSalvage(state, amount) {
  state.salvage += amount;
}

// --- get the upgrade tree config ---
export function getUpgradeTree() {
  return UPGRADE_TREE;
}

// --- can afford upgrade? ---
export function canAfford(state, key) {
  var info = findUpgrade(key);
  if (!info) return false;
  var level = state.levels[key] || 0;
  if (level >= 3) return false;
  var cost = info.costs[level];
  if (cost <= 0) return false;
  return state.salvage >= cost;
}

// --- buy upgrade; returns true on success ---
export function buyUpgrade(state, key) {
  var info = findUpgrade(key);
  if (!info) return false;
  var level = state.levels[key] || 0;
  if (level >= 3) return false;
  var cost = info.costs[level];
  if (cost <= 0) return false;
  if (state.salvage < cost) return false;
  state.salvage -= cost;
  state.levels[key] = level + 1;
  return true;
}

// --- get next tier cost (0 if maxed) ---
export function getNextCost(state, key) {
  var info = findUpgrade(key);
  if (!info) return 0;
  var level = state.levels[key] || 0;
  if (level >= 3) return 0;
  return info.costs[level];
}

// --- compute all multipliers from current upgrade levels ---
export function getMultipliers(state) {
  var mults = {
    damage: 1,
    fireRate: 1,
    projSpeed: 1,
    maxSpeed: 1,
    turnRate: 1,
    accel: 1,
    maxHp: 1,
    armor: 0,      // armor is additive 0-1 damage reduction
    repair: 1,
    enemyRange: 1,
    pickupRange: 1,
    minimap: 0      // 0 or 1
  };

  var cats = Object.keys(UPGRADE_TREE);
  for (var c = 0; c < cats.length; c++) {
    var upgrades = UPGRADE_TREE[cats[c]].upgrades;
    for (var u = 0; u < upgrades.length; u++) {
      var up = upgrades[u];
      var level = state.levels[up.key] || 0;
      for (var t = 0; t < level; t++) {
        if (up.key === "armor" || up.key === "minimap") {
          mults[up.stat] += up.perTier[t];
        } else {
          mults[up.stat] += up.perTier[t];
        }
      }
    }
  }
  return mults;
}

// --- build combined multipliers from upgrades + crew + tech ---
export function buildCombinedMults(upgradeState, crewBonuses, techBonuses) {
  var mults = getMultipliers(upgradeState);
  mults = Object.assign({}, mults);
  if (crewBonuses) {
    mults.fireRate = mults.fireRate * crewBonuses.fireRate;
    mults.maxSpeed = mults.maxSpeed * crewBonuses.maxSpeed;
    mults.turnRate = mults.turnRate * crewBonuses.turnRate;
    mults.repair = mults.repair * crewBonuses.repair;
  }
  if (techBonuses) {
    mults.damage += techBonuses.damage;
    mults.fireRate += techBonuses.fireRate;
    mults.maxHp += techBonuses.maxHp;
    mults.armor += techBonuses.armor;
    mults.enemyRange += techBonuses.enemyRange;
    mults.pickupRange += techBonuses.pickupRange;
    mults.maxSpeed += techBonuses.maxSpeed;
    mults.critChance = techBonuses.critChance;
    mults.splash = techBonuses.splash;
    mults.autoRepair = techBonuses.autoRepair;
    mults.dmgReflect = techBonuses.dmgReflect;
  }
  return mults;
}

// --- helper: find upgrade definition by key ---
function findUpgrade(key) {
  var cats = Object.keys(UPGRADE_TREE);
  for (var c = 0; c < cats.length; c++) {
    var upgrades = UPGRADE_TREE[cats[c]].upgrades;
    for (var u = 0; u < upgrades.length; u++) {
      if (upgrades[u].key === key) return upgrades[u];
    }
  }
  return null;
}
