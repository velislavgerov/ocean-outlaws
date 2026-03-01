// shipSelect.js — ship class selection screen before game start
import * as THREE from "three";
import { getClassOrder, getAllClasses } from "./shipClass.js";
import { getTotalSpent, respecUpgrades } from "./upgrade.js";
import { isMobile } from "./mobile.js";
import { T, FONT, FONT_UI, FONT_MONO, PARCHMENT_BG, PARCHMENT_SHADOW } from "./theme.js";
import { getOverridePath, getOverrideSize, ensureManifest } from "./artOverrides.js";
import { loadGlbVisual } from "./glbVisual.js";
import { isShipUnlocked, getShipInfamyReq, getTotalInfamy, getLegendLevel } from "./infamy.js";

var overlay = null;
export function getShipSelectOverlay() { return overlay; }
var onSelectCallback = null;
var resetBtn = null;
var confirmDialog = null;
var currentUpgradeState = null;
var currentInfamyState = null;
var infamyLabel = null;
var legendLabel = null;
var previewRenderer = null;
var previewCards = [];
var previewAnimId = null;

function ensurePreviewRenderer() {
  if (previewRenderer) return previewRenderer;
  previewRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  return previewRenderer;
}

function renderPreview(entry) {
  if (!entry.model || !entry.canvas) return;
  var renderer = ensurePreviewRenderer();
  var w = entry.canvas.clientWidth;
  var h = entry.canvas.clientHeight;
  if (w === 0 || h === 0) return;
  renderer.setSize(w, h, false);
  entry.camera.aspect = w / h;
  entry.camera.updateProjectionMatrix();
  entry.model.rotation.y += 0.01;
  renderer.render(entry.scene, entry.camera);
  var ctx = entry.canvas.getContext("2d");
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(renderer.domElement, 0, 0, w, h);
}

function animatePreviewLoop() {
  previewAnimId = requestAnimationFrame(animatePreviewLoop);
  for (var i = 0; i < previewCards.length; i++) {
    renderPreview(previewCards[i]);
  }
}

function startPreviewAnimation() {
  if (previewAnimId) return;
  animatePreviewLoop();
}

function stopPreviewAnimation() {
  if (previewAnimId) {
    cancelAnimationFrame(previewAnimId);
    previewAnimId = null;
  }
}

function createPreviewEntry(classKey, canvas) {
  var scene = new THREE.Scene();
  var hemi = new THREE.HemisphereLight(0xffeedd, 0x444422, 1.2);
  scene.add(hemi);
  var dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(2, 4, 3);
  scene.add(dir);
  var camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 4, 8);
  camera.lookAt(0, 1, 0);
  var entry = { canvas: canvas, scene: scene, camera: camera, model: null };
  previewCards.push(entry);

  ensureManifest().then(function () {
    var path = getOverridePath(classKey);
    var size = getOverrideSize(classKey) || 6;
    if (!path) return;
    loadGlbVisual(path, size, true, { noDecimate: true }).then(function (visual) {
      entry.model = visual;
      scene.add(visual);
    }).catch(function () {});
  });

  return entry;
}

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
    "background: var(--oo-bg-scrim)",
    "z-index: 200",
    "font-family: " + FONT,
    "user-select: none",
    "overflow-y: auto",
    "padding: 20px 0"
  ].join(";");

  var title = document.createElement("div");
  title.textContent = "THE ADMIRALTY ROSTER";
  var _mobTitle = isMobile();
  title.style.cssText = [
    "font-size: " + (_mobTitle ? "22px" : "32px"),
    "font-weight: bold",
    "color: " + T.gold,
    "letter-spacing: 0.1em",
    "margin-bottom: " + (_mobTitle ? "10px" : "24px"),
    "margin-top: 16px",
    "text-shadow: 0 1px 4px rgba(0,0,0,0.5), 0 0 20px rgba(200,152,42,0.3)",
    "font-family: " + FONT,
    "animation: oo-fall 0.5s var(--oo-ease-spring) both"
  ].join(";");
  overlay.appendChild(title);

  // Infamy + Legend Level counter
  var infamyRow = document.createElement("div");
  infamyRow.style.cssText = [
    "display:flex",
    "gap:24px",
    "align-items:center",
    "margin-bottom:" + (_mobTitle ? "10px" : "16px"),
    "animation: oo-fade 0.5s var(--oo-ease-std) 100ms both"
  ].join(";");

  infamyLabel = document.createElement("div");
  infamyLabel.style.cssText = [
    "font-size:" + (_mobTitle ? "13px" : "15px"),
    "color:" + T.gold,
    "font-family:" + FONT_UI,
    "text-shadow:0 1px 4px rgba(212,164,74,0.4)"
  ].join(";");
  infamyLabel.textContent = "Infamy: 0";
  infamyRow.appendChild(infamyLabel);

  legendLabel = document.createElement("div");
  legendLabel.style.cssText = [
    "font-size:" + (_mobTitle ? "13px" : "15px"),
    "color:" + T.goldBright,
    "font-weight:bold",
    "font-family:" + FONT_UI,
    "text-shadow:0 1px 4px rgba(240,200,96,0.3)"
  ].join(";");
  legendLabel.textContent = "Legend Lv 0";
  infamyRow.appendChild(legendLabel);

  overlay.appendChild(infamyRow);

  var grid = document.createElement("div");
  var _mob = isMobile();

  if (_mob) {
    // Mobile landscape: horizontal scroll-snap
    grid.style.cssText = [
      "display: flex",
      "flex-direction: row",
      "gap: 12px",
      "overflow-x: auto",
      "scroll-snap-type: x mandatory",
      "-webkit-overflow-scrolling: touch",
      "width: 100%",
      "padding: 8px 20px 16px 20px",
      "box-sizing: border-box",
      "align-items: stretch"
    ].join(";");
  } else {
    // Desktop: three cards side-by-side, centered
    grid.style.cssText = [
      "display: flex",
      "flex-direction: row",
      "gap: 20px",
      "justify-content: center",
      "align-items: stretch",
      "max-width: 920px",
      "width: 95%",
      "padding: 0 8px"
    ].join(";");
  }

  var order = getClassOrder();
  var classes = getAllClasses();

  for (var i = 0; i < order.length; i++) {
    var cls = classes[order[i]];
    var card = buildCard(cls, null, i);
    card.setAttribute("data-class-key", cls.key);
    grid.appendChild(card);
  }

  overlay.appendChild(grid);

  var hint = document.createElement("div");
  hint.textContent = isMobile() ? "Swipe to browse \u2022 Tap to select" : "Click a vessel to begin";
  hint.style.cssText = [
    "font-size: 13px",
    "color: " + T.textDim,
    "margin-top: 20px",
    "font-family: " + FONT_UI,
    "letter-spacing: 0.05em",
    "text-shadow: 0 1px 2px rgba(0,0,0,0.4)",
    "animation: oo-fade 0.5s var(--oo-ease-std) 600ms both"
  ].join(";");
  overlay.appendChild(hint);

  // reset upgrades button
  resetBtn = document.createElement("button");
  resetBtn.textContent = "RESET UPGRADES";
  resetBtn.style.cssText = [
    "font-family: " + FONT,
    "font-size: 13px",
    "padding: 10px 28px",
    "margin-top: 14px",
    "background: none",
    "color: " + T.redBright,
    "border: 1px solid rgba(170, 51, 51, 0.5)",
    "border-radius: 4px",
    "cursor: pointer",
    "pointer-events: auto",
    "display: none",
    "min-height: 44px",
    "letter-spacing: 0.06em",
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
    "background: " + T.bg,
    "border: 1px solid var(--oo-gold-dim)",
    "border-radius: 8px",
    "padding: 24px 32px",
    "text-align: center",
    "max-width: 350px",
    PARCHMENT_SHADOW
  ].join(";");

  var dialogText = document.createElement("div");
  dialogText.textContent = "Are you sure? This resets all upgrades.";
  dialogText.style.cssText = "font-size:15px;color:" + T.text + ";margin-bottom:20px;font-family:" + FONT_UI + ";text-shadow:0 1px 2px rgba(0,0,0,0.4)";
  dialogBox.appendChild(dialogText);

  var dialogRefund = document.createElement("div");
  dialogRefund.id = "reset-refund-label";
  dialogRefund.style.cssText = "font-size:13px;color:" + T.gold + ";margin-bottom:16px;font-family:" + FONT_UI + ";text-shadow:0 1px 2px rgba(0,0,0,0.4)";
  dialogBox.appendChild(dialogRefund);

  var btnRow = document.createElement("div");
  btnRow.style.cssText = "display:flex;gap:12px;justify-content:center";

  var confirmBtn = document.createElement("button");
  confirmBtn.textContent = "CONFIRM RESET";
  confirmBtn.style.cssText = [
    "font-family: " + FONT,
    "font-size: 13px",
    "padding: 8px 20px",
    "background: none",
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
    "background: none",
    "color: " + T.text,
    "border: 1px solid var(--oo-gold-dim)",
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
  startPreviewAnimation();
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

function buildCard(cls, infamyState, idx) {
  var _mob = isMobile();
  var locked = infamyState ? !isShipUnlocked(infamyState, cls.key) : false;
  var reqInfamy = getShipInfamyReq(cls.key);
  var card = document.createElement("div");

  if (_mob) {
    card.style.cssText = [
      "position:relative",
      "flex-shrink: 0",
      "width: 70vw",
      "min-width: 220px",
      "max-width: 320px",
      "padding: 14px 16px",
      "background: " + T.bg,
      "border: 1px solid " + (locked ? T.textDark : "var(--oo-gold-dim)"),
      "border-radius: 8px",
      locked ? "cursor: not-allowed" : "cursor: pointer",
      "pointer-events: auto",
      "transition: border-color 0.2s, transform 0.2s",
      locked ? "opacity: 0.6" : "",
      PARCHMENT_SHADOW,
      "scroll-snap-align: center",
      "box-sizing: border-box"
    ].join(";");
  } else {
    card.style.cssText = [
      "position:relative",
      "flex: 1",
      "min-width: 220px",
      "max-width: 280px",
      "padding: 20px 18px",
      "background: " + T.bg,
      "border: 1px solid " + (locked ? T.textDark : "var(--oo-gold-dim)"),
      "border-radius: 8px",
      locked ? "cursor: not-allowed" : "cursor: pointer",
      "pointer-events: auto",
      "transition: border-color 0.2s, transform 0.25s, box-shadow 0.25s",
      locked ? "opacity: 0.6" : "",
      PARCHMENT_SHADOW,
      "box-sizing: border-box"
    ].join(";");
  }

  // Staggered rise animation
  card.style.animation = "oo-rise 0.4s var(--oo-ease-spring) " + (idx * 150) + "ms both";

  // touch-friendly: highlight on active instead of hover
  card.addEventListener("touchstart", function () {
    card.style.borderColor = cls.color;
  }, { passive: true });
  card.addEventListener("touchend", function () {
    card.style.borderColor = locked ? T.textDark : "var(--oo-gold-dim)";
  }, { passive: true });
  card.addEventListener("mouseenter", function () {
    if (locked) return;
    card.style.borderColor = "var(--oo-gold)";
    card.style.transform = "translateY(-8px)";
    card.style.boxShadow = [
      "0 0 40px rgba(8,12,18,0.8)",
      "inset 0 1px 0 rgba(200,152,42,0.15)",
      "0 8px 32px rgba(200,152,42,0.12)"
    ].join(",");
  });
  card.addEventListener("mouseleave", function () {
    card.style.borderColor = locked ? T.textDark : "var(--oo-gold-dim)";
    card.style.transform = "";
    card.style.boxShadow = "";
  });

  // 3D model preview canvas
  var previewCanvas = document.createElement("canvas");
  var _previewH = _mob ? 90 : 100;
  previewCanvas.width = _mob ? 280 : 240;
  previewCanvas.height = _previewH;
  previewCanvas.style.cssText = [
    "width: 100%",
    "height: " + _previewH + "px",
    "margin-bottom: 10px",
    "border-radius: 4px",
    "background: rgba(8,12,18,0.6)"
  ].join(";");
  card.appendChild(previewCanvas);
  createPreviewEntry(cls.key, previewCanvas);

  var name = document.createElement("div");
  name.textContent = cls.name;
  name.style.cssText = [
    "font-size: " + (_mob ? "18px" : "17px"),
    "font-weight: bold",
    "color: " + T.gold,
    "font-family: " + FONT,
    "letter-spacing: 0.06em",
    "margin-bottom: 4px",
    "text-shadow: 0 1px 2px rgba(0,0,0,0.4), 0 0 12px rgba(200,152,42,0.2)"
  ].join(";");
  card.appendChild(name);

  var desc = document.createElement("div");
  desc.textContent = cls.description;
  desc.style.cssText = [
    "font-size: " + (_mob ? "12px" : "11px"),
    "color: " + T.textDim,
    "font-family: " + FONT_UI,
    "margin-bottom: 10px",
    "min-height: 28px",
    "line-height: 1.5",
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
      "align-items: baseline",
      "font-size: " + (_mob ? "12px" : "11px"),
      "margin-bottom: 3px"
    ].join(";");
    var lbl = document.createElement("span");
    lbl.textContent = stats[s].label;
    lbl.style.cssText = [
      "color: " + T.textDim,
      "font-family: " + FONT_UI,
      "font-size: 10px",
      "text-transform: uppercase",
      "letter-spacing: 0.08em"
    ].join(";");
    var val = document.createElement("span");
    val.textContent = stats[s].value;
    val.style.cssText = [
      "color: " + T.text,
      "font-family: " + FONT_MONO,
      "font-size: " + (_mob ? "12px" : "11px")
    ].join(";");
    row.appendChild(lbl);
    row.appendChild(val);
    card.appendChild(row);
  }

  // ability
  var abilityRow = document.createElement("div");
  abilityRow.style.cssText = [
    "margin-top: 10px",
    "padding-top: 8px",
    "border-top: 1px solid var(--oo-gold-dim)",
    "font-size: 11px"
  ].join(";");

  var abilityName = document.createElement("div");
  abilityName.textContent = "[Q] " + cls.ability.name;
  abilityName.style.cssText = [
    "color: " + cls.color,
    "font-family: " + FONT_UI,
    "font-size: 11px",
    "font-weight: 600",
    "letter-spacing: 0.04em",
    "margin-bottom: 2px",
    "text-shadow: 0 1px 2px rgba(0,0,0,0.4)"
  ].join(";");
  abilityRow.appendChild(abilityName);

  var abilityDesc = document.createElement("div");
  abilityDesc.textContent = cls.ability.description;
  abilityDesc.style.cssText = [
    "color: " + T.textDim,
    "font-family: " + FONT_UI,
    "font-size: 10px",
    "line-height: 1.5",
    "text-shadow: 0 1px 2px rgba(0,0,0,0.4)"
  ].join(";");
  abilityRow.appendChild(abilityDesc);

  card.appendChild(abilityRow);

  // lock overlay for Infamy-gated ships
  if (locked && reqInfamy > 0) {
    var lockOverlay = document.createElement("div");
    lockOverlay.className = "ship-lock-overlay";
    lockOverlay.style.cssText = [
      "position:absolute",
      "top:0", "left:0",
      "width:100%", "height:100%",
      "display:flex",
      "flex-direction:column",
      "align-items:center",
      "justify-content:center",
      "background:rgba(8,12,18,0.75)",
      "border-radius:8px",
      "z-index:1"
    ].join(";");
    var lockIcon = document.createElement("div");
    lockIcon.textContent = "\uD83D\uDD12";
    lockIcon.style.cssText = "font-size:28px;margin-bottom:6px";
    lockOverlay.appendChild(lockIcon);
    var lockText = document.createElement("div");
    lockText.textContent = reqInfamy + " Infamy";
    lockText.style.cssText = [
      "font-size:" + (_mob ? "13px" : "12px"),
      "color:" + T.gold,
      "font-family:" + FONT_UI,
      "font-weight:bold",
      "text-shadow:0 1px 2px rgba(0,0,0,0.5)"
    ].join(";");
    lockOverlay.appendChild(lockText);
    card.appendChild(lockOverlay);
  }

  card.addEventListener("click", function () {
    if (currentInfamyState && !isShipUnlocked(currentInfamyState, cls.key)) return;
    if (onSelectCallback) onSelectCallback(cls.key);
  });

  return card;
}

export function showShipSelectScreen(callback, upgradeState, infamyState) {
  onSelectCallback = callback;
  currentUpgradeState = upgradeState || null;
  currentInfamyState = infamyState || null;
  updateResetButton();
  updateInfamyDisplay();
  updateCardLocks();
  if (overlay) overlay.style.display = "flex";
  startPreviewAnimation();
}

function updateInfamyDisplay() {
  if (infamyLabel && currentInfamyState) {
    infamyLabel.textContent = "Infamy: " + getTotalInfamy(currentInfamyState);
  } else if (infamyLabel) {
    infamyLabel.textContent = "Infamy: 0";
  }
  if (legendLabel && currentInfamyState) {
    legendLabel.textContent = "Legend Lv " + getLegendLevel(currentInfamyState);
  } else if (legendLabel) {
    legendLabel.textContent = "Legend Lv 0";
  }
}

function updateCardLocks() {
  if (!overlay || !currentInfamyState) return;
  var order = getClassOrder();
  var classes = getAllClasses();
  var cards = overlay.querySelectorAll("[data-class-key]");
  for (var i = 0; i < cards.length; i++) {
    var key = cards[i].getAttribute("data-class-key");
    var locked = !isShipUnlocked(currentInfamyState, key);
    var reqInfamy = getShipInfamyReq(key);
    var existingLock = cards[i].querySelector(".ship-lock-overlay");
    // update opacity and cursor
    cards[i].style.opacity = locked ? "0.6" : "";
    cards[i].style.cursor = locked ? "not-allowed" : "pointer";
    cards[i].style.borderColor = locked ? T.textDark : "var(--oo-gold-dim)";
    if (locked && reqInfamy > 0 && !existingLock) {
      var _mob = isMobile();
      var lockOverlay = document.createElement("div");
      lockOverlay.className = "ship-lock-overlay";
      lockOverlay.style.cssText = [
        "position:absolute",
        "top:0", "left:0",
        "width:100%", "height:100%",
        "display:flex",
        "flex-direction:column",
        "align-items:center",
        "justify-content:center",
        "background:rgba(8,12,18,0.75)",
        "border-radius:8px",
        "z-index:1"
      ].join(";");
      var lockIcon = document.createElement("div");
      lockIcon.textContent = "\uD83D\uDD12";
      lockIcon.style.cssText = "font-size:28px;margin-bottom:6px";
      lockOverlay.appendChild(lockIcon);
      var lockText = document.createElement("div");
      lockText.textContent = reqInfamy + " Infamy";
      lockText.style.cssText = [
        "font-size:12px",
        "color:" + T.gold,
        "font-family:" + FONT_UI,
        "font-weight:bold",
        "text-shadow:0 1px 2px rgba(0,0,0,0.5)"
      ].join(";");
      lockOverlay.appendChild(lockText);
      cards[i].appendChild(lockOverlay);
    } else if (!locked && existingLock) {
      existingLock.remove();
    }
  }
}

export function hideShipSelectScreen() {
  if (overlay) overlay.style.display = "none";
  hideResetConfirm();
  stopPreviewAnimation();
}

export function isShipSelectVisible() {
  return overlay && overlay.style.display !== "none";
}
