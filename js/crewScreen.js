// crewScreen.js — crew management UI overlay (shown between waves alongside upgrades)
import {
  getStations, getAssigned, assignOfficer, unassignStation,
  getBonusLabel, getStationColor
} from "./crew.js";
import { isMobile } from "./mobile.js";

var root = null;
var stationEls = {};
var rosterEl = null;
var currentState = null;
var onCloseCallback = null;
var selectedOfficerId = null;

// --- create crew screen DOM (called once) ---
export function createCrewScreen() {
  root = document.createElement("div");
  root.id = "crew-screen";
  root.style.cssText = [
    "position: fixed",
    "top: 0", "left: 0",
    "width: 100%", "height: 100%",
    "display: none",
    "flex-direction: column",
    "align-items: center",
    "justify-content: center",
    "background: rgba(5, 5, 15, 0.92)",
    "z-index: 91",
    "font-family: monospace",
    "user-select: none",
    "overflow-y: auto"
  ].join(";");

  // title
  var title = document.createElement("div");
  title.textContent = "CREW ROSTER";
  title.style.cssText = [
    "font-size: 36px",
    "font-weight: bold",
    "color: #44ccff",
    "margin-bottom: 4px",
    "margin-top: 20px",
    "text-shadow: 0 0 15px rgba(60,180,255,0.4)"
  ].join(";");
  root.appendChild(title);

  var subtitle = document.createElement("div");
  subtitle.textContent = "Click an officer, then click a station to assign";
  subtitle.style.cssText = "font-size:13px;color:#667788;margin-bottom:16px";
  root.appendChild(subtitle);

  // stations row
  var stationsRow = document.createElement("div");
  stationsRow.style.cssText = [
    "display: flex",
    "flex-wrap: wrap",
    "justify-content: center",
    "gap: 12px",
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
    "color: #8899aa",
    "margin-bottom: 8px"
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
    "font-family: monospace",
    "font-size: 20px",
    "padding: 14px 48px",
    "min-height: 44px",
    "margin-top: 10px",
    "margin-bottom: 20px",
    "background: rgba(40, 80, 60, 0.8)",
    "color: #44dd66",
    "border: 1px solid rgba(60, 140, 90, 0.6)",
    "border-radius: 6px",
    "cursor: pointer",
    "pointer-events: auto",
    "text-shadow: 0 0 10px rgba(60,200,90,0.3)"
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
  var color = getStationColor(stationKey);
  var el = document.createElement("div");
  el.style.cssText = [
    "background: rgba(15, 20, 35, 0.8)",
    "border: 1px solid " + color + "44",
    "border-radius: 8px",
    "padding: 12px",
    "width: 170px",
    "min-width: 44px",
    "min-height: 130px",
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
    "text-align: center"
  ].join(";");
  el.appendChild(label);

  var assignedEl = document.createElement("div");
  assignedEl.style.cssText = [
    "font-size: 13px",
    "color: #8899aa",
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
  bonusEl.style.cssText = "font-size:11px;color:#667788;text-align:center;margin-top:6px";
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
  var specColor = getStationColor(officer.specialty);
  var el = document.createElement("div");
  el.style.cssText = [
    "background: rgba(20, 25, 40, 0.7)",
    "border: 1px solid " + (isAssigned ? "#334455" : specColor + "66"),
    "border-radius: 6px",
    "padding: 8px 12px",
    "cursor: " + (isAssigned ? "default" : "pointer"),
    "opacity: " + (isAssigned ? "0.4" : "1"),
    "min-width: 140px",
    "text-align: center",
    "transition: border-color 0.2s, background 0.2s"
  ].join(";");

  // portrait + name row
  var nameRow = document.createElement("div");
  nameRow.style.cssText = "font-size:14px;color:#ccddee;margin-bottom:4px";
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
    el.style.borderColor = "#44ccff";
    el.style.background = "rgba(30, 60, 80, 0.6)";
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
      nameEl.style.cssText = "font-size:12px;color:#ccddee";
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
      panel.assignedEl.textContent = selectedOfficerId ? "Click to assign" : "\u2014 Empty \u2014";
      panel.assignedEl.style.color = selectedOfficerId ? "#44ccff" : "#556677";
      panel.bonusEl.textContent = "";
    }

    // highlight station if officer is selected
    if (selectedOfficerId) {
      panel.el.style.borderColor = panel.color + "88";
    } else {
      panel.el.style.borderColor = panel.color + "44";
    }
  }

  // rebuild roster cards
  rosterEl.innerHTML = "";
  var roster = currentState.roster;
  if (roster.length === 0) {
    var emptyMsg = document.createElement("div");
    emptyMsg.textContent = "No officers yet — complete waves to recruit!";
    emptyMsg.style.cssText = "font-size:13px;color:#556677;padding:16px";
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
