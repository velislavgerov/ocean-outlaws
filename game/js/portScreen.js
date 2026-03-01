// portScreen.js — between-zone port stop: repair ship + buy upgrades
import { getUpgradeTree, canAfford, buyUpgrade, getNextCost, getMultiplierForKey, findUpgrade, getRepairCost } from "./upgrade.js";
import { playUpgrade, playClick } from "./soundFx.js";
import { isMobile } from "./mobile.js";
import { T, FONT, FONT_UI, FONT_MONO, PARCHMENT_BG } from "./theme.js";

var root = null;
var panel = null;
var goldLabel = null;
var repairSection = null;
var repairBtn = null;
var repairInfo = null;
var repairBar = null;
var repairBarFill = null;
var storyNoticeEl = null;
var categoryEls = {};
var categoryPanels = {};
var onCloseCallback = null;
var currentState = null;    // { upgrades, hpInfo, classKey }
var activeTab = null;
var tabBtns = {};

// --- tab label mapping (display labels for each upgrade category) ---
var TAB_LABELS = {
  weapons:    "ARMAMENTS",
  propulsion: "SAILS",
  defense:    "DEFENSE",
  radar:      "TECH"
};

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
    "font-family:" + FONT_UI,
    "user-select: none",
    "overflow-y: auto",
    _mob ? "padding: 8px 0" : ""
  ].join(";");

  // --- main panel (dark glass) ---
  panel = document.createElement("div");
  panel.className = "oo-panel";
  panel.style.cssText = [
    "width: " + (_mob ? "100%" : "640px"),
    "max-width: " + (_mob ? "100%" : "640px"),
    "box-sizing: border-box",
    "border-radius: " + (_mob ? "0" : "8px"),
    "padding: " + (_mob ? "12px 14px" : "20px 24px"),
    "display: flex",
    "flex-direction: column",
    "gap: 0",
    "transform: translateY(60px)",
    "opacity: 0",
    "transition: transform 600ms cubic-bezier(0.16, 1, 0.3, 1), opacity 600ms cubic-bezier(0.16, 1, 0.3, 1)"
  ].join(";");

  // --- header row: port name + gold + leave button ---
  var header = document.createElement("div");
  header.style.cssText = [
    "display: flex",
    "align-items: center",
    "justify-content: space-between",
    "margin-bottom: 14px"
  ].join(";");

  var portName = document.createElement("div");
  portName.textContent = "Port of Call";
  portName.style.cssText = [
    "font-family:" + FONT,
    "font-size: " + (_mob ? "20px" : "28px"),
    "font-weight: 700",
    "color:" + T.gold,
    "letter-spacing: 2px",
    "text-shadow: 0 2px 8px rgba(0,0,0,0.7)",
    "flex: 1"
  ].join(";");
  header.appendChild(portName);

  goldLabel = document.createElement("div");
  goldLabel.style.cssText = [
    "font-family:" + FONT_MONO,
    "font-size: " + (_mob ? "13px" : "15px"),
    "color:" + T.gold,
    "margin: 0 12px",
    "white-space: nowrap"
  ].join(";");
  header.appendChild(goldLabel);

  var leaveBtn = document.createElement("button");
  leaveBtn.textContent = "LEAVE";
  leaveBtn.style.cssText = [
    "font-family:" + FONT_UI,
    "font-size: " + (_mob ? "11px" : "12px"),
    "font-weight: 500",
    "letter-spacing: 0.08em",
    "background: none",
    "color:" + T.textDim,
    "border: 1px solid " + T.border,
    "border-radius: 4px",
    "padding: " + (_mob ? "7px 12px" : "7px 16px"),
    "min-height: 32px",
    "cursor: pointer",
    "pointer-events: auto",
    "white-space: nowrap",
    "text-transform: uppercase",
    "transition: color 150ms, border-color 150ms"
  ].join(";");
  leaveBtn.addEventListener("mouseover", function () {
    leaveBtn.style.color = T.gold;
    leaveBtn.style.borderColor = T.borderGold;
  });
  leaveBtn.addEventListener("mouseout", function () {
    leaveBtn.style.color = T.textDim;
    leaveBtn.style.borderColor = T.border;
  });
  leaveBtn.addEventListener("click", function () {
    hidePortScreen();
    if (onCloseCallback) onCloseCallback();
  });
  header.appendChild(leaveBtn);

  panel.appendChild(header);

  // --- story notice ---
  storyNoticeEl = document.createElement("div");
  storyNoticeEl.style.cssText = [
    "display: none",
    "background: rgba(200,152,42,0.07)",
    "border: 1px solid " + T.borderGold,
    "border-radius: 4px",
    "padding: 10px 14px",
    "margin-bottom: 14px",
    "font-family:" + FONT_UI,
    "font-size: " + (_mob ? "12px" : "13px"),
    "line-height: 1.5",
    "color:" + T.text,
    "text-align: center"
  ].join(";");
  panel.appendChild(storyNoticeEl);

  // --- repair section (ledger row style) ---
  repairSection = document.createElement("div");
  repairSection.style.cssText = [
    "border: 1px solid rgba(76,175,122,0.25)",
    "border-radius: 4px",
    "padding: " + (_mob ? "10px 12px" : "12px 16px"),
    "margin-bottom: 14px",
    "background: rgba(76,175,122,0.04)",
    "display: flex",
    "flex-direction: column",
    "gap: 8px"
  ].join(";");

  // repair top row: info + button
  var repairTopRow = document.createElement("div");
  repairTopRow.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:12px";

  repairInfo = document.createElement("div");
  repairInfo.style.cssText = [
    "font-family:" + FONT_UI,
    "font-size:" + (_mob ? "14px" : "15px"),
    "color:" + T.text
  ].join(";");
  repairTopRow.appendChild(repairInfo);

  repairBtn = document.createElement("button");
  repairBtn.textContent = "REPAIR";
  repairBtn.style.cssText = [
    "font-family:" + FONT_UI,
    "font-size: " + (_mob ? "12px" : "13px"),
    "font-weight: 500",
    "letter-spacing: 0.05em",
    "text-transform: uppercase",
    "padding: " + (_mob ? "9px 16px" : "8px 20px"),
    "min-height: 44px",
    "background: none",
    "color:" + T.greenBright,
    "border: 1px solid " + T.greenBright + "88",
    "border-radius: 4px",
    "cursor: pointer",
    "pointer-events: auto",
    "white-space: nowrap",
    "transition: color 150ms, border-color 150ms"
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
  repairTopRow.appendChild(repairBtn);
  repairSection.appendChild(repairTopRow);

  // repair bar (hull integrity progress)
  var barTrack = document.createElement("div");
  barTrack.className = "oo-bar-track";
  barTrack.style.cssText = "height:4px";

  repairBarFill = document.createElement("div");
  repairBarFill.className = "oo-bar-fill";
  repairBarFill.style.cssText = "width:100%;background:" + T.greenBright;
  barTrack.appendChild(repairBarFill);
  repairSection.appendChild(barTrack);

  panel.appendChild(repairSection);

  // --- upgrade categories ---
  var tree = getUpgradeTree();
  var cats = Object.keys(tree);

  // tab bar (used on both mobile and desktop)
  var tabBar = document.createElement("div");
  tabBar.className = "oo-tabs";
  tabBar.style.cssText = "margin-bottom: 0";

  for (var t = 0; t < cats.length; t++) {
    (function (catKey) {
      var cat = tree[catKey];
      var tabLabel = TAB_LABELS[catKey] || cat.label.toUpperCase();
      var tabBtn = document.createElement("button");
      tabBtn.textContent = tabLabel;
      tabBtn.className = "oo-tab";
      tabBtn.addEventListener("click", function () {
        switchPortTab(catKey);
      });
      tabBar.appendChild(tabBtn);
      tabBtns[catKey] = tabBtn;
    })(cats[t]);
  }

  panel.appendChild(tabBar);

  // --- upgrade panels container ---
  var upgradesContainer = document.createElement("div");
  upgradesContainer.style.cssText = [
    "margin-top: 14px",
    "display: flex",
    "flex-direction: column",
    "gap: 0"
  ].join(";");

  for (var c = 0; c < cats.length; c++) {
    var catKey = cats[c];
    var cat = tree[catKey];
    var catPanel = buildPortCategoryPanel(catKey, cat, _mob);
    upgradesContainer.appendChild(catPanel);
    categoryPanels[catKey] = catPanel;
  }

  panel.appendChild(upgradesContainer);

  // set initial active tab
  activeTab = cats[0];
  switchPortTab(activeTab);

  root.appendChild(panel);
  document.body.appendChild(root);
}

// --- tab switching ---
function switchPortTab(catKey) {
  activeTab = catKey;
  var tree = getUpgradeTree();
  var cats = Object.keys(tree);
  for (var i = 0; i < cats.length; i++) {
    var k = cats[i];
    var catPanel = categoryPanels[k];
    var btn = tabBtns[k];
    if (!catPanel || !btn) continue;
    if (k === catKey) {
      catPanel.style.display = "block";
      btn.classList.add("active");
    } else {
      catPanel.style.display = "none";
      btn.classList.remove("active");
    }
  }
}

// --- build a category panel ---
function buildPortCategoryPanel(catKey, cat, mob) {
  var catPanel = document.createElement("div");
  catPanel.style.cssText = [
    "display: none",
    "padding: 2px 0"
  ].join(";");

  var upgradeEls = [];
  for (var u = 0; u < cat.upgrades.length; u++) {
    var up = cat.upgrades[u];
    var row = buildPortUpgradeRow(up, cat.color, mob);
    catPanel.appendChild(row.el);
    upgradeEls.push(row);
  }

  categoryEls[catKey] = upgradeEls;
  return catPanel;
}

// --- build a single upgrade row (ledger style) ---
function buildPortUpgradeRow(up, color, mob) {
  var _mob = mob !== undefined ? mob : isMobile();
  var el = document.createElement("div");
  el.style.cssText = [
    "padding: " + (_mob ? "10px 8px" : "9px 10px"),
    "margin-bottom: 1px",
    "border-radius: 4px",
    "border: 1px solid " + T.border,
    "background: none",
    "cursor: pointer",
    "pointer-events: auto",
    "transition: background 150ms, border-color 150ms",
    "box-sizing: border-box"
  ].join(";");

  el.addEventListener("mouseover", function () {
    el.style.background = "rgba(200,152,42,0.06)";
    el.style.borderColor = T.borderActive;
  });
  el.addEventListener("mouseout", function () {
    el.style.background = "none";
    el.style.borderColor = T.border;
  });

  // top row: name + cost
  var topRow = document.createElement("div");
  topRow.style.cssText = "display:flex;justify-content:space-between;align-items:center;margin-bottom:4px";

  var label = document.createElement("div");
  label.textContent = up.label;
  label.style.cssText = [
    "font-family:" + FONT_UI,
    "font-size:" + (_mob ? "15px" : "15px"),
    "color:" + T.text
  ].join(";");
  topRow.appendChild(label);

  var costLabel = document.createElement("div");
  costLabel.style.cssText = [
    "font-family:" + FONT_MONO,
    "font-size:" + (_mob ? "13px" : "13px"),
    "color:" + T.gold,
    "text-align:right",
    "white-space:nowrap"
  ].join(";");
  topRow.appendChild(costLabel);

  el.appendChild(topRow);

  // description row: tier pips (bottom row)
  var bottomRow = document.createElement("div");
  bottomRow.style.cssText = "display:flex;align-items:center;gap:4px";

  var pipEls = [];
  for (var t = 0; t < 3; t++) {
    var pip = document.createElement("div");
    pip.style.cssText = [
      "width: " + (_mob ? "22px" : "18px"),
      "height: 4px",
      "border-radius: 2px",
      "background: rgba(107,78,20,0.3)",
      "border: 1px solid " + T.border,
      "transition: background 200ms"
    ].join(";");
    bottomRow.appendChild(pip);
    pipEls.push(pip);
  }

  el.appendChild(bottomRow);

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

  goldLabel.textContent = currentState.upgrades.gold + " gp";

  // repair section
  var cost = getRepairCost(currentState.classKey);
  var damaged = currentState.hpInfo.hp < currentState.hpInfo.maxHp;
  var canRepair = damaged && currentState.upgrades.gold >= cost;
  var hpPct = Math.round(currentState.hpInfo.hp / currentState.hpInfo.maxHp * 100);

  if (damaged) {
    repairInfo.innerHTML = "Hull: <span style='font-family:" + FONT_MONO + ";color:" + (hpPct > 50 ? T.greenBright : hpPct > 25 ? T.amber : T.redBright) + "'>" + hpPct + "%</span>";
    repairBtn.textContent = "REPAIR (" + cost + " gp)";
    repairBtn.style.color = canRepair ? T.greenBright : T.textDark;
    repairBtn.style.borderColor = canRepair ? T.greenBright + "88" : T.border;
    repairBtn.style.cursor = canRepair ? "pointer" : "default";
  } else {
    repairInfo.innerHTML = "Hull: <span style='font-family:" + FONT_MONO + ";color:" + T.greenBright + "'>100%</span>";
    repairBtn.textContent = "FULL HP";
    repairBtn.style.color = T.textDark;
    repairBtn.style.borderColor = T.border;
    repairBtn.style.cursor = "default";
  }

  // update repair bar fill
  repairBarFill.style.width = hpPct + "%";
  repairBarFill.style.background = hpPct > 50 ? T.greenBright : hpPct > 25 ? T.amber : T.redBright;

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

      // update tier pips
      for (var t = 0; t < 3; t++) {
        if (t < level) {
          row.pipEls[t].style.background = row.color;
          row.pipEls[t].style.borderColor = row.color;
        } else {
          row.pipEls[t].style.background = "rgba(107,78,20,0.3)";
          row.pipEls[t].style.borderColor = T.border;
        }
      }

      // update affordability (opacity on whole row)
      if (level < 3 && upgCost > 0 && !affordable) {
        row.el.style.opacity = "0.4";
      } else {
        row.el.style.opacity = "1";
      }

      // update cost label
      if (level >= 3) {
        row.costLabel.textContent = "MAX";
        row.costLabel.style.color = row.color;
      } else if (upgCost <= 0) {
        row.costLabel.textContent = "";
        row.costLabel.style.color = T.textDark;
      } else {
        row.costLabel.textContent = upgCost + " gp";
        row.costLabel.style.color = affordable ? T.gold : T.red;
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
  if (storyNoticeEl) {
    var notice = state && typeof state.storyNotice === "string" ? state.storyNotice.trim() : "";
    storyNoticeEl.textContent = notice;
    storyNoticeEl.style.display = notice ? "block" : "none";
  }
  refreshPortUI();
  root.style.display = "flex";
  // trigger slide-up spring animation
  if (panel) {
    panel.style.transition = "none";
    panel.style.transform = "translateY(60px)";
    panel.style.opacity = "0";
    // force reflow then animate
    void panel.offsetHeight;
    panel.style.transition = "transform 600ms cubic-bezier(0.16, 1, 0.3, 1), opacity 600ms cubic-bezier(0.16, 1, 0.3, 1)";
    panel.style.transform = "translateY(0)";
    panel.style.opacity = "1";
  }
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
