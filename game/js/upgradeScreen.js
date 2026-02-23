// upgradeScreen.js — between-wave upgrade UI overlay styled as ship blueprint scroll
import { getUpgradeTree, canAfford, buyUpgrade, getNextCost, getMultiplierForKey, findUpgrade, undoUpgrade } from "./upgrade.js";
import { playUpgrade, playClick } from "./soundFx.js";
import { isMobile } from "./mobile.js";
import { T, FONT, SCROLL_BG, PARCHMENT_BG, PARCHMENT_SHADOW } from "./theme.js";

var root = null;
var salvageLabel = null;
var categoryEls = {};
var categoryPanels = {};  // catKey -> panel DOM element (for mobile tab switching)
var onCloseCallback = null;
var currentState = null;
var continueBtn = null;
var selectedKey = null;   // currently highlighted upgrade key
var pendingKey = null;     // upgrade just applied, showing inline undo
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
    "background:" + T.bgOverlay,
    "z-index: 90",
    "font-family:" + FONT,
    "user-select: none",
    "overflow-y: auto",
    _mob ? "padding: 12px 0" : ""
  ].join(";");

  // title — ship blueprint scroll style
  var title = document.createElement("div");
  title.textContent = "SHIP BLUEPRINTS";
  title.style.cssText = [
    "font-size: " + (_mob ? "24px" : "36px"),
    "font-weight: bold",
    "color:" + T.gold,
    "margin-bottom: 8px",
    "margin-top: " + (_mob ? "10px" : "20px"),
    "text-shadow: 0 2px 4px rgba(0,0,0,0.6)",
    "letter-spacing: 3px"
  ].join(";");
  root.appendChild(title);

  // salvage display
  salvageLabel = document.createElement("div");
  salvageLabel.style.cssText = [
    "font-size: " + (_mob ? "16px" : "18px"),
    "color:" + T.gold,
    "margin-bottom: " + (_mob ? "12px" : "20px"),
    "text-shadow: 0 1px 2px rgba(0,0,0,0.4)"
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

  // continue button
  continueBtn = document.createElement("button");
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
    pendingKey = null;
    selectedKey = null;
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
      btn.style.background = T.bgLight;
      btn.style.borderColor = tree[k].color + "33";
    }
  }
}

// --- build ship diagram (SVG top-down view) — blueprint style ---
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

  // hull outline — blueprint style (warm brown on dark)
  var hull = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
  hull.setAttribute("points", "60,10 85,60 90,130 85,200 75,240 45,240 35,200 30,130 35,60");
  hull.setAttribute("fill", "rgba(60,45,28,0.4)");
  hull.setAttribute("stroke", T.text);
  hull.setAttribute("stroke-width", "2");
  hull.setAttribute("stroke-dasharray", "6,3");
  svg.appendChild(hull);

  // system markers with labels
  var markers = [
    { cx: 60, cy: 70,  color: "#cc8822", label: "W" },  // weapons (bow turret)
    { cx: 60, cy: 180, color: T.blueBright, label: "P" },  // propulsion (stern)
    { cx: 60, cy: 130, color: T.greenBright, label: "D" },  // defense (mid)
    { cx: 60, cy: 50,  color: T.purple, label: "R" }   // radar (top)
  ];

  for (var i = 0; i < markers.length; i++) {
    var m = markers[i];
    var circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", String(m.cx));
    circle.setAttribute("cy", String(m.cy));
    circle.setAttribute("r", "12");
    circle.setAttribute("fill", m.color);
    circle.setAttribute("opacity", "0.6");
    svg.appendChild(circle);

    var text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", String(m.cx));
    text.setAttribute("y", String(m.cy + 4));
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("font-size", "12");
    text.setAttribute("font-family", "serif");
    text.setAttribute("font-weight", "bold");
    text.setAttribute("fill", "#1a1408");
    text.textContent = m.label;
    svg.appendChild(text);
  }

  wrap.appendChild(svg);

  // legend
  var legend = document.createElement("div");
  legend.style.cssText = "font-size:10px;color:" + T.textDim + ";margin-top:8px;text-align:center;line-height:1.6;font-family:" + FONT;
  legend.innerHTML = '<span style="color:#cc8822">W</span>=Weapons ' +
    '<span style="color:' + T.blueBright + '">P</span>=Propulsion<br>' +
    '<span style="color:' + T.greenBright + '">D</span>=Defense ' +
    '<span style="color:' + T.purple + '">R</span>=Radar';
  wrap.appendChild(legend);

  return wrap;
}

// --- build a category panel ---
function buildCategoryPanel(catKey, cat, mob) {
  var panel = document.createElement("div");
  panel.style.cssText = [
    PARCHMENT_BG,
    "border: 1px solid " + cat.color + "33",
    "border-radius: 6px",
    "padding: 12px",
    mob ? "width: 100%" : "width: 180px",
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
  if (pendingKey && pendingKey !== key) return;

  // if clicking the pending row, ignore (use undo button instead)
  if (pendingKey === key) return;

  // toggle selection off if clicking same key
  if (selectedKey === key) {
    selectedKey = null;
    refreshUI();
    return;
  }

  // try to buy immediately
  if (canAfford(currentState, key)) {
    if (buyUpgrade(currentState, key)) {
      playUpgrade();
      selectedKey = key;
      pendingKey = key;
      refreshUI();
      return;
    }
  }

  // can't afford or maxed — just select for preview
  selectedKey = key;
  refreshUI();
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
    "background: rgba(30, 22, 14, 0.5)",
    "cursor: pointer",
    "transition: background 0.15s"
  ].join(";");

  // label
  var label = document.createElement("div");
  label.textContent = up.label;
  label.style.cssText = "font-size:" + (_mob ? "14px" : "12px") + ";color:" + T.text + ";margin-bottom:4px;text-shadow:0 1px 1px rgba(0,0,0,0.3)";
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
      "background: rgba(40, 30, 18, 0.6)",
      "border: 1px solid " + T.border
    ].join(";");
    pips.appendChild(pip);
    pipEls.push(pip);
  }
  el.appendChild(pips);

  // cost label
  var costLabel = document.createElement("div");
  costLabel.style.cssText = "font-size:" + (_mob ? "13px" : "11px") + ";color:" + T.textDim;
  el.appendChild(costLabel);

  // inline detail area (stat change + undo) — hidden by default
  var inlineDetail = document.createElement("div");
  inlineDetail.style.cssText = "display:none;margin-top:6px";
  el.appendChild(inlineDetail);

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
    inlineDetail: inlineDetail,
    color: color
  };
}

// --- render inline detail content for a row ---
function renderInlineDetail(row) {
  var detail = row.inlineDetail;
  detail.innerHTML = "";

  if (!currentState) { detail.style.display = "none"; return; }

  var isPending = pendingKey === row.key;
  var isSelected = selectedKey === row.key;

  if (!isPending && !isSelected) {
    detail.style.display = "none";
    return;
  }

  var info = findUpgrade(row.key);
  if (!info) { detail.style.display = "none"; return; }

  var level = currentState.levels[row.key] || 0;
  var _mob = isMobile();

  if (isPending) {
    // show applied stat change + undo button inline
    detail.style.display = "block";

    var currentVal = getMultiplierForKey(currentState, row.key, 0);
    var prevVal = getMultiplierForKey(currentState, row.key, -1);
    var statLabel = STAT_LABELS[info.stat] || info.stat;

    var statRow = document.createElement("div");
    statRow.style.cssText = "font-size:" + (_mob ? "13px" : "12px") + ";color:" + T.text + ";display:flex;align-items:center;gap:4px;flex-wrap:wrap";

    var statName = document.createElement("span");
    statName.textContent = statLabel + ": ";
    statName.style.color = T.textDim;
    statRow.appendChild(statName);

    var prevSpan = document.createElement("span");
    prevSpan.textContent = formatStat(info.stat, prevVal);
    prevSpan.style.color = T.textDim;
    statRow.appendChild(prevSpan);

    var arrow = document.createElement("span");
    arrow.textContent = " \u2192 ";
    arrow.style.color = T.textDark;
    statRow.appendChild(arrow);

    var newSpan = document.createElement("span");
    newSpan.textContent = formatStat(info.stat, currentVal);
    newSpan.style.cssText = "color:" + T.greenBright + ";font-weight:bold";
    statRow.appendChild(newSpan);

    detail.appendChild(statRow);

    // undo button
    var undoBtn = document.createElement("button");
    undoBtn.textContent = "UNDO";
    undoBtn.style.cssText = [
      "font-family:" + FONT,
      "font-size: " + (_mob ? "13px" : "12px"),
      "padding: " + (_mob ? "6px 20px" : "4px 16px"),
      "min-height: 44px",
      "margin-top: 6px",
      "background: rgba(80, 30, 20, 0.7)",
      "color:" + T.redBright,
      "border: 1px solid " + T.red + "88",
      "border-radius: 4px",
      "cursor: pointer",
      "pointer-events: auto"
    ].join(";");
    undoBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (!currentState || !pendingKey) return;
      playClick();
      undoUpgrade(currentState, pendingKey);
      var undone = pendingKey;
      pendingKey = null;
      selectedKey = null;
      refreshUI();
    });
    detail.appendChild(undoBtn);
  } else if (isSelected) {
    // show cost preview inline
    var maxed = level >= 3;

    if (maxed) {
      detail.style.display = "none";
      return;
    }

    var cost = getNextCost(currentState, row.key);
    if (cost <= 0) { detail.style.display = "none"; return; }

    detail.style.display = "block";

    var affordable = canAfford(currentState, row.key);

    // stat preview: current -> new
    var curVal = getMultiplierForKey(currentState, row.key, 0);
    var nxtVal = getMultiplierForKey(currentState, row.key, 1);
    var sLabel = STAT_LABELS[info.stat] || info.stat;

    var sRow = document.createElement("div");
    sRow.style.cssText = "font-size:" + (_mob ? "13px" : "12px") + ";color:" + T.text + ";display:flex;align-items:center;gap:4px;flex-wrap:wrap";

    var sName = document.createElement("span");
    sName.textContent = sLabel + ": ";
    sName.style.color = T.textDim;
    sRow.appendChild(sName);

    var curSpan = document.createElement("span");
    curSpan.textContent = formatStat(info.stat, curVal);
    curSpan.style.color = T.textLight;
    sRow.appendChild(curSpan);

    var arr = document.createElement("span");
    arr.textContent = " \u2192 ";
    arr.style.color = T.textDark;
    sRow.appendChild(arr);

    var nxtSpan = document.createElement("span");
    nxtSpan.textContent = formatStat(info.stat, nxtVal);
    nxtSpan.style.cssText = "color:" + T.greenBright + ";font-weight:bold";
    sRow.appendChild(nxtSpan);

    detail.appendChild(sRow);

    // cost line
    var costLine = document.createElement("div");
    costLine.textContent = "Cost: " + cost + " gold";
    costLine.style.cssText = "font-size:" + (_mob ? "12px" : "11px") + ";color:" + (affordable ? T.gold : T.brownDark) + ";margin-top:2px";
    detail.appendChild(costLine);

    if (!affordable) {
      var hint = document.createElement("div");
      hint.textContent = "Not enough gold";
      hint.style.cssText = "font-size:11px;color:" + T.brownDark + ";margin-top:2px";
      detail.appendChild(hint);
    } else {
      var hint2 = document.createElement("div");
      hint2.textContent = _mob ? "Tap to purchase" : "Click to purchase";
      hint2.style.cssText = "font-size:11px;color:" + T.textDim + ";margin-top:2px";
      detail.appendChild(hint2);
    }
  }
}

// --- refresh all UI elements ---
function refreshUI() {
  if (!currentState || !root) return;

  salvageLabel.textContent = "\uD83E\uDE99 Gold: " + currentState.gold;

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
          row.pipEls[t].style.background = "rgba(40, 30, 18, 0.6)";
          row.pipEls[t].style.borderColor = T.border;
        }
      }

      // highlight selected/pending row
      if (isPending) {
        row.el.style.background = "rgba(50, 60, 30, 0.7)";
        row.el.style.outline = "1px solid " + T.greenBright + "66";
      } else if (isSelected) {
        row.el.style.background = "rgba(50, 40, 25, 0.7)";
        row.el.style.outline = "1px solid " + row.color + "66";
      } else {
        row.el.style.background = "rgba(30, 22, 14, 0.5)";
        row.el.style.outline = "none";
      }

      // update cost display
      if (level >= 3) {
        row.costLabel.textContent = "MAX";
        row.costLabel.style.color = row.color;
      } else if (cost <= 0) {
        row.costLabel.textContent = "N/A";
        row.costLabel.style.color = T.textDark;
      } else {
        row.costLabel.textContent = cost + " gold";
        row.costLabel.style.color = affordable ? T.textLight : T.textDark;
      }

      // render inline detail
      renderInlineDetail(row);
    }
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
