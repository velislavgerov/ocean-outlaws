// infamyScreen.js — end-of-run summary screen showing Infamy earned

import { isMobile } from "./mobile.js";
import { T, FONT, PARCHMENT_BG, PARCHMENT_SHADOW } from "./theme.js";
import { getLegendLevel, getLegendProgress } from "./infamy.js";

var overlay = null;
var onContinueCallback = null;

// --- create the summary screen (call once at startup) ---
export function createInfamyScreen() {
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
    "z-index:180",
    "font-family:" + FONT,
    "user-select:none"
  ].join(";");
  document.body.appendChild(overlay);
}

// --- show the end-of-run summary ---
// data: { goldLooted, enemiesSunk, zonesReached, infamyEarned, totalInfamy, legendLevel, result }
export function showInfamyScreen(data, callback) {
  onContinueCallback = callback;
  if (!overlay) return;

  var _mob = isMobile();
  var result = data.result || "defeat";
  var resultColor = result === "victory" ? T.greenBright : T.red;
  var resultText = result === "victory" ? "VICTORY" : "DEFEATED";
  var progress = data.legendProgress || getLegendProgress({ total: data.totalInfamy });

  overlay.innerHTML = "";

  // result title
  var title = document.createElement("div");
  title.textContent = resultText;
  title.style.cssText = [
    "font-size:" + (_mob ? "32px" : "42px"),
    "font-weight:bold",
    "color:" + resultColor,
    "margin-bottom:24px",
    "text-shadow:0 2px 6px rgba(0,0,0,0.6)",
    "letter-spacing:4px"
  ].join(";");
  overlay.appendChild(title);

  // summary card
  var card = document.createElement("div");
  card.style.cssText = [
    _mob ? "width:90%;max-width:360px" : "width:340px",
    "padding:24px 28px",
    PARCHMENT_BG,
    "border:2px solid " + T.borderGold,
    "border-radius:8px",
    PARCHMENT_SHADOW
  ].join(";");

  // stat rows
  var rows = [
    { label: "Gold Looted", value: data.goldLooted || 0, color: T.gold },
    { label: "Enemies Sunk", value: data.enemiesSunk || 0, color: T.redBright },
    { label: "Zones Reached", value: data.zonesReached || 0, color: T.blueBright }
  ];

  for (var i = 0; i < rows.length; i++) {
    var row = document.createElement("div");
    row.style.cssText = [
      "display:flex",
      "justify-content:space-between",
      "font-size:" + (_mob ? "15px" : "14px"),
      "color:" + T.text,
      "margin-bottom:8px",
      "text-shadow:0 1px 2px rgba(0,0,0,0.4)"
    ].join(";");
    var lbl = document.createElement("span");
    lbl.textContent = rows[i].label;
    lbl.style.color = T.textDim;
    var val = document.createElement("span");
    val.textContent = String(rows[i].value);
    val.style.color = rows[i].color;
    val.style.fontWeight = "bold";
    row.appendChild(lbl);
    row.appendChild(val);
    card.appendChild(row);
  }

  // divider
  var divider = document.createElement("div");
  divider.style.cssText = "border-top:1px solid " + T.border + ";margin:12px 0";
  card.appendChild(divider);

  // Infamy earned row (highlighted)
  var infamyRow = document.createElement("div");
  infamyRow.style.cssText = [
    "display:flex",
    "justify-content:space-between",
    "font-size:" + (_mob ? "17px" : "16px"),
    "font-weight:bold",
    "color:" + T.goldBright,
    "margin-bottom:8px",
    "text-shadow:0 1px 4px rgba(212,164,74,0.4)"
  ].join(";");
  var infamyLbl = document.createElement("span");
  infamyLbl.textContent = "Infamy Earned";
  var infamyVal = document.createElement("span");
  infamyVal.textContent = "+" + (data.infamyEarned || 0);
  infamyRow.appendChild(infamyLbl);
  infamyRow.appendChild(infamyVal);
  card.appendChild(infamyRow);

  // total Infamy
  var totalRow = document.createElement("div");
  totalRow.style.cssText = [
    "display:flex",
    "justify-content:space-between",
    "font-size:" + (_mob ? "14px" : "13px"),
    "color:" + T.text,
    "margin-bottom:4px",
    "text-shadow:0 1px 2px rgba(0,0,0,0.4)"
  ].join(";");
  var totalLbl = document.createElement("span");
  totalLbl.textContent = "Total Infamy";
  totalLbl.style.color = T.textDim;
  var totalVal = document.createElement("span");
  totalVal.textContent = String(data.totalInfamy || 0);
  totalVal.style.color = T.gold;
  totalRow.appendChild(totalLbl);
  totalRow.appendChild(totalVal);
  card.appendChild(totalRow);

  // Legend Level
  var legendRow = document.createElement("div");
  legendRow.style.cssText = [
    "display:flex",
    "justify-content:space-between",
    "font-size:" + (_mob ? "14px" : "13px"),
    "color:" + T.text,
    "margin-bottom:12px",
    "text-shadow:0 1px 2px rgba(0,0,0,0.4)"
  ].join(";");
  var legendLbl = document.createElement("span");
  legendLbl.textContent = "Legend Level";
  legendLbl.style.color = T.textDim;
  var legendVal = document.createElement("span");
  legendVal.textContent = String(progress.level);
  legendVal.style.color = T.goldBright;
  legendVal.style.fontWeight = "bold";
  legendRow.appendChild(legendLbl);
  legendRow.appendChild(legendVal);
  card.appendChild(legendRow);

  // Legend Level progress bar
  if (progress.next !== null) {
    var barWrap = document.createElement("div");
    barWrap.style.cssText = [
      "width:100%",
      "height:8px",
      "background:" + T.bgLight,
      "border:1px solid " + T.border,
      "border-radius:4px",
      "overflow:hidden",
      "margin-bottom:4px"
    ].join(";");
    var barFill = document.createElement("div");
    var pct = Math.min(100, ((progress.current - progress.threshold) / (progress.next - progress.threshold)) * 100);
    barFill.style.cssText = [
      "width:" + pct + "%",
      "height:100%",
      "background:" + T.gold,
      "border-radius:3px",
      "transition:width 0.3s"
    ].join(";");
    barWrap.appendChild(barFill);
    card.appendChild(barWrap);

    var barLabel = document.createElement("div");
    barLabel.textContent = progress.current + " / " + progress.next;
    barLabel.style.cssText = "font-size:10px;color:" + T.textDim + ";text-align:center;margin-bottom:4px";
    card.appendChild(barLabel);
  }

  overlay.appendChild(card);

  // continue button
  var btn = document.createElement("button");
  btn.textContent = "CONTINUE";
  btn.style.cssText = [
    "font-family:" + FONT,
    "font-size:" + (_mob ? "18px" : "16px"),
    "padding:" + (_mob ? "14px 44px" : "12px 36px"),
    "margin-top:24px",
    "background:" + T.bgLight,
    "color:" + T.textLight,
    "border:1px solid " + T.borderActive,
    "border-radius:4px",
    "cursor:pointer",
    "pointer-events:auto",
    "min-height:44px",
    "letter-spacing:2px",
    "text-shadow:0 1px 2px rgba(0,0,0,0.4)"
  ].join(";");
  btn.addEventListener("click", function () {
    hideInfamyScreen();
    if (onContinueCallback) onContinueCallback();
  });
  overlay.appendChild(btn);

  overlay.style.display = "flex";
}

// --- hide the summary screen ---
export function hideInfamyScreen() {
  if (overlay) overlay.style.display = "none";
}
