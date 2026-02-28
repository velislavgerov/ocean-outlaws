// mainMenu.js — main menu screen with New Run / Continue Run
import { isMobile } from "./mobile.js";
import { T, FONT } from "./theme.js";

var overlay = null;
var continueBtn = null;
var newRunCallback = null;
var continueRunCallback = null;

export function createMainMenu() {
  var _mob = isMobile();
  overlay = document.createElement("div");
  overlay.style.cssText = [
    "position:fixed",
    "top:0", "left:0",
    "width:100%", "height:100%",
    "display:none",
    "flex-direction:column",
    "align-items:center",
    "justify-content:flex-start",
    "overflow-y:auto",
    "padding:24px 0",
    "background:" + T.bgOverlay,
    "z-index:250",
    "font-family:" + FONT,
    "user-select:none"
  ].join(";");

  var title = document.createElement("div");
  title.textContent = "OCEAN OUTLAWS";
  title.style.cssText = [
    "font-size:" + (_mob ? "36px" : "48px"),
    "font-weight:bold",
    "color:" + T.gold,
    "margin-bottom:8px",
    "text-shadow:0 2px 8px rgba(212,164,74,0.4), 0 4px 16px rgba(0,0,0,0.6)",
    "letter-spacing:6px"
  ].join(";");
  overlay.appendChild(title);

  var subtitle = document.createElement("div");
  subtitle.textContent = "Roguelite Naval Combat";
  subtitle.style.cssText = [
    "font-size:" + (_mob ? "14px" : "16px"),
    "color:" + T.textDim,
    "margin-bottom:48px",
    "letter-spacing:3px"
  ].join(";");
  overlay.appendChild(subtitle);

  var newBtn = document.createElement("button");
  newBtn.textContent = "NEW RUN";
  newBtn.style.cssText = buildBtnStyle(_mob, true);
  newBtn.addEventListener("click", function () {
    if (newRunCallback) newRunCallback();
  });
  overlay.appendChild(newBtn);

  continueBtn = document.createElement("button");
  continueBtn.textContent = "CONTINUE RUN";
  continueBtn.style.cssText = buildBtnStyle(_mob, false);
  continueBtn.addEventListener("click", function () {
    if (continueRunCallback) continueRunCallback();
  });
  overlay.appendChild(continueBtn);

  document.body.appendChild(overlay);
}

function buildBtnStyle(_mob, primary) {
  return [
    "font-family:" + FONT,
    "font-size:" + (_mob ? "20px" : "18px"),
    "padding:" + (_mob ? "16px 52px" : "14px 44px"),
    "margin-bottom:16px",
    "min-width:" + (_mob ? "260px" : "240px"),
    "min-height:44px",
    "background:" + (primary ? "rgba(80,60,30,0.85)" : T.bgLight),
    "color:" + (primary ? T.goldBright : T.text),
    "border:2px solid " + (primary ? T.borderGold : T.border),
    "border-radius:6px",
    "cursor:pointer",
    "pointer-events:auto",
    "letter-spacing:3px",
    "text-shadow:0 1px 2px rgba(0,0,0,0.4)"
  ].join(";");
}

export function showMainMenu(onNewRun, onContinueRun, hasContinue) {
  newRunCallback = onNewRun;
  continueRunCallback = onContinueRun;
  if (continueBtn) {
    continueBtn.style.display = hasContinue ? "block" : "none";
  }
  if (overlay) overlay.style.display = "flex";
}

export function hideMainMenu() {
  if (overlay) overlay.style.display = "none";
}
