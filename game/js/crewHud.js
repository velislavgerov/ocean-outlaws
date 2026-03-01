// crewHud.js — crew roster display as small icons in the top-left HUD panel
import { T, FONT, FONT_UI } from "./theme.js";
import { getBonusLabel, getStationColor } from "./crew.js";
import { isMobile } from "./mobile.js";

var container = null;
var tooltipEl = null;
var _mob = isMobile();

export function createCrewHud() {
  container = document.createElement("div");
  container.style.cssText = [
    "margin-top:5px", "display:flex", "flex-wrap:wrap",
    "gap:3px", "max-width:130px", "pointer-events:auto"
  ].join(";");

  // shared tooltip
  tooltipEl = document.createElement("div");
  tooltipEl.style.cssText = [
    "position:fixed", "pointer-events:none", "display:none",
    "padding:8px 12px", "background:" + T.bg,
    "border:1px solid var(--oo-gold-dim)",
    "border-radius:var(--oo-radius-md, 4px)",
    "font-family:" + FONT_UI, "font-size:12px", "color:" + T.textDim,
    "z-index:25", "white-space:nowrap",
    "box-shadow:0 2px 8px rgba(0,0,0,0.5)"
  ].join(";");
  document.body.appendChild(tooltipEl);

  return container;
}

export function getCrewHudContainer() {
  return container;
}

export function updateCrewHud(crewState) {
  if (!container) return;
  container.innerHTML = "";
  if (!crewState || !crewState.roster || crewState.roster.length === 0) return;

  var roster = crewState.roster;
  var assigned = crewState.assigned || {};

  for (var i = 0; i < roster.length && i < 8; i++) {
    var officer = roster[i];
    var icon = _buildIcon(officer, assigned);
    container.appendChild(icon);
  }
}

function _buildIcon(officer, assigned) {
  // find which station this officer is assigned to (if any)
  var station = null;
  var stations = ["weapons", "engine", "helm", "medical"];
  for (var s = 0; s < stations.length; s++) {
    if (assigned[stations[s]] === officer.id) { station = stations[s]; break; }
  }

  var size = _mob ? 22 : 18;
  var el = document.createElement("div");
  el.style.cssText = [
    "width:" + size + "px", "height:" + size + "px",
    "border-radius:50%", "background:" + T.bgLight,
    "border:1px solid " + (station ? getStationColor(station) : "var(--oo-gold-dim)"),
    "display:flex", "align-items:center", "justify-content:center",
    "font-size:" + (size - 4) + "px", "cursor:default",
    "overflow:hidden", "flex-shrink:0",
    "min-height:" + (_mob ? "44px" : size + "px"),  // 44px touch target on mobile
    "min-width:" + (_mob ? "44px" : size + "px")
  ].join(";");
  el.textContent = officer.portrait || "\ud83d\udc64";

  // tooltip on hover (desktop) or as title (mobile)
  var rankStars = "";
  for (var r = 0; r < (officer.rank || 1); r++) rankStars += "\u2605";
  var bonusText = station ? getBonusLabel(officer, station) : "Unassigned";
  var tipHtml = [
    "<span style='color:" + T.text + ";font-size:12px;font-weight:bold'>" + (officer.name || "Officer") + "</span>",
    rankStars + " " + (officer.specialty || "") + (station ? " \u2192 " + station : ""),
    "<span style='color:" + T.text + "'>" + bonusText + "</span>"
  ].join("<br>");

  el.addEventListener("mouseenter", function (e) {
    tooltipEl.innerHTML = tipHtml;
    tooltipEl.style.display = "block";
    _positionTooltip(e.clientX, e.clientY);
  });
  el.addEventListener("mousemove", function (e) {
    _positionTooltip(e.clientX, e.clientY);
  });
  el.addEventListener("mouseleave", function () {
    tooltipEl.style.display = "none";
  });

  // mobile: tap-to-show tooltip
  if (_mob) {
    el.addEventListener("touchstart", function (e) {
      e.stopPropagation();
      tooltipEl.innerHTML = tipHtml;
      tooltipEl.style.display = "block";
      var touch = e.touches[0];
      _positionTooltip(touch.clientX, touch.clientY);
      setTimeout(function () { tooltipEl.style.display = "none"; }, 2500);
    }, { passive: true });
  }

  return el;
}

function _positionTooltip(cx, cy) {
  var tw = 200;
  var left = cx + 12;
  if (left + tw > window.innerWidth) left = cx - tw - 6;
  tooltipEl.style.left = left + "px";
  tooltipEl.style.top = (cy - 10) + "px";
}

export function destroyCrewHud() {
  if (container && container.parentNode) container.parentNode.removeChild(container);
  if (tooltipEl && tooltipEl.parentNode) tooltipEl.parentNode.removeChild(tooltipEl);
  container = null;
  tooltipEl = null;
}
