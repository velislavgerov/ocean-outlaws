// crewSwap.js — quick overlay for swapping crew when roster is full (max 8)
import { T, FONT, PARCHMENT_BG, PARCHMENT_SHADOW } from "./theme.js";
import { isMobile } from "./mobile.js";
import { getStationColor } from "./crew.js";

var overlay = null;
var _onChoice = null;
var _visible = false;

export function createCrewSwap() {
  var mob = isMobile();

  overlay = document.createElement("div");
  overlay.style.cssText = [
    "position:fixed", "top:0", "left:0", "width:100%", "height:100%",
    "display:none", "flex-direction:column", "align-items:center", "justify-content:center",
    "background:rgba(10,8,4,0.80)", "z-index:95",
    "font-family:" + FONT, "user-select:none"
  ].join(";");

  document.body.appendChild(overlay);
}

export function showCrewSwap(currentRoster, newOfficer, onChoice) {
  if (!overlay) return;
  _onChoice = onChoice;
  _visible = true;
  overlay.innerHTML = "";

  var mob = isMobile();

  var panel = document.createElement("div");
  panel.style.cssText = [
    PARCHMENT_BG, PARCHMENT_SHADOW,
    "border:2px solid " + T.borderGold, "border-radius:8px",
    "padding:" + (mob ? "16px" : "24px"),
    "max-width:" + (mob ? "320px" : "500px"), "width:90vw",
    "display:flex", "flex-direction:column", "gap:12px"
  ].join(";");

  var title = document.createElement("div");
  title.textContent = "CREW FULL — SWAP OR DISCARD?";
  title.style.cssText = [
    "font-size:" + (mob ? "14px" : "16px"), "font-weight:bold",
    "color:" + T.gold, "letter-spacing:2px", "text-align:center"
  ].join(";");
  panel.appendChild(title);

  // new officer card
  var newCard = _buildOfficerCard(newOfficer, "NEW RECRUIT", T.greenBright, mob);
  panel.appendChild(newCard);

  var subtitle = document.createElement("div");
  subtitle.textContent = "TAP A CURRENT OFFICER TO REPLACE, OR DISCARD THE NEW RECRUIT";
  subtitle.style.cssText = "font-size:10px;color:" + T.textDim + ";text-align:center;letter-spacing:1px;";
  panel.appendChild(subtitle);

  // current roster
  var rosterWrap = document.createElement("div");
  rosterWrap.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;justify-content:center;";

  for (var i = 0; i < currentRoster.length; i++) {
    var officer = currentRoster[i];
    var card = _buildRosterCard(officer, mob, (function (off) {
      return function () {
        if (!_visible) return;
        hideCrewSwap();
        if (_onChoice) _onChoice({ action: "swap", replaceId: off.id, newOfficer: newOfficer });
      };
    })(officer));
    rosterWrap.appendChild(card);
  }
  panel.appendChild(rosterWrap);

  // discard button
  var discardBtn = document.createElement("button");
  discardBtn.textContent = "DISCARD NEW RECRUIT";
  discardBtn.style.cssText = [
    "font-family:" + FONT, "font-size:" + (mob ? "13px" : "14px"),
    "padding:" + (mob ? "10px 20px" : "8px 20px"),
    "background:" + T.bgLight, "color:" + T.textDim,
    "border:1px solid " + T.border, "border-radius:4px",
    "cursor:pointer", "pointer-events:auto", "min-height:44px",
    "width:100%", "letter-spacing:1px"
  ].join(";");
  discardBtn.addEventListener("click", function () {
    if (!_visible) return;
    hideCrewSwap();
    if (_onChoice) _onChoice({ action: "discard" });
  });
  panel.appendChild(discardBtn);

  overlay.appendChild(panel);
  overlay.style.display = "flex";
}

function _buildOfficerCard(officer, badge, borderColor, mob) {
  var el = document.createElement("div");
  el.style.cssText = [
    "display:flex", "align-items:center", "gap:10px",
    "padding:10px 12px", "border-radius:6px",
    "background:" + T.bgDark,
    "border:1px solid " + (borderColor || T.borderGold)
  ].join(";");

  var portrait = document.createElement("div");
  portrait.textContent = officer.portrait || "\ud83d\udc64";
  portrait.style.cssText = "font-size:" + (mob ? "22px" : "26px") + ";flex-shrink:0;";
  el.appendChild(portrait);

  var info = document.createElement("div");
  var rankStars = "";
  for (var r = 0; r < (officer.rank || 1); r++) rankStars += "\u2605";
  info.innerHTML = [
    '<div style="font-weight:bold;font-size:12px;color:' + T.textLight + '">' + (officer.name || "Officer") + "</div>",
    '<div style="font-size:10px;color:' + getStationColor(officer.specialty) + '">' + rankStars + " " + (officer.specialty || "") + "</div>"
  ].join("");
  el.appendChild(info);

  if (badge) {
    var badgeEl = document.createElement("div");
    badgeEl.textContent = badge;
    badgeEl.style.cssText = "font-size:9px;color:" + (borderColor || T.gold) + ";margin-left:auto;letter-spacing:1px;";
    el.appendChild(badgeEl);
  }

  return el;
}

function _buildRosterCard(officer, mob, onClick) {
  var el = _buildOfficerCard(officer, null, T.border, mob);
  el.style.cursor = "pointer";
  el.style.minHeight = "44px";
  el.style.flex = "1 1 40%";
  el.style.transition = "border-color 0.1s";

  el.addEventListener("mouseenter", function () { el.style.borderColor = T.red; });
  el.addEventListener("mouseleave", function () { el.style.borderColor = T.border; });
  el.addEventListener("click", onClick);
  el.addEventListener("touchend", function (e) { e.preventDefault(); onClick(); }, { passive: false });

  // dismiss label
  var dismiss = document.createElement("div");
  dismiss.textContent = "REPLACE";
  dismiss.style.cssText = "font-size:9px;color:" + T.red + ";margin-left:auto;letter-spacing:1px;";
  el.appendChild(dismiss);

  return el;
}

export function hideCrewSwap() {
  _visible = false;
  if (overlay) overlay.style.display = "none";
}

export function isCrewSwapVisible() {
  return _visible;
}
