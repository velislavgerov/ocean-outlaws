// mainMenu.js — cinematic main menu floating over ocean world
import { isMobile } from "./mobile.js";
import { T, FONT, FONT_UI } from "./theme.js";

var overlay = null;
var continueBtn = null;
var newRunCallback = null;
var continueRunCallback = null;
var settingsCallback = null;

export function createMainMenu() {
  var _mob = isMobile();
  overlay = document.createElement("div");
  overlay.style.cssText = [
    "position:fixed",
    "top:0", "left:0",
    "width:100%", "height:100%",
    "display:none",
    _mob ? "flex-direction:row" : "flex-direction:column",
    "align-items:center",
    _mob ? "justify-content:space-around" : "justify-content:center",
    "background:radial-gradient(ellipse at center, rgba(8,12,18,0.3) 0%, rgba(8,12,18,0.85) 100%)",
    "z-index:250",
    "user-select:none",
    _mob ? "padding:0 env(safe-area-inset-right,20px) 0 env(safe-area-inset-left,20px)" : ""
  ].filter(Boolean).join(";");

  if (_mob) {
    _buildMobileLayout();
  } else {
    _buildDesktopLayout();
  }

  document.body.appendChild(overlay);
}

function _buildDesktopLayout() {
  var titleBlock = _makeTitleBlock(false);
  overlay.appendChild(titleBlock);

  var line = document.createElement("div");
  line.style.cssText = "width:200px;height:1px;background:" + T.border + ";margin:8px auto 24px";
  overlay.appendChild(line);

  var btnWrap = document.createElement("div");
  btnWrap.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:8px";
  overlay.appendChild(btnWrap);

  var newBtn = _makeGhostBtn("NEW VOYAGE", false, 18, T.gold);
  newBtn.addEventListener("click", function() { if (newRunCallback) newRunCallback(); });
  btnWrap.appendChild(newBtn);

  continueBtn = _makeGhostBtn("CONTINUE", false, 18, T.text);
  continueBtn.addEventListener("click", function() { if (continueRunCallback) continueRunCallback(); });
  btnWrap.appendChild(continueBtn);

  var settingsBtn = _makeGhostBtn("SETTINGS", false, 14, T.textDim);
  settingsBtn.style.marginTop = "8px";
  settingsBtn.addEventListener("click", function() { if (settingsCallback) settingsCallback(); });
  btnWrap.appendChild(settingsBtn);

  var version = document.createElement("div");
  version.style.cssText = [
    "position:fixed", "bottom:16px", "right:16px",
    "font-family:" + FONT_UI,
    "font-size:11px",
    "color:" + T.textDark,
    "letter-spacing:0.04em"
  ].join(";");
  version.textContent = "\u00a9 OCEAN OUTLAWS";
  overlay.appendChild(version);
}

function _buildMobileLayout() {
  // Left column: title block
  var left = document.createElement("div");
  left.style.cssText = [
    "display:flex", "flex-direction:column", "justify-content:center",
    "flex:1", "padding:16px"
  ].join(";");
  var titleBlock = _makeTitleBlock(true);
  left.appendChild(titleBlock);
  overlay.appendChild(left);

  // Vertical divider
  var vDivider = document.createElement("div");
  vDivider.style.cssText = "width:1px;height:60%;background:" + T.border + ";align-self:center";
  overlay.appendChild(vDivider);

  // Right column: buttons
  var right = document.createElement("div");
  right.style.cssText = [
    "display:flex", "flex-direction:column", "justify-content:center",
    "gap:10px", "flex:1", "padding:16px"
  ].join(";");

  var newBtn = _makeGhostBtn("NEW VOYAGE", true, 16, T.gold);
  newBtn.addEventListener("click", function() { if (newRunCallback) newRunCallback(); });
  right.appendChild(newBtn);

  continueBtn = _makeGhostBtn("CONTINUE", true, 16, T.text);
  continueBtn.addEventListener("click", function() { if (continueRunCallback) continueRunCallback(); });
  right.appendChild(continueBtn);

  var settingsBtn = _makeGhostBtn("SETTINGS", true, 13, T.textDim);
  settingsBtn.addEventListener("click", function() { if (settingsCallback) settingsCallback(); });
  right.appendChild(settingsBtn);

  overlay.appendChild(right);
}

function _makeTitleBlock(_mob) {
  var block = document.createElement("div");

  var title = document.createElement("div");
  title.textContent = "OCEAN OUTLAWS";
  title.style.cssText = [
    "font-family:" + FONT,
    "font-size:" + (_mob ? "36px" : "72px"),
    "font-weight:700",
    "color:" + T.gold,
    "letter-spacing:0.12em",
    "text-shadow:0 2px 16px rgba(200,152,42,0.4), 0 4px 32px rgba(0,0,0,0.8)",
    "line-height:1",
    "margin-bottom:8px",
    _mob ? "text-align:left" : "text-align:center"
  ].join(";");
  block.appendChild(title);

  var sub = document.createElement("div");
  sub.textContent = "NAVAL COMBAT \u2022 ROGUELITE";
  sub.style.cssText = [
    "font-family:" + FONT_UI,
    "font-size:" + (_mob ? "11px" : "13px"),
    "color:" + T.textDim,
    "letter-spacing:0.1em",
    "text-transform:uppercase",
    _mob ? "text-align:left" : "text-align:center"
  ].join(";");
  block.appendChild(sub);

  return block;
}

function _makeGhostBtn(label, _mob, size, color) {
  var btn = document.createElement("button");
  btn.textContent = label;
  btn.className = "oo-btn" + (_mob ? " oo-btn-outline" : "");
  btn.style.cssText = [
    "font-family:" + FONT,
    "font-size:" + size + "px",
    "color:" + color,
    "letter-spacing:0.08em",
    _mob ? "width:100%;min-height:52px;padding:0 16px" : "padding:8px 0",
    "background:none",
    _mob ? "border:1px solid " + T.border : "border:none",
    "cursor:pointer",
    "user-select:none",
    "pointer-events:auto"
  ].join(";");
  return btn;
}

function _animateEntry() {
  var btns = overlay.querySelectorAll("button");
  for (var i = 0; i < btns.length; i++) {
    (function(btn, idx) {
      btn.style.opacity = "0";
      setTimeout(function() {
        btn.style.transition = "opacity 0.4s ease";
        btn.style.opacity = "1";
      }, 400 + idx * 150);
    })(btns[i], i);
  }
}

export function showMainMenu(onNewRun, onContinueRun, hasContinue, onSettings) {
  newRunCallback = onNewRun;
  continueRunCallback = onContinueRun;
  settingsCallback = onSettings || null;
  if (continueBtn) {
    continueBtn.style.display = hasContinue ? "" : "none";
  }
  if (overlay) {
    overlay.style.display = "flex";
    _animateEntry();
  }
}

export function hideMainMenu() {
  if (overlay) overlay.style.display = "none";
}
