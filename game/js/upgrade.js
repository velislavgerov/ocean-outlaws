// upgrade.js — upgrade config, state, and multiplier logic

// --- upgrade tree definition ---
// Each category has 3 upgrades, each with 3 tiers.
// Costs increase per tier. Multipliers stack additively per tier.
var UPGRADE_TREE = {
  weapons: {
    label: "Weapons",
    color: "#ffaa22",
    upgrades: [
      { key: "damage",     label: "+Damage",          stat: "damage",         perTier: [0.15, 0.20, 0.30], costs: [150, 350, 600] },
      { key: "fireRate",   label: "+Fire Rate",       stat: "fireRate",       perTier: [0.10, 0.15, 0.25], costs: [140, 330, 580] },
      { key: "projSpeed",  label: "+Projectile Spd",  stat: "projSpeed",      perTier: [0.10, 0.15, 0.20], costs: [120, 300, 550] }
    ]
  },
  propulsion: {
    label: "Sails",
    color: "#22aaff",
    upgrades: [
      { key: "maxSpeed",   label: "+Max Speed",       stat: "maxSpeed",       perTier: [0.15, 0.20, 0.30], costs: [140, 330, 580] },
      { key: "turnRate",   label: "+Turn Rate",       stat: "turnRate",       perTier: [0.10, 0.15, 0.20], costs: [120, 300, 550] },
      { key: "accel",      label: "+Acceleration",    stat: "accel",          perTier: [0.15, 0.20, 0.30], costs: [120, 300, 550] }
    ]
  },
  defense: {
    label: "Defense",
    color: "#44dd66",
    upgrades: [
      { key: "maxHp",      label: "+Max HP",          stat: "maxHp",          perTier: [0.15, 0.20, 0.30], costs: [150, 350, 600] },
      { key: "armor",      label: "+Armor",           stat: "armor",          perTier: [0.10, 0.15, 0.20], costs: [140, 340, 590] },
      { key: "repair",     label: "+Repair Eff.",     stat: "repair",         perTier: [0.20, 0.30, 0.50], costs: [120, 300, 550] }
    ]
  },
  radar: {
    label: "Radar",
    color: "#cc66ff",
    upgrades: [
      { key: "enemyRange", label: "+Enemy Range",     stat: "enemyRange",     perTier: [0.20, 0.30, 0.50], costs: [120, 300, 550] },
      { key: "pickupRange",label: "+Pickup Range",    stat: "pickupRange",    perTier: [0.25, 0.35, 0.50], costs: [100, 280, 520] },
      { key: "minimap",    label: "Minimap",          stat: "minimap",        perTier: [1, 0, 0],          costs: [200, 0, 0]     }
    ]
  }
};

// --- ship-class repair costs ---
var REPAIR_COSTS = {
  destroyer: 50,    // Sloop
  cruiser: 100,     // Brigantine
  carrier: 180,     // Galleon
  submarine: 280    // Man-o'-War
};

export function getRepairCost(classKey) {
  return REPAIR_COSTS[classKey] || 100;
}

// --- create upgrade state (all tiers at 0) ---
export function createUpgradeState() {
  var state = {
    gold: 0,
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

// --- reset upgrades (on new zone/restart) — keeps gold (persistent currency) ---
export function resetUpgrades(state) {
  var keys = Object.keys(state.levels);
  for (var i = 0; i < keys.length; i++) {
    state.levels[keys[i]] = 0;
  }
}

// --- add gold ---
export function addGold(state, amount) {
  state.gold += amount;
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
  return state.gold >= cost;
}

// --- buy upgrade; returns true on success ---
export function buyUpgrade(state, key) {
  var info = findUpgrade(key);
  if (!info) return false;
  var level = state.levels[key] || 0;
  if (level >= 3) return false;
  var cost = info.costs[level];
  if (cost <= 0) return false;
  if (state.gold < cost) return false;
  state.gold -= cost;
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

// --- calculate total gold spent on all upgrades ---
export function getTotalSpent(state) {
  var total = 0;
  var cats = Object.keys(UPGRADE_TREE);
  for (var c = 0; c < cats.length; c++) {
    var upgrades = UPGRADE_TREE[cats[c]].upgrades;
    for (var u = 0; u < upgrades.length; u++) {
      var up = upgrades[u];
      var level = state.levels[up.key] || 0;
      for (var t = 0; t < level; t++) {
        total += up.costs[t];
      }
    }
  }
  return total;
}

// --- respec: refund all spent gold and reset levels ---
export function respecUpgrades(state) {
  var refund = getTotalSpent(state);
  state.gold += refund;
  var keys = Object.keys(state.levels);
  for (var i = 0; i < keys.length; i++) {
    state.levels[keys[i]] = 0;
  }
  return refund;
}

// --- undo a single upgrade tier (refund cost, decrement level) ---
export function undoUpgrade(state, key) {
  var info = findUpgrade(key);
  if (!info) return false;
  var level = state.levels[key] || 0;
  if (level <= 0) return false;
  var cost = info.costs[level - 1];
  state.gold += cost;
  state.levels[key] = level - 1;
  return true;
}

// --- get the multiplier for a single upgrade key at a given level ---
export function getMultiplierForKey(state, key, extraLevels) {
  var info = findUpgrade(key);
  if (!info) return 1;
  var level = (state.levels[key] || 0) + (extraLevels || 0);
  var base = (key === "armor" || key === "minimap") ? 0 : 1;
  for (var t = 0; t < level && t < info.perTier.length; t++) {
    base += info.perTier[t];
  }
  return base;
}

// --- apply a free upgrade (no gold cost); returns true on success ---
export function applyFreeUpgrade(state, key) {
  var info = findUpgrade(key);
  if (!info) return false;
  var level = state.levels[key] || 0;
  if (level >= 3) return false;
  state.levels[key] = level + 1;
  return true;
}

// --- return array of upgrade defs where level < 3 (for card generation) ---
export function getAvailableUpgrades(state) {
  var result = [];
  var cats = Object.keys(UPGRADE_TREE);
  for (var c = 0; c < cats.length; c++) {
    var upgrades = UPGRADE_TREE[cats[c]].upgrades;
    for (var u = 0; u < upgrades.length; u++) {
      var up = upgrades[u];
      var level = state.levels[up.key] || 0;
      if (level < 3) result.push(up);
    }
  }
  return result;
}

// --- helper: find upgrade definition by key ---
export function findUpgrade(key) {
  var cats = Object.keys(UPGRADE_TREE);
  for (var c = 0; c < cats.length; c++) {
    var upgrades = UPGRADE_TREE[cats[c]].upgrades;
    for (var u = 0; u < upgrades.length; u++) {
      if (upgrades[u].key === key) return upgrades[u];
    }
  }
  return null;
}
