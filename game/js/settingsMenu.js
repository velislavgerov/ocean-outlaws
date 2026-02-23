// settingsMenu.js — settings/pause menu: game info, music/volume, autofire,
// fuel, parts, weather, compass, speed + existing save/quality/new-game

import { exportSave, importSave, deleteSave, hasSave } from "./save.js";
import { getQuality, setQuality, isMobile } from "./mobile.js";
import { T, FONT, PARCHMENT_BG } from "./theme.js";

var BTN = [
  "font-family:" + FONT, "font-size:14px", "padding:10px 20px",
  "border-radius:4px", "cursor:pointer", "pointer-events:auto",
  "user-select:none", "text-align:center", "min-width:200px",
  "border:1px solid " + T.border, "background:" + T.bgLight,
  "color:" + T.text, "margin:6px 0",
  "text-shadow:0 1px 2px rgba(0,0,0,0.4)"
].join(";");

var INFO_ROW = [
  "font-family:" + FONT, "font-size:13px", "color:" + T.text,
  "padding:3px 0", "text-align:left",
  "text-shadow:0 1px 2px rgba(0,0,0,0.3)"
].join(";");

var gearBtn = null;
var menuPanel = null;
var menuOpen = false;
var onNewGameCallback = null;
var confirmOverlay = null;

// --- game info labels (moved from HUD) ---
var infoSection = null;
var fuelInfo = null, partsInfo = null, salvageInfo = null;
var weatherInfo = null, speedInfo = null, compassInfo = null;
var waveInfo = null, ammoInfo = null;

// --- sound controls (moved from HUD) ---
var muteBtn = null, volumeSlider = null;
var onMuteCallback = null, onVolumeCallback = null;

// --- autofire toggle (moved from HUD) ---
var autofireBtn = null;
var onAutofireToggleCallback = null;

// --- game data from HUD ---
var _gameData = null;

// --- PWA install prompt ---
var deferredPrompt = null;
var installBtn = null;

window.addEventListener("beforeinstallprompt", function (e) {
  e.preventDefault();
  deferredPrompt = e;
  if (installBtn) installBtn.style.display = "block";
});

export function createSettingsMenu(callbacks) {
  onNewGameCallback = callbacks.onNewGame || null;
  onMuteCallback = callbacks.onMute || null;
  onVolumeCallback = callbacks.onVolume || null;
  onAutofireToggleCallback = callbacks.onAutofireToggle || null;

  var _mob = isMobile();

  // gear button (top-right, beside minimap)
  gearBtn = document.createElement("div");
  gearBtn.textContent = "\u2699";
  var minimapWidth = _mob ? 100 : 110;
  var gearRight = minimapWidth + 16 + 8;
  var gearSize = _mob ? "min-width:44px;min-height:44px;font-size:28px;padding:8px;display:flex;align-items:center;justify-content:center;" : "font-size:24px;padding:4px;";
  gearBtn.style.cssText = [
    "position:fixed", "top:16px", "right:" + gearRight + "px",
    "color:" + T.text, "cursor:pointer",
    "pointer-events:auto", "user-select:none", "z-index:15",
    "font-family:" + FONT, "line-height:1",
    "border-radius:4px", "background:" + T.bgLight,
    "border:1px solid " + T.border,
    "text-shadow:0 1px 2px rgba(0,0,0,0.4)"
  ].join(";") + ";" + gearSize;
  gearBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    toggleMenu();
  });
  document.body.appendChild(gearBtn);

  // menu panel
  menuPanel = document.createElement("div");
  menuPanel.style.cssText = [
    "position:fixed", "top:50%", "left:50%",
    "transform:translate(-50%,-50%)",
    PARCHMENT_BG, "border:1px solid " + T.border,
    "border-radius:6px", "padding:24px 32px",
    "font-family:" + FONT, "color:" + T.text,
    "z-index:200", "display:none", "text-align:center",
    "min-width:280px", "max-height:80vh", "overflow-y:auto",
    "pointer-events:auto",
    "box-shadow:inset 0 0 30px rgba(0,0,0,0.3), 0 2px 12px rgba(0,0,0,0.4)"
  ].join(";");

  var title = document.createElement("div");
  title.textContent = "CAPTAIN\u2019S LOG";
  title.style.cssText = "font-size:20px;font-weight:bold;color:" + T.gold + ";margin-bottom:16px;text-shadow:0 1px 3px rgba(0,0,0,0.5);";
  menuPanel.appendChild(title);

  // === GAME INFO SECTION (moved from HUD) ===
  infoSection = document.createElement("div");
  infoSection.style.cssText = [
    "background:" + T.bgLight, "border:1px solid " + T.border,
    "border-radius:6px", "padding:10px 14px", "margin-bottom:12px",
    "text-align:left"
  ].join(";");

  waveInfo = document.createElement("div");
  waveInfo.style.cssText = INFO_ROW + ";font-weight:bold;";
  waveInfo.textContent = "FLEET 1";
  infoSection.appendChild(waveInfo);

  fuelInfo = document.createElement("div");
  fuelInfo.style.cssText = INFO_ROW;
  fuelInfo.textContent = "WIND: 100%";
  infoSection.appendChild(fuelInfo);

  ammoInfo = document.createElement("div");
  ammoInfo.style.cssText = INFO_ROW;
  ammoInfo.textContent = "AMMO: --";
  infoSection.appendChild(ammoInfo);

  partsInfo = document.createElement("div");
  partsInfo.style.cssText = INFO_ROW;
  partsInfo.textContent = "PARTS: 0";
  infoSection.appendChild(partsInfo);

  salvageInfo = document.createElement("div");
  salvageInfo.style.cssText = INFO_ROW + ";color:" + T.gold;
  salvageInfo.textContent = "GOLD: 0";
  infoSection.appendChild(salvageInfo);

  weatherInfo = document.createElement("div");
  weatherInfo.style.cssText = INFO_ROW;
  weatherInfo.textContent = "WEATHER: CALM";
  infoSection.appendChild(weatherInfo);

  speedInfo = document.createElement("div");
  speedInfo.style.cssText = INFO_ROW;
  speedInfo.textContent = "SPEED: 0.0 kn";
  infoSection.appendChild(speedInfo);

  compassInfo = document.createElement("div");
  compassInfo.style.cssText = INFO_ROW;
  compassInfo.textContent = "HEADING: N 0\u00B0";
  infoSection.appendChild(compassInfo);

  menuPanel.appendChild(infoSection);

  // === AUTOFIRE TOGGLE ===
  autofireBtn = makeButton("AUTOFIRE: OFF [F]", T.textDim, function () {
    if (onAutofireToggleCallback) onAutofireToggleCallback();
  });
  menuPanel.appendChild(autofireBtn);

  // === SOUND CONTROLS ===
  var soundRow = document.createElement("div");
  soundRow.style.cssText = [
    BTN, "display:flex", "align-items:center", "justify-content:center", "gap:8px"
  ].join(";");
  muteBtn = document.createElement("span");
  muteBtn.textContent = "\u266A";
  muteBtn.style.cssText = "cursor:pointer;font-size:18px;color:" + T.text + ";min-width:28px;text-align:center;";
  muteBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    if (onMuteCallback) onMuteCallback();
  });
  soundRow.appendChild(muteBtn);
  var volLabel = document.createElement("span");
  volLabel.textContent = "VOL";
  volLabel.style.cssText = "font-size:12px;color:" + T.textDim;
  soundRow.appendChild(volLabel);
  volumeSlider = document.createElement("input");
  volumeSlider.type = "range";
  volumeSlider.min = "0";
  volumeSlider.max = "100";
  volumeSlider.value = "50";
  volumeSlider.style.cssText = "width:100px;cursor:pointer;pointer-events:auto;accent-color:" + T.amber + ";";
  volumeSlider.addEventListener("input", function (e) {
    e.stopPropagation();
    if (onVolumeCallback) onVolumeCallback(parseFloat(volumeSlider.value) / 100);
  });
  soundRow.appendChild(volumeSlider);
  menuPanel.appendChild(soundRow);

  // === QUALITY TOGGLE ===
  var qualityRow = document.createElement("div");
  qualityRow.style.cssText = [
    BTN, "display:flex", "align-items:center", "justify-content:center", "gap:8px"
  ].join(";");
  var qualityLabel = document.createElement("span");
  qualityLabel.textContent = "QUALITY:";
  qualityLabel.style.color = T.text;
  qualityRow.appendChild(qualityLabel);

  var qualityOptions = ["LOW", "MEDIUM", "HIGH"];
  var qualityKeys = ["low", "medium", "high"];
  var qualityBtns = [];
  for (var qi = 0; qi < qualityOptions.length; qi++) {
    (function (idx) {
      var qBtn = document.createElement("span");
      qBtn.textContent = qualityOptions[idx];
      qBtn.style.cssText = [
        "padding:4px 10px", "border-radius:3px", "cursor:pointer",
        "font-size:12px", "min-width:44px", "min-height:44px",
        "display:inline-flex", "align-items:center", "justify-content:center"
      ].join(";");
      qBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        setQuality(qualityKeys[idx]);
        updateQualityBtns();
      });
      qualityRow.appendChild(qBtn);
      qualityBtns.push(qBtn);
    })(qi);
  }
  menuPanel.appendChild(qualityRow);

  function updateQualityBtns() {
    var cur = getQuality();
    for (var qb = 0; qb < qualityBtns.length; qb++) {
      if (qualityKeys[qb] === cur) {
        qualityBtns[qb].style.background = "rgba(90, 154, 74, 0.5)";
        qualityBtns[qb].style.color = T.gold;
        qualityBtns[qb].style.fontWeight = "bold";
      } else {
        qualityBtns[qb].style.background = "rgba(60, 45, 28, 0.5)";
        qualityBtns[qb].style.color = T.text;
        qualityBtns[qb].style.fontWeight = "normal";
      }
    }
  }
  updateQualityBtns();

  // === SAVE MANAGEMENT ===
  var newGameBtn = makeButton("NEW GAME", T.red, function () {
    showConfirm("Start a new game? This will erase your current save.", function () {
      deleteSave();
      closeMenu();
      if (onNewGameCallback) onNewGameCallback();
    });
  });
  menuPanel.appendChild(newGameBtn);

  var exportBtn = makeButton("EXPORT SAVE", T.text, function () {
    var data = exportSave();
    if (!data) {
      showNotice("No save data to export.");
      return;
    }
    try {
      navigator.clipboard.writeText(data);
    } catch (e) {
      // fallback: create download
    }
    var blob = new Blob([data], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "ocean-outlaws-save.json";
    a.click();
    URL.revokeObjectURL(url);
    showNotice("Save exported!");
  });
  menuPanel.appendChild(exportBtn);

  var importBtn = makeButton("IMPORT SAVE", T.text, function () {
    var input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.style.display = "none";
    input.addEventListener("change", function () {
      if (!input.files || !input.files[0]) return;
      var reader = new FileReader();
      reader.onload = function (ev) {
        var success = importSave(ev.target.result);
        if (success) {
          showNotice("Save imported! Reload to apply.");
          setTimeout(function () { location.reload(); }, 1500);
        } else {
          showNotice("Invalid save file.");
        }
      };
      reader.readAsText(input.files[0]);
    });
    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  });
  menuPanel.appendChild(importBtn);

  // Install App button (PWA)
  installBtn = makeButton("INSTALL APP", T.green, function () {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function () {
        deferredPrompt = null;
        installBtn.style.display = "none";
      });
    }
  });
  installBtn.style.display = deferredPrompt ? "block" : "none";
  menuPanel.appendChild(installBtn);

  // Close button
  var closeBtn = makeButton("CLOSE", T.text, function () {
    closeMenu();
  });
  closeBtn.style.marginTop = "16px";
  menuPanel.appendChild(closeBtn);

  document.body.appendChild(menuPanel);

  // confirm overlay
  confirmOverlay = document.createElement("div");
  confirmOverlay.style.cssText = [
    "position:fixed", "top:0", "left:0", "width:100%", "height:100%",
    "background:rgba(10,6,2,0.7)", "display:none",
    "flex-direction:column", "align-items:center", "justify-content:center",
    "z-index:300", "font-family:" + FONT
  ].join(";");
  document.body.appendChild(confirmOverlay);
}

// --- receive game data from HUD to display in menu ---
export function updateSettingsData(data) {
  _gameData = data;
  if (!menuOpen) return;
  refreshInfoLabels();
}

function refreshInfoLabels() {
  if (!_gameData || !infoSection) return;
  var d = _gameData;
  if (d.wave !== undefined && waveInfo) {
    if (d.waveState === "WAITING") { waveInfo.textContent = "REPAIRING..."; waveInfo.style.color = T.green; }
    else if (d.waveState === "WAVE_COMPLETE") { waveInfo.textContent = "FLEET " + d.wave + " CLEAR"; waveInfo.style.color = T.green; }
    else { waveInfo.textContent = "FLEET " + d.wave; waveInfo.style.color = T.text; }
  }
  if (d.fuel !== undefined && fuelInfo) {
    var fuelPct = Math.max(0, d.fuel / d.maxFuel) * 100;
    fuelInfo.textContent = "WIND: " + Math.round(d.fuel) + "%";
    fuelInfo.style.color = fuelPct > 30 ? T.blueBright : fuelPct > 15 ? T.amber : T.red;
  }
  if (d.ammo !== undefined && ammoInfo) {
    ammoInfo.textContent = "AMMO: " + d.ammo + " / " + d.maxAmmo;
    ammoInfo.style.color = d.ammo <= 5 ? T.red : T.text;
  }
  if (d.parts !== undefined && partsInfo) {
    partsInfo.textContent = "PARTS: " + d.parts;
    partsInfo.style.color = d.parts > 0 ? T.green : T.text;
  }
  if (d.gold !== undefined && salvageInfo) {
    salvageInfo.textContent = "GOLD: " + d.gold;
  }
  if (d.weatherText && weatherInfo) {
    weatherInfo.textContent = "WEATHER: " + d.weatherText;
    weatherInfo.style.color = ({ CALM: T.green, ROUGH: T.gold, STORM: T.red })[d.weatherText] || T.textDim;
  }
  if (d.displaySpeed !== undefined && speedInfo) {
    speedInfo.textContent = "SPEED: " + d.displaySpeed.toFixed(1) + " kn";
  }
  if (d.heading !== undefined && compassInfo) {
    var deg = ((d.heading * 180 / Math.PI) % 360 + 360) % 360;
    var dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    compassInfo.textContent = "HEADING: " + dirs[Math.round(deg / 45) % 8] + " " + Math.round(deg) + "\u00B0";
  }
  if (autofireBtn && d.autofireOn !== undefined) {
    autofireBtn.textContent = d.autofireOn ? "AUTOFIRE: ON [F]" : "AUTOFIRE: OFF [F]";
    autofireBtn.style.color = d.autofireOn ? T.green : T.textDim;
  }
}

export function updateMuteButton(m) {
  if (!muteBtn) return;
  muteBtn.textContent = m ? "\u266A\u2715" : "\u266A";
  muteBtn.style.color = m ? T.red : T.text;
}

export function updateVolumeSlider(v) {
  if (volumeSlider) volumeSlider.value = String(Math.round(v * 100));
}

function makeButton(text, color, onClick) {
  var btn = document.createElement("div");
  btn.textContent = text;
  btn.style.cssText = BTN + ";color:" + color;
  btn.addEventListener("click", function (e) {
    e.stopPropagation();
    onClick();
  });
  return btn;
}

function toggleMenu() {
  if (menuOpen) closeMenu();
  else openMenu();
}

function openMenu() {
  menuOpen = true;
  menuPanel.style.display = "block";
  if (installBtn) installBtn.style.display = deferredPrompt ? "block" : "none";
  refreshInfoLabels();
}

function closeMenu() {
  menuOpen = false;
  menuPanel.style.display = "none";
}

export function isSettingsOpen() {
  return menuOpen;
}

function showConfirm(message, onYes) {
  confirmOverlay.innerHTML = "";
  confirmOverlay.style.display = "flex";

  var box = document.createElement("div");
  box.style.cssText = [
    PARCHMENT_BG, "border:1px solid " + T.border,
    "border-radius:6px", "padding:24px 32px", "text-align:center",
    "color:" + T.text, "max-width:320px", "font-family:" + FONT,
    "box-shadow:inset 0 0 30px rgba(0,0,0,0.3), 0 2px 12px rgba(0,0,0,0.4)"
  ].join(";");

  var msg = document.createElement("div");
  msg.textContent = message;
  msg.style.cssText = "font-size:14px;margin-bottom:20px;line-height:1.4;text-shadow:0 1px 2px rgba(0,0,0,0.3);";
  box.appendChild(msg);

  var row = document.createElement("div");
  row.style.cssText = "display:flex;gap:12px;justify-content:center;";

  var yesBtn = makeButton("YES", T.red, function () {
    confirmOverlay.style.display = "none";
    onYes();
  });
  yesBtn.style.minWidth = "100px";
  row.appendChild(yesBtn);

  var noBtn = makeButton("NO", T.text, function () {
    confirmOverlay.style.display = "none";
  });
  noBtn.style.minWidth = "100px";
  row.appendChild(noBtn);

  box.appendChild(row);
  confirmOverlay.appendChild(box);
}

function showNotice(text) {
  confirmOverlay.innerHTML = "";
  confirmOverlay.style.display = "flex";

  var box = document.createElement("div");
  box.style.cssText = [
    PARCHMENT_BG, "border:1px solid " + T.border,
    "border-radius:6px", "padding:24px 32px", "text-align:center",
    "color:" + T.gold, "font-size:16px", "font-family:" + FONT,
    "text-shadow:0 1px 3px rgba(0,0,0,0.5)",
    "box-shadow:inset 0 0 30px rgba(0,0,0,0.3), 0 2px 12px rgba(0,0,0,0.4)"
  ].join(";");
  box.textContent = text;
  confirmOverlay.appendChild(box);

  setTimeout(function () {
    confirmOverlay.style.display = "none";
  }, 2000);
}
