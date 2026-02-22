// settingsMenu.js — settings/pause menu: game info, music/volume, autofire,
// fuel, parts, weather, compass, speed + existing save/quality/new-game

import { exportSave, importSave, deleteSave, hasSave } from "./save.js";
import { getQuality, setQuality, isMobile } from "./mobile.js";

var C = {
  bg: "rgba(5,10,20,0.85)",
  bgLight: "rgba(20,30,50,0.8)",
  border: "rgba(80,100,130,0.4)",
  text: "#8899aa",
  textDim: "#667788",
  yellow: "#ffcc44",
  red: "#cc4444",
  green: "#44aa66",
  blueBright: "#2288cc",
  orange: "#cc8822"
};

var BTN = [
  "font-family:monospace", "font-size:14px", "padding:10px 20px",
  "border-radius:4px", "cursor:pointer", "pointer-events:auto",
  "user-select:none", "text-align:center", "min-width:200px",
  "border:1px solid " + C.border, "background:" + C.bgLight,
  "color:" + C.text, "margin:6px 0"
].join(";");

var INFO_ROW = [
  "font-family:monospace", "font-size:13px", "color:" + C.text,
  "padding:3px 0", "text-align:left"
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
    "color:" + C.text, "cursor:pointer",
    "pointer-events:auto", "user-select:none", "z-index:15",
    "font-family:monospace", "line-height:1",
    "border-radius:4px", "background:" + C.bgLight,
    "border:1px solid " + C.border
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
    "background:" + C.bg, "border:1px solid " + C.border,
    "border-radius:8px", "padding:24px 32px",
    "font-family:monospace", "color:" + C.text,
    "z-index:200", "display:none", "text-align:center",
    "min-width:280px", "max-height:80vh", "overflow-y:auto",
    "pointer-events:auto"
  ].join(";");

  var title = document.createElement("div");
  title.textContent = "SETTINGS";
  title.style.cssText = "font-size:20px;font-weight:bold;color:" + C.yellow + ";margin-bottom:16px;";
  menuPanel.appendChild(title);

  // === GAME INFO SECTION (moved from HUD) ===
  infoSection = document.createElement("div");
  infoSection.style.cssText = [
    "background:" + C.bgLight, "border:1px solid " + C.border,
    "border-radius:6px", "padding:10px 14px", "margin-bottom:12px",
    "text-align:left"
  ].join(";");

  waveInfo = document.createElement("div");
  waveInfo.style.cssText = INFO_ROW + ";font-weight:bold;";
  waveInfo.textContent = "FLEET 1";
  infoSection.appendChild(waveInfo);

  fuelInfo = document.createElement("div");
  fuelInfo.style.cssText = INFO_ROW;
  fuelInfo.textContent = "FUEL: 100%";
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
  salvageInfo.style.cssText = INFO_ROW + ";color:" + C.yellow;
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
  autofireBtn = makeButton("AUTOFIRE: OFF [F]", C.textDim, function () {
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
  muteBtn.style.cssText = "cursor:pointer;font-size:18px;color:" + C.text + ";min-width:28px;text-align:center;";
  muteBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    if (onMuteCallback) onMuteCallback();
  });
  soundRow.appendChild(muteBtn);
  var volLabel = document.createElement("span");
  volLabel.textContent = "VOL";
  volLabel.style.cssText = "font-size:12px;color:" + C.textDim;
  soundRow.appendChild(volLabel);
  volumeSlider = document.createElement("input");
  volumeSlider.type = "range";
  volumeSlider.min = "0";
  volumeSlider.max = "100";
  volumeSlider.value = "50";
  volumeSlider.style.cssText = "width:100px;cursor:pointer;pointer-events:auto;accent-color:#4477aa;";
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
  qualityLabel.style.color = C.text;
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
        qualityBtns[qb].style.background = "rgba(60,120,80,0.6)";
        qualityBtns[qb].style.color = C.yellow;
        qualityBtns[qb].style.fontWeight = "bold";
      } else {
        qualityBtns[qb].style.background = "rgba(30,40,60,0.5)";
        qualityBtns[qb].style.color = C.text;
        qualityBtns[qb].style.fontWeight = "normal";
      }
    }
  }
  updateQualityBtns();

  // === SAVE MANAGEMENT ===
  var newGameBtn = makeButton("NEW GAME", C.red, function () {
    showConfirm("Start a new game? This will erase your current save.", function () {
      deleteSave();
      closeMenu();
      if (onNewGameCallback) onNewGameCallback();
    });
  });
  menuPanel.appendChild(newGameBtn);

  var exportBtn = makeButton("EXPORT SAVE", C.text, function () {
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

  var importBtn = makeButton("IMPORT SAVE", C.text, function () {
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
  installBtn = makeButton("INSTALL APP", C.green, function () {
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
  var closeBtn = makeButton("CLOSE", C.text, function () {
    closeMenu();
  });
  closeBtn.style.marginTop = "16px";
  menuPanel.appendChild(closeBtn);

  document.body.appendChild(menuPanel);

  // confirm overlay
  confirmOverlay = document.createElement("div");
  confirmOverlay.style.cssText = [
    "position:fixed", "top:0", "left:0", "width:100%", "height:100%",
    "background:rgba(0,0,0,0.7)", "display:none",
    "flex-direction:column", "align-items:center", "justify-content:center",
    "z-index:300", "font-family:monospace"
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
    if (d.waveState === "WAITING") { waveInfo.textContent = "REPAIRING..."; waveInfo.style.color = C.green; }
    else if (d.waveState === "WAVE_COMPLETE") { waveInfo.textContent = "FLEET " + d.wave + " CLEAR"; waveInfo.style.color = C.green; }
    else { waveInfo.textContent = "FLEET " + d.wave; waveInfo.style.color = C.text; }
  }
  if (d.fuel !== undefined && fuelInfo) {
    var fuelPct = Math.max(0, d.fuel / d.maxFuel) * 100;
    fuelInfo.textContent = "FUEL: " + Math.round(d.fuel) + "%";
    fuelInfo.style.color = fuelPct > 30 ? C.blueBright : fuelPct > 15 ? C.orange : C.red;
  }
  if (d.ammo !== undefined && ammoInfo) {
    ammoInfo.textContent = "AMMO: " + d.ammo + " / " + d.maxAmmo;
    ammoInfo.style.color = d.ammo <= 5 ? C.red : C.text;
  }
  if (d.parts !== undefined && partsInfo) {
    partsInfo.textContent = "PARTS: " + d.parts;
    partsInfo.style.color = d.parts > 0 ? C.green : C.text;
  }
  if (d.salvage !== undefined && salvageInfo) {
    salvageInfo.textContent = "GOLD: " + d.salvage;
  }
  if (d.weatherText && weatherInfo) {
    weatherInfo.textContent = "WEATHER: " + d.weatherText;
    weatherInfo.style.color = ({ CALM: C.green, ROUGH: C.yellow, STORM: C.red })[d.weatherText] || C.textDim;
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
    autofireBtn.style.color = d.autofireOn ? C.green : C.textDim;
  }
}

export function updateMuteButton(m) {
  if (!muteBtn) return;
  muteBtn.textContent = m ? "\u266A\u2715" : "\u266A";
  muteBtn.style.color = m ? C.red : C.text;
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
    "background:" + C.bg, "border:1px solid " + C.border,
    "border-radius:8px", "padding:24px 32px", "text-align:center",
    "color:" + C.text, "max-width:320px"
  ].join(";");

  var msg = document.createElement("div");
  msg.textContent = message;
  msg.style.cssText = "font-size:14px;margin-bottom:20px;line-height:1.4;";
  box.appendChild(msg);

  var row = document.createElement("div");
  row.style.cssText = "display:flex;gap:12px;justify-content:center;";

  var yesBtn = makeButton("YES", C.red, function () {
    confirmOverlay.style.display = "none";
    onYes();
  });
  yesBtn.style.minWidth = "100px";
  row.appendChild(yesBtn);

  var noBtn = makeButton("NO", C.text, function () {
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
    "background:" + C.bg, "border:1px solid " + C.border,
    "border-radius:8px", "padding:24px 32px", "text-align:center",
    "color:" + C.yellow, "font-size:16px"
  ].join(";");
  box.textContent = text;
  confirmOverlay.appendChild(box);

  setTimeout(function () {
    confirmOverlay.style.display = "none";
  }, 2000);
}
