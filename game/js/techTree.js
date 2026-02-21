// techTree.js — tech tree config, persistent state, and bonus logic

var STORAGE_KEY = "ocean-outlaws-tech";

// --- tech tree definition ---
// 3 branches, each with 5 linear nodes
var TECH_BRANCHES = {
  offense: {
    label: "Offense",
    color: "#ff4444",
    nodes: [
      { key: "adv_cannons",   label: "Adv. Cannons",    desc: "+15% damage",             cost: 40,  stat: "damage",      bonus: 0.15 },
      { key: "crit_chance",   label: "Critical Hit",     desc: "10% crit chance (2x dmg)", cost: 80,  stat: "critChance",  bonus: 0.10 },
      { key: "rapid_load",    label: "Rapid Load",       desc: "+20% fire rate",          cost: 120, stat: "fireRate",    bonus: 0.20 },
      { key: "splash_rounds", label: "Splash Rounds",    desc: "Splash damage on hit",    cost: 180, stat: "splash",      bonus: 1    },
      { key: "deadly_aim",    label: "Deadly Aim",       desc: "+25% damage, +5% crit",   cost: 260, stat: "deadlyAim",   bonus: 1    }
    ]
  },
  defense: {
    label: "Defense",
    color: "#4488ff",
    nodes: [
      { key: "hull_plating",  label: "Hull Plating",     desc: "+10% max HP",             cost: 40,  stat: "maxHp",        bonus: 0.10 },
      { key: "shield_gen",    label: "Shield Gen",       desc: "+10 armor rating",        cost: 80,  stat: "armor",        bonus: 0.10 },
      { key: "auto_repair",   label: "Auto-Repair",      desc: "Regen 1 HP/sec",          cost: 120, stat: "autoRepair",   bonus: 1    },
      { key: "dmg_reflect",   label: "Dmg. Reflect",     desc: "Reflect 15% damage",      cost: 180, stat: "dmgReflect",   bonus: 0.15 },
      { key: "fortress",      label: "Fortress",         desc: "+20% HP, +5 armor",       cost: 260, stat: "fortress",     bonus: 1    }
    ]
  },
  utility: {
    label: "Utility",
    color: "#44dd66",
    nodes: [
      { key: "wide_radar",    label: "Wide Radar",       desc: "+30% radar range",        cost: 40,  stat: "enemyRange",   bonus: 0.30 },
      { key: "mag_pickup",    label: "Mag. Pickup",      desc: "+40% pickup range",       cost: 80,  stat: "pickupRange",  bonus: 0.40 },
      { key: "salvage_bonus", label: "Salvage Bonus",    desc: "+25% salvage earned",     cost: 120, stat: "salvageBonus", bonus: 0.25 },
      { key: "swift_nav",     label: "Swift Nav",        desc: "+15% max speed",          cost: 180, stat: "maxSpeed",     bonus: 0.15 },
      { key: "master_loot",   label: "Master Loot",      desc: "+50% salvage, +20% range", cost: 260, stat: "masterLoot",  bonus: 1    }
    ]
  }
};

// --- load persistent tech state from localStorage ---
export function loadTechState() {
  var state = { unlocked: {} };
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed && parsed.unlocked) {
        state.unlocked = parsed.unlocked;
      }
    }
  } catch (e) {
    // ignore corrupt data
  }
  return state;
}

// --- save persistent tech state ---
export function saveTechState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    // storage full or unavailable
  }
}

// --- get the branch definitions ---
export function getTechBranches() {
  return TECH_BRANCHES;
}

// --- is a node unlocked? ---
export function isUnlocked(state, nodeKey) {
  return !!state.unlocked[nodeKey];
}

// --- can a node be purchased? (previous node must be unlocked, or first in branch) ---
export function canUnlock(state, branchKey, nodeIndex, salvage) {
  var branch = TECH_BRANCHES[branchKey];
  if (!branch) return false;
  var node = branch.nodes[nodeIndex];
  if (!node) return false;
  if (state.unlocked[node.key]) return false;

  // check prerequisite: previous node must be unlocked (or index 0)
  if (nodeIndex > 0) {
    var prevKey = branch.nodes[nodeIndex - 1].key;
    if (!state.unlocked[prevKey]) return false;
  }

  return salvage >= node.cost;
}

// --- purchase a tech node; returns cost spent or 0 on failure ---
export function unlockNode(state, branchKey, nodeIndex, salvage) {
  if (!canUnlock(state, branchKey, nodeIndex, salvage)) return 0;
  var node = TECH_BRANCHES[branchKey].nodes[nodeIndex];
  state.unlocked[node.key] = true;
  saveTechState(state);
  return node.cost;
}

// --- get the next unlockable index in a branch (-1 if all done) ---
export function getNextIndex(state, branchKey) {
  var branch = TECH_BRANCHES[branchKey];
  if (!branch) return -1;
  for (var i = 0; i < branch.nodes.length; i++) {
    if (!state.unlocked[branch.nodes[i].key]) return i;
  }
  return -1;
}

// --- compute all tech bonuses from unlocked nodes ---
export function getTechBonuses(state) {
  var bonuses = {
    damage: 0,
    critChance: 0,
    fireRate: 0,
    splash: false,
    maxHp: 0,
    armor: 0,
    autoRepair: false,
    dmgReflect: 0,
    enemyRange: 0,
    pickupRange: 0,
    salvageBonus: 0,
    maxSpeed: 0
  };

  var branches = Object.keys(TECH_BRANCHES);
  for (var b = 0; b < branches.length; b++) {
    var nodes = TECH_BRANCHES[branches[b]].nodes;
    for (var n = 0; n < nodes.length; n++) {
      var node = nodes[n];
      if (!state.unlocked[node.key]) continue;

      if (node.stat === "damage") bonuses.damage += node.bonus;
      else if (node.stat === "critChance") bonuses.critChance += node.bonus;
      else if (node.stat === "fireRate") bonuses.fireRate += node.bonus;
      else if (node.stat === "splash") bonuses.splash = true;
      else if (node.stat === "deadlyAim") { bonuses.damage += 0.25; bonuses.critChance += 0.05; }
      else if (node.stat === "maxHp") bonuses.maxHp += node.bonus;
      else if (node.stat === "armor") bonuses.armor += node.bonus;
      else if (node.stat === "autoRepair") bonuses.autoRepair = true;
      else if (node.stat === "dmgReflect") bonuses.dmgReflect += node.bonus;
      else if (node.stat === "fortress") { bonuses.maxHp += 0.20; bonuses.armor += 0.05; }
      else if (node.stat === "enemyRange") bonuses.enemyRange += node.bonus;
      else if (node.stat === "pickupRange") bonuses.pickupRange += node.bonus;
      else if (node.stat === "salvageBonus") bonuses.salvageBonus += node.bonus;
      else if (node.stat === "maxSpeed") bonuses.maxSpeed += node.bonus;
      else if (node.stat === "masterLoot") { bonuses.salvageBonus += 0.50; bonuses.pickupRange += 0.20; }
    }
  }

  return bonuses;
}

// --- count total unlocked nodes ---
export function getTotalUnlocked(state) {
  return Object.keys(state.unlocked).length;
}

// --- reset tech tree (for testing/debug) ---
export function resetTechState(state) {
  state.unlocked = {};
  saveTechState(state);
}
