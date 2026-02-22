// hud.js — Minimal HUD: HP bar (top-left), weapon icons (bottom-center),
// minimap (top-right), fade-on-change popups, ability cooldown ring
import { createMinimap, updateMinimap as renderMinimap } from "./minimap.js";
import { isMobile } from "./mobile.js";

// --- color palette ---
var C = {
  bg: "rgba(5,10,20,0.7)",
  bgLight: "rgba(20,30,50,0.7)",
  border: "rgba(80,100,130,0.4)",
  borderActive: "rgba(80,100,130,0.5)",
  text: "#8899aa",
  textDim: "#667788",
  green: "#44aa66",
  greenBright: "#44dd66",
  yellow: "#ffcc44",
  orange: "#cc8822",
  red: "#cc4444",
  blue: "#4477aa",
  blueBright: "#2288cc",
  purple: "#cc66ff",
  cyan: "#44aaff",
  portGreen: "#44ff88"
};

export { C as HUD_COLORS };

var _mob = isMobile();

// --- always-visible elements ---
var topLeftPanel = null;
var hpBarBg = null, hpBar = null, hpLabel = null;

var minimapContainer = null;

var bottomPanel = null;
var weaponPanel = null, weaponItems = [];

// --- ability cooldown ring (bottom-left) ---
var abilityRing = null, abilityCanvas = null, abilityCtx = null;
var RING_SIZE = _mob ? 44 : 36;

// --- fade-on-change popups ---
var ammoPopup = null, ammoPopupTimer = 0, prevAmmo = -1;
var salvagePopup = null, salvagePopupTimer = 0, prevSalvage = -1;
var autofirePopup = null, autofirePopupTimer = 0, prevAutofire = null;

// --- port proximity label ---
var portLabel = null;

// --- overlays ---
var banner = null, bannerTimer = 0;
var overlay = null, overlayTitle = null, overlaySubtext = null, overlayBtn = null;

// --- callbacks ---
var onWeaponSwitchCallback = null;
var onAbilityCallback = null;
var onAutofireToggleCallback = null;
var onRestartCallback = null;
var onMuteCallback = null;
var onVolumeCallback = null;

// --- settings menu data callbacks ---
var settingsDataCallback = null;

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
    "font-family:monospace", "font-size:" + (_mob ? "14px" : "12px"),
    "color:" + C.text, "background:" + C.bg,
    "border:1px solid " + C.border, "border-radius:4px",
    "padding:4px 10px", "pointer-events:none",
    "user-select:none", "z-index:10",
    "opacity:0", "transition:opacity 0.3s"
  ].join(";");
  document.body.appendChild(el);
  return el;
}

export function createHUD() {
  // === TOP-LEFT: HP bar only ===
  topLeftPanel = document.createElement("div");
  var mobPad = _mob ? "top:env(safe-area-inset-top,16px);left:env(safe-area-inset-left,16px);" : "top:16px;left:16px;";
  topLeftPanel.style.cssText = [
    "position:fixed", "pointer-events:none",
    "font-family:monospace", "color:" + C.text, "font-size:" + (_mob ? "15px" : "13px"),
    "user-select:none", "z-index:10"
  ].join(";") + ";" + mobPad;

  hpLabel = document.createElement("div");
  hpLabel.textContent = "";
  hpLabel.style.cssText = "font-size:" + (_mob ? "12px" : "11px") + ";color:" + C.textDim + ";margin-bottom:2px;height:14px;";
  topLeftPanel.appendChild(hpLabel);
  var hpBars = makeBar(_mob ? 100 : 120, _mob ? 10 : 8);
  hpBarBg = hpBars.bg;
  hpBar = hpBars.fill;
  topLeftPanel.appendChild(hpBarBg);

  // port proximity (shows only when near)
  portLabel = document.createElement("div");
  portLabel.textContent = "";
  portLabel.style.cssText = "margin-top:4px;font-size:11px;color:" + C.portGreen + ";height:14px;";
  topLeftPanel.appendChild(portLabel);

  document.body.appendChild(topLeftPanel);

  // === TOP-RIGHT: minimap only (no sound controls) ===
  minimapContainer = document.createElement("div");
  minimapContainer.style.cssText = [
    "position:fixed", "top:16px", "right:16px",
    "pointer-events:none", "user-select:none", "z-index:10"
  ].join(";");
  createMinimap(minimapContainer);
  document.body.appendChild(minimapContainer);

  // === BOTTOM-CENTER: weapon selector (icon-based) ===
  bottomPanel = document.createElement("div");
  var botPad = _mob ? "bottom:env(safe-area-inset-bottom,16px);" : "bottom:16px;";
  bottomPanel.style.cssText = [
    "position:fixed", "left:50%", "transform:translateX(-50%)",
    "pointer-events:none", "font-family:monospace", "color:" + C.text,
    "user-select:none", "z-index:10", "text-align:center"
  ].join(";") + ";" + botPad;

  weaponPanel = document.createElement("div");
  weaponPanel.style.cssText = "display:flex;gap:" + (_mob ? "6px" : "4px") + ";justify-content:center;";
  var weaponDefs = [
    { icon: "\u2022", color: "#ffcc44" },
    { icon: "\u25C6", color: "#ff6644" },
    { icon: "\u25AC", color: "#44aaff" }
  ];
  weaponItems = [];
  for (var w = 0; w < weaponDefs.length; w++) {
    var btn = document.createElement("div");
    var sz = _mob ? 44 : 32;
    btn.style.cssText = [
      "width:" + sz + "px", "height:" + sz + "px",
      "display:flex", "align-items:center", "justify-content:center",
      "background:" + C.bgLight, "border:2px solid transparent",
      "border-radius:4px", "cursor:pointer", "pointer-events:auto",
      "font-size:" + (_mob ? "18px" : "14px"), "color:" + weaponDefs[w].color,
      "transition:border-color 0.15s,opacity 0.15s"
    ].join(";");
    btn.textContent = weaponDefs[w].icon;
    btn.dataset.weaponIndex = String(w);
    btn.addEventListener("click", (function (idx) {
      return function (e) {
        e.stopPropagation();
        if (onWeaponSwitchCallback) onWeaponSwitchCallback(idx);
      };
    })(w));
    weaponPanel.appendChild(btn);
    weaponItems.push({ el: btn, color: weaponDefs[w].color, index: w });
  }
  bottomPanel.appendChild(weaponPanel);
  document.body.appendChild(bottomPanel);

  // === BOTTOM-LEFT: ability cooldown ring ===
  abilityRing = document.createElement("div");
  var abilityPad = _mob ? "bottom:env(safe-area-inset-bottom,16px);left:env(safe-area-inset-left,16px);" : "bottom:16px;left:16px;";
  abilityRing.style.cssText = [
    "position:fixed", "pointer-events:auto", "cursor:pointer",
    "user-select:none", "z-index:10"
  ].join(";") + ";" + abilityPad;
  abilityCanvas = document.createElement("canvas");
  abilityCanvas.width = RING_SIZE;
  abilityCanvas.height = RING_SIZE;
  abilityCanvas.style.cssText = "width:" + RING_SIZE + "px;height:" + RING_SIZE + "px;";
  abilityCtx = abilityCanvas.getContext("2d");
  abilityRing.appendChild(abilityCanvas);
  abilityRing.addEventListener("click", function (e) {
    e.stopPropagation();
    if (onAbilityCallback) onAbilityCallback();
  });
  document.body.appendChild(abilityRing);

  // === FADE-ON-CHANGE POPUPS ===
  ammoPopup = makePopup("left");
  ammoPopup.style.bottom = _mob ? "70px" : "60px";
  ammoPopup.style.left = "";
  ammoPopup.style.right = "";
  ammoPopup.style.left = "50%";
  ammoPopup.style.transform = "translateX(-50%)";
  ammoPopup.style.bottom = _mob ? "70px" : "56px";

  salvagePopup = makePopup("left");
  salvagePopup.style.bottom = "";
  salvagePopup.style.left = "";
  salvagePopup.style.top = _mob ? "50px" : "46px";
  salvagePopup.style.left = "16px";

  autofirePopup = makePopup("left");
  autofirePopup.style.bottom = "";
  autofirePopup.style.left = "50%";
  autofirePopup.style.transform = "translateX(-50%)";
  autofirePopup.style.top = "50%";

  // === BANNER ===
  banner = document.createElement("div");
  banner.style.cssText = [
    "position:fixed", "top:25%", "left:50%",
    "transform:translate(-50%,-50%)", "font-family:monospace",
    "font-size:" + (_mob ? "24px" : "32px"), "font-weight:bold", "color:" + C.yellow,
    "text-shadow:0 0 20px rgba(255,200,60,0.6)", "pointer-events:none",
    "user-select:none", "z-index:20", "opacity:0", "transition:opacity 0.3s"
  ].join(";");
  document.body.appendChild(banner);

  // === OVERLAY (game over / victory) ===
  overlay = document.createElement("div");
  overlay.style.cssText = [
    "position:fixed", "top:0", "left:0", "width:100%", "height:100%",
    "display:none", "flex-direction:column", "align-items:center",
    "justify-content:center", "background:rgba(5,5,15,0.85)",
    "z-index:100", "font-family:monospace", "user-select:none"
  ].join(";");
  overlayTitle = document.createElement("div");
  overlayTitle.style.cssText = "font-size:" + (_mob ? "36px" : "48px") + ";font-weight:bold;color:" + C.red + ";margin-bottom:16px;";
  overlay.appendChild(overlayTitle);
  overlaySubtext = document.createElement("div");
  overlaySubtext.style.cssText = "font-size:20px;color:" + C.text + ";margin-bottom:32px;";
  overlay.appendChild(overlaySubtext);
  overlayBtn = document.createElement("button");
  overlayBtn.textContent = "RESTART";
  overlayBtn.style.cssText = [
    "font-family:monospace", "font-size:" + (_mob ? "20px" : "18px"),
    "padding:" + (_mob ? "14px 44px" : "12px 36px"),
    "background:rgba(40,60,90,0.8)", "color:" + C.text,
    "border:1px solid " + C.borderActive, "border-radius:6px",
    "cursor:pointer", "pointer-events:auto",
    "min-height:44px"
  ].join(";");
  overlayBtn.addEventListener("click", function () {
    hideOverlay();
    if (onRestartCallback) onRestartCallback();
  });
  overlay.appendChild(overlayBtn);
  document.body.appendChild(overlay);
}

export function setWeaponSwitchCallback(cb) { onWeaponSwitchCallback = cb; }
export function setAbilityCallback(cb) { onAbilityCallback = cb; }
export function setRestartCallback(cb) { onRestartCallback = cb; }
export function setAutofireToggleCallback(cb) { onAutofireToggleCallback = cb; }
export function setMuteCallback(cb) { onMuteCallback = cb; }
export function setVolumeCallback(cb) { onVolumeCallback = cb; }
export function updateMuteButton(m) { /* moved to settings menu — no-op for compat */ }
export function updateVolumeSlider(v) { /* moved to settings menu — no-op for compat */ }

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
  overlaySubtext.textContent = "You reached Wave " + waveReached;
  overlayBtn.textContent = "RESTART";
  overlay.style.display = "flex";
}
export function showVictory(waveReached) {
  if (!overlay) return;
  overlayTitle.textContent = "VICTORY";
  overlayTitle.style.color = C.greenBright;
  overlaySubtext.textContent = "All " + waveReached + " waves survived!";
  overlayBtn.textContent = "CONTINUE";
  overlay.style.display = "flex";
}
export function hideOverlay() {
  if (!overlay) return;
  overlay.style.display = "none";
}

export function updateMinimap(playerX, playerZ, playerHeading, enemies, pickups, ports, remotePlayers) {
  renderMinimap(playerX, playerZ, playerHeading, enemies, pickups, ports, remotePlayers);
}

// --- draw ability cooldown ring ---
function drawAbilityRing(info) {
  if (!abilityCtx) return;
  var ctx = abilityCtx;
  var cx = RING_SIZE / 2;
  var cy = RING_SIZE / 2;
  var r = RING_SIZE / 2 - 3;
  ctx.clearRect(0, 0, RING_SIZE, RING_SIZE);

  var ac = (info && info.color) || C.purple;
  var pct = 1;
  var label = "Q";

  if (info) {
    if (info.active) {
      pct = Math.max(0, info.activeTimer / info.duration);
      label = "\u26A1";
    } else if (info.cooldownTimer > 0) {
      pct = 1 - info.cooldownTimer / info.cooldown;
      label = Math.ceil(info.cooldownTimer) + "";
      ac = "#556677";
    }
  }

  // background circle
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = C.bgLight;
  ctx.fill();
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 1;
  ctx.stroke();

  // progress arc
  if (pct < 1) {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = ac;
    ctx.globalAlpha = 0.35;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // ring border colored when ready
  if (info && !info.active && info.cooldownTimer <= 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = info.color || C.purple;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // label
  ctx.fillStyle = info && !info.active && info.cooldownTimer <= 0 ? (info.color || C.purple) : C.text;
  ctx.font = (_mob ? "14" : "12") + "px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, cx, cy);
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
export function updateHUD(speedRatio, displaySpeed, heading, ammo, maxAmmo, hp, maxHp, fuel, maxFuel, parts, wave, waveState, dt, salvage, weaponInfo, abilityInfo, weatherText, autofireOn, portInfo) {
  if (!topLeftPanel) return;

  // HP bar — no numbers unless damaged
  if (hp !== undefined && hpBar) {
    var hpPct = Math.max(0, hp / maxHp) * 100;
    hpBar.style.width = hpPct + "%";
    hpBar.style.background = hpPct > 50 ? C.green : hpPct > 25 ? "#aaaa44" : C.red;
    if (hp < maxHp) {
      hpLabel.textContent = Math.round(hp) + " / " + Math.round(maxHp);
      hpLabel.style.color = hpPct > 25 ? C.textDim : C.red;
    } else {
      hpLabel.textContent = "";
    }
  }

  // Port proximity
  if (portLabel) {
    if (portInfo && portInfo.dist < 50) {
      portLabel.textContent = portInfo.available ? "PORT " + Math.round(portInfo.dist) + "m" : "PORT " + Math.ceil(portInfo.cooldown) + "s";
      portLabel.style.color = portInfo.available ? C.portGreen : "#884422";
    } else { portLabel.textContent = ""; }
  }

  // Weapon icons — highlight active
  if (weaponInfo && weaponItems.length > 0) {
    for (var w = 0; w < weaponItems.length; w++) {
      var item = weaponItems[w];
      var isActive = w === weaponInfo.activeIndex;
      item.el.style.borderColor = isActive ? item.color : "transparent";
      item.el.style.opacity = isActive ? "1" : "0.4";
    }
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
    salvagePopup.textContent = "SALVAGE +" + (salvage - prevSalvage);
    salvagePopup.style.color = C.yellow;
    salvagePopupTimer = 2.5;
  }
  prevSalvage = salvage !== undefined ? salvage : prevSalvage;
  salvagePopupTimer = fadePopup(salvagePopup, salvagePopupTimer, dt || 0.016);

  // Autofire popup — show on change, fade after 2s
  if (prevAutofire !== null && autofireOn !== prevAutofire) {
    autofirePopup.textContent = autofireOn ? "AUTOFIRE ON" : "AUTOFIRE OFF";
    autofirePopup.style.color = autofireOn ? C.greenBright : C.textDim;
    autofirePopupTimer = 2;
  }
  prevAutofire = autofireOn;
  autofirePopupTimer = fadePopup(autofirePopup, autofirePopupTimer, dt || 0.016);

  // Ability cooldown ring
  drawAbilityRing(abilityInfo);

  // Provide data to settings menu for display
  if (settingsDataCallback) {
    settingsDataCallback({
      fuel: fuel, maxFuel: maxFuel, parts: parts, salvage: salvage,
      weatherText: weatherText, speedRatio: speedRatio, displaySpeed: displaySpeed,
      heading: heading, wave: wave, waveState: waveState, autofireOn: autofireOn,
      ammo: ammo, maxAmmo: maxAmmo
    });
  }

  updateBanner(dt || 0.016);
}
