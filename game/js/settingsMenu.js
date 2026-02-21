// settingsMenu.js — settings gear menu: new game, export/import save, install prompt

import { exportSave, importSave, deleteSave, hasSave } from "./save.js";
import { getQuality, setQuality, isMobile } from "./mobile.js";

var C = {
  bg: "rgba(5,10,20,0.85)",
  bgLight: "rgba(20,30,50,0.8)",
  border: "rgba(80,100,130,0.4)",
  text: "#8899aa",
  yellow: "#ffcc44",
  red: "#cc4444",
  green: "#44aa66"
};

var BTN = [
  "font-family:monospace", "font-size:14px", "padding:10px 20px",
  "border-radius:4px", "cursor:pointer", "pointer-events:auto",
  "user-select:none", "text-align:center", "min-width:200px",
  "border:1px solid " + C.border, "background:" + C.bgLight,
  "color:" + C.text, "margin:6px 0"
].join(";");

var gearBtn = null;
var menuPanel = null;
var menuOpen = false;
var onNewGameCallback = null;
var confirmOverlay = null;

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

  // gear button (top-right, below minimap area)
  gearBtn = document.createElement("div");
  gearBtn.textContent = "\u2699";
  var gearSize = isMobile() ? "min-width:44px;min-height:44px;font-size:28px;padding:8px;display:flex;align-items:center;justify-content:center;" : "font-size:24px;padding:4px;";
  gearBtn.style.cssText = [
    "position:fixed", "top:16px", "right:180px",
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
    "min-width:280px", "pointer-events:auto"
  ].join(";");

  var title = document.createElement("div");
  title.textContent = "SETTINGS";
  title.style.cssText = "font-size:20px;font-weight:bold;color:" + C.yellow + ";margin-bottom:20px;";
  menuPanel.appendChild(title);

  // New Game button
  var newGameBtn = makeButton("NEW GAME", C.red, function () {
    showConfirm("Start a new game? This will erase your current save.", function () {
      deleteSave();
      closeMenu();
      if (onNewGameCallback) onNewGameCallback();
    });
  });
  menuPanel.appendChild(newGameBtn);

  // Export Save button
  var exportBtn = makeButton("EXPORT SAVE", C.text, function () {
    var data = exportSave();
    if (!data) {
      showNotice("No save data to export.");
      return;
    }
    // copy to clipboard and offer download
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

  // Import Save button
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

  // Quality toggle (Low / Medium / High)
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
  // show install btn if prompt available
  if (installBtn) installBtn.style.display = deferredPrompt ? "block" : "none";
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
