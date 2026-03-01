// settingsMenu.js — settings/pause menu: game info, music/volume, autofire,
// fuel, parts, weather, compass, speed + existing save/quality/new-game

import { exportSave, importSave, deleteSave, hasSave } from "./save.js";
import { getQuality, setQuality, isMobile } from "./mobile.js";
import {
  getTerrainStreamSettings,
  getTerrainStreamSettingBounds,
  updateTerrainStreamSettings,
  resetTerrainStreamSettings
} from "./terrain.js";
import { T, FONT, FONT_UI, FONT_MONO, PARCHMENT_BG } from "./theme.js";

// Section label style — Inter, fog-gray
var SECTION_LABEL = [
  "font-family:" + FONT_UI, "font-size:10px", "font-weight:600",
  "letter-spacing:1.2px", "text-transform:uppercase",
  "color:" + T.textDim, "margin-bottom:6px", "display:block"
].join(";");

// Info row — label dim, value cream mono
var INFO_LABEL = [
  "font-family:" + FONT_UI, "font-size:12px", "color:" + T.textDim,
  "padding:2px 0"
].join(";");

var INFO_VALUE = [
  "font-family:" + FONT_MONO, "font-size:12px", "color:" + T.cream,
  "font-weight:bold"
].join(";");

// Ghost button base — for quality row
var GHOST_BTN = [
  "font-family:" + FONT_UI, "font-size:11px", "font-weight:600",
  "letter-spacing:0.8px", "padding:6px 10px",
  "border-radius:4px", "cursor:pointer", "pointer-events:auto",
  "user-select:none", "text-align:center",
  "border:1px solid " + T.border, "background:none",
  "color:" + T.textDim, "transition:border-color 0.15s,color 0.15s",
  "min-width:60px", "min-height:36px",
  "display:inline-flex", "align-items:center", "justify-content:center"
].join(";");

// Section container
var SECTION_BOX = [
  "background:" + T.bgLight, "border:1px solid " + T.border,
  "border-radius:6px", "padding:10px 12px", "margin-bottom:10px"
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

  // --- Floating dark glass panel anchored top-right below gear button ---
  var panelWidth = _mob ? "280px" : "320px";
  menuPanel = document.createElement("div");
  menuPanel.style.cssText = [
    "position:fixed",
    "top:" + (16 + (_mob ? 44 : 36) + 8) + "px",
    "right:" + gearRight + "px",
    "width:" + panelWidth,
    "background:" + T.bg,
    "border:1px solid var(--oo-gold-dim)",
    "border-radius:var(--oo-radius-lg, 8px)",
    "padding:16px",
    "font-family:" + FONT_UI,
    "color:" + T.text,
    "z-index:200",
    "display:none",
    "text-align:left",
    "max-height:80vh",
    "overflow-y:auto",
    "pointer-events:auto",
    "box-shadow:0 8px 32px rgba(8,12,18,0.8),0 0 0 1px rgba(200,152,42,0.08),inset 0 1px 0 rgba(200,152,42,0.1)"
  ].join(";");

  // Title — "CAPTAIN'S ORDERS"
  var title = document.createElement("div");
  title.textContent = "CAPTAIN\u2019S ORDERS";
  title.style.cssText = [
    "font-family:" + FONT, "font-size:15px", "font-weight:bold",
    "color:" + T.gold, "margin-bottom:14px",
    "letter-spacing:0.5px",
    "text-shadow:0 1px 3px rgba(0,0,0,0.5)",
    "border-bottom:1px solid var(--oo-gold-dim)",
    "padding-bottom:10px"
  ].join(";");
  menuPanel.appendChild(title);

  // =====================================================================
  // === SECTION: GAME INFO ===
  // =====================================================================
  var gameInfoSection = document.createElement("div");
  gameInfoSection.style.cssText = SECTION_BOX;

  var gameInfoLabel = document.createElement("span");
  gameInfoLabel.textContent = "GAME INFO";
  gameInfoLabel.style.cssText = SECTION_LABEL;
  gameInfoSection.appendChild(gameInfoLabel);

  infoSection = document.createElement("div");

  function makeInfoRow(labelText, initValue) {
    var row = document.createElement("div");
    row.style.cssText = "display:flex;justify-content:space-between;align-items:baseline;padding:2px 0;";
    var lbl = document.createElement("span");
    lbl.textContent = labelText;
    lbl.style.cssText = INFO_LABEL;
    var val = document.createElement("span");
    val.textContent = initValue;
    val.style.cssText = INFO_VALUE;
    row.appendChild(lbl);
    row.appendChild(val);
    infoSection.appendChild(row);
    return val;
  }

  waveInfo    = makeInfoRow("Fleet",   "1");
  fuelInfo    = makeInfoRow("Wind",    "100%");
  ammoInfo    = makeInfoRow("Ammo",    "--");
  partsInfo   = makeInfoRow("Parts",   "0");
  salvageInfo = makeInfoRow("Gold",    "0");
  weatherInfo = makeInfoRow("Weather", "CALM");
  speedInfo   = makeInfoRow("Speed",   "0.0 kn");
  compassInfo = makeInfoRow("Heading", "N 0\u00B0");

  gameInfoSection.appendChild(infoSection);
  menuPanel.appendChild(gameInfoSection);

  // =====================================================================
  // === SECTION: AUDIO ===
  // =====================================================================
  var audioSection = document.createElement("div");
  audioSection.style.cssText = SECTION_BOX;

  var audioLabel = document.createElement("span");
  audioLabel.textContent = "AUDIO";
  audioLabel.style.cssText = SECTION_LABEL;
  audioSection.appendChild(audioLabel);

  var audioRow = document.createElement("div");
  audioRow.style.cssText = "display:flex;align-items:center;gap:10px;";

  muteBtn = document.createElement("button");
  muteBtn.textContent = "\u266A";
  muteBtn.title = "Toggle mute";
  muteBtn.style.cssText = [
    "font-size:16px", "cursor:pointer", "pointer-events:auto",
    "background:none", "border:1px solid " + T.border,
    "border-radius:4px", "color:" + T.text,
    "min-width:36px", "min-height:36px",
    "display:inline-flex", "align-items:center", "justify-content:center",
    "padding:4px", "flex-shrink:0"
  ].join(";");
  muteBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    if (onMuteCallback) onMuteCallback();
  });
  audioRow.appendChild(muteBtn);

  var volLabel = document.createElement("span");
  volLabel.textContent = "VOL";
  volLabel.style.cssText = "font-family:" + FONT_UI + ";font-size:11px;color:" + T.textDim + ";flex-shrink:0;letter-spacing:0.8px;";
  audioRow.appendChild(volLabel);

  volumeSlider = document.createElement("input");
  volumeSlider.type = "range";
  volumeSlider.min = "0";
  volumeSlider.max = "100";
  volumeSlider.value = "50";
  volumeSlider.style.cssText = [
    "flex:1", "cursor:pointer", "pointer-events:auto",
    "appearance:none", "-webkit-appearance:none",
    "height:4px", "border-radius:2px",
    "background:linear-gradient(to right," + T.amber + " 50%," + T.bgLight + " 50%)",
    "outline:none", "accent-color:" + T.amber
  ].join(";");
  volumeSlider.addEventListener("input", function (e) {
    e.stopPropagation();
    var pct = parseFloat(volumeSlider.value);
    volumeSlider.style.background = "linear-gradient(to right," + T.amber + " " + pct + "%," + T.bgLight + " " + pct + "%)";
    if (onVolumeCallback) onVolumeCallback(pct / 100);
  });
  audioRow.appendChild(volumeSlider);
  audioSection.appendChild(audioRow);
  menuPanel.appendChild(audioSection);

  // =====================================================================
  // === SECTION: QUALITY ===
  // =====================================================================
  var qualitySection = document.createElement("div");
  qualitySection.style.cssText = SECTION_BOX;

  var qualityLabel = document.createElement("span");
  qualityLabel.textContent = "QUALITY";
  qualityLabel.style.cssText = SECTION_LABEL;
  qualitySection.appendChild(qualityLabel);

  var qualityRow = document.createElement("div");
  qualityRow.style.cssText = "display:flex;gap:6px;";

  var qualityOptions = ["LOW", "MEDIUM", "HIGH"];
  var qualityKeys = ["low", "medium", "high"];
  var qualityBtns = [];
  for (var qi = 0; qi < qualityOptions.length; qi++) {
    (function (idx) {
      var qBtn = document.createElement("button");
      qBtn.textContent = qualityOptions[idx];
      qBtn.style.cssText = GHOST_BTN + ";flex:1;";
      qBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        setQuality(qualityKeys[idx]);
        updateQualityBtns();
      });
      qualityRow.appendChild(qBtn);
      qualityBtns.push(qBtn);
    })(qi);
  }
  qualitySection.appendChild(qualityRow);
  menuPanel.appendChild(qualitySection);

  function updateQualityBtns() {
    var cur = getQuality();
    for (var qb = 0; qb < qualityBtns.length; qb++) {
      if (qualityKeys[qb] === cur) {
        qualityBtns[qb].style.borderColor = T.gold;
        qualityBtns[qb].style.color = T.gold;
        qualityBtns[qb].style.fontWeight = "bold";
      } else {
        qualityBtns[qb].style.borderColor = T.border;
        qualityBtns[qb].style.color = T.textDim;
        qualityBtns[qb].style.fontWeight = "normal";
      }
    }
  }
  updateQualityBtns();

  // =====================================================================
  // === WORLD STREAM TUNING ===
  // =====================================================================
  var streamCfg = getTerrainStreamSettings();
  var streamBounds = getTerrainStreamSettingBounds();
  var streamRows = {};
  var streamHint = null;

  var streamSection = document.createElement("div");
  streamSection.style.cssText = SECTION_BOX;

  var streamSectionLabel = document.createElement("span");
  streamSectionLabel.textContent = "WORLD STREAM";
  streamSectionLabel.style.cssText = SECTION_LABEL;
  streamSection.appendChild(streamSectionLabel);

  function makeStreamStepper(label, key, step) {
    var row = document.createElement("div");
    row.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:8px;margin:4px 0";

    var text = document.createElement("span");
    text.textContent = label;
    text.style.cssText = "font-family:" + FONT_UI + ";font-size:11px;color:" + T.textDim + ";letter-spacing:0.3px";
    row.appendChild(text);

    var controls = document.createElement("div");
    controls.style.cssText = "display:flex;align-items:center;gap:5px";

    var minusBtn = document.createElement("button");
    minusBtn.textContent = "-";
    minusBtn.style.cssText = "min-width:28px;min-height:28px;padding:0 8px;border:1px solid " + T.border + ";background:" + T.bgLight + ";color:" + T.text + ";border-radius:4px;cursor:pointer;font-family:" + FONT_UI;
    minusBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      var patch = {};
      patch[key] = streamCfg[key] - step;
      streamCfg = updateTerrainStreamSettings(patch);
      updateStreamRows();
    });
    controls.appendChild(minusBtn);

    var valueEl = document.createElement("span");
    valueEl.style.cssText = "min-width:28px;text-align:center;font-family:" + FONT_MONO + ";font-size:12px;color:" + T.gold + ";font-weight:bold";
    controls.appendChild(valueEl);

    var plusBtn = document.createElement("button");
    plusBtn.textContent = "+";
    plusBtn.style.cssText = "min-width:28px;min-height:28px;padding:0 8px;border:1px solid " + T.border + ";background:" + T.bgLight + ";color:" + T.text + ";border-radius:4px;cursor:pointer;font-family:" + FONT_UI;
    plusBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      var patch = {};
      patch[key] = streamCfg[key] + step;
      streamCfg = updateTerrainStreamSettings(patch);
      updateStreamRows();
    });
    controls.appendChild(plusBtn);

    row.appendChild(controls);
    streamRows[key] = {
      valueEl: valueEl,
      minusBtn: minusBtn,
      plusBtn: plusBtn
    };
    streamSection.appendChild(row);
  }

  function updateStreamRows() {
    streamCfg = getTerrainStreamSettings();
    for (var key in streamRows) {
      if (!Object.prototype.hasOwnProperty.call(streamRows, key)) continue;
      var row = streamRows[key];
      var bounds = streamBounds[key];
      row.valueEl.textContent = String(streamCfg[key]);
      if (bounds) {
        var min = bounds.min;
        var max = bounds.max;
        if (key === "keepRadius") min = Math.max(min, streamCfg.streamRadius);
        if (key === "activeChunkHardLimit") min = Math.max(min, streamCfg.activeChunkSoftLimit + 2);
        if (key === "activeChunkSoftLimit") max = Math.min(max, streamCfg.activeChunkHardLimit - 2);
        row.minusBtn.style.opacity = streamCfg[key] <= min ? "0.5" : "1";
        row.plusBtn.style.opacity = streamCfg[key] >= max ? "0.5" : "1";
      }
    }

    if (streamHint) {
      streamHint.textContent =
        "Loaded/frame: " + streamCfg.chunkCreateBudget +
        " | Keep: " + streamCfg.keepRadius +
        " | Cap: " + streamCfg.activeChunkSoftLimit + "/" + streamCfg.activeChunkHardLimit;
    }
  }

  makeStreamStepper("ACTIVE RADIUS", "streamRadius", 1);
  makeStreamStepper("KEEP RADIUS", "keepRadius", 1);
  makeStreamStepper("PRELOAD AHEAD", "preloadAhead", 1);
  makeStreamStepper("CHUNKS / FRAME", "chunkCreateBudget", 1);
  makeStreamStepper("ACTIVE SOFT CAP", "activeChunkSoftLimit", 1);
  makeStreamStepper("ACTIVE HARD CAP", "activeChunkHardLimit", 1);

  streamHint = document.createElement("div");
  streamHint.style.cssText = "margin-top:6px;font-family:" + FONT_MONO + ";font-size:10px;color:" + T.textDim + ";text-align:center";
  streamSection.appendChild(streamHint);

  var resetStreamBtn = document.createElement("button");
  resetStreamBtn.textContent = "RESET STREAM DEFAULTS";
  resetStreamBtn.style.cssText = [
    "margin-top:8px", "width:100%", "padding:6px 8px",
    "border:1px solid " + T.border, "background:" + T.bgLight,
    "color:" + T.textDim, "border-radius:4px", "cursor:pointer",
    "font-family:" + FONT_UI, "font-size:11px", "letter-spacing:0.5px"
  ].join(";");
  resetStreamBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    streamCfg = resetTerrainStreamSettings();
    updateStreamRows();
    showNotice("World stream settings reset.");
  });
  streamSection.appendChild(resetStreamBtn);

  updateStreamRows();
  menuPanel.appendChild(streamSection);

  // =====================================================================
  // === SECTION: SAVE MANAGEMENT ===
  // =====================================================================
  var saveSection = document.createElement("div");
  saveSection.style.cssText = SECTION_BOX;

  var saveSectionLabel = document.createElement("span");
  saveSectionLabel.textContent = "SAVE";
  saveSectionLabel.style.cssText = SECTION_LABEL;
  saveSection.appendChild(saveSectionLabel);

  var exportBtn = makeSaveButton("EXPORT SAVE", T.textDim, function () {
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
  saveSection.appendChild(exportBtn);

  var importBtn = makeSaveButton("IMPORT SAVE", T.textDim, function () {
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
  saveSection.appendChild(importBtn);

  menuPanel.appendChild(saveSection);

  // Install App button (PWA)
  installBtn = makeSaveButton("INSTALL APP", T.green, function () {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function () {
        deferredPrompt = null;
        installBtn.style.display = "none";
      });
    }
  });
  installBtn.style.display = deferredPrompt ? "block" : "none";
  installBtn.style.marginBottom = "10px";
  menuPanel.appendChild(installBtn);

  // =====================================================================
  // === SECTION: DANGER ZONE ===
  // =====================================================================
  var dangerSection = document.createElement("div");
  dangerSection.style.cssText = [
    "background:" + T.bgLight,
    "border:1px solid " + T.red,
    "border-radius:6px", "padding:10px 12px", "margin-bottom:10px"
  ].join(";");

  var dangerLabel = document.createElement("span");
  dangerLabel.textContent = "DANGER ZONE";
  dangerLabel.style.cssText = [
    "font-family:" + FONT_UI, "font-size:10px", "font-weight:600",
    "letter-spacing:1.2px", "text-transform:uppercase",
    "color:" + T.red, "margin-bottom:6px", "display:block"
  ].join(";");
  dangerSection.appendChild(dangerLabel);

  var newGameBtn = document.createElement("button");
  newGameBtn.textContent = "NEW GAME";
  newGameBtn.style.cssText = [
    "width:100%", "padding:8px 12px",
    "font-family:" + FONT_UI, "font-size:12px", "font-weight:600",
    "letter-spacing:0.8px", "text-transform:uppercase",
    "color:" + T.red, "border:1px solid " + T.red,
    "background:none", "border-radius:4px",
    "cursor:pointer", "pointer-events:auto"
  ].join(";");
  newGameBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    showConfirm("Start a new game? This will erase your current save.", function () {
      deleteSave();
      closeMenu();
      if (onNewGameCallback) onNewGameCallback();
    });
  });
  dangerSection.appendChild(newGameBtn);
  menuPanel.appendChild(dangerSection);

  // Close button
  var closeBtn = makeSaveButton("CLOSE", T.textDim, function () {
    closeMenu();
  });
  closeBtn.style.marginTop = "4px";
  menuPanel.appendChild(closeBtn);

  document.body.appendChild(menuPanel);

  // confirm overlay (still full-screen for confirm/notice dialogs)
  confirmOverlay = document.createElement("div");
  confirmOverlay.style.cssText = [
    "position:fixed", "top:0", "left:0", "width:100%", "height:100%",
    "background:rgba(10,6,2,0.7)", "display:none",
    "flex-direction:column", "align-items:center", "justify-content:center",
    "z-index:300", "font-family:" + FONT_UI
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
    if (d.waveState === "WAITING") { waveInfo.textContent = "Repairing..."; waveInfo.style.color = T.green; }
    else if (d.waveState === "WAVE_COMPLETE") { waveInfo.textContent = "Fleet " + d.wave + " Clear"; waveInfo.style.color = T.green; }
    else { waveInfo.textContent = String(d.wave); waveInfo.style.color = T.cream; }
  }
  if (d.fuel !== undefined && fuelInfo) {
    var fuelPct = Math.max(0, d.fuel / d.maxFuel) * 100;
    fuelInfo.textContent = Math.round(d.fuel) + "%";
    fuelInfo.style.color = fuelPct > 30 ? T.blueBright : fuelPct > 15 ? T.amber : T.red;
  }
  if (d.ammo !== undefined && ammoInfo) {
    ammoInfo.textContent = d.ammo + " / " + d.maxAmmo;
    ammoInfo.style.color = d.ammo <= 5 ? T.red : T.cream;
  }
  if (d.parts !== undefined && partsInfo) {
    partsInfo.textContent = String(d.parts);
    partsInfo.style.color = d.parts > 0 ? T.green : T.cream;
  }
  if (d.gold !== undefined && salvageInfo) {
    salvageInfo.textContent = String(d.gold);
    salvageInfo.style.color = T.gold;
  }
  if (d.weatherText && weatherInfo) {
    weatherInfo.textContent = d.weatherText;
    weatherInfo.style.color = ({ CALM: T.green, ROUGH: T.gold, STORM: T.red })[d.weatherText] || T.textDim;
  }
  if (d.displaySpeed !== undefined && speedInfo) {
    speedInfo.textContent = d.displaySpeed.toFixed(1) + " kn";
    speedInfo.style.color = T.cream;
  }
  if (d.heading !== undefined && compassInfo) {
    var deg = ((d.heading * 180 / Math.PI) % 360 + 360) % 360;
    var dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    compassInfo.textContent = dirs[Math.round(deg / 45) % 8] + " " + Math.round(deg) + "\u00B0";
    compassInfo.style.color = T.cream;
  }
}

export function updateMuteButton(m) {
  if (!muteBtn) return;
  muteBtn.textContent = m ? "\u266A\u2715" : "\u266A";
  muteBtn.style.color = m ? T.red : T.text;
  muteBtn.style.borderColor = m ? T.red : T.border;
}

export function updateVolumeSlider(v) {
  if (volumeSlider) {
    volumeSlider.value = String(Math.round(v * 100));
    var pct = Math.round(v * 100);
    volumeSlider.style.background = "linear-gradient(to right," + T.amber + " " + pct + "%," + T.bgLight + " " + pct + "%)";
  }
}

// Small inline button used for save actions and close
function makeSaveButton(text, color, onClick) {
  var btn = document.createElement("button");
  btn.textContent = text;
  btn.style.cssText = [
    "width:100%", "padding:7px 12px", "margin-bottom:5px",
    "font-family:" + FONT_UI, "font-size:11px", "font-weight:600",
    "letter-spacing:0.8px", "text-transform:uppercase",
    "color:" + color, "border:1px solid " + T.border,
    "background:none", "border-radius:4px",
    "cursor:pointer", "pointer-events:auto", "display:block"
  ].join(";");
  btn.addEventListener("click", function (e) {
    e.stopPropagation();
    onClick();
  });
  return btn;
}

// Legacy helper kept for confirm/notice dialogs — same shape as old makeButton
function makeButton(text, color, onClick) {
  var btn = document.createElement("div");
  btn.textContent = text;
  btn.style.cssText = [
    "font-family:" + FONT_UI, "font-size:13px", "padding:10px 20px",
    "border-radius:4px", "cursor:pointer", "pointer-events:auto",
    "user-select:none", "text-align:center", "min-width:100px",
    "border:1px solid " + T.border, "background:" + T.bgLight,
    "color:" + color, "margin:4px 0",
    "text-shadow:0 1px 2px rgba(0,0,0,0.4)"
  ].join(";");
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
  menuPanel.style.animation = "oo-fall 0.3s var(--oo-ease-std)";
  if (installBtn) installBtn.style.display = deferredPrompt ? "block" : "none";
  refreshInfoLabels();
}

function closeMenu() {
  menuOpen = false;
  menuPanel.style.display = "none";
  menuPanel.style.animation = "";
}

export function isSettingsOpen() {
  return menuOpen;
}

function showConfirm(message, onYes) {
  confirmOverlay.innerHTML = "";
  confirmOverlay.style.display = "flex";

  var box = document.createElement("div");
  box.style.cssText = [
    "background:" + T.bg,
    "border:1px solid var(--oo-gold-dim)",
    "border-radius:var(--oo-radius-lg, 8px)", "padding:24px 32px", "text-align:center",
    "color:" + T.text, "max-width:320px", "font-family:" + FONT_UI,
    "box-shadow:0 8px 32px rgba(8,12,18,0.8)"
  ].join(";");

  var msg = document.createElement("div");
  msg.textContent = message;
  msg.style.cssText = "font-size:14px;margin-bottom:20px;line-height:1.5;color:" + T.text + ";";
  box.appendChild(msg);

  var row = document.createElement("div");
  row.style.cssText = "display:flex;gap:12px;justify-content:center;";

  var yesBtn = makeButton("YES", T.red, function () {
    confirmOverlay.style.display = "none";
    onYes();
  });
  row.appendChild(yesBtn);

  var noBtn = makeButton("NO", T.text, function () {
    confirmOverlay.style.display = "none";
  });
  row.appendChild(noBtn);

  box.appendChild(row);
  confirmOverlay.appendChild(box);
}

function showNotice(text) {
  confirmOverlay.innerHTML = "";
  confirmOverlay.style.display = "flex";

  var box = document.createElement("div");
  box.style.cssText = [
    "background:" + T.bg,
    "border:1px solid var(--oo-gold-dim)",
    "border-radius:var(--oo-radius-lg, 8px)", "padding:24px 32px", "text-align:center",
    "color:" + T.gold, "font-size:16px", "font-family:" + FONT_UI,
    "text-shadow:0 1px 3px rgba(0,0,0,0.5)",
    "box-shadow:0 8px 32px rgba(8,12,18,0.8)"
  ].join(";");
  box.textContent = text;
  confirmOverlay.appendChild(box);

  setTimeout(function () {
    confirmOverlay.style.display = "none";
  }, 2000);
}
