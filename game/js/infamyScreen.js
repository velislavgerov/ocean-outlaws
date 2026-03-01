// infamyScreen.js — The Captain's Log (cinematic end-of-run summary)
import { isMobile } from "./mobile.js";
import { T, FONT, FONT_UI, FONT_MONO } from "./theme.js";
import { getLegendProgress } from "./infamy.js";

var overlay = null;
var onContinueCallback = null;

export function createInfamyScreen() {
  overlay = document.createElement("div");
  overlay.style.cssText = [
    "position:fixed", "top:0", "left:0",
    "width:100%", "height:100%",
    "display:none",
    "align-items:center",
    "justify-content:center",
    "background:var(--oo-bg-scrim)",
    "z-index:180",
    "font-family:" + FONT,
    "user-select:none"
  ].join(";");
  document.body.appendChild(overlay);
}

export function showInfamyScreen(data, callback) {
  onContinueCallback = callback;
  if (!overlay) return;

  var _mob = isMobile();
  var result = data.result || "defeat";
  var isVictory = result === "victory";
  var progress = data.legendProgress || getLegendProgress({ total: data.totalInfamy });

  overlay.innerHTML = "";
  overlay.style.opacity = "0";
  overlay.style.display = "flex";

  var panel = document.createElement("div");
  panel.className = "oo-panel";
  panel.style.cssText = [
    _mob
      ? "width:calc(100% - 32px);display:flex;flex-direction:row"
      : "width:460px;display:flex;flex-direction:column",
    "border-radius:var(--oo-radius-lg)",
    "overflow:hidden",
    "opacity:0",
    "transform:translateY(40px)"
  ].join(";");

  if (_mob) {
    var leftCol = _makeLeftCol(isVictory, data, progress);
    var vDivider = document.createElement("div");
    vDivider.style.cssText = "width:1px;background:" + T.border + ";align-self:stretch;margin:20px 0";
    var rightCol = _makeRightCol(data, progress);
    panel.appendChild(leftCol);
    panel.appendChild(vDivider);
    panel.appendChild(rightCol);
  } else {
    panel.appendChild(_makeSingleCol(isVictory, data, progress));
  }

  overlay.appendChild(panel);
  _animateReveal(panel);
}

function _makeLeftCol(isVictory, data, progress) {
  var col = document.createElement("div");
  col.style.cssText = "flex:1;padding:24px 20px;display:flex;flex-direction:column;justify-content:center";

  col.appendChild(_makeEyebrow());
  col.appendChild(_makeVerdict(isVictory, "28px"));

  var fleet = document.createElement("div");
  fleet.textContent = "Fleet " + (data.zonesReached || 0) + " cleared";
  fleet.style.cssText = "font-family:" + FONT_UI + ";font-size:13px;color:" + T.textDim + ";margin-top:8px;margin-bottom:20px";
  col.appendChild(fleet);
  col.appendChild(_makeContinueBtn(true));

  return col;
}

function _makeRightCol(data, progress) {
  var col = document.createElement("div");
  col.style.cssText = "flex:1;padding:24px 20px;display:flex;flex-direction:column;justify-content:center";

  var rows = _buildStatRows(data);
  for (var i = 0; i < rows.length; i++) {
    col.appendChild(_makeStatRow(rows[i].label, rows[i].value, rows[i].color, "13px"));
  }

  var divider = document.createElement("hr");
  divider.className = "oo-divider";
  col.appendChild(divider);
  col.appendChild(_makeStatRow("INFAMY EARNED", "+" + (data.infamyEarned || 0), T.gold, "14px"));
  col.appendChild(_makeProgressBar(progress));

  return col;
}

function _makeSingleCol(isVictory, data, progress) {
  var col = document.createElement("div");
  col.style.cssText = "padding:32px;display:flex;flex-direction:column";

  col.appendChild(_makeEyebrow());
  col.appendChild(_makeVerdict(isVictory, "48px"));

  var fleet = document.createElement("div");
  fleet.textContent = "Fleet " + (data.zonesReached || 0) + " cleared";
  fleet.style.cssText = "font-family:" + FONT_UI + ";font-size:14px;color:" + T.textDim + ";margin:8px 0 24px";
  col.appendChild(fleet);

  var div1 = document.createElement("hr");
  div1.className = "oo-divider";
  col.appendChild(div1);

  var rows = _buildStatRows(data);
  for (var i = 0; i < rows.length; i++) {
    col.appendChild(_makeStatRow(rows[i].label, rows[i].value, rows[i].color, "14px"));
  }

  var div2 = document.createElement("hr");
  div2.className = "oo-divider";
  col.appendChild(div2);

  col.appendChild(_makeStatRow("INFAMY EARNED", "+" + (data.infamyEarned || 0), T.gold, "16px"));
  col.appendChild(_makeProgressBar(progress));
  col.appendChild(_makeContinueBtn(false));

  return col;
}

function _makeEyebrow() {
  var el = document.createElement("div");
  el.textContent = "VOYAGE ENDED";
  el.style.cssText = [
    "font-family:" + FONT_UI,
    "font-size:11px", "font-weight:500",
    "letter-spacing:0.1em", "text-transform:uppercase",
    "color:" + T.textDim, "margin-bottom:8px"
  ].join(";");
  return el;
}

function _makeVerdict(isVictory, size) {
  var el = document.createElement("div");
  el.textContent = isVictory ? "LEGEND SAILS ON" : "CAPTAIN FALLEN";
  el.style.cssText = [
    "font-family:" + FONT, "font-size:" + size,
    "font-weight:700", "letter-spacing:0.06em",
    "color:" + (isVictory ? T.gold : T.red),
    "text-shadow:0 2px 12px " + (isVictory ? "rgba(200,152,42,0.5)" : "rgba(192,57,43,0.5)"),
    "line-height:1.1", "margin-bottom:4px"
  ].join(";");
  return el;
}

function _buildStatRows(data) {
  return [
    { label: "GOLD PLUNDERED", value: data.goldLooted || 0, color: T.gold },
    { label: "SHIPS SUNK",     value: data.enemiesSunk || 0, color: T.text },
    { label: "ZONES CLEARED",  value: data.zonesReached || 0, color: T.text }
  ];
}

function _makeStatRow(label, value, color, size) {
  var row = document.createElement("div");
  row.style.cssText = "display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px";

  var lbl = document.createElement("span");
  lbl.textContent = label;
  lbl.style.cssText = [
    "font-family:" + FONT_UI, "font-size:" + size,
    "letter-spacing:0.06em", "text-transform:uppercase",
    "color:" + T.textDim
  ].join(";");

  var val = document.createElement("span");
  val.textContent = String(value);
  val.style.cssText = [
    "font-family:" + FONT_MONO, "font-size:" + size,
    "color:" + color, "font-weight:bold"
  ].join(";");

  row.appendChild(lbl);
  row.appendChild(val);
  return row;
}

function _makeProgressBar(progress) {
  var wrap = document.createElement("div");
  wrap.style.cssText = "margin-top:8px;margin-bottom:4px";

  var track = document.createElement("div");
  track.className = "oo-bar-track";
  track.style.height = "2px";

  var fill = document.createElement("div");
  fill.className = "oo-bar-fill";
  fill.style.cssText = "width:0%;background:" + T.gold;
  track.appendChild(fill);
  wrap.appendChild(track);

  var lbl = document.createElement("div");
  lbl.style.cssText = [
    "font-family:" + FONT_UI, "font-size:11px",
    "color:" + T.textDim, "margin-top:4px", "text-align:right"
  ].join(";");
  var lvl = progress ? progress.level : 1;
  lbl.textContent = "Level " + lvl;
  wrap.appendChild(lbl);

  var pct = 0;
  if (progress && progress.next !== null && progress.threshold !== undefined) {
    pct = Math.min(100, ((progress.current - progress.threshold) / (progress.next - progress.threshold)) * 100);
  }
  setTimeout(function() { fill.style.width = pct + "%"; }, 3600);

  return wrap;
}

function _makeContinueBtn(_mob) {
  var btn = document.createElement("button");
  btn.textContent = "RETURN TO PORT";
  btn.className = "oo-btn oo-btn-outline";
  btn.style.cssText = [
    "font-family:" + FONT, "font-size:14px",
    "color:" + T.text, "letter-spacing:0.08em",
    _mob ? "width:100%;margin-top:auto" : "align-self:flex-end;margin-top:24px",
    "min-height:44px", "padding:0 20px",
    "opacity:0"
  ].join(";");
  btn.addEventListener("click", function() {
    hideInfamyScreen();
    if (onContinueCallback) onContinueCallback();
  });
  return btn;
}

function _animateReveal(panel) {
  // Stage 1 (0ms): scrim fades in
  overlay.style.transition = "opacity 0.6s ease";
  requestAnimationFrame(function() { overlay.style.opacity = "1"; });

  // Stage 2 (600ms): panel rises
  setTimeout(function() {
    panel.style.transition = "opacity 0.8s var(--oo-ease-spring), transform 0.8s var(--oo-ease-spring)";
    panel.style.opacity = "1";
    panel.style.transform = "translateY(0)";
  }, 600);

  // Stage 3 (4200ms): CTA button fades in
  setTimeout(function() {
    var btn = overlay.querySelector(".oo-btn");
    if (btn) {
      btn.style.transition = "opacity 0.4s ease";
      btn.style.opacity = "1";
    }
  }, 4200);
}

export function hideInfamyScreen() {
  if (overlay) overlay.style.display = "none";
}
