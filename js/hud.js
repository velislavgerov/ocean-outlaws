// hud.js — HUD elements, on-screen weapon selector, ability button, overlays
var container = null;
var speedBar = null;
var speedLabel = null;
var compassLabel = null;
var ammoLabel = null;
var weaponPanel = null;
var weaponItems = [];
var fuelBarBg = null;
var fuelBar = null;
var fuelLabel = null;
var partsLabel = null;
var salvageLabel = null;
var hpBarBg = null;
var hpBar = null;
var hpLabel = null;
var waveLabel = null;
var abilityBtn = null;
var abilityBarBg = null;
var abilityBar = null;
var abilityStatus = null;
var weatherLabel = null;
var autofireLabel = null;
var onWeaponSwitchCallback = null;
var onAbilityCallback = null;
var onAutofireToggleCallback = null;
var banner = null;
var bannerTimer = 0;
var overlay = null;
var overlayTitle = null;
var overlaySubtext = null;
var overlayBtn = null;
var onRestartCallback = null;

var BTN_BASE = [
  "font-family:monospace", "font-size:13px", "padding:6px 10px",
  "border-radius:4px", "cursor:pointer", "pointer-events:auto",
  "user-select:none", "text-align:center", "min-width:80px"
].join(";");

export function createHUD() {
  container = document.createElement("div");
  container.style.cssText = [
    "position:fixed", "bottom:20px", "left:20px", "pointer-events:none",
    "font-family:monospace", "color:#8899aa", "font-size:13px",
    "user-select:none", "z-index:10"
  ].join(";");

  var barBg = document.createElement("div");
  barBg.style.cssText = [
    "width:120px", "height:8px", "background:rgba(20,30,50,0.7)",
    "border:1px solid rgba(80,100,130,0.4)", "border-radius:4px",
    "overflow:hidden", "margin-bottom:6px"
  ].join(";");
  speedBar = document.createElement("div");
  speedBar.style.cssText = [
    "width:0%", "height:100%", "background:#4477aa",
    "border-radius:3px", "transition:width 0.1s"
  ].join(";");
  barBg.appendChild(speedBar);
  container.appendChild(barBg);

  speedLabel = document.createElement("div");
  speedLabel.textContent = "0 kn";
  speedLabel.style.marginBottom = "4px";
  container.appendChild(speedLabel);

  compassLabel = document.createElement("div");
  compassLabel.textContent = "N";
  compassLabel.style.fontSize = "12px";
  compassLabel.style.color = "#667788";
  container.appendChild(compassLabel);

  weaponPanel = document.createElement("div");
  weaponPanel.style.cssText = "margin-top:8px;display:flex;flex-direction:column;gap:3px;";
  var weaponDefs = [
    { name: "Turret", color: "#ffcc44" },
    { name: "Missile", color: "#ff6644" },
    { name: "Torpedo", color: "#44aaff" }
  ];
  weaponItems = [];
  for (var w = 0; w < weaponDefs.length; w++) {
    var row = document.createElement("div");
    row.style.cssText = [
      BTN_BASE, "display:flex", "align-items:center", "gap:6px",
      "background:rgba(20,30,50,0.7)", "border:1px solid transparent",
      "color:" + weaponDefs[w].color
    ].join(";");
    row.dataset.weaponIndex = String(w);
    row.addEventListener("click", (function (idx) {
      return function (e) {
        e.stopPropagation();
        if (onWeaponSwitchCallback) onWeaponSwitchCallback(idx);
      };
    })(w));
    var nameEl = document.createElement("span");
    nameEl.textContent = weaponDefs[w].name;
    nameEl.style.minWidth = "60px";
    row.appendChild(nameEl);
    var label = document.createElement("span");
    label.textContent = "--";
    label.style.color = "#8899aa";
    row.appendChild(label);
    weaponPanel.appendChild(row);
    weaponItems.push({ el: row, label: label, nameEl: nameEl, color: weaponDefs[w].color, index: w });
  }
  container.appendChild(weaponPanel);

  ammoLabel = document.createElement("div");
  ammoLabel.textContent = "AMMO: --";
  ammoLabel.style.marginTop = "4px";
  ammoLabel.style.fontSize = "13px";
  ammoLabel.style.color = "#8899aa";
  container.appendChild(ammoLabel);

  autofireLabel = document.createElement("div");
  autofireLabel.style.cssText = [
    BTN_BASE, "margin-top:6px", "background:rgba(20,30,50,0.7)",
    "border:1px solid rgba(80,100,130,0.5)", "color:#667788",
    "font-size:12px"
  ].join(";");
  autofireLabel.textContent = "AUTOFIRE: OFF [F]";
  autofireLabel.addEventListener("click", function (e) {
    e.stopPropagation();
    if (onAutofireToggleCallback) onAutofireToggleCallback();
  });
  container.appendChild(autofireLabel);

  fuelLabel = document.createElement("div");
  fuelLabel.textContent = "FUEL";
  fuelLabel.style.marginTop = "8px";
  fuelLabel.style.fontSize = "12px";
  fuelLabel.style.color = "#667788";
  container.appendChild(fuelLabel);
  fuelBarBg = document.createElement("div");
  fuelBarBg.style.cssText = [
    "width:120px", "height:8px", "background:rgba(20,30,50,0.7)",
    "border:1px solid rgba(80,100,130,0.4)", "border-radius:4px",
    "overflow:hidden", "margin-top:3px"
  ].join(";");
  fuelBar = document.createElement("div");
  fuelBar.style.cssText = [
    "width:100%", "height:100%", "background:#2288cc",
    "border-radius:3px", "transition:width 0.2s"
  ].join(";");
  fuelBarBg.appendChild(fuelBar);
  container.appendChild(fuelBarBg);

  partsLabel = document.createElement("div");
  partsLabel.textContent = "PARTS: 0";
  partsLabel.style.marginTop = "6px";
  partsLabel.style.fontSize = "13px";
  partsLabel.style.color = "#8899aa";
  container.appendChild(partsLabel);

  salvageLabel = document.createElement("div");
  salvageLabel.textContent = "SALVAGE: 0";
  salvageLabel.style.marginTop = "4px";
  salvageLabel.style.fontSize = "13px";
  salvageLabel.style.color = "#ffcc44";
  container.appendChild(salvageLabel);

  hpLabel = document.createElement("div");
  hpLabel.textContent = "HP";
  hpLabel.style.marginTop = "8px";
  hpLabel.style.fontSize = "12px";
  hpLabel.style.color = "#667788";
  container.appendChild(hpLabel);
  hpBarBg = document.createElement("div");
  hpBarBg.style.cssText = [
    "width:120px", "height:8px", "background:rgba(20,30,50,0.7)",
    "border:1px solid rgba(80,100,130,0.4)", "border-radius:4px",
    "overflow:hidden", "margin-top:3px"
  ].join(";");
  hpBar = document.createElement("div");
  hpBar.style.cssText = [
    "width:100%", "height:100%", "background:#44aa66",
    "border-radius:3px", "transition:width 0.2s"
  ].join(";");
  hpBarBg.appendChild(hpBar);
  container.appendChild(hpBarBg);

  waveLabel = document.createElement("div");
  waveLabel.textContent = "WAVE 1";
  waveLabel.style.marginTop = "10px";
  waveLabel.style.fontSize = "14px";
  waveLabel.style.color = "#8899aa";
  waveLabel.style.fontWeight = "bold";
  container.appendChild(waveLabel);

  var abilityContainer = document.createElement("div");
  abilityContainer.style.marginTop = "10px";
  abilityBtn = document.createElement("div");
  abilityBtn.style.cssText = [
    BTN_BASE, "background:rgba(20,30,50,0.7)",
    "border:1px solid rgba(80,100,130,0.5)",
    "color:#cc66ff", "margin-bottom:3px"
  ].join(";");
  abilityBtn.textContent = "Ability";
  abilityBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    if (onAbilityCallback) onAbilityCallback();
  });
  abilityContainer.appendChild(abilityBtn);
  abilityBarBg = document.createElement("div");
  abilityBarBg.style.cssText = [
    "width:120px", "height:10px", "background:rgba(20,30,50,0.7)",
    "border:1px solid rgba(80,100,130,0.4)", "border-radius:4px",
    "overflow:hidden"
  ].join(";");
  abilityBar = document.createElement("div");
  abilityBar.style.cssText = [
    "width:100%", "height:100%", "background:#cc66ff",
    "border-radius:3px", "transition:width 0.1s"
  ].join(";");
  abilityBarBg.appendChild(abilityBar);
  abilityContainer.appendChild(abilityBarBg);
  abilityStatus = document.createElement("div");
  abilityStatus.textContent = "READY";
  abilityStatus.style.fontSize = "11px";
  abilityStatus.style.color = "#cc66ff";
  abilityStatus.style.marginTop = "2px";
  abilityContainer.appendChild(abilityStatus);
  container.appendChild(abilityContainer);

  weatherLabel = document.createElement("div");
  weatherLabel.textContent = "CALM";
  weatherLabel.style.marginTop = "10px";
  weatherLabel.style.fontSize = "12px";
  weatherLabel.style.color = "#667788";
  container.appendChild(weatherLabel);
  document.body.appendChild(container);

  banner = document.createElement("div");
  banner.style.cssText = [
    "position:fixed", "top:25%", "left:50%",
    "transform:translate(-50%,-50%)", "font-family:monospace",
    "font-size:32px", "font-weight:bold", "color:#ffcc44",
    "text-shadow:0 0 20px rgba(255,200,60,0.6)", "pointer-events:none",
    "user-select:none", "z-index:20", "opacity:0", "transition:opacity 0.3s"
  ].join(";");
  banner.textContent = "";
  document.body.appendChild(banner);

  overlay = document.createElement("div");
  overlay.style.cssText = [
    "position:fixed", "top:0", "left:0", "width:100%", "height:100%",
    "display:none", "flex-direction:column", "align-items:center",
    "justify-content:center", "background:rgba(5,5,15,0.85)",
    "z-index:100", "font-family:monospace", "user-select:none"
  ].join(";");
  overlayTitle = document.createElement("div");
  overlayTitle.style.cssText = [
    "font-size:48px", "font-weight:bold", "color:#cc4444", "margin-bottom:16px"
  ].join(";");
  overlay.appendChild(overlayTitle);
  overlaySubtext = document.createElement("div");
  overlaySubtext.style.cssText = [
    "font-size:20px", "color:#8899aa", "margin-bottom:32px"
  ].join(";");
  overlay.appendChild(overlaySubtext);
  overlayBtn = document.createElement("button");
  overlayBtn.textContent = "RESTART";
  overlayBtn.style.cssText = [
    "font-family:monospace", "font-size:18px", "padding:12px 36px",
    "background:rgba(40,60,90,0.8)", "color:#8899aa",
    "border:1px solid rgba(80,100,130,0.5)", "border-radius:6px",
    "cursor:pointer", "pointer-events:auto"
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
  if (bannerTimer <= 0) {
    banner.style.opacity = "0";
  }
}

export function showGameOver(waveReached) {
  if (!overlay) return;
  overlayTitle.textContent = "GAME OVER";
  overlayTitle.style.color = "#cc4444";
  overlaySubtext.textContent = "You reached Wave " + waveReached;
  overlayBtn.textContent = "RESTART";
  overlay.style.display = "flex";
}

export function showVictory(waveReached) {
  if (!overlay) return;
  overlayTitle.textContent = "VICTORY";
  overlayTitle.style.color = "#44dd66";
  overlaySubtext.textContent = "All " + waveReached + " waves survived!";
  overlayBtn.textContent = "CONTINUE";
  overlay.style.display = "flex";
}

export function hideOverlay() {
  if (!overlay) return;
  overlay.style.display = "none";
}

export function updateHUD(speedRatio, displaySpeed, heading, ammo, maxAmmo, hp, maxHp, fuel, maxFuel, parts, wave, waveState, dt, salvage, weaponInfo, abilityInfo, weatherText, autofireOn) {
  if (!container) return;
  var pct = Math.min(1, speedRatio) * 100;
  speedBar.style.width = pct + "%";
  speedLabel.textContent = displaySpeed.toFixed(1) + " kn";
  var deg = ((heading * 180 / Math.PI) % 360 + 360) % 360;
  var dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  var idx = Math.round(deg / 45) % 8;
  compassLabel.textContent = dirs[idx] + " " + Math.round(deg) + "\u00B0";

  if (weaponInfo && weaponItems.length > 0) {
    var ammoCosts = weaponInfo.ammoCosts;
    for (var w = 0; w < weaponItems.length; w++) {
      var item = weaponItems[w];
      var isActive = w === weaponInfo.activeIndex;
      item.el.style.background = isActive ? "rgba(40,60,90,0.6)" : "rgba(20,30,50,0.7)";
      item.el.style.border = isActive ? "1px solid " + item.color : "1px solid transparent";
      var cost = ammoCosts[w];
      var canAfford = ammo >= cost;
      item.label.textContent = "x" + cost;
      item.label.style.color = canAfford ? "#8899aa" : "#cc4444";
      item.nameEl.style.opacity = isActive ? "1" : "0.5";
    }
  }
  if (ammo !== undefined) {
    ammoLabel.textContent = "AMMO: " + ammo + " / " + maxAmmo;
    ammoLabel.style.color = ammo <= 5 ? "#cc6644" : ammo === 0 ? "#cc2222" : "#8899aa";
  }
  if (fuel !== undefined && fuelBar) {
    var fuelPct = Math.max(0, fuel / maxFuel) * 100;
    fuelBar.style.width = fuelPct + "%";
    fuelBar.style.background = fuelPct > 30 ? "#2288cc" : fuelPct > 15 ? "#cc8822" : "#cc4444";
    fuelLabel.textContent = "FUEL: " + Math.round(fuel) + "%";
    fuelLabel.style.color = fuelPct > 15 ? "#667788" : "#cc4444";
  }
  if (parts !== undefined && partsLabel) {
    partsLabel.textContent = "PARTS: " + parts;
    partsLabel.style.color = parts > 0 ? "#44dd66" : "#8899aa";
  }
  if (salvage !== undefined && salvageLabel) {
    salvageLabel.textContent = "SALVAGE: " + salvage;
  }
  if (hp !== undefined && hpBar) {
    var hpPct = Math.max(0, hp / maxHp) * 100;
    hpBar.style.width = hpPct + "%";
    hpBar.style.background = hpPct > 50 ? "#44aa66" : hpPct > 25 ? "#aaaa44" : "#cc4444";
    hpLabel.textContent = "HP: " + Math.round(hp) + " / " + Math.round(maxHp);
    hpLabel.style.color = hpPct > 25 ? "#667788" : "#cc4444";
  }
  if (wave !== undefined && waveLabel) {
    if (waveState === "SPAWNING" || waveState === "ACTIVE") {
      waveLabel.textContent = "WAVE " + wave;
      waveLabel.style.color = "#8899aa";
    } else if (waveState === "WAITING") {
      waveLabel.textContent = "REPAIRING...";
      waveLabel.style.color = "#44dd66";
    } else if (waveState === "WAVE_COMPLETE") {
      waveLabel.textContent = "WAVE " + wave + " CLEAR";
      waveLabel.style.color = "#44dd66";
    } else {
      waveLabel.textContent = "WAVE " + wave;
      waveLabel.style.color = "#8899aa";
    }
  }
  if (abilityInfo && abilityBtn) {
    abilityBtn.textContent = abilityInfo.name;
    abilityBtn.style.color = abilityInfo.color || "#cc66ff";
    if (abilityInfo.active) {
      var activePct = Math.max(0, abilityInfo.activeTimer / abilityInfo.duration) * 100;
      abilityBar.style.width = activePct + "%";
      abilityBar.style.background = abilityInfo.color || "#cc66ff";
      abilityStatus.textContent = "ACTIVE";
      abilityStatus.style.color = abilityInfo.color || "#cc66ff";
      abilityBtn.style.borderColor = abilityInfo.color || "#cc66ff";
    } else if (abilityInfo.cooldownTimer > 0) {
      var cdPct = (1 - abilityInfo.cooldownTimer / abilityInfo.cooldown) * 100;
      abilityBar.style.width = cdPct + "%";
      abilityBar.style.background = "#556677";
      abilityStatus.textContent = Math.ceil(abilityInfo.cooldownTimer) + "s";
      abilityStatus.style.color = "#667788";
      abilityBtn.style.borderColor = "rgba(80,100,130,0.5)";
    } else {
      abilityBar.style.width = "100%";
      abilityBar.style.background = abilityInfo.color || "#cc66ff";
      abilityStatus.textContent = "READY";
      abilityStatus.style.color = abilityInfo.color || "#cc66ff";
      abilityBtn.style.borderColor = abilityInfo.color || "#cc66ff";
    }
  }
  if (weatherText && weatherLabel) {
    weatherLabel.textContent = "WEATHER: " + weatherText;
    var wColors = { CALM: "#44aa66", ROUGH: "#ccaa44", STORM: "#cc4444" };
    weatherLabel.style.color = wColors[weatherText] || "#667788";
  }
  if (autofireLabel) {
    if (autofireOn) {
      autofireLabel.textContent = "AUTOFIRE: ON [F]";
      autofireLabel.style.color = "#44dd66";
      autofireLabel.style.borderColor = "#44dd66";
    } else {
      autofireLabel.textContent = "AUTOFIRE: OFF [F]";
      autofireLabel.style.color = "#667788";
      autofireLabel.style.borderColor = "rgba(80,100,130,0.5)";
    }
  }
  updateBanner(dt || 0.016);
}
