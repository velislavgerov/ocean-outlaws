// upgradeScreen.js — between-wave upgrade UI overlay with ship diagram
import { getUpgradeTree, canAfford, buyUpgrade, getNextCost, getMultipliers, getMultiplierForKey, findUpgrade, undoUpgrade } from "./upgrade.js";
import { playUpgrade, playClick } from "./soundFx.js";
import { isMobile } from "./mobile.js";

var root = null;
var salvageLabel = null;
var categoryEls = {};
var categoryPanels = {};  // catKey -> panel DOM element (for mobile tab switching)
var onCloseCallback = null;
var currentState = null;
var continueBtn = null;
var selectedKey = null;   // currently highlighted upgrade key
var pendingKey = null;     // upgrade just applied, awaiting confirm/undo
var previewPanel = null;   // stat preview panel element
var activeTab = null;      // current mobile tab key
var tabBtns = {};          // catKey -> tab button element

// --- stat display names ---
var STAT_LABELS = {
  damage: "Damage",
  fireRate: "Fire Rate",
  projSpeed: "Proj Speed",
  maxSpeed: "Max Speed",
  turnRate: "Turn Rate",
  accel: "Acceleration",
  maxHp: "Max HP",
  armor: "Armor",
  repair: "Repair Eff.",
  enemyRange: "Enemy Range",
  pickupRange: "Pickup Range",
  minimap: "Minimap"
};

// --- create the upgrade screen DOM (called once) ---
export function createUpgradeScreen() {
  root = document.createElement("div");
  var _mob = isMobile();
  root.id = "upgrade-screen";
  root.style.cssText = [
    "position: fixed",
    "top: 0", "left: 0",
    "width: 100%", "height: 100%",
    "display: none",
    "flex-direction: column",
    "align-items: center",
    _mob ? "justify-content: flex-start" : "justify-content: center",
    "background: rgba(5, 5, 15, 0.92)",
    "z-index: 90",
    "font-family: monospace",
    "user-select: none",
    "overflow-y: auto",
    _mob ? "padding: 12px 0" : ""
  ].join(";");

  // title
  var title = document.createElement("div");
  title.textContent = "UPGRADES";
  title.style.cssText = [
    "font-size: " + (_mob ? "24px" : "36px"),
    "font-weight: bold",
    "color: #ffcc44",
    "margin-bottom: 8px",
    "margin-top: " + (_mob ? "10px" : "20px"),
    "text-shadow: 0 0 15px rgba(255,200,60,0.4)"
  ].join(";");
  root.appendChild(title);

  // salvage display
  salvageLabel = document.createElement("div");
  salvageLabel.style.cssText = [
    "font-size: " + (_mob ? "16px" : "18px"),
    "color: #ffcc44",
    "margin-bottom: " + (_mob ? "12px" : "20px")
  ].join(";");
  root.appendChild(salvageLabel);

  // mobile: tab bar for W/P/D/R
  var tree = getUpgradeTree();
  var cats = Object.keys(tree);

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
          "color: " + cat.color,
          "background: rgba(15, 20, 35, 0.6)",
          "border: 1px solid " + cat.color + "33",
          "border-radius: 6px",
          "cursor: pointer",
          "pointer-events: auto",
          "transition: background 0.15s, border-color 0.15s"
        ].join(";");
        tabBtn.addEventListener("click", function () {
          switchTab(catKey);
        });
        tabBar.appendChild(tabBtn);
        tabBtns[catKey] = tabBtn;
      })(cats[t]);
    }

    root.appendChild(tabBar);
    activeTab = cats[0];
  }

  // ship diagram + categories container
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
      "flex-wrap: wrap",
      "justify-content: center",
      "align-items: flex-start",
      "gap: 16px",
      "max-width: 900px",
      "width: 90%"
    ].join(";");
  }
  root.appendChild(body);

  // ship diagram (desktop only)
  if (!_mob) {
    var diagram = buildShipDiagram();
    body.appendChild(diagram);
  }

  // category panels
  for (var c = 0; c < cats.length; c++) {
    var catKey = cats[c];
    var cat = tree[catKey];
    var panel = buildCategoryPanel(catKey, cat, _mob);
    body.appendChild(panel);
    categoryPanels[catKey] = panel;
  }

  // set initial mobile tab visibility
  if (_mob) {
    switchTab(activeTab);
  }

  // stat preview panel (below the grid, above continue)
  previewPanel = document.createElement("div");
  previewPanel.style.cssText = [
    "max-width: 400px",
    "width: 90%",
    "min-height: 48px",
    "margin-top: 12px",
    "padding: 10px 16px",
    "background: rgba(15, 20, 35, 0.9)",
    "border: 1px solid rgba(80, 100, 130, 0.3)",
    "border-radius: 6px",
    "display: none",
    "flex-direction: column",
    "gap: 6px"
  ].join(";");
  root.appendChild(previewPanel);

  // continue button
  continueBtn = document.createElement("button");
  continueBtn.textContent = "CONTINUE";
  continueBtn.style.cssText = [
    "font-family: monospace",
    "font-size: 20px",
    "padding: 14px 48px",
    "min-height: 44px",
    "margin-top: 20px",
    "margin-bottom: 20px",
    "background: rgba(40, 80, 60, 0.8)",
    "color: #44dd66",
    "border: 1px solid rgba(60, 140, 90, 0.6)",
    "border-radius: 6px",
    "cursor: pointer",
    "pointer-events: auto",
    "text-shadow: 0 0 10px rgba(60,200,90,0.3)"
  ].join(";");
  continueBtn.addEventListener("click", function () {
    if (pendingKey) return; // must confirm or undo first
    hideUpgradeScreen();
    if (onCloseCallback) onCloseCallback();
  });
  root.appendChild(continueBtn);

  document.body.appendChild(root);
}

// --- switch mobile tab ---
function switchTab(catKey) {
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
      btn.style.background = "rgba(15, 20, 35, 0.6)";
      btn.style.borderColor = tree[k].color + "33";
    }
  }
}

// --- build ship diagram (SVG top-down view) ---
function buildShipDiagram() {
  var wrap = document.createElement("div");
  wrap.style.cssText = [
    "width: 160px",
    "min-height: 300px",
    "display: flex",
    "flex-direction: column",
    "align-items: center",
    "justify-content: center"
  ].join(";");

  var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "120");
  svg.setAttribute("height", "260");
  svg.setAttribute("viewBox", "0 0 120 260");

  // hull outline
  var hull = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
  hull.setAttribute("points", "60,10 85,60 90,130 85,200 75,240 45,240 35,200 30,130 35,60");
  hull.setAttribute("fill", "rgba(50,65,80,0.6)");
  hull.setAttribute("stroke", "#556677");
  hull.setAttribute("stroke-width", "2");
  svg.appendChild(hull);

  // system markers with labels
  var markers = [
    { cx: 60, cy: 70,  color: "#ffaa22", label: "W" },  // weapons (bow turret)
    { cx: 60, cy: 180, color: "#22aaff", label: "P" },  // propulsion (stern)
    { cx: 60, cy: 130, color: "#44dd66", label: "D" },  // defense (mid)
    { cx: 60, cy: 50,  color: "#cc66ff", label: "R" }   // radar (top)
  ];

  for (var i = 0; i < markers.length; i++) {
    var m = markers[i];
    var circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", String(m.cx));
    circle.setAttribute("cy", String(m.cy));
    circle.setAttribute("r", "12");
    circle.setAttribute("fill", m.color);
    circle.setAttribute("opacity", "0.7");
    svg.appendChild(circle);

    var text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", String(m.cx));
    text.setAttribute("y", String(m.cy + 4));
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("font-size", "12");
    text.setAttribute("font-family", "monospace");
    text.setAttribute("font-weight", "bold");
    text.setAttribute("fill", "#000");
    text.textContent = m.label;
    svg.appendChild(text);
  }

  wrap.appendChild(svg);

  // legend
  var legend = document.createElement("div");
  legend.style.cssText = "font-size:10px;color:#667788;margin-top:8px;text-align:center;line-height:1.6";
  legend.innerHTML = '<span style="color:#ffaa22">W</span>=Weapons ' +
    '<span style="color:#22aaff">P</span>=Propulsion<br>' +
    '<span style="color:#44dd66">D</span>=Defense ' +
    '<span style="color:#cc66ff">R</span>=Radar';
  wrap.appendChild(legend);

  return wrap;
}

// --- build a category panel ---
function buildCategoryPanel(catKey, cat, mob) {
  var panel = document.createElement("div");
  panel.style.cssText = [
    "background: rgba(15, 20, 35, 0.8)",
    "border: 1px solid " + cat.color + "33",
    "border-radius: 8px",
    "padding: 12px",
    mob ? "width: 100%" : "width: 180px"
  ].join(";");

  var heading = document.createElement("div");
  heading.textContent = cat.label;
  heading.style.cssText = [
    "font-size: 15px",
    "font-weight: bold",
    "color: " + cat.color,
    "margin-bottom: 10px",
    "text-align: center"
  ].join(";");
  panel.appendChild(heading);

  var upgradeEls = [];
  for (var u = 0; u < cat.upgrades.length; u++) {
    var up = cat.upgrades[u];
    var row = buildUpgradeRow(up, cat.color);
    panel.appendChild(row.el);
    upgradeEls.push(row);
  }

  categoryEls[catKey] = upgradeEls;
  return panel;
}

// --- format a multiplier value for display ---
function formatStat(key, value) {
  if (key === "armor") return Math.round(value * 100) + "%";
  if (key === "minimap") return value >= 1 ? "ON" : "OFF";
  // display multiplier as percentage
  return (value * 100).toFixed(0) + "%";
}

// --- click an upgrade: buy immediately if affordable ---
function clickUpgrade(key) {
  if (!currentState) return;

  // if there's already a pending upgrade, ignore clicks on other rows
  if (pendingKey) return;

  // toggle selection off if clicking same key
  if (selectedKey === key) {
    selectedKey = null;
    refreshPreview();
    refreshUI();
    return;
  }

  // try to buy immediately
  if (canAfford(currentState, key)) {
    if (buyUpgrade(currentState, key)) {
      playUpgrade();
      selectedKey = key;
      pendingKey = key;
      refreshPreview();
      refreshUI();
      return;
    }
  }

  // can't afford or maxed — just select for preview
  selectedKey = key;
  refreshPreview();
  refreshUI();
}

// --- refresh the preview panel ---
function refreshPreview() {
  if (!previewPanel || !currentState) return;

  // clear
  previewPanel.innerHTML = "";

  if (!selectedKey) {
    previewPanel.style.display = "none";
    return;
  }

  var info = findUpgrade(selectedKey);
  if (!info) { previewPanel.style.display = "none"; return; }

  var level = currentState.levels[selectedKey] || 0;
  var maxed = level >= 3;
  var isPending = pendingKey === selectedKey;

  previewPanel.style.display = "flex";

  if (isPending) {
    // show what was just applied, with undo/confirm
    var header = document.createElement("div");
    header.textContent = info.label + " — Tier " + level + " applied!";
    header.style.cssText = "font-size:14px;font-weight:bold;color:#44dd66;margin-bottom:4px";
    previewPanel.appendChild(header);

    // show the stat change that was applied
    var currentVal = getMultiplierForKey(currentState, selectedKey, 0);
    var prevVal = getMultiplierForKey(currentState, selectedKey, -1);
    var statLabel = STAT_LABELS[info.stat] || info.stat;

    var statRow = document.createElement("div");
    statRow.style.cssText = "font-size:13px;color:#8899aa;display:flex;align-items:center;gap:6px;flex-wrap:wrap";

    var statName = document.createElement("span");
    statName.textContent = statLabel + ": ";
    statName.style.color = "#667788";
    statRow.appendChild(statName);

    var prevSpan = document.createElement("span");
    prevSpan.textContent = formatStat(info.stat, prevVal);
    prevSpan.style.color = "#888";
    statRow.appendChild(prevSpan);

    var arrow = document.createElement("span");
    arrow.textContent = " \u2192 ";
    arrow.style.color = "#556677";
    statRow.appendChild(arrow);

    var newSpan = document.createElement("span");
    newSpan.textContent = formatStat(info.stat, currentVal);
    newSpan.style.cssText = "color:#44dd66;font-weight:bold";
    statRow.appendChild(newSpan);

    previewPanel.appendChild(statRow);

    // undo + confirm buttons
    var btnRow = document.createElement("div");
    btnRow.style.cssText = "display:flex;gap:10px;margin-top:6px";

    var undoBtn = document.createElement("button");
    undoBtn.textContent = "UNDO";
    undoBtn.style.cssText = [
      "font-family: monospace",
      "font-size: 13px",
      "padding: 6px 24px",
      "min-height: 44px",
      "background: rgba(80, 40, 40, 0.8)",
      "color: #dd6644",
      "border: 1px solid rgba(140, 60, 60, 0.6)",
      "border-radius: 4px",
      "cursor: pointer",
      "pointer-events: auto"
    ].join(";");
    undoBtn.addEventListener("click", function () {
      if (!currentState || !pendingKey) return;
      playClick();
      undoUpgrade(currentState, pendingKey);
      var undone = pendingKey;
      pendingKey = null;
      selectedKey = undone; // keep it selected so player sees current state
      refreshPreview();
      refreshUI();
    });
    btnRow.appendChild(undoBtn);

    var confirmBtn = document.createElement("button");
    confirmBtn.textContent = "CONFIRM";
    confirmBtn.style.cssText = [
      "font-family: monospace",
      "font-size: 13px",
      "padding: 6px 24px",
      "min-height: 44px",
      "background: rgba(40, 80, 60, 0.8)",
      "color: #44dd66",
      "border: 1px solid rgba(60, 140, 90, 0.6)",
      "border-radius: 4px",
      "cursor: pointer",
      "pointer-events: auto"
    ].join(";");
    confirmBtn.addEventListener("click", function () {
      playClick();
      pendingKey = null;
      selectedKey = null;
      refreshPreview();
      refreshUI();
    });
    btnRow.appendChild(confirmBtn);

    previewPanel.appendChild(btnRow);
  } else {
    // normal preview (not pending) — show info about upgrade
    var header2 = document.createElement("div");
    header2.textContent = info.label + (maxed ? " (MAX)" : " — Tier " + (level + 1));
    header2.style.cssText = "font-size:14px;font-weight:bold;color:#aabbcc;margin-bottom:4px";
    previewPanel.appendChild(header2);

    if (!maxed) {
      var cost = getNextCost(currentState, selectedKey);
      var affordable = canAfford(currentState, selectedKey);

      if (cost > 0) {
        // stat preview: current → new
        var curVal = getMultiplierForKey(currentState, selectedKey, 0);
        var nxtVal = getMultiplierForKey(currentState, selectedKey, 1);
        var sLabel = STAT_LABELS[info.stat] || info.stat;

        var sRow = document.createElement("div");
        sRow.style.cssText = "font-size:13px;color:#8899aa;display:flex;align-items:center;gap:6px;flex-wrap:wrap";

        var sName = document.createElement("span");
        sName.textContent = sLabel + ": ";
        sName.style.color = "#667788";
        sRow.appendChild(sName);

        var curSpan = document.createElement("span");
        curSpan.textContent = formatStat(info.stat, curVal);
        curSpan.style.color = "#aabbcc";
        sRow.appendChild(curSpan);

        var arr = document.createElement("span");
        arr.textContent = " \u2192 ";
        arr.style.color = "#556677";
        sRow.appendChild(arr);

        var nxtSpan = document.createElement("span");
        nxtSpan.textContent = formatStat(info.stat, nxtVal);
        nxtSpan.style.cssText = "color:#44dd66;font-weight:bold";
        sRow.appendChild(nxtSpan);

        previewPanel.appendChild(sRow);

        // cost line
        var costLine = document.createElement("div");
        costLine.textContent = "Cost: " + cost + " salvage";
        costLine.style.cssText = "font-size:12px;color:" + (affordable ? "#ffcc44" : "#664422") + ";margin-top:2px";
        previewPanel.appendChild(costLine);

        if (!affordable) {
          var hint = document.createElement("div");
          hint.textContent = "Not enough salvage";
          hint.style.cssText = "font-size:11px;color:#664422;margin-top:2px";
          previewPanel.appendChild(hint);
        } else {
          var hint2 = document.createElement("div");
          hint2.textContent = isMobile() ? "Tap to purchase" : "Click to purchase";
          hint2.style.cssText = "font-size:11px;color:#667788;margin-top:2px";
          previewPanel.appendChild(hint2);
        }
      }
    }
  }
}

// --- build a single upgrade row ---
function buildUpgradeRow(up, color) {
  var _mob = isMobile();
  var el = document.createElement("div");
  el.style.cssText = [
    "margin-bottom: 8px",
    "padding: " + (_mob ? "10px" : "6px"),
    "min-height: 44px",
    "border-radius: 4px",
    "background: rgba(20, 25, 40, 0.6)",
    "cursor: pointer",
    "transition: background 0.15s"
  ].join(";");

  // label
  var label = document.createElement("div");
  label.textContent = up.label;
  label.style.cssText = "font-size:" + (_mob ? "14px" : "12px") + ";color:#8899aa;margin-bottom:4px";
  el.appendChild(label);

  // tier pips
  var pips = document.createElement("div");
  pips.style.cssText = "display:flex;gap:3px;margin-bottom:4px";
  var pipEls = [];
  for (var t = 0; t < 3; t++) {
    var pip = document.createElement("div");
    pip.style.cssText = [
      "width: " + (_mob ? "20px" : "14px"),
      "height: " + (_mob ? "8px" : "6px"),
      "border-radius: 2px",
      "background: rgba(40, 50, 70, 0.8)",
      "border: 1px solid rgba(80, 100, 130, 0.3)"
    ].join(";");
    pips.appendChild(pip);
    pipEls.push(pip);
  }
  el.appendChild(pips);

  // cost label
  var costLabel = document.createElement("div");
  costLabel.style.cssText = "font-size:" + (_mob ? "13px" : "11px") + ";color:#667788";
  el.appendChild(costLabel);

  // click to buy immediately (or select for preview if can't afford)
  el.addEventListener("click", function () {
    playClick();
    clickUpgrade(up.key);
  });

  return {
    el: el,
    key: up.key,
    pipEls: pipEls,
    costLabel: costLabel,
    color: color
  };
}

// --- refresh all UI elements ---
function refreshUI() {
  if (!currentState || !root) return;

  salvageLabel.textContent = "Salvage: " + currentState.salvage;

  var tree = getUpgradeTree();
  var cats = Object.keys(tree);

  for (var c = 0; c < cats.length; c++) {
    var catKey = cats[c];
    var rows = categoryEls[catKey];
    if (!rows) continue;

    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      var level = currentState.levels[row.key] || 0;
      var cost = getNextCost(currentState, row.key);
      var affordable = canAfford(currentState, row.key);
      var isSelected = selectedKey === row.key;
      var isPending = pendingKey === row.key;

      // update pips
      for (var t = 0; t < 3; t++) {
        if (t < level) {
          row.pipEls[t].style.background = row.color;
          row.pipEls[t].style.borderColor = row.color;
        } else {
          row.pipEls[t].style.background = "rgba(40, 50, 70, 0.8)";
          row.pipEls[t].style.borderColor = "rgba(80, 100, 130, 0.3)";
        }
      }

      // highlight selected/pending row
      if (isPending) {
        row.el.style.background = "rgba(40, 70, 55, 0.8)";
        row.el.style.outline = "1px solid #44dd6666";
      } else if (isSelected) {
        row.el.style.background = "rgba(40, 55, 80, 0.8)";
        row.el.style.outline = "1px solid " + row.color + "66";
      } else {
        row.el.style.background = "rgba(20, 25, 40, 0.6)";
        row.el.style.outline = "none";
      }

      // update cost display
      if (level >= 3) {
        row.costLabel.textContent = "MAX";
        row.costLabel.style.color = row.color;
      } else if (cost <= 0) {
        row.costLabel.textContent = "N/A";
        row.costLabel.style.color = "#445566";
      } else {
        row.costLabel.textContent = cost + " salvage";
        row.costLabel.style.color = affordable ? "#aabbcc" : "#556677";
      }
    }
  }

  // continue button: disabled while an upgrade is pending
  if (pendingKey) {
    continueBtn.style.background = "rgba(40, 40, 50, 0.6)";
    continueBtn.style.color = "#556677";
    continueBtn.style.borderColor = "rgba(60, 60, 70, 0.3)";
    continueBtn.style.cursor = "default";
  } else {
    continueBtn.style.background = "rgba(40, 80, 60, 0.8)";
    continueBtn.style.color = "#44dd66";
    continueBtn.style.borderColor = "rgba(60, 140, 90, 0.6)";
    continueBtn.style.cursor = "pointer";
  }
}

// --- show upgrade screen ---
export function showUpgradeScreen(upgradeState, closeCb) {
  if (!root) return;
  currentState = upgradeState;
  onCloseCallback = closeCb;
  selectedKey = null;
  pendingKey = null;
  refreshUI();
  refreshPreview();
  root.style.display = "flex";
}

// --- hide upgrade screen ---
export function hideUpgradeScreen() {
  if (!root) return;
  root.style.display = "none";
  currentState = null;
  selectedKey = null;
  pendingKey = null;
}

// --- is upgrade screen visible? ---
export function isUpgradeScreenVisible() {
  return root && root.style.display !== "none";
}
