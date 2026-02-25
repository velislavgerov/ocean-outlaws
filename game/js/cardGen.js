// cardGen.js — generate random card options from the upgrade pool (free tier picks)
import { getUpgradeTree } from "./upgrade.js";
import { nextRandom } from "./rng.js";

// --- icon map per upgrade key ---
var ICONS = {
  damage:     "\u2694",  // swords
  fireRate:   "\ud83d\udd25", // fire
  projSpeed:  "\ud83d\udca8", // wind
  maxSpeed:   "\ud83d\udea2", // ship
  turnRate:   "\u2693",   // anchor
  accel:      "\u26a1",   // lightning
  maxHp:      "\u2764",   // heart
  armor:      "\ud83d\udee1", // shield
  repair:     "\u2695",   // medical
  enemyRange: "\ud83d\udd2d", // eye
  pickupRange:"\ud83e\uddea", // flask
  minimap:    "\ud83d\uddfa"  // map
};

// --- build per-tier description string ---
function buildDesc(upgrade, currentLevel) {
  var tier = currentLevel; // 0-indexed tier about to be applied
  if (tier >= upgrade.perTier.length) return upgrade.label;
  var pct = Math.round(upgrade.perTier[tier] * 100);
  return "+" + pct + "% " + upgrade.label.replace("+", "").trim();
}

// --- generate count upgrade cards from available (not-maxed) upgrades ---
export function generateUpgradeCards(upgradeState, count) {
  var tree = getUpgradeTree();
  var available = [];

  var cats = Object.keys(tree);
  for (var c = 0; c < cats.length; c++) {
    var catKey = cats[c];
    var cat = tree[catKey];
    for (var u = 0; u < cat.upgrades.length; u++) {
      var up = cat.upgrades[u];
      var level = upgradeState.levels[up.key] || 0;
      if (level >= 3) continue; // maxed
      // skip minimap tier 2/3 (perTier = 0)
      if (up.perTier[level] === 0) continue;
      available.push({
        type: "upgrade",
        key: up.key,
        category: catKey,
        label: up.label,
        desc: buildDesc(up, level),
        icon: ICONS[up.key] || "\u2b50",
        color: cat.color,
        tier: level + 1
      });
    }
  }

  if (available.length === 0) return [];

  // fisher-yates shuffle using game RNG
  for (var i = available.length - 1; i > 0; i--) {
    var j = Math.floor(nextRandom() * (i + 1));
    var tmp = available[i];
    available[i] = available[j];
    available[j] = tmp;
  }

  return available.slice(0, count || 3);
}
