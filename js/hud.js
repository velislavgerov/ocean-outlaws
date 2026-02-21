// hud.js — HUD elements: HP (top-left), wave (top-center), minimap (top-right),
// weapons/ammo (bottom-center), ability & status (bottom-left)
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

var _mob = isMobile();
var BTN_BASE = [
  "font-family:monospace", "font-size:" + (_mob ? "15px" : "13px"), "padding:" + (_mob ? "10px 14px" : "6px 10px"),
  "border-radius:4px", "cursor:pointer", "pointer-events:auto",
  "user-select:none", "text-align:center",
  "min-width:" + (_mob ? "44px" : "80px"), "min-height:" + (_mob ? "44px" : "auto")
].join(";");

// --- top-left: HP, fuel, resources ---
var topLeftPanel = null;
var hpBarBg = null, hpBar = null, hpLabel = null;
var fuelBarBg = null, fuelBar = null, fuelLabel = null;
var partsLabel = null, salvageLabel = null;
var weatherLabel = null, portLabel = null;

// --- top-center: wave info ---
var topCenterPanel = null;
var waveLabel = null;
var compassLabel = null;

// --- top-right: minimap + sound ---
var minimapContainer = null;
var soundPanel = null, muteBtn = null, volumeSlider = null;

// --- bottom-center: weapons/ammo ---
var bottomPanel = null;
var weaponPanel = null, weaponItems = [];
var ammoLabel = null;
var speedBar = null, speedLabel = null;
var autofireLabel = null;

// --- bottom-left: ability ---
var bottomLeftPanel = null;
var abilityBtn = null, abilityBarBg = null, abilityBar = null, abilityStatus = null;

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

export function createHUD() {
  // === TOP-LEFT: HP, fuel, resources ===
  topLeftPanel = document.createElement("div");
  var mobPad = _mob ? "top:env(safe-area-inset-top,16px);left:env(safe-area-inset-left,16px);" : "top:16px;left:16px;";
  topLeftPanel.style.cssText = [
    "position:fixed", "pointer-events:none",
    "font-family:monospace", "color:" + C.text, "font-size:" + (_mob ? "15px" : "13px"),
    "user-select:none", "z-index:10"
  ].join(";") + ";" + mobPad;

  hpLabel = document.createElement("div");
  hpLabel.textContent = "HP";
  hpLabel.style.cssText = "font-size:" + (_mob ? "14px" : "12px") + ";color:" + C.textDim + ";margin-bottom:3px;";
  topLeftPanel.appendChild(hpLabel);
  var hpBars = makeBar(_mob ? 130 : 160, _mob ? 12 : 10);
  hpBarBg = hpBars.bg;
  hpBar = hpBars.fill;
  topLeftPanel.appendChild(hpBarBg);

  fuelLabel = document.createElement("div");
  fuelLabel.textContent = "FUEL";
  fuelLabel.style.cssText = "font-size:" + (_mob ? "14px" : "12px") + ";color:" + C.textDim + ";margin-top:8px;margin-bottom:3px;";
  topLeftPanel.appendChild(fuelLabel);
  var fuelBars = makeBar(_mob ? 130 : 160, _mob ? 10 : 8);
  fuelBarBg = fuelBars.bg;
  fuelBar = fuelBars.fill;
  fuelBar.style.background = C.blueBright;
  topLeftPanel.appendChild(fuelBarBg);

  partsLabel = document.createElement("div");
  partsLabel.textContent = "PARTS: 0";
  partsLabel.style.cssText = "margin-top:6px;font-size:12px;color:" + C.text + ";";
  topLeftPanel.appendChild(partsLabel);

  salvageLabel = document.createElement("div");
  salvageLabel.textContent = "SALVAGE: 0";
  salvageLabel.style.cssText = "margin-top:3px;font-size:12px;color:" + C.yellow + ";";
  topLeftPanel.appendChild(salvageLabel);

  weatherLabel = document.createElement("div");
  weatherLabel.textContent = "CALM";
  weatherLabel.style.cssText = "margin-top:6px;font-size:12px;color:" + C.textDim + ";";
  topLeftPanel.appendChild(weatherLabel);

  portLabel = document.createElement("div");
  portLabel.textContent = "";
  portLabel.style.cssText = "margin-top:3px;font-size:12px;color:" + C.portGreen + ";";
  topLeftPanel.appendChild(portLabel);

  document.body.appendChild(topLeftPanel);

  // === TOP-CENTER: wave info ===
  topCenterPanel = document.createElement("div");
  topCenterPanel.style.cssText = [
    "position:fixed", "top:16px", "left:50%", "transform:translateX(-50%)",
    "pointer-events:none", "font-family:monospace", "color:" + C.text,
    "font-size:13px", "user-select:none", "z-index:10", "text-align:center"
  ].join(";");

  waveLabel = document.createElement("div");
  waveLabel.textContent = "WAVE 1";
  waveLabel.style.cssText = "font-size:" + (_mob ? "18px" : "16px") + ";font-weight:bold;color:" + C.text + ";";
  topCenterPanel.appendChild(waveLabel);

  compassLabel = document.createElement("div");
  compassLabel.textContent = "N 0\u00B0";
  compassLabel.style.cssText = "font-size:" + (_mob ? "14px" : "12px") + ";color:" + C.textDim + ";margin-top:4px;";
  topCenterPanel.appendChild(compassLabel);

  document.body.appendChild(topCenterPanel);

  // === TOP-RIGHT: minimap + sound ===
  minimapContainer = document.createElement("div");
  minimapContainer.style.cssText = [
    "position:fixed", "top:16px", "right:16px",
    "pointer-events:none", "user-select:none", "z-index:10"
  ].join(";");

  createMinimap(minimapContainer);

  // sound controls below minimap
  soundPanel = document.createElement("div");
  soundPanel.style.cssText = [
    "display:flex", "align-items:center", "gap:6px",
    "margin-top:8px", "font-family:monospace", "font-size:12px",
    "color:" + C.text, "justify-content:center"
  ].join(";");
  muteBtn = document.createElement("div");
  muteBtn.style.cssText = [
    BTN_BASE, "font-size:" + (_mob ? "20px" : "16px"),
    "min-width:" + (_mob ? "44px" : "36px"),
    "min-height:" + (_mob ? "44px" : "auto"),
    "padding:" + (_mob ? "8px 12px" : "4px 8px"),
    "background:" + C.bgLight, "border:1px solid " + C.borderActive,
    "color:" + C.text
  ].join(";");
  muteBtn.textContent = "\u266A";
  muteBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    if (onMuteCallback) onMuteCallback();
  });
  soundPanel.appendChild(muteBtn);
  volumeSlider = document.createElement("input");
  volumeSlider.type = "range";
  volumeSlider.min = "0";
  volumeSlider.max = "100";
  volumeSlider.value = "50";
  volumeSlider.style.cssText = "width:70px;cursor:pointer;pointer-events:auto;accent-color:" + C.blue + ";";
  volumeSlider.addEventListener("input", function (e) {
    e.stopPropagation();
    if (onVolumeCallback) onVolumeCallback(parseFloat(volumeSlider.value) / 100);
  });
  soundPanel.appendChild(volumeSlider);
  minimapContainer.appendChild(soundPanel);

  document.body.appendChild(minimapContainer);

  // === BOTTOM-CENTER: weapons, ammo, speed ===
  bottomPanel = document.createElement("div");
  var botPad = _mob ? "bottom:env(safe-area-inset-bottom,16px);" : "bottom:16px;";
  bottomPanel.style.cssText = [
    "position:fixed", "left:50%", "transform:translateX(-50%)",
    "pointer-events:none", "font-family:monospace", "color:" + C.text,
    "font-size:" + (_mob ? "15px" : "13px"), "user-select:none", "z-index:10", "text-align:center"
  ].join(";") + ";" + botPad;

  weaponPanel = document.createElement("div");
  weaponPanel.style.cssText = "display:flex;gap:4px;justify-content:center;margin-bottom:6px;";
  var weaponDefs = [
    { name: "Turret", color: "#ffcc44", key: "1" },
    { name: "Missile", color: "#ff6644", key: "2" },
    { name: "Torpedo", color: "#44aaff", key: "3" }
  ];
  weaponItems = [];
  for (var w = 0; w < weaponDefs.length; w++) {
    var row = document.createElement("div");
    row.style.cssText = [
      BTN_BASE, "display:flex", "align-items:center", "gap:4px",
      "background:" + C.bgLight, "border:1px solid transparent",
      "color:" + weaponDefs[w].color,
      "min-width:" + (_mob ? "44px" : "90px"),
      "padding:" + (_mob ? "8px 10px" : "5px 8px"),
      "font-size:" + (_mob ? "14px" : "12px"),
      "min-height:" + (_mob ? "44px" : "auto")
    ].join(";");
    row.dataset.weaponIndex = String(w);
    row.addEventListener("click", (function (idx) {
      return function (e) {
        e.stopPropagation();
        if (onWeaponSwitchCallback) onWeaponSwitchCallback(idx);
      };
    })(w));
    var keyHint = document.createElement("span");
    keyHint.textContent = "[" + weaponDefs[w].key + "]";
    keyHint.style.cssText = "color:" + C.textDim + ";font-size:10px;";
    row.appendChild(keyHint);
    var nameEl = document.createElement("span");
    nameEl.textContent = weaponDefs[w].name;
    row.appendChild(nameEl);
    var label = document.createElement("span");
    label.textContent = "--";
    label.style.color = C.text;
    row.appendChild(label);
    weaponPanel.appendChild(row);
    weaponItems.push({ el: row, label: label, nameEl: nameEl, color: weaponDefs[w].color, index: w });
  }
  bottomPanel.appendChild(weaponPanel);

  ammoLabel = document.createElement("div");
  ammoLabel.textContent = "AMMO: --";
  ammoLabel.style.cssText = "font-size:13px;color:" + C.text + ";margin-bottom:6px;";
  bottomPanel.appendChild(ammoLabel);

  // speed bar row
  var speedRow = document.createElement("div");
  speedRow.style.cssText = "display:flex;align-items:center;gap:8px;justify-content:center;";
  var speedBarBg = document.createElement("div");
  speedBarBg.style.cssText = [
    "width:100px", "height:6px", "background:" + C.bgLight,
    "border:1px solid " + C.border, "border-radius:3px", "overflow:hidden"
  ].join(";");
  speedBar = document.createElement("div");
  speedBar.style.cssText = "width:0%;height:100%;background:" + C.blue + ";border-radius:2px;transition:width 0.1s;";
  speedBarBg.appendChild(speedBar);
  speedRow.appendChild(speedBarBg);
  speedLabel = document.createElement("span");
  speedLabel.textContent = "0 kn";
  speedLabel.style.cssText = "font-size:12px;color:" + C.textDim + ";min-width:50px;";
  speedRow.appendChild(speedLabel);
  bottomPanel.appendChild(speedRow);

  // autofire toggle
  autofireLabel = document.createElement("div");
  autofireLabel.style.cssText = [
    BTN_BASE, "margin-top:6px", "display:inline-block",
    "background:" + C.bgLight, "border:1px solid " + C.borderActive,
    "color:" + C.textDim,
    "font-size:" + (_mob ? "14px" : "11px"),
    "padding:" + (_mob ? "10px 14px" : "4px 10px"),
    "min-height:" + (_mob ? "44px" : "auto")
  ].join(";");
  autofireLabel.textContent = "AUTOFIRE: OFF [F]";
  autofireLabel.addEventListener("click", function (e) {
    e.stopPropagation();
    if (onAutofireToggleCallback) onAutofireToggleCallback();
  });
  bottomPanel.appendChild(autofireLabel);

  document.body.appendChild(bottomPanel);

  // === BOTTOM-LEFT: ability ===
  bottomLeftPanel = document.createElement("div");
  var botLeftPad = _mob ? "bottom:env(safe-area-inset-bottom,16px);left:env(safe-area-inset-left,16px);" : "bottom:16px;left:16px;";
  bottomLeftPanel.style.cssText = [
    "position:fixed", "pointer-events:none",
    "font-family:monospace", "color:" + C.text, "font-size:" + (_mob ? "15px" : "13px"),
    "user-select:none", "z-index:10"
  ].join(";") + ";" + botLeftPad;

  abilityBtn = document.createElement("div");
  abilityBtn.style.cssText = [
    BTN_BASE, "background:" + C.bgLight,
    "border:1px solid " + C.borderActive,
    "color:" + C.purple, "margin-bottom:3px",
    "min-height:" + (_mob ? "44px" : "auto"),
    "font-size:" + (_mob ? "15px" : "13px")
  ].join(";");
  abilityBtn.textContent = "Ability";
  abilityBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    if (onAbilityCallback) onAbilityCallback();
  });
  bottomLeftPanel.appendChild(abilityBtn);
  abilityBarBg = document.createElement("div");
  abilityBarBg.style.cssText = [
    "width:120px", "height:8px", "background:" + C.bgLight,
    "border:1px solid " + C.border, "border-radius:4px", "overflow:hidden"
  ].join(";");
  abilityBar = document.createElement("div");
  abilityBar.style.cssText = [
    "width:100%", "height:100%", "background:" + C.purple,
    "border-radius:3px", "transition:width 0.1s"
  ].join(";");
  abilityBarBg.appendChild(abilityBar);
  bottomLeftPanel.appendChild(abilityBarBg);
  abilityStatus = document.createElement("div");
  abilityStatus.textContent = "READY";
  abilityStatus.style.cssText = "font-size:11px;color:" + C.purple + ";margin-top:2px;";
  bottomLeftPanel.appendChild(abilityStatus);

  document.body.appendChild(bottomLeftPanel);

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
export function updateMuteButton(m) { if (!muteBtn) return; muteBtn.textContent = m ? "\u266A\u2715" : "\u266A"; muteBtn.style.color = m ? C.red : C.text; }
export function updateVolumeSlider(v) { if (volumeSlider) volumeSlider.value = String(Math.round(v * 100)); }

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

// --- main HUD update ---
export function updateHUD(speedRatio, displaySpeed, heading, ammo, maxAmmo, hp, maxHp, fuel, maxFuel, parts, wave, waveState, dt, salvage, weaponInfo, abilityInfo, weatherText, autofireOn, portInfo) {
  if (!topLeftPanel) return;
  // HP bar
  if (hp !== undefined && hpBar) {
    var hpPct = Math.max(0, hp / maxHp) * 100;
    hpBar.style.width = hpPct + "%";
    hpBar.style.background = hpPct > 50 ? C.green : hpPct > 25 ? "#aaaa44" : C.red;
    hpLabel.textContent = "HP: " + Math.round(hp) + " / " + Math.round(maxHp);
    hpLabel.style.color = hpPct > 25 ? C.textDim : C.red;
  }
  // Fuel bar
  if (fuel !== undefined && fuelBar) {
    var fuelPct = Math.max(0, fuel / maxFuel) * 100;
    fuelBar.style.width = fuelPct + "%";
    fuelBar.style.background = fuelPct > 30 ? C.blueBright : fuelPct > 15 ? C.orange : C.red;
    fuelLabel.textContent = "FUEL: " + Math.round(fuel) + "%";
    fuelLabel.style.color = fuelPct > 15 ? C.textDim : C.red;
  }
  // Resources
  if (parts !== undefined && partsLabel) { partsLabel.textContent = "PARTS: " + parts; partsLabel.style.color = parts > 0 ? C.greenBright : C.text; }
  if (salvage !== undefined && salvageLabel) salvageLabel.textContent = "SALVAGE: " + salvage;
  // Weather + port
  if (weatherText && weatherLabel) {
    weatherLabel.textContent = "WEATHER: " + weatherText;
    weatherLabel.style.color = ({ CALM: C.green, ROUGH: "#ccaa44", STORM: C.red })[weatherText] || C.textDim;
  }
  if (portLabel) {
    if (portInfo && portInfo.dist < 50) {
      portLabel.textContent = portInfo.available ? "PORT: " + Math.round(portInfo.dist) + "m" : "PORT: " + Math.ceil(portInfo.cooldown) + "s";
      portLabel.style.color = portInfo.available ? C.portGreen : "#884422";
    } else { portLabel.textContent = ""; }
  }
  // Wave info
  if (wave !== undefined && waveLabel) {
    if (waveState === "WAITING") { waveLabel.textContent = "REPAIRING..."; waveLabel.style.color = C.greenBright; }
    else if (waveState === "WAVE_COMPLETE") { waveLabel.textContent = "WAVE " + wave + " CLEAR"; waveLabel.style.color = C.greenBright; }
    else { waveLabel.textContent = "WAVE " + wave; waveLabel.style.color = C.text; }
  }
  // Compass
  var deg = ((heading * 180 / Math.PI) % 360 + 360) % 360;
  var dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  compassLabel.textContent = dirs[Math.round(deg / 45) % 8] + " " + Math.round(deg) + "\u00B0";
  // Weapons
  if (weaponInfo && weaponItems.length > 0) {
    for (var w = 0; w < weaponItems.length; w++) {
      var item = weaponItems[w], isActive = w === weaponInfo.activeIndex, cost = weaponInfo.ammoCosts[w];
      item.el.style.background = isActive ? "rgba(40,60,90,0.6)" : C.bgLight;
      item.el.style.border = isActive ? "1px solid " + item.color : "1px solid transparent";
      item.label.textContent = "x" + cost;
      item.label.style.color = ammo >= cost ? C.text : C.red;
      item.nameEl.style.opacity = isActive ? "1" : "0.5";
    }
  }
  if (ammo !== undefined) { ammoLabel.textContent = "AMMO: " + ammo + " / " + maxAmmo; ammoLabel.style.color = ammo <= 5 ? "#cc6644" : ammo === 0 ? "#cc2222" : C.text; }
  // Speed
  speedBar.style.width = Math.min(1, speedRatio) * 100 + "%";
  speedLabel.textContent = displaySpeed.toFixed(1) + " kn";
  // Autofire
  if (autofireLabel) {
    autofireLabel.textContent = autofireOn ? "AUTOFIRE: ON [F]" : "AUTOFIRE: OFF [F]";
    autofireLabel.style.color = autofireOn ? C.greenBright : C.textDim;
    autofireLabel.style.borderColor = autofireOn ? C.greenBright : C.borderActive;
  }
  // Ability
  if (abilityInfo && abilityBtn) {
    var ac = abilityInfo.color || C.purple;
    abilityBtn.textContent = abilityInfo.name;
    abilityBtn.style.color = ac;
    if (abilityInfo.active) {
      abilityBar.style.width = Math.max(0, abilityInfo.activeTimer / abilityInfo.duration) * 100 + "%";
      abilityBar.style.background = ac;
      abilityStatus.textContent = "ACTIVE"; abilityStatus.style.color = ac; abilityBtn.style.borderColor = ac;
    } else if (abilityInfo.cooldownTimer > 0) {
      abilityBar.style.width = (1 - abilityInfo.cooldownTimer / abilityInfo.cooldown) * 100 + "%";
      abilityBar.style.background = "#556677";
      abilityStatus.textContent = Math.ceil(abilityInfo.cooldownTimer) + "s"; abilityStatus.style.color = C.textDim; abilityBtn.style.borderColor = C.borderActive;
    } else {
      abilityBar.style.width = "100%"; abilityBar.style.background = ac;
      abilityStatus.textContent = "READY"; abilityStatus.style.color = ac; abilityBtn.style.borderColor = ac;
    }
  }
  updateBanner(dt || 0.016);
}
