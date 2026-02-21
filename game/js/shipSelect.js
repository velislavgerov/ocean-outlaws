// shipSelect.js — ship class selection screen before game start
import { getClassOrder, getAllClasses } from "./shipClass.js";
import { getTotalSpent, respecUpgrades } from "./upgrade.js";
import { isMobile } from "./mobile.js";

var overlay = null;
export function getShipSelectOverlay() { return overlay; }
var onSelectCallback = null;
var resetBtn = null;
var confirmDialog = null;
var currentUpgradeState = null;

export function createShipSelectScreen() {
  overlay = document.createElement("div");
  overlay.style.cssText = [
    "position: fixed",
    "top: 0",
    "left: 0",
    "width: 100%",
    "height: 100%",
    "display: flex",
    "flex-direction: column",
    "align-items: center",
    "justify-content: flex-start",
    "background: rgba(5, 5, 15, 0.92)",
    "z-index: 200",
    "font-family: monospace",
    "user-select: none",
    "overflow-y: auto",
    "padding: 20px 0"
  ].join(";");

  var title = document.createElement("div");
  title.textContent = "CHOOSE YOUR SHIP";
  var _mobTitle = isMobile();
  title.style.cssText = [
    "font-size: " + (_mobTitle ? "24px" : "32px"),
    "font-weight: bold",
    "color: #8899aa",
    "margin-bottom: " + (_mobTitle ? "16px" : "32px"),
    "margin-top: 16px",
    "text-shadow: 0 0 20px rgba(100,140,200,0.3)"
  ].join(";");
  overlay.appendChild(title);

  var grid = document.createElement("div");
  var _mob = isMobile();
  grid.style.cssText = [
    "display: flex",
    "gap: " + (_mob ? "10px" : "16px"),
    "flex-wrap: wrap",
    "justify-content: center",
    "max-width: 800px",
    "width: 95%",
    "padding: 0 8px"
  ].join(";");

  var order = getClassOrder();
  var classes = getAllClasses();

  for (var i = 0; i < order.length; i++) {
    var cls = classes[order[i]];
    var card = buildCard(cls);
    grid.appendChild(card);
  }

  overlay.appendChild(grid);

  var hint = document.createElement("div");
  hint.textContent = isMobile() ? "Tap a ship to start" : "Click a ship to start";
  hint.style.cssText = [
    "font-size: 14px",
    "color: #556677",
    "margin-top: 24px"
  ].join(";");
  overlay.appendChild(hint);

  // reset upgrades button
  resetBtn = document.createElement("button");
  resetBtn.textContent = "RESET UPGRADES";
  resetBtn.style.cssText = [
    "font-family: monospace",
    "font-size: 14px",
    "padding: 10px 28px",
    "margin-top: 16px",
    "background: rgba(80, 30, 30, 0.7)",
    "color: #cc6666",
    "border: 1px solid rgba(160, 60, 60, 0.5)",
    "border-radius: 6px",
    "cursor: pointer",
    "pointer-events: auto",
    "display: none",
    "min-height: 44px"
  ].join(";");
  resetBtn.addEventListener("click", function () {
    showResetConfirm();
  });
  overlay.appendChild(resetBtn);

  // confirmation dialog (hidden by default)
  confirmDialog = document.createElement("div");
  confirmDialog.style.cssText = [
    "position: fixed",
    "top: 0", "left: 0",
    "width: 100%", "height: 100%",
    "display: none",
    "align-items: center",
    "justify-content: center",
    "background: rgba(0, 0, 0, 0.7)",
    "z-index: 210",
    "font-family: monospace"
  ].join(";");

  var dialogBox = document.createElement("div");
  dialogBox.style.cssText = [
    "background: rgba(15, 20, 35, 0.95)",
    "border: 1px solid rgba(160, 60, 60, 0.5)",
    "border-radius: 8px",
    "padding: 24px 32px",
    "text-align: center",
    "max-width: 350px"
  ].join(";");

  var dialogText = document.createElement("div");
  dialogText.textContent = "Are you sure? This resets all upgrades.";
  dialogText.style.cssText = "font-size:15px;color:#cc9999;margin-bottom:20px";
  dialogBox.appendChild(dialogText);

  var dialogRefund = document.createElement("div");
  dialogRefund.id = "reset-refund-label";
  dialogRefund.style.cssText = "font-size:13px;color:#ffcc44;margin-bottom:16px";
  dialogBox.appendChild(dialogRefund);

  var btnRow = document.createElement("div");
  btnRow.style.cssText = "display:flex;gap:12px;justify-content:center";

  var confirmBtn = document.createElement("button");
  confirmBtn.textContent = "CONFIRM RESET";
  confirmBtn.style.cssText = [
    "font-family: monospace",
    "font-size: 13px",
    "padding: 8px 20px",
    "background: rgba(120, 30, 30, 0.8)",
    "color: #ff6666",
    "border: 1px solid rgba(200, 60, 60, 0.6)",
    "border-radius: 4px",
    "cursor: pointer",
    "pointer-events: auto",
    "min-height: 44px"
  ].join(";");
  confirmBtn.addEventListener("click", function () {
    if (currentUpgradeState) {
      respecUpgrades(currentUpgradeState);
    }
    hideResetConfirm();
    updateResetButton();
  });
  btnRow.appendChild(confirmBtn);

  var cancelBtn = document.createElement("button");
  cancelBtn.textContent = "CANCEL";
  cancelBtn.style.cssText = [
    "font-family: monospace",
    "font-size: 13px",
    "padding: 8px 20px",
    "background: rgba(40, 50, 70, 0.8)",
    "color: #8899aa",
    "border: 1px solid rgba(80, 100, 130, 0.4)",
    "border-radius: 4px",
    "cursor: pointer",
    "pointer-events: auto",
    "min-height: 44px"
  ].join(";");
  cancelBtn.addEventListener("click", function () {
    hideResetConfirm();
  });
  btnRow.appendChild(cancelBtn);

  dialogBox.appendChild(btnRow);
  confirmDialog.appendChild(dialogBox);
  document.body.appendChild(confirmDialog);

  document.body.appendChild(overlay);
}

function showResetConfirm() {
  if (!confirmDialog || !currentUpgradeState) return;
  var refund = getTotalSpent(currentUpgradeState);
  var refundLabel = confirmDialog.querySelector("#reset-refund-label");
  if (refundLabel) {
    refundLabel.textContent = "Refund: " + refund + " salvage";
  }
  confirmDialog.style.display = "flex";
}

function hideResetConfirm() {
  if (confirmDialog) confirmDialog.style.display = "none";
}

function updateResetButton() {
  if (!resetBtn) return;
  if (!currentUpgradeState) {
    resetBtn.style.display = "none";
    return;
  }
  var spent = getTotalSpent(currentUpgradeState);
  resetBtn.style.display = spent > 0 ? "inline-block" : "none";
}

function buildCard(cls) {
  var _mob = isMobile();
  var card = document.createElement("div");
  card.style.cssText = [
    _mob ? "width:calc(50% - 8px);min-width:140px" : "width: 170px",
    "padding: " + (_mob ? "12px" : "16px"),
    "background: rgba(20, 30, 50, 0.8)",
    "border: 2px solid rgba(80, 100, 130, 0.4)",
    "border-radius: 8px",
    "cursor: pointer",
    "pointer-events: auto",
    "transition: border-color 0.2s"
  ].join(";");

  // touch-friendly: highlight on active instead of hover
  card.addEventListener("touchstart", function () {
    card.style.borderColor = cls.color;
  }, { passive: true });
  card.addEventListener("touchend", function () {
    card.style.borderColor = "rgba(80, 100, 130, 0.4)";
  }, { passive: true });
  card.addEventListener("mouseenter", function () {
    card.style.borderColor = cls.color;
  });
  card.addEventListener("mouseleave", function () {
    card.style.borderColor = "rgba(80, 100, 130, 0.4)";
  });

  var name = document.createElement("div");
  name.textContent = cls.name;
  name.style.cssText = [
    "font-size: 18px",
    "font-weight: bold",
    "color: " + cls.color,
    "margin-bottom: 6px"
  ].join(";");
  card.appendChild(name);

  var desc = document.createElement("div");
  desc.textContent = cls.description;
  desc.style.cssText = [
    "font-size: 11px",
    "color: #667788",
    "margin-bottom: 10px",
    "min-height: 28px"
  ].join(";");
  card.appendChild(desc);

  // stats
  var stats = [
    { label: "HP", value: cls.stats.hp },
    { label: "Speed", value: cls.stats.maxSpeed },
    { label: "Turn", value: cls.stats.turnRate.toFixed(1) },
    { label: "Armor", value: Math.round(cls.stats.armor * 100) + "%" }
  ];

  for (var s = 0; s < stats.length; s++) {
    var row = document.createElement("div");
    row.style.cssText = [
      "display: flex",
      "justify-content: space-between",
      "font-size: 11px",
      "color: #8899aa",
      "margin-bottom: 2px"
    ].join(";");
    var lbl = document.createElement("span");
    lbl.textContent = stats[s].label;
    lbl.style.color = "#667788";
    var val = document.createElement("span");
    val.textContent = stats[s].value;
    row.appendChild(lbl);
    row.appendChild(val);
    card.appendChild(row);
  }

  // ability
  var abilityRow = document.createElement("div");
  abilityRow.style.cssText = [
    "margin-top: 8px",
    "padding-top: 6px",
    "border-top: 1px solid rgba(80, 100, 130, 0.3)",
    "font-size: 11px"
  ].join(";");

  var abilityName = document.createElement("div");
  abilityName.textContent = "[Q] " + cls.ability.name;
  abilityName.style.color = cls.color;
  abilityName.style.fontWeight = "bold";
  abilityName.style.marginBottom = "2px";
  abilityRow.appendChild(abilityName);

  var abilityDesc = document.createElement("div");
  abilityDesc.textContent = cls.ability.description;
  abilityDesc.style.color = "#667788";
  abilityRow.appendChild(abilityDesc);

  card.appendChild(abilityRow);

  card.addEventListener("click", function () {
    if (onSelectCallback) onSelectCallback(cls.key);
  });

  return card;
}

export function showShipSelectScreen(callback, upgradeState) {
  onSelectCallback = callback;
  currentUpgradeState = upgradeState || null;
  updateResetButton();
  if (overlay) overlay.style.display = "flex";
}

export function hideShipSelectScreen() {
  if (overlay) overlay.style.display = "none";
  hideResetConfirm();
}

export function isShipSelectVisible() {
  return overlay && overlay.style.display !== "none";
}
