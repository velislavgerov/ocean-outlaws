// crewScreen.js — crew management UI overlay (shown between waves alongside upgrades)
import {
  getStations, getAssigned, assignOfficer, unassignStation,
  getBonusLabel, getStationColor
} from "./crew.js";
import { isMobile } from "./mobile.js";
import { T, FONT, PARCHMENT_BG } from "./theme.js";

var root = null;
var stationEls = {};
var rosterEl = null;
var currentState = null;
var onCloseCallback = null;
var selectedOfficerId = null;

// --- create crew screen DOM (called once) ---
export function createCrewScreen() {
  var _mob = isMobile();
  root = document.createElement("div");
  root.id = "crew-screen";
  root.style.cssText = [
    "position: fixed",
    "top: 0", "left: 0",
    "width: 100%", "height: 100%",
    "display: none",
    "flex-direction: column",
    "align-items: center",
    _mob ? "justify-content: flex-start" : "justify-content: center",
    "background: " + T.bgOverlay,
    "z-index: 91",
    "font-family: " + FONT,
    "user-select: none",
    "overflow-y: auto",
    _mob ? "padding: 12px 0" : ""
  ].join(";");

  // title
  var title = document.createElement("div");
  title.textContent = "CREW ROSTER";
  title.style.cssText = [
    "font-size: " + (_mob ? "24px" : "36px"),
    "font-weight: bold",
    "color: " + T.gold,
    "margin-bottom: 4px",
    "margin-top: " + (_mob ? "10px" : "20px"),
    "text-shadow: 0 0 15px rgba(212,164,74,0.4), 0 1px 3px rgba(0,0,0,0.5)"
  ].join(";");
  root.appendChild(title);

  var subtitle = document.createElement("div");
  subtitle.textContent = _mob ? "Tap an officer, then tap a station" : "Click an officer, then click a station to assign";
  subtitle.style.cssText = "font-size:13px;color:" + T.textDim + ";margin-bottom:16px;font-family:" + FONT;
  root.appendChild(subtitle);

  // stations row
  var stationsRow = document.createElement("div");
  stationsRow.style.cssText = [
    "display: flex",
    "flex-wrap: wrap",
    "justify-content: center",
    "gap: " + (_mob ? "8px" : "12px"),
    "margin-bottom: 20px",
    "max-width: 800px",
    "width: 90%"
  ].join(";");
  root.appendChild(stationsRow);

  var stations = getStations();
  for (var s = 0; s < stations.length; s++) {
    var stationKey = stations[s];
    var stationPanel = buildStationPanel(stationKey);
    stationsRow.appendChild(stationPanel.el);
    stationEls[stationKey] = stationPanel;
  }

  // roster section
  var rosterTitle = document.createElement("div");
  rosterTitle.textContent = "AVAILABLE OFFICERS";
  rosterTitle.style.cssText = [
    "font-size: 16px",
    "font-weight: bold",
    "color: " + T.text,
    "margin-bottom: 8px",
    "text-shadow: 0 1px 2px rgba(0,0,0,0.4)"
  ].join(";");
  root.appendChild(rosterTitle);

  rosterEl = document.createElement("div");
  rosterEl.style.cssText = [
    "display: flex",
    "flex-wrap: wrap",
    "justify-content: center",
    "gap: 8px",
    "max-width: 800px",
    "width: 90%",
    "min-height: 60px",
    "margin-bottom: 16px"
  ].join(";");
  root.appendChild(rosterEl);

  // continue button
  var btn = document.createElement("button");
  btn.textContent = "CONTINUE";
  btn.style.cssText = [
    "font-family: " + FONT,
    "font-size: 20px",
    "padding: 14px 48px",
    "min-height: 44px",
    "margin-top: 10px",
    "margin-bottom: 20px",
    "background: " + T.bgLight,
    "color: " + T.greenBright,
    "border: 1px solid " + T.border,
    "border-radius: 6px",
    "cursor: pointer",
    "pointer-events: auto",
    "text-shadow: 0 1px 2px rgba(0,0,0,0.4)"
  ].join(";");
  btn.addEventListener("click", function () {
    hideCrewScreen();
    if (onCloseCallback) onCloseCallback();
  });
  root.appendChild(btn);

  document.body.appendChild(root);
}

// --- build a station panel ---
function buildStationPanel(stationKey) {
  var _mob = isMobile();
  var color = getStationColor(stationKey);
  var el = document.createElement("div");
  el.style.cssText = [
    PARCHMENT_BG,
    "border: 1px solid " + T.border,
    "border-radius: 8px",
    "padding: 12px",
    _mob ? "width: calc(50% - 8px);min-width: 120px;box-sizing: border-box" : "width: 170px",
    "min-height: " + (_mob ? "100px" : "130px"),
    "cursor: pointer",
    "transition: border-color 0.2s"
  ].join(";");

  var label = document.createElement("div");
  label.textContent = stationKey.charAt(0).toUpperCase() + stationKey.slice(1);
  label.style.cssText = [
    "font-size: 15px",
    "font-weight: bold",
    "color: " + color,
    "margin-bottom: 8px",
    "text-align: center",
    "text-shadow: 0 1px 2px rgba(0,0,0,0.4)"
  ].join(";");
  el.appendChild(label);

  var assignedEl = document.createElement("div");
  assignedEl.style.cssText = [
    "font-size: 13px",
    "color: " + T.text,
    "text-align: center",
    "min-height: 50px",
    "display: flex",
    "flex-direction: column",
    "align-items: center",
    "justify-content: center"
  ].join(";");
  assignedEl.textContent = "— Empty —";
  el.appendChild(assignedEl);

  var bonusEl = document.createElement("div");
  bonusEl.style.cssText = "font-size:11px;color:" + T.textDim + ";text-align:center;margin-top:6px";
  el.appendChild(bonusEl);

  // click station: assign selected officer or unassign
  el.addEventListener("click", function () {
    if (!currentState) return;
    if (selectedOfficerId) {
      assignOfficer(currentState, selectedOfficerId, stationKey);
      selectedOfficerId = null;
      refreshUI();
    } else {
      // clicking an occupied station unassigns
      var assigned = getAssigned(currentState, stationKey);
      if (assigned) {
        unassignStation(currentState, stationKey);
        refreshUI();
      }
    }
  });

  return { el: el, assignedEl: assignedEl, bonusEl: bonusEl, color: color };
}

// --- build a roster officer card ---
function buildOfficerCard(officer, isAssigned) {
  var _mob = isMobile();
  var specColor = getStationColor(officer.specialty);
  var el = document.createElement("div");
  el.style.cssText = [
    "background: rgba(55, 42, 26, 0.7)",
    "border: 1px solid " + (isAssigned ? T.textDark : specColor + "66"),
    "border-radius: 6px",
    "padding: " + (_mob ? "10px 14px" : "8px 12px"),
    "cursor: " + (isAssigned ? "default" : "pointer"),
    "opacity: " + (isAssigned ? "0.4" : "1"),
    _mob ? "min-width: calc(50% - 8px);box-sizing: border-box" : "min-width: 140px",
    "min-height: 44px",
    "text-align: center",
    "transition: border-color 0.2s, background 0.2s"
  ].join(";");

  // portrait + name row
  var nameRow = document.createElement("div");
  nameRow.style.cssText = "font-size:14px;color:" + T.textLight + ";margin-bottom:4px";
  nameRow.textContent = officer.portrait + " " + officer.name;
  el.appendChild(nameRow);

  // specialty + rank
  var infoRow = document.createElement("div");
  infoRow.style.cssText = "font-size:11px;color:" + specColor;
  var stars = "";
  for (var r = 0; r < officer.rank; r++) stars += "\u2605";
  infoRow.textContent = officer.specialty.charAt(0).toUpperCase() + officer.specialty.slice(1) + " " + stars;
  el.appendChild(infoRow);

  if (!isAssigned) {
    el.addEventListener("click", function (e) {
      e.stopPropagation();
      if (selectedOfficerId === officer.id) {
        selectedOfficerId = null;
      } else {
        selectedOfficerId = officer.id;
      }
      refreshUI();
    });
  }

  // highlight if selected
  if (selectedOfficerId === officer.id) {
    el.style.borderColor = T.gold;
    el.style.background = "rgba(80, 60, 30, 0.6)";
  }

  return el;
}

// --- refresh all UI elements ---
function refreshUI() {
  if (!currentState || !root) return;

  var stations = getStations();
  // get set of assigned officer ids
  var assignedIds = {};
  for (var s = 0; s < stations.length; s++) {
    var stKey = stations[s];
    var assigned = getAssigned(currentState, stKey);
    if (assigned) assignedIds[assigned.id] = stKey;
  }

  // update station panels
  for (var s = 0; s < stations.length; s++) {
    var stKey = stations[s];
    var panel = stationEls[stKey];
    var assigned = getAssigned(currentState, stKey);

    if (assigned) {
      var stars = "";
      for (var r = 0; r < assigned.rank; r++) stars += "\u2605";
      panel.assignedEl.innerHTML = "";
      var portrait = document.createElement("div");
      portrait.style.cssText = "font-size:24px;margin-bottom:2px";
      portrait.textContent = assigned.portrait;
      panel.assignedEl.appendChild(portrait);

      var nameEl = document.createElement("div");
      nameEl.style.cssText = "font-size:12px;color:" + T.textLight;
      nameEl.textContent = assigned.name;
      panel.assignedEl.appendChild(nameEl);

      var rankEl = document.createElement("div");
      rankEl.style.cssText = "font-size:11px;color:" + getStationColor(assigned.specialty);
      rankEl.textContent = assigned.specialty.charAt(0).toUpperCase() + assigned.specialty.slice(1) + " " + stars;
      panel.assignedEl.appendChild(rankEl);

      panel.bonusEl.textContent = getBonusLabel(assigned, stKey);
      panel.bonusEl.style.color = (assigned.specialty === stKey) ? panel.color : "#887766";
      if (assigned.specialty !== stKey) {
        panel.bonusEl.textContent += " (mismatch)";
      }
    } else {
      panel.assignedEl.innerHTML = "";
      panel.assignedEl.textContent = selectedOfficerId ? (isMobile() ? "Tap to assign" : "Click to assign") : "\u2014 Empty \u2014";
      panel.assignedEl.style.color = selectedOfficerId ? T.gold : T.textDark;
      panel.bonusEl.textContent = "";
    }

    // highlight station if officer is selected
    if (selectedOfficerId) {
      panel.el.style.borderColor = panel.color + "88";
    } else {
      panel.el.style.borderColor = T.border;
    }
  }

  // rebuild roster cards
  rosterEl.innerHTML = "";
  var roster = currentState.roster;
  if (roster.length === 0) {
    var emptyMsg = document.createElement("div");
    emptyMsg.textContent = "No officers yet — complete waves to recruit!";
    emptyMsg.style.cssText = "font-size:13px;color:" + T.textDark + ";padding:16px";
    rosterEl.appendChild(emptyMsg);
    return;
  }

  for (var i = 0; i < roster.length; i++) {
    var officer = roster[i];
    var isAssigned = !!assignedIds[officer.id];
    var card = buildOfficerCard(officer, isAssigned);
    rosterEl.appendChild(card);
  }
}

// --- show crew screen ---
export function showCrewScreen(crewState, closeCb) {
  if (!root) return;
  currentState = crewState;
  onCloseCallback = closeCb;
  selectedOfficerId = null;
  refreshUI();
  root.style.display = "flex";
}

// --- hide crew screen ---
export function hideCrewScreen() {
  if (!root) return;
  root.style.display = "none";
  currentState = null;
  selectedOfficerId = null;
}
