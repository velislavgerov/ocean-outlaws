// techScreen.js — tech tree visual UI with node-graph and connecting lines
import {
  getTechBranches, isUnlocked, canUnlock, unlockNode,
  getNextIndex, getTechBonuses, loadTechState
} from "./techTree.js";
import { isMobile } from "./mobile.js";

var root = null;
var currentState = null;
var currentSalvage = null;     // { get, spend } callbacks
var onCloseCallback = null;
var branchEls = {};            // branchKey -> { nodeEls: [...], lineEls: [...] }
var salvageLabel = null;

// --- create tech screen DOM (called once) ---
export function createTechScreen() {
  root = document.createElement("div");
  root.id = "tech-screen";
  root.style.cssText = [
    "position: fixed",
    "top: 0", "left: 0",
    "width: 100%", "height: 100%",
    "display: none",
    "flex-direction: column",
    "align-items: center",
    "justify-content: flex-start",
    "background: rgba(5, 5, 15, 0.94)",
    "z-index: 92",
    "font-family: monospace",
    "user-select: none",
    "overflow-y: auto",
    "padding: 20px 0"
  ].join(";");

  // title
  var title = document.createElement("div");
  title.textContent = "TECH TREE";
  title.style.cssText = [
    "font-size: 36px",
    "font-weight: bold",
    "color: #ffcc44",
    "margin-bottom: 4px",
    "text-shadow: 0 0 15px rgba(255,200,60,0.4)"
  ].join(";");
  root.appendChild(title);

  var subtitle = document.createElement("div");
  subtitle.textContent = "Permanent upgrades — persists across runs";
  subtitle.style.cssText = "font-size:13px;color:#667788;margin-bottom:8px";
  root.appendChild(subtitle);

  // salvage display
  salvageLabel = document.createElement("div");
  salvageLabel.style.cssText = [
    "font-size: 18px",
    "color: #ffcc44",
    "margin-bottom: 16px"
  ].join(";");
  root.appendChild(salvageLabel);

  // branches container
  var branchesRow = document.createElement("div");
  branchesRow.style.cssText = [
    "display: flex",
    "flex-wrap: wrap",
    "justify-content: center",
    "gap: 24px",
    "max-width: 1000px",
    "width: 95%",
    "margin-bottom: 20px"
  ].join(";");
  root.appendChild(branchesRow);

  // build each branch
  var branches = getTechBranches();
  var branchKeys = Object.keys(branches);
  for (var b = 0; b < branchKeys.length; b++) {
    var bKey = branchKeys[b];
    var branch = branches[bKey];
    var branchPanel = buildBranchPanel(bKey, branch);
    branchesRow.appendChild(branchPanel.el);
    branchEls[bKey] = branchPanel;
  }

  // continue button
  var btn = document.createElement("button");
  btn.textContent = "CONTINUE";
  btn.style.cssText = [
    "font-family: monospace",
    "font-size: 20px",
    "padding: 14px 48px",
    "min-height: 44px",
    "margin-top: 10px",
    "margin-bottom: 20px",
    "background: rgba(40, 80, 60, 0.8)",
    "color: #44dd66",
    "border: 1px solid rgba(60, 140, 90, 0.6)",
    "border-radius: 6px",
    "cursor: pointer",
    "pointer-events: auto",
    "text-shadow: 0 0 10px rgba(60,200,90,0.3)"
  ].join(";");
  btn.addEventListener("click", function () {
    hideTechScreen();
    if (onCloseCallback) onCloseCallback();
  });
  root.appendChild(btn);

  document.body.appendChild(root);
}

// --- build a branch panel with node-graph ---
function buildBranchPanel(branchKey, branch) {
  var el = document.createElement("div");
  el.style.cssText = [
    "background: rgba(15, 20, 35, 0.8)",
    "border: 1px solid " + branch.color + "33",
    "border-radius: 10px",
    "padding: 16px",
    "width: 280px",
    "display: flex",
    "flex-direction: column",
    "align-items: center"
  ].join(";");

  // branch heading
  var heading = document.createElement("div");
  heading.textContent = branch.label;
  heading.style.cssText = [
    "font-size: 18px",
    "font-weight: bold",
    "color: " + branch.color,
    "margin-bottom: 12px",
    "text-align: center",
    "text-shadow: 0 0 10px " + branch.color + "44"
  ].join(";");
  el.appendChild(heading);

  // node graph container (relative for line positioning)
  var graphWrap = document.createElement("div");
  graphWrap.style.cssText = [
    "position: relative",
    "width: 100%",
    "display: flex",
    "flex-direction: column",
    "align-items: center",
    "gap: 0"
  ].join(";");
  el.appendChild(graphWrap);

  var nodeEls = [];
  var lineEls = [];

  for (var n = 0; n < branch.nodes.length; n++) {
    // connecting line (before nodes 1-4)
    if (n > 0) {
      var line = document.createElement("div");
      line.style.cssText = [
        "width: 3px",
        "height: 20px",
        "background: " + branch.color + "33",
        "margin: 0 auto"
      ].join(";");
      graphWrap.appendChild(line);
      lineEls.push(line);
    }

    var nodeEl = buildNodeEl(branchKey, n, branch);
    graphWrap.appendChild(nodeEl.el);
    nodeEls.push(nodeEl);
  }

  return { el: el, nodeEls: nodeEls, lineEls: lineEls, color: branch.color };
}

// --- build a single tech node element ---
function buildNodeEl(branchKey, nodeIndex, branch) {
  var node = branch.nodes[nodeIndex];

  var el = document.createElement("div");
  el.style.cssText = [
    "width: 240px",
    "padding: 10px 12px",
    "min-height: 44px",
    "border-radius: 8px",
    "background: rgba(20, 25, 40, 0.7)",
    "border: 2px solid " + branch.color + "33",
    "cursor: pointer",
    "pointer-events: auto",
    "transition: border-color 0.2s, background 0.2s"
  ].join(";");

  // top row: icon + name
  var topRow = document.createElement("div");
  topRow.style.cssText = "display:flex;align-items:center;gap:8px;margin-bottom:4px";

  var icon = document.createElement("div");
  icon.style.cssText = [
    "width: 28px",
    "height: 28px",
    "border-radius: 50%",
    "background: " + branch.color + "22",
    "border: 2px solid " + branch.color + "55",
    "display: flex",
    "align-items: center",
    "justify-content: center",
    "font-size: 14px",
    "color: " + branch.color,
    "font-weight: bold",
    "flex-shrink: 0"
  ].join(";");
  icon.textContent = String(nodeIndex + 1);
  topRow.appendChild(icon);

  var nameEl = document.createElement("div");
  nameEl.style.cssText = "font-size:14px;font-weight:bold;color:#ccddee";
  nameEl.textContent = node.label;
  topRow.appendChild(nameEl);

  el.appendChild(topRow);

  // description
  var descEl = document.createElement("div");
  descEl.style.cssText = "font-size:11px;color:#8899aa;margin-bottom:6px;margin-left:36px";
  descEl.textContent = node.desc;
  el.appendChild(descEl);

  // cost row
  var costRow = document.createElement("div");
  costRow.style.cssText = "display:flex;justify-content:space-between;align-items:center;margin-left:36px";

  var costLabel = document.createElement("span");
  costLabel.style.cssText = "font-size:12px;color:#667788";
  costRow.appendChild(costLabel);

  var statusLabel = document.createElement("span");
  statusLabel.style.cssText = "font-size:11px;font-weight:bold";
  costRow.appendChild(statusLabel);

  el.appendChild(costRow);

  // click handler
  el.addEventListener("click", function () {
    if (!currentState || !currentSalvage) return;
    var salvage = currentSalvage.get();
    if (canUnlock(currentState, branchKey, nodeIndex, salvage)) {
      var cost = unlockNode(currentState, branchKey, nodeIndex, salvage);
      if (cost > 0) {
        currentSalvage.spend(cost);
        refreshUI();
      }
    }
  });

  return {
    el: el,
    icon: icon,
    nameEl: nameEl,
    costLabel: costLabel,
    statusLabel: statusLabel,
    branchKey: branchKey,
    nodeIndex: nodeIndex,
    color: branch.color
  };
}

// --- refresh all UI ---
function refreshUI() {
  if (!currentState || !root) return;

  var salvage = currentSalvage ? currentSalvage.get() : 0;
  salvageLabel.textContent = "Salvage: " + salvage;

  var branches = getTechBranches();
  var branchKeys = Object.keys(branches);

  for (var b = 0; b < branchKeys.length; b++) {
    var bKey = branchKeys[b];
    var branch = branches[bKey];
    var bPanel = branchEls[bKey];
    if (!bPanel) continue;

    var nextIdx = getNextIndex(currentState, bKey);

    for (var n = 0; n < branch.nodes.length; n++) {
      var node = branch.nodes[n];
      var nEl = bPanel.nodeEls[n];
      var unlocked = isUnlocked(currentState, node.key);
      var isNext = (n === nextIdx);
      var affordable = isNext && salvage >= node.cost;

      if (unlocked) {
        // unlocked: bright
        nEl.el.style.borderColor = bPanel.color;
        nEl.el.style.background = bPanel.color + "22";
        nEl.icon.style.background = bPanel.color;
        nEl.icon.style.borderColor = bPanel.color;
        nEl.icon.style.color = "#000";
        nEl.nameEl.style.color = "#ffffff";
        nEl.costLabel.textContent = "";
        nEl.statusLabel.textContent = "UNLOCKED";
        nEl.statusLabel.style.color = bPanel.color;
        nEl.el.style.cursor = "default";
      } else if (isNext) {
        // next available
        nEl.el.style.borderColor = affordable ? bPanel.color + "aa" : bPanel.color + "44";
        nEl.el.style.background = affordable ? "rgba(30, 40, 60, 0.8)" : "rgba(20, 25, 40, 0.7)";
        nEl.icon.style.background = bPanel.color + "33";
        nEl.icon.style.borderColor = bPanel.color + "88";
        nEl.icon.style.color = bPanel.color;
        nEl.nameEl.style.color = "#aabbcc";
        nEl.costLabel.textContent = node.cost + " salvage";
        nEl.costLabel.style.color = affordable ? "#aabbcc" : "#556677";
        nEl.statusLabel.textContent = affordable ? "UNLOCK" : "LOCKED";
        nEl.statusLabel.style.color = affordable ? "#44dd66" : "#556677";
        nEl.el.style.cursor = affordable ? "pointer" : "default";
      } else {
        // locked (prerequisite not met)
        nEl.el.style.borderColor = "#222233";
        nEl.el.style.background = "rgba(15, 18, 30, 0.5)";
        nEl.icon.style.background = "#1a1a2a";
        nEl.icon.style.borderColor = "#333344";
        nEl.icon.style.color = "#444455";
        nEl.nameEl.style.color = "#445566";
        nEl.costLabel.textContent = node.cost + " salvage";
        nEl.costLabel.style.color = "#334455";
        nEl.statusLabel.textContent = "LOCKED";
        nEl.statusLabel.style.color = "#334455";
        nEl.el.style.cursor = "default";
      }
    }

    // update connecting lines
    for (var l = 0; l < bPanel.lineEls.length; l++) {
      var prevUnlocked = isUnlocked(currentState, branch.nodes[l].key);
      var nextUnlocked = isUnlocked(currentState, branch.nodes[l + 1].key);
      if (prevUnlocked && nextUnlocked) {
        bPanel.lineEls[l].style.background = bPanel.color;
      } else if (prevUnlocked) {
        bPanel.lineEls[l].style.background = bPanel.color + "66";
      } else {
        bPanel.lineEls[l].style.background = bPanel.color + "22";
      }
    }
  }
}

// --- show tech screen ---
export function showTechScreen(techState, salvageCallbacks, closeCb) {
  if (!root) return;
  currentState = techState;
  currentSalvage = salvageCallbacks;
  onCloseCallback = closeCb;
  refreshUI();
  root.style.display = "flex";
}

// --- hide tech screen ---
export function hideTechScreen() {
  if (!root) return;
  root.style.display = "none";
  currentState = null;
  currentSalvage = null;
}

// --- is tech screen visible? ---
export function isTechScreenVisible() {
  return root && root.style.display !== "none";
}
