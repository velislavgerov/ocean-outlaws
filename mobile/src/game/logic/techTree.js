// Migrated tech tree logic (web -> mobile shared module)

var TECH_BRANCHES = {
  offense: {
    label: 'Offense',
    nodes: [
      { key: 'adv_cannons', label: 'Adv. Cannons', cost: 40, stat: 'damage', bonus: 0.15 },
      { key: 'crit_chance', label: 'Critical Hit', cost: 80, stat: 'critChance', bonus: 0.1 }
    ]
  },
  defense: {
    label: 'Defense',
    nodes: [
      { key: 'hull_plating', label: 'Hull Plating', cost: 40, stat: 'maxHp', bonus: 0.1 },
      { key: 'shield_gen', label: 'Shield Gen', cost: 80, stat: 'armor', bonus: 0.1 }
    ]
  },
  utility: {
    label: 'Utility',
    nodes: [
      { key: 'salvage_bonus', label: 'Gold Bonus', cost: 120, stat: 'salvageBonus', bonus: 0.25 },
      { key: 'swift_nav', label: 'Swift Nav', cost: 180, stat: 'maxSpeed', bonus: 0.15 }
    ]
  }
};

export function createTechState() {
  return { unlocked: {} };
}

export function getTechBranches() {
  return TECH_BRANCHES;
}

export function canUnlock(state, branchKey, nodeIndex, gold) {
  var branch = TECH_BRANCHES[branchKey];
  if (!branch) return false;
  var node = branch.nodes[nodeIndex];
  if (!node) return false;
  if (state.unlocked[node.key]) return false;
  if (nodeIndex > 0 && !state.unlocked[branch.nodes[nodeIndex - 1].key]) return false;
  return gold >= node.cost;
}

export function unlockNode(state, branchKey, nodeIndex, gold) {
  if (!canUnlock(state, branchKey, nodeIndex, gold)) {
    return 0;
  }

  var node = TECH_BRANCHES[branchKey].nodes[nodeIndex];
  state.unlocked[node.key] = true;
  return node.cost;
}

export function getTechBonuses(state) {
  var bonuses = {
    damage: 0,
    critChance: 0,
    maxHp: 0,
    armor: 0,
    salvageBonus: 0,
    maxSpeed: 0
  };

  Object.keys(TECH_BRANCHES).forEach(function (branchKey) {
    TECH_BRANCHES[branchKey].nodes.forEach(function (node) {
      if (!state.unlocked[node.key]) return;
      bonuses[node.stat] += node.bonus;
    });
  });

  return bonuses;
}
