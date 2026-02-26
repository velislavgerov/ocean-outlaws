// hud.js — HUD: Hull Integrity bar + Wind bar (top-left), QWER ability bar (bottom-center),
// minimap (top-right), fade-on-change popups, banner/overlay
import { createMinimap, updateMinimap as renderMinimap } from "./minimap.js";
import { isMobile } from "./mobile.js";
import { T, FONT, SCROLL_BG, PARCHMENT_BG, PARCHMENT_SHADOW } from "./theme.js";
import { createCrewHud as _createCrewHud, updateCrewHud as _updateCrewHud, getCrewHudContainer } from "./crewHud.js";

// --- color palette (parchment/nautical) ---
var C = {
  bg: T.bg,
  bgLight: T.bgLight,
  border: T.border,
  borderActive: T.borderActive,
  text: T.text,
  textDim: T.textDim,
  green: T.hullGreen,
  greenBright: T.greenBright,
  yellow: T.gold,
  orange: T.amber,
  amber: T.windAmber,
  red: T.red,
  blue: T.blue,
  blueBright: T.blueBright,
  purple: T.purple,
  cyan: T.cyan,
  portGreen: T.portGreen
};

export { C as HUD_COLORS };

var _mob = isMobile();

var topLeftPanel = null;
var hpBarBg = null, hpBar = null, hpLabel = null;
var fuelBarBg = null, fuelBar = null;
var minimapContainer = null;
var abilityBar = null;
var SLOT_SIZE = _mob ? 48 : 40, SLOT_GAP = _mob ? 6 : 4;
var abilitySlots = [];
var statsRow = null, ammoLabel = null, salvageLabel = null;
var ammoPopup = null, ammoPopupTimer = 0, prevAmmo = -1;
var salvagePopup = null, salvagePopupTimer = 0, prevSalvage = -1;
var portLabel = null;
var banner = null, bannerTimer = 0;
var overlay = null, overlayTitle = null, overlaySubtext = null, overlayBtn = null;

var onAbilityBarCallback = null;
var onRestartCallback = null;
var onMuteCallback = null, onVolumeCallback = null;
var settingsDataCallback = null;

var SLOT_DEFS = [
  { key: "Q", icon: "\u2022", defaultColor: T.gold },      // Cannon
  { key: "W", icon: "\u25C6", defaultColor: "#cc6633" },    // Chain Shot
  { key: "E", icon: "\u25AC", defaultColor: T.blueBright }, // Fire Bomb
  { key: "R", icon: "\u26A1", defaultColor: T.purple }      // Ability
];

function makeBar(width, height) {
  var bg = document.createElement("div");
  bg.style.cssText = [
    "width:" + width + "px", "height:" + height + "px",
    "background:" + C.bgLight, "border:1px solid " + C.border,
    "border-radius:4px", "overflow:hidden"
  ].join(";");
  var fill = document.createElement("div");
  fill.style.cssText = [
    "width:100%", "height:100%", "background:" + C.green,
    "border-radius:3px", "transition:width 0.2s"
  ].join(";");
  bg.appendChild(fill);
  return { bg: bg, fill: fill };
}

function makePopup(side) {
  var el = document.createElement("div");
  var pos = side === "left" ? "left:16px;" : "right:16px;";
  el.style.cssText = [
    "position:fixed", "bottom:80px", pos,
    "font-family:" + FONT, "font-size:" + (_mob ? "14px" : "12px"),
    "color:" + C.text, "background:" + C.bg,
    "border:1px solid " + C.border, "border-radius:4px",
    "padding:4px 10px", "pointer-events:none",
    "user-select:none", "z-index:10",
    "opacity:0", "transition:opacity 0.3s",
    "text-shadow:0 1px 2px rgba(0,0,0,0.4)"
  ].join(";");
  document.body.appendChild(el);
  return el;
}

export function createHUD() {
  // === TOP-LEFT: HP bar + fuel bar ===
  topLeftPanel = document.createElement("div");
  var mobPad = _mob ? "top:env(safe-area-inset-top,16px);left:env(safe-area-inset-left,16px);" : "top:16px;left:16px;";
  topLeftPanel.style.cssText = [
    "position:fixed", "pointer-events:none",
    "font-family:" + FONT, "color:" + C.text, "font-size:" + (_mob ? "15px" : "13px"),
    "user-select:none", "z-index:10"
  ].join(";") + ";" + mobPad;

  hpLabel = document.createElement("div");
  hpLabel.textContent = "";
  hpLabel.style.cssText = "font-size:" + (_mob ? "12px" : "11px") + ";color:" + C.textDim + ";margin-bottom:2px;height:14px;text-shadow:0 1px 2px rgba(0,0,0,0.4);";
  topLeftPanel.appendChild(hpLabel);
  var hpBars = makeBar(_mob ? 100 : 120, _mob ? 10 : 8);
  hpBarBg = hpBars.bg;
  hpBar = hpBars.fill;
  topLeftPanel.appendChild(hpBarBg);

  // fuel bar — thinner, amber/yellow, directly below HP
  var fuelBars = makeBar(_mob ? 100 : 120, _mob ? 6 : 5);
  fuelBarBg = fuelBars.bg;
  fuelBar = fuelBars.fill;
  fuelBar.style.background = C.amber;
  fuelBarBg.style.marginTop = "3px";
  topLeftPanel.appendChild(fuelBarBg);

  // port proximity (shows only when near)
  portLabel = document.createElement("div");
  portLabel.textContent = "";
  portLabel.style.cssText = "margin-top:4px;font-size:11px;color:" + C.portGreen + ";height:14px;text-shadow:0 1px 2px rgba(0,0,0,0.4);";
  topLeftPanel.appendChild(portLabel);

  // crew HUD — small officer icons
  var crewHudEl = _createCrewHud();
  topLeftPanel.appendChild(crewHudEl);

  document.body.appendChild(topLeftPanel);

  // === TOP-RIGHT: minimap ===
  minimapContainer = document.createElement("div");
  minimapContainer.style.cssText = [
    "position:fixed", "top:16px", "right:16px",
    "pointer-events:none", "user-select:none", "z-index:10"
  ].join(";");
  createMinimap(minimapContainer);
  document.body.appendChild(minimapContainer);

  // === BOTTOM-CENTER: QWER ability bar ===
  abilityBar = document.createElement("div");
  var botPad = _mob ? "bottom:env(safe-area-inset-bottom,16px);" : "bottom:16px;";
  abilityBar.style.cssText = [
    "position:fixed", "left:50%", "transform:translateX(-50%)",
    "pointer-events:none", "font-family:" + FONT, "color:" + C.text,
    "user-select:none", "z-index:10", "text-align:center"
  ].join(";") + ";" + botPad;

  var slotRow = document.createElement("div");
  slotRow.style.cssText = "display:flex;gap:" + SLOT_GAP + "px;justify-content:center;";

  abilitySlots = [];
  for (var i = 0; i < SLOT_DEFS.length; i++) {
    var def = SLOT_DEFS[i];
    var container = document.createElement("div");
    container.style.cssText = [
      "position:relative",
      "width:" + SLOT_SIZE + "px", "height:" + SLOT_SIZE + "px",
      "cursor:pointer", "pointer-events:auto"
    ].join(";");

    // canvas for icon + cooldown overlay
    var canvas = document.createElement("canvas");
    canvas.width = SLOT_SIZE * 2; // 2x for retina
    canvas.height = SLOT_SIZE * 2;
    canvas.style.cssText = "width:" + SLOT_SIZE + "px;height:" + SLOT_SIZE + "px;display:block;";
    var ctx = canvas.getContext("2d");
    container.appendChild(canvas);

    // key label (bottom-right corner)
    var keyLabel = document.createElement("div");
    keyLabel.textContent = def.key;
    keyLabel.style.cssText = [
      "position:absolute", "bottom:2px", "right:3px",
      "font-size:" + (_mob ? "10px" : "9px"), "font-family:" + FONT,
      "color:" + C.text, "pointer-events:none", "line-height:1",
      "text-shadow:0 1px 2px rgba(0,0,0,0.5)"
    ].join(";");
    container.appendChild(keyLabel);

    container.addEventListener("click", (function (idx) {
      return function (e) {
        e.stopPropagation();
        if (onAbilityBarCallback) onAbilityBarCallback(idx);
      };
    })(i));

    slotRow.appendChild(container);
    abilitySlots.push({ container: container, canvas: canvas, ctx: ctx, keyLabel: keyLabel });
  }
  abilityBar.appendChild(slotRow);

  // === STATS ROW: ammo + salvage (compact, below ability bar) ===
  statsRow = document.createElement("div");
  statsRow.style.cssText = [
    "display:flex", "align-items:center", "justify-content:center",
    "gap:" + (_mob ? "10px" : "8px"), "margin-top:" + (_mob ? "4px" : "3px"),
    "font-family:" + FONT, "font-size:" + (_mob ? "12px" : "10px")
  ].join(";");

  ammoLabel = document.createElement("div");
  ammoLabel.style.cssText = "color:" + C.text + ";pointer-events:none;white-space:nowrap;";
  ammoLabel.textContent = "\u2022 --";
  statsRow.appendChild(ammoLabel);

  salvageLabel = document.createElement("div");
  salvageLabel.style.cssText = "color:" + C.yellow + ";pointer-events:none;white-space:nowrap;text-shadow:0 1px 2px rgba(0,0,0,0.4);";
  salvageLabel.textContent = "\uD83E\uDE99 0";
  statsRow.appendChild(salvageLabel);

  abilityBar.appendChild(statsRow);
  document.body.appendChild(abilityBar);

  // === FADE-ON-CHANGE POPUPS ===
  ammoPopup = makePopup("left");
  ammoPopup.style.bottom = _mob ? "90px" : "76px";
  ammoPopup.style.left = "50%";
  ammoPopup.style.right = "";
  ammoPopup.style.transform = "translateX(-50%)";

  salvagePopup = makePopup("left");
  salvagePopup.style.bottom = "";
  salvagePopup.style.left = "16px";
  salvagePopup.style.top = _mob ? "50px" : "46px";

  // === BANNER (parchment scroll style) ===
  banner = document.createElement("div");
  banner.style.cssText = [
    "position:fixed", "top:25%", "left:50%",
    "transform:translate(-50%,-50%)", "font-family:" + FONT,
    "font-size:" + (_mob ? "24px" : "32px"), "font-weight:bold", "color:" + T.cream,
    "text-shadow:0 2px 4px rgba(0,0,0,0.6),0 0 20px rgba(212,164,74,0.4)",
    "pointer-events:none", "user-select:none", "z-index:20",
    "opacity:0", "transition:opacity 0.3s",
    "padding:16px 32px", "border-radius:4px",
    SCROLL_BG,
    "border:2px solid " + T.borderGold,
    "box-shadow:0 4px 20px rgba(0,0,0,0.5)",
    "letter-spacing:2px"
  ].join(";");
  document.body.appendChild(banner);

  // === OVERLAY (game over / victory) ===
  overlay = document.createElement("div");
  overlay.style.cssText = [
    "position:fixed", "top:0", "left:0", "width:100%", "height:100%",
    "display:none", "flex-direction:column", "align-items:center",
    "justify-content:center", "background:rgba(20,14,8,0.88)",
    "z-index:100", "font-family:" + FONT, "user-select:none"
  ].join(";");
  overlayTitle = document.createElement("div");
  overlayTitle.style.cssText = "font-size:" + (_mob ? "36px" : "48px") + ";font-weight:bold;color:" + C.red + ";margin-bottom:16px;text-shadow:0 2px 4px rgba(0,0,0,0.6);letter-spacing:4px;";
  overlay.appendChild(overlayTitle);
  overlaySubtext = document.createElement("div");
  overlaySubtext.style.cssText = "font-size:20px;color:" + C.text + ";margin-bottom:32px;text-shadow:0 1px 2px rgba(0,0,0,0.4);";
  overlay.appendChild(overlaySubtext);
  overlayBtn = document.createElement("button");
  overlayBtn.textContent = "RESTART";
  overlayBtn.style.cssText = [
    "font-family:" + FONT, "font-size:" + (_mob ? "20px" : "18px"),
    "padding:" + (_mob ? "14px 44px" : "12px 36px"),
    T.bgLight.indexOf("rgba") >= 0 ? "background:" + T.bgLight : "",
    "background:" + T.bgLight, "color:" + T.textLight,
    "border:1px solid " + C.borderActive, "border-radius:4px",
    "cursor:pointer", "pointer-events:auto",
    "min-height:44px", "letter-spacing:2px",
    "text-shadow:0 1px 2px rgba(0,0,0,0.4)"
  ].join(";");
  overlayBtn.addEventListener("click", function () {
    hideOverlay();
    if (onRestartCallback) onRestartCallback();
  });
  overlay.appendChild(overlayBtn);
  document.body.appendChild(overlay);
}

export function setAbilityBarCallback(cb) { onAbilityBarCallback = cb; }
export function setRestartCallback(cb) { onRestartCallback = cb; }
export function setMuteCallback(cb) { onMuteCallback = cb; }
export function setVolumeCallback(cb) { onVolumeCallback = cb; }
export function setSettingsDataCallback(cb) { settingsDataCallback = cb; }

export function showBanner(text, duration) {
  if (!banner) return;
  banner.textContent = text;
  banner.style.opacity = "1";
  bannerTimer = duration || 3;
}

function updateBanner(dt) {
  if (bannerTimer <= 0) return;
  bannerTimer -= dt;
  if (bannerTimer <= 0.5) {
    banner.style.opacity = String(Math.max(0, bannerTimer / 0.5));
  }
  if (bannerTimer <= 0) { banner.style.opacity = "0"; }
}

export function showGameOver(waveReached) {
  if (!overlay) return;
  overlayTitle.textContent = "GAME OVER";
  overlayTitle.style.color = C.red;
  overlaySubtext.textContent = "You reached Fleet " + waveReached;
  overlayBtn.textContent = "RESTART";
  overlay.style.display = "flex";
}
export function showVictory(waveReached) {
  if (!overlay) return;
  overlayTitle.textContent = "VICTORY";
  overlayTitle.style.color = C.greenBright;
  overlaySubtext.textContent = "All " + waveReached + " fleets defeated!";
  overlayBtn.textContent = "CONTINUE";
  overlay.style.display = "flex";
}
export function hideOverlay() {
  if (!overlay) return;
  overlay.style.display = "none";
}

export function updateMinimap(playerX, playerZ, playerHeading, enemies, pickups, ports, terrainMarkers, remotePlayers) {
  renderMinimap(playerX, playerZ, playerHeading, enemies, pickups, ports, terrainMarkers, remotePlayers);
}

// --- draw a single QWER slot ---
// slotInfo: { icon, color, active, cooldownPct, cooldownSecs, isActiveSlot }
function drawSlot(slot, info) {
  var ctx = slot.ctx;
  var s = SLOT_SIZE * 2; // canvas is 2x
  var r = 8; // corner radius (in canvas coords)
  ctx.clearRect(0, 0, s, s);

  var onCooldown = info.cooldownPct !== undefined && info.cooldownPct < 1;
  var isActive = info.active;
  var color = info.color || C.text;

  // background rounded rect
  ctx.beginPath();
  roundRect(ctx, 1, 1, s - 2, s - 2, r);
  ctx.fillStyle = C.bgLight;
  ctx.fill();
  ctx.strokeStyle = info.isActiveSlot ? color : C.border;
  ctx.lineWidth = info.isActiveSlot ? 3 : 1.5;
  ctx.stroke();

  // dim overlay when on cooldown
  if (onCooldown && !isActive) {
    ctx.save();
    ctx.beginPath();
    roundRect(ctx, 1, 1, s - 2, s - 2, r);
    ctx.clip();
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, s, s);

    // radial sweep showing cooldown progress (clockwise from top)
    var pct = info.cooldownPct;
    ctx.beginPath();
    ctx.moveTo(s / 2, s / 2);
    ctx.arc(s / 2, s / 2, s, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fill();
    ctx.restore();
  }

  // active glow
  if (isActive) {
    ctx.save();
    ctx.beginPath();
    roundRect(ctx, 1, 1, s - 2, s - 2, r);
    ctx.clip();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.2;
    ctx.fillRect(0, 0, s, s);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // icon
  var iconSize = _mob ? 22 : 18;
  ctx.fillStyle = onCooldown && !isActive ? C.textDim : color;
  ctx.font = "bold " + iconSize + "px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(info.icon, s / 2, s / 2 - 4);

  // cooldown seconds text (centered, below icon)
  if (onCooldown && !isActive && info.cooldownSecs > 0) {
    ctx.fillStyle = C.text;
    ctx.font = (_mob ? "14" : "12") + "px monospace";
    ctx.fillText(Math.ceil(info.cooldownSecs) + "s", s / 2, s / 2 + 16);
  }

  // active duration remaining
  if (isActive && info.cooldownSecs > 0) {
    ctx.fillStyle = color;
    ctx.font = (_mob ? "14" : "12") + "px monospace";
    ctx.fillText(info.cooldownSecs.toFixed(1), s / 2, s / 2 + 16);
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// --- fade popup helpers ---
function fadePopup(el, timer, dt) {
  if (timer > 0) {
    timer -= dt;
    if (timer > 0.5) {
      el.style.opacity = "1";
    } else {
      el.style.opacity = String(Math.max(0, timer / 0.5));
    }
    if (timer <= 0) { el.style.opacity = "0"; }
  }
  return timer;
}

// --- main HUD update ---
// abilityBarInfo: array of 4 objects:
//   { icon, color, active, cooldownPct, cooldownSecs, isActiveSlot }
// (slots 0-2 = weapons, slot 3 = class ability)
export function updateHUD(speedRatio, displaySpeed, heading, ammo, maxAmmo, hp, maxHp, fuel, maxFuel, parts, wave, waveState, dt, salvage, weaponInfo, abilityInfo, weatherText, autofireOn, portInfo, abilityBarInfo, crewState) {
  if (!topLeftPanel) return;

  // Crew HUD
  if (crewState !== undefined) _updateCrewHud(crewState);

  // Hull Integrity bar — no numbers unless damaged
  if (hp !== undefined && hpBar) {
    var hpPct = Math.max(0, hp / maxHp) * 100;
    hpBar.style.width = hpPct + "%";
    hpBar.style.background = hpPct > 50 ? C.green : hpPct > 25 ? T.amber : C.red;
    if (hp < maxHp) {
      hpLabel.textContent = "Hull " + Math.round(hp) + "/" + Math.round(maxHp);
      hpLabel.style.color = hpPct > 25 ? C.textDim : C.red;
    } else {
      hpLabel.textContent = "";
    }
  }

  // Fuel bar
  if (fuel !== undefined && fuelBar) {
    var fuelPct = Math.max(0, fuel / maxFuel) * 100;
    fuelBar.style.width = fuelPct + "%";
    fuelBar.style.background = fuelPct > 20 ? C.amber : C.red;
  }

  // Port proximity
  if (portLabel) {
    var showDist = portInfo && portInfo.hostile ? 90 : 50;
    if (portInfo && portInfo.dist < showDist) {
      var baseLabel = portInfo.label || "PORT";
      if (portInfo.hostile) {
        portLabel.textContent = baseLabel + " " + Math.round(portInfo.dist) + "m";
        portLabel.style.color = C.red;
      } else if (portInfo.available) {
        portLabel.textContent = baseLabel + " " + Math.round(portInfo.dist) + "m";
        portLabel.style.color = C.portGreen;
      } else {
        portLabel.textContent = baseLabel + " " + Math.ceil(portInfo.cooldown) + "s";
        portLabel.style.color = T.brownDark;
      }
    } else { portLabel.textContent = ""; }
  }

  // QWER ability bar slots
  if (abilityBarInfo && abilitySlots.length === 4) {
    for (var i = 0; i < 4; i++) {
      drawSlot(abilitySlots[i], abilityBarInfo[i]);
    }
  }

  // Always-visible ammo count
  if (ammoLabel && ammo !== undefined) {
    ammoLabel.textContent = "\u2022 " + ammo + "/" + maxAmmo;
    ammoLabel.style.color = ammo <= 5 ? C.red : C.text;
  }

  // Always-visible gold coin counter
  if (salvageLabel && salvage !== undefined) {
    salvageLabel.textContent = "\uD83E\uDE99 " + salvage;
  }

  // Ammo popup — show on change, fade after 2.5s
  if (ammo !== undefined && prevAmmo >= 0 && ammo !== prevAmmo) {
    ammoPopup.textContent = "AMMO " + ammo + "/" + maxAmmo;
    ammoPopup.style.color = ammo <= 5 ? C.red : C.text;
    ammoPopupTimer = 2.5;
  }
  prevAmmo = ammo !== undefined ? ammo : prevAmmo;
  ammoPopupTimer = fadePopup(ammoPopup, ammoPopupTimer, dt || 0.016);

  // Salvage popup — show on change, fade after 2.5s
  if (salvage !== undefined && prevSalvage >= 0 && salvage !== prevSalvage) {
    salvagePopup.textContent = "\uD83E\uDE99 +" + (salvage - prevSalvage) + " Gold";
    salvagePopup.style.color = C.yellow;
    salvagePopupTimer = 2.5;
  }
  prevSalvage = salvage !== undefined ? salvage : prevSalvage;
  salvagePopupTimer = fadePopup(salvagePopup, salvagePopupTimer, dt || 0.016);

  // Provide data to settings menu for display
  if (settingsDataCallback) {
    settingsDataCallback({
      fuel: fuel, maxFuel: maxFuel, parts: parts, gold: salvage,
      weatherText: weatherText, speedRatio: speedRatio, displaySpeed: displaySpeed,
      heading: heading, wave: wave, waveState: waveState, autofireOn: autofireOn,
      ammo: ammo, maxAmmo: maxAmmo
    });
  }

  updateBanner(dt || 0.016);
}
