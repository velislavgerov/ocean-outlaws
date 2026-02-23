// portScreen.js — between-zone port stop: repair ship + buy upgrades
import { getUpgradeTree, canAfford, buyUpgrade, getNextCost, getMultiplierForKey, findUpgrade, getRepairCost } from "./upgrade.js";
import { playUpgrade, playClick } from "./soundFx.js";
import { isMobile } from "./mobile.js";
import { T, FONT, PARCHMENT_BG } from "./theme.js";

var root = null;
var goldLabel = null;
var repairSection = null;
var repairBtn = null;
var repairInfo = null;
var categoryEls = {};
var categoryPanels = {};
var onCloseCallback = null;
var currentState = null;    // { upgrades, hpInfo, classKey }
var activeTab = null;
var tabBtns = {};

// --- stat display names ---
var STAT_LABELS = {
  damage: "Damage", fireRate: "Fire Rate", projSpeed: "Proj Speed",
  maxSpeed: "Max Speed", turnRate: "Turn Rate", accel: "Acceleration",
  maxHp: "Max HP", armor: "Armor", repair: "Repair Eff.",
  enemyRange: "Enemy Range", pickupRange: "Pickup Range", minimap: "Minimap"
};

// --- create port screen DOM (called once at startup) ---
export function createPortScreen() {
  root = document.createElement("div");
  var _mob = isMobile();
  root.id = "port-screen";
  root.style.cssText = [
    "position: fixed",
    "top: 0", "left: 0",
    "width: 100%", "height: 100%",
    "display: none",
    "flex-direction: column",
    "align-items: center",
    _mob ? "justify-content: flex-start" : "justify-content: center",
    "background:" + T.bgOverlay,
    "z-index: 91",
    "font-family:" + FONT,
    "user-select: none",
    "overflow-y: auto",
    _mob ? "padding: 12px 0" : ""
  ].join(";");

  // title
  var title = document.createElement("div");
  title.textContent = "PORT OF CALL";
  title.style.cssText = [
    "font-size: " + (_mob ? "24px" : "36px"),
    "font-weight: bold",
    "color:" + T.gold,
    "margin-bottom: 4px",
    "margin-top: " + (_mob ? "10px" : "20px"),
    "text-shadow: 0 2px 4px rgba(0,0,0,0.6)",
    "letter-spacing: 3px"
  ].join(";");
  root.appendChild(title);

  // subtitle
  var subtitle = document.createElement("div");
  subtitle.textContent = "Repair and outfit your vessel";
  subtitle.style.cssText = [
    "font-size: " + (_mob ? "13px" : "14px"),
    "color:" + T.textDim,
    "margin-bottom: " + (_mob ? "10px" : "16px"),
    "text-shadow: 0 1px 2px rgba(0,0,0,0.3)"
  ].join(";");
  root.appendChild(subtitle);

  // gold display
  goldLabel = document.createElement("div");
  goldLabel.style.cssText = [
    "font-size: " + (_mob ? "16px" : "20px"),
    "color:" + T.gold,
    "margin-bottom: " + (_mob ? "12px" : "16px"),
    "text-shadow: 0 1px 2px rgba(0,0,0,0.4)"
  ].join(";");
  root.appendChild(goldLabel);

  // repair section
  repairSection = document.createElement("div");
  repairSection.style.cssText = [
    PARCHMENT_BG,
    "border: 1px solid " + T.greenBright + "44",
    "border-radius: 6px",
    "padding: 12px 20px",
    "margin-bottom: " + (_mob ? "12px" : "16px"),
    _mob ? "width: 90%" : "width: 400px",
    "max-width: 90%",
    "box-sizing: border-box",
    "display: flex",
    "align-items: center",
    "justify-content: space-between",
    "gap: 12px",
    "box-shadow: inset 0 0 15px rgba(0,0,0,0.2)"
  ].join(";");

  repairInfo = document.createElement("div");
  repairInfo.style.cssText = "font-size:" + (_mob ? "14px" : "15px") + ";color:" + T.text;
  repairSection.appendChild(repairInfo);

  repairBtn = document.createElement("button");
  repairBtn.textContent = "REPAIR";
  repairBtn.style.cssText = [
    "font-family:" + FONT,
    "font-size: " + (_mob ? "14px" : "15px"),
    "padding: " + (_mob ? "10px 20px" : "8px 24px"),
    "min-height: 44px",
    "background:" + T.bgLight,
    "color:" + T.greenBright,
    "border: 1px solid " + T.greenBright + "88",
    "border-radius: 4px",
    "cursor: pointer",
    "pointer-events: auto",
    "white-space: nowrap",
    "text-shadow: 0 1px 2px rgba(0,0,0,0.4)"
  ].join(";");
  repairBtn.addEventListener("click", function () {
    if (!currentState) return;
    var cost = getRepairCost(currentState.classKey);
    if (currentState.upgrades.gold >= cost && currentState.hpInfo.hp < currentState.hpInfo.maxHp) {
      currentState.upgrades.gold -= cost;
      currentState.hpInfo.hp = currentState.hpInfo.maxHp;
      playUpgrade();
      refreshPortUI();
    } else {
      playClick();
    }
  });
  repairSection.appendChild(repairBtn);
  root.appendChild(repairSection);

  // upgrade categories
  var tree = getUpgradeTree();
  var cats = Object.keys(tree);

  // mobile: tab bar
  if (_mob) {
    var tabBar = document.createElement("div");
    tabBar.style.cssText = [
      "display: flex",
      "gap: 6px",
      "margin-bottom: 12px",
      "width: 90%",
      "max-width: 400px",
      "justify-content: center"
    ].join(";");

    for (var t = 0; t < cats.length; t++) {
      (function (catKey) {
        var cat = tree[catKey];
        var tabBtn = document.createElement("div");
        tabBtn.textContent = cat.label;
        tabBtn.style.cssText = [
          "flex: 1",
          "text-align: center",
          "padding: 10px 4px",
          "min-height: 44px",
          "display: flex",
          "align-items: center",
          "justify-content: center",
          "font-size: 13px",
          "font-weight: bold",
          "font-family:" + FONT,
          "color: " + cat.color,
          "background:" + T.bgLight,
          "border: 1px solid " + cat.color + "33",
          "border-radius: 4px",
          "cursor: pointer",
          "pointer-events: auto",
          "transition: background 0.15s, border-color 0.15s",
          "text-shadow: 0 1px 2px rgba(0,0,0,0.4)"
        ].join(";");
        tabBtn.addEventListener("click", function () {
          switchPortTab(catKey);
        });
        tabBar.appendChild(tabBtn);
        tabBtns[catKey] = tabBtn;
      })(cats[t]);
    }

    root.appendChild(tabBar);
    activeTab = cats[0];
  }

  // upgrade body — single horizontal row on desktop
  var body = document.createElement("div");
  if (_mob) {
    body.style.cssText = [
      "display: flex",
      "flex-direction: column",
      "align-items: center",
      "width: 90%",
      "max-width: 400px"
    ].join(";");
  } else {
    body.style.cssText = [
      "display: flex",
      "flex-direction: row",
      "flex-wrap: nowrap",
      "justify-content: center",
      "align-items: flex-start",
      "gap: 12px",
      "max-width: 960px",
      "width: 95%"
    ].join(";");
  }
  root.appendChild(body);

  for (var c = 0; c < cats.length; c++) {
    var catKey = cats[c];
    var cat = tree[catKey];
    var panel = buildPortCategoryPanel(catKey, cat, _mob);
    body.appendChild(panel);
    categoryPanels[catKey] = panel;
  }

  if (_mob) {
    switchPortTab(activeTab);
  }

  // continue button
  var continueBtn = document.createElement("button");
  continueBtn.textContent = "SET SAIL";
  continueBtn.style.cssText = [
    "font-family:" + FONT,
    "font-size: 20px",
    "padding: 14px 48px",
    "min-height: 44px",
    "margin-top: 20px",
    "margin-bottom: 20px",
    "background:" + T.bgLight,
    "color:" + T.greenBright,
    "border: 1px solid " + T.greenBright + "88",
    "border-radius: 4px",
    "cursor: pointer",
    "pointer-events: auto",
    "text-shadow: 0 1px 3px rgba(0,0,0,0.5)",
    "letter-spacing: 2px"
  ].join(";");
  continueBtn.addEventListener("click", function () {
    hidePortScreen();
    if (onCloseCallback) onCloseCallback();
  });
  root.appendChild(continueBtn);

  document.body.appendChild(root);
}

// --- mobile tab switching ---
function switchPortTab(catKey) {
  activeTab = catKey;
  var tree = getUpgradeTree();
  var cats = Object.keys(tree);
  for (var i = 0; i < cats.length; i++) {
    var k = cats[i];
    var panel = categoryPanels[k];
    var btn = tabBtns[k];
    if (!panel || !btn) continue;
    if (k === catKey) {
      panel.style.display = "block";
      btn.style.background = tree[k].color + "22";
      btn.style.borderColor = tree[k].color + "88";
    } else {
      panel.style.display = "none";
      btn.style.background = T.bgLight;
      btn.style.borderColor = tree[k].color + "33";
    }
  }
}

// --- build a category panel ---
function buildPortCategoryPanel(catKey, cat, mob) {
  var panel = document.createElement("div");
  panel.style.cssText = [
    PARCHMENT_BG,
    "border: 1px solid " + cat.color + "33",
    "border-radius: 6px",
    "padding: 12px",
    mob ? "width: 100%" : "width: 210px",
    "min-height: 240px",
    "box-sizing: border-box",
    "box-shadow: inset 0 0 15px rgba(0,0,0,0.2)"
  ].join(";");

  var heading = document.createElement("div");
  heading.textContent = cat.label;
  heading.style.cssText = [
    "font-size: 15px",
    "font-weight: bold",
    "color: " + cat.color,
    "margin-bottom: 10px",
    "text-align: center",
    "text-shadow: 0 1px 2px rgba(0,0,0,0.4)",
    "letter-spacing: 1px"
  ].join(";");
  panel.appendChild(heading);

  var upgradeEls = [];
  for (var u = 0; u < cat.upgrades.length; u++) {
    var up = cat.upgrades[u];
    var row = buildPortUpgradeRow(up, cat.color);
    panel.appendChild(row.el);
    upgradeEls.push(row);
  }

  categoryEls[catKey] = upgradeEls;
  return panel;
}

// --- build a single upgrade row (fixed height) ---
function buildPortUpgradeRow(up, color) {
  var _mob = isMobile();
  var el = document.createElement("div");
  el.style.cssText = [
    "margin-bottom: 8px",
    "padding: " + (_mob ? "10px" : "8px"),
    "height: " + (_mob ? "auto" : "60px"),
    "min-height: 44px",
    "border-radius: 4px",
    "background: rgba(30, 22, 14, 0.5)",
    "cursor: pointer",
    "transition: background 0.15s",
    "box-sizing: border-box",
    "display: flex",
    "flex-direction: column",
    "justify-content: center"
  ].join(";");

  // top row: label + cost
  var topRow = document.createElement("div");
  topRow.style.cssText = "display:flex;justify-content:space-between;align-items:center;margin-bottom:4px";

  var label = document.createElement("div");
  label.textContent = up.label;
  label.style.cssText = "font-size:" + (_mob ? "14px" : "12px") + ";color:" + T.text + ";text-shadow:0 1px 1px rgba(0,0,0,0.3)";
  topRow.appendChild(label);

  var costLabel = document.createElement("div");
  costLabel.style.cssText = "font-size:" + (_mob ? "12px" : "11px") + ";color:" + T.textDim + ";text-align:right;white-space:nowrap";
  topRow.appendChild(costLabel);

  el.appendChild(topRow);

  // tier pips
  var pips = document.createElement("div");
  pips.style.cssText = "display:flex;gap:3px";
  var pipEls = [];
  for (var t = 0; t < 3; t++) {
    var pip = document.createElement("div");
    pip.style.cssText = [
      "width: " + (_mob ? "20px" : "14px"),
      "height: " + (_mob ? "8px" : "6px"),
      "border-radius: 2px",
      "background: rgba(40, 30, 18, 0.6)",
      "border: 1px solid " + T.border
    ].join(";");
    pips.appendChild(pip);
    pipEls.push(pip);
  }
  el.appendChild(pips);

  el.addEventListener("click", function () {
    if (!currentState) return;
    playClick();
    if (canAfford(currentState.upgrades, up.key)) {
      if (buyUpgrade(currentState.upgrades, up.key)) {
        playUpgrade();
      }
    }
    refreshPortUI();
  });

  return { el: el, key: up.key, pipEls: pipEls, costLabel: costLabel, color: color };
}

// --- refresh all UI ---
function refreshPortUI() {
  if (!currentState || !root) return;

  goldLabel.textContent = "\uD83E\uDE99 Gold: " + currentState.upgrades.gold;

  // repair section
  var cost = getRepairCost(currentState.classKey);
  var damaged = currentState.hpInfo.hp < currentState.hpInfo.maxHp;
  var canRepair = damaged && currentState.upgrades.gold >= cost;

  if (damaged) {
    var hpPct = Math.round(currentState.hpInfo.hp / currentState.hpInfo.maxHp * 100);
    repairInfo.innerHTML = "Hull: <span style='color:" + (hpPct > 50 ? T.greenBright : hpPct > 25 ? T.amber : T.redBright) + "'>" + hpPct + "%</span>";
    repairBtn.textContent = "REPAIR (" + cost + " \uD83E\uDE99)";
    repairBtn.style.color = canRepair ? T.greenBright : T.textDark;
    repairBtn.style.borderColor = canRepair ? T.greenBright + "88" : T.border;
    repairBtn.style.cursor = canRepair ? "pointer" : "default";
  } else {
    repairInfo.innerHTML = "Hull: <span style='color:" + T.greenBright + "'>100%</span>";
    repairBtn.textContent = "FULL HP";
    repairBtn.style.color = T.textDark;
    repairBtn.style.borderColor = T.border;
    repairBtn.style.cursor = "default";
  }

  // upgrade categories
  var tree = getUpgradeTree();
  var cats = Object.keys(tree);

  for (var c = 0; c < cats.length; c++) {
    var catKey = cats[c];
    var rows = categoryEls[catKey];
    if (!rows) continue;

    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      var level = currentState.upgrades.levels[row.key] || 0;
      var upgCost = getNextCost(currentState.upgrades, row.key);
      var affordable = canAfford(currentState.upgrades, row.key);

      for (var t = 0; t < 3; t++) {
        if (t < level) {
          row.pipEls[t].style.background = row.color;
          row.pipEls[t].style.borderColor = row.color;
        } else {
          row.pipEls[t].style.background = "rgba(40, 30, 18, 0.6)";
          row.pipEls[t].style.borderColor = T.border;
        }
      }

      if (level > 0) {
        row.el.style.background = "rgba(50, 60, 30, 0.5)";
      } else {
        row.el.style.background = "rgba(30, 22, 14, 0.5)";
      }

      if (level >= 3) {
        row.costLabel.textContent = "MAX";
        row.costLabel.style.color = row.color;
      } else if (upgCost <= 0) {
        row.costLabel.textContent = "";
        row.costLabel.style.color = T.textDark;
      } else {
        row.costLabel.textContent = upgCost + " \uD83E\uDE99";
        row.costLabel.style.color = affordable ? T.gold : T.textDark;
      }
    }
  }
}

// --- show port screen ---
// state: { upgrades, hpInfo: { hp, maxHp }, classKey }
export function showPortScreen(state, closeCb) {
  if (!root) return;
  currentState = state;
  onCloseCallback = closeCb;
  refreshPortUI();
  root.style.display = "flex";
}

// --- hide port screen ---
export function hidePortScreen() {
  if (!root) return;
  root.style.display = "none";
  currentState = null;
}

// --- is port screen visible? ---
export function isPortScreenVisible() {
  return root && root.style.display !== "none";
}
