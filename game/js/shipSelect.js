// shipSelect.js — ship class selection screen before game start
import { getClassOrder, getAllClasses } from "./shipClass.js";
import { getTotalSpent, respecUpgrades } from "./upgrade.js";
import { isMobile } from "./mobile.js";
import { T, FONT, PARCHMENT_BG, PARCHMENT_SHADOW } from "./theme.js";

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
    "background: " + T.bgOverlay,
    "z-index: 200",
    "font-family: " + FONT,
    "user-select: none",
    "overflow-y: auto",
    "padding: 20px 0"
  ].join(";");

  var title = document.createElement("div");
  title.textContent = "CHOOSE YOUR VESSEL";
  var _mobTitle = isMobile();
  title.style.cssText = [
    "font-size: " + (_mobTitle ? "24px" : "32px"),
    "font-weight: bold",
    "color: " + T.text,
    "margin-bottom: " + (_mobTitle ? "16px" : "32px"),
    "margin-top: 16px",
    "text-shadow: 0 1px 4px rgba(0,0,0,0.5), 0 0 20px rgba(180,140,80,0.2)"
  ].join(";");
  overlay.appendChild(title);

  var grid = document.createElement("div");
  var _mob = isMobile();
  grid.style.cssText = [
    "display: flex",
    "gap: " + (_mob ? "10px" : "16px"),
    _mob ? "flex-direction: column" : "flex-wrap: wrap",
    "justify-content: center",
    "align-items: center",
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
  hint.textContent = isMobile() ? "Tap a vessel to start" : "Click a vessel to start";
  hint.style.cssText = [
    "font-size: 14px",
    "color: " + T.textDark,
    "margin-top: 24px",
    "font-family: " + FONT,
    "text-shadow: 0 1px 2px rgba(0,0,0,0.4)"
  ].join(";");
  overlay.appendChild(hint);

  // reset upgrades button
  resetBtn = document.createElement("button");
  resetBtn.textContent = "RESET UPGRADES";
  resetBtn.style.cssText = [
    "font-family: " + FONT,
    "font-size: 14px",
    "padding: 10px 28px",
    "margin-top: 16px",
    "background: rgba(92, 74, 30, 0.7)",
    "color: " + T.redBright,
    "border: 1px solid rgba(170, 51, 51, 0.5)",
    "border-radius: 4px",
    "cursor: pointer",
    "pointer-events: auto",
    "display: none",
    "min-height: 44px",
    "text-shadow: 0 1px 2px rgba(0,0,0,0.4)"
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
    "font-family: " + FONT
  ].join(";");

  var dialogBox = document.createElement("div");
  dialogBox.style.cssText = [
    PARCHMENT_BG,
    "border: 1px solid rgba(170, 51, 51, 0.5)",
    "border-radius: 8px",
    "padding: 24px 32px",
    "text-align: center",
    "max-width: 350px",
    PARCHMENT_SHADOW
  ].join(";");

  var dialogText = document.createElement("div");
  dialogText.textContent = "Are you sure? This resets all upgrades.";
  dialogText.style.cssText = "font-size:15px;color:" + T.text + ";margin-bottom:20px;text-shadow:0 1px 2px rgba(0,0,0,0.4)";
  dialogBox.appendChild(dialogText);

  var dialogRefund = document.createElement("div");
  dialogRefund.id = "reset-refund-label";
  dialogRefund.style.cssText = "font-size:13px;color:" + T.gold + ";margin-bottom:16px;text-shadow:0 1px 2px rgba(0,0,0,0.4)";
  dialogBox.appendChild(dialogRefund);

  var btnRow = document.createElement("div");
  btnRow.style.cssText = "display:flex;gap:12px;justify-content:center";

  var confirmBtn = document.createElement("button");
  confirmBtn.textContent = "CONFIRM RESET";
  confirmBtn.style.cssText = [
    "font-family: " + FONT,
    "font-size: 13px",
    "padding: 8px 20px",
    "background: rgba(120, 30, 30, 0.8)",
    "color: " + T.redBright,
    "border: 1px solid rgba(200, 60, 60, 0.6)",
    "border-radius: 4px",
    "cursor: pointer",
    "pointer-events: auto",
    "min-height: 44px",
    "text-shadow: 0 1px 2px rgba(0,0,0,0.4)"
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
    "font-family: " + FONT,
    "font-size: 13px",
    "padding: 8px 20px",
    "background: " + T.bgLight,
    "color: " + T.text,
    "border: 1px solid " + T.border,
    "border-radius: 4px",
    "cursor: pointer",
    "pointer-events: auto",
    "min-height: 44px",
    "text-shadow: 0 1px 2px rgba(0,0,0,0.4)"
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
    refundLabel.textContent = "Refund: " + refund + " gold";
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
    _mob ? "width:100%;max-width:340px" : "width: 170px",
    "padding: " + (_mob ? "14px 16px" : "16px"),
    PARCHMENT_BG,
    "border: 2px solid " + T.border,
    "border-radius: 8px",
    "cursor: pointer",
    "pointer-events: auto",
    "transition: border-color 0.2s",
    PARCHMENT_SHADOW
  ].join(";");

  // touch-friendly: highlight on active instead of hover
  card.addEventListener("touchstart", function () {
    card.style.borderColor = cls.color;
  }, { passive: true });
  card.addEventListener("touchend", function () {
    card.style.borderColor = T.border;
  }, { passive: true });
  card.addEventListener("mouseenter", function () {
    card.style.borderColor = cls.color;
  });
  card.addEventListener("mouseleave", function () {
    card.style.borderColor = T.border;
  });

  var name = document.createElement("div");
  name.textContent = cls.name;
  name.style.cssText = [
    "font-size: " + (_mob ? "20px" : "18px"),
    "font-weight: bold",
    "color: " + cls.color,
    "margin-bottom: 6px",
    "text-shadow: 0 1px 2px rgba(0,0,0,0.4)"
  ].join(";");
  card.appendChild(name);

  var desc = document.createElement("div");
  desc.textContent = cls.description;
  desc.style.cssText = [
    "font-size: " + (_mob ? "13px" : "11px"),
    "color: " + T.textDim,
    "margin-bottom: 10px",
    "min-height: 28px",
    "text-shadow: 0 1px 2px rgba(0,0,0,0.4)"
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
      "font-size: " + (_mob ? "13px" : "11px"),
      "color: " + T.text,
      "margin-bottom: 2px",
      "text-shadow: 0 1px 2px rgba(0,0,0,0.4)"
    ].join(";");
    var lbl = document.createElement("span");
    lbl.textContent = stats[s].label;
    lbl.style.color = T.textDim;
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
    "border-top: 1px solid " + T.border,
    "font-size: 11px"
  ].join(";");

  var abilityName = document.createElement("div");
  abilityName.textContent = "[Q] " + cls.ability.name;
  abilityName.style.color = cls.color;
  abilityName.style.fontWeight = "bold";
  abilityName.style.marginBottom = "2px";
  abilityName.style.textShadow = "0 1px 2px rgba(0,0,0,0.4)";
  abilityRow.appendChild(abilityName);

  var abilityDesc = document.createElement("div");
  abilityDesc.textContent = cls.ability.description;
  abilityDesc.style.color = T.textDim;
  abilityDesc.style.textShadow = "0 1px 2px rgba(0,0,0,0.4)";
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
