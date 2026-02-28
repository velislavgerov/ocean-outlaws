// cardPicker.js — mid-combat card picker overlay (Vampire Survivors style)
import { T, FONT, PARCHMENT_BG, PARCHMENT_SHADOW } from "./theme.js";
import { isMobile } from "./mobile.js";

var overlay = null;
var cardEls = [];
var _onPick = null;
var _visible = false;

export function createCardPicker() {
  var mob = isMobile();

  overlay = document.createElement("div");
  overlay.style.cssText = [
    "position:fixed", "top:0", "left:0", "width:100%", "height:100%",
    "display:none", "flex-direction:column", "align-items:center", "justify-content:flex-start",
    "overflow-y:auto", "padding:24px 0",
    "background:rgba(10,8,4,0.78)", "z-index:90",
    "font-family:" + FONT, "user-select:none"
  ].join(";");

  var title = document.createElement("div");
  title.textContent = "CHOOSE AN UPGRADE";
  title.style.cssText = [
    "font-size:" + (mob ? "18px" : "22px"), "font-weight:bold",
    "color:" + T.gold, "margin-bottom:" + (mob ? "12px" : "20px"),
    "letter-spacing:4px", "text-shadow:0 2px 6px rgba(0,0,0,0.7)"
  ].join(";");
  overlay.appendChild(title);

  var row = document.createElement("div");
  row.style.cssText = [
    "display:flex",
    mob ? "flex-direction:column" : "flex-direction:row",
    "gap:" + (mob ? "10px" : "16px"),
    "align-items:center", "justify-content:center",
    mob ? "max-width:90vw" : "max-width:860px",
    "padding:0 12px"
  ].join(";");

  cardEls = [];
  for (var i = 0; i < 3; i++) {
    var card = _buildCard(mob);
    row.appendChild(card.el);
    cardEls.push(card);
  }

  overlay.appendChild(row);
  document.body.appendChild(overlay);
}

function _buildCard(mob) {
  var el = document.createElement("div");
  el.style.cssText = [
    "position:relative", "cursor:pointer", "pointer-events:auto",
    "border-radius:8px",
    mob ? "width:260px;min-height:80px" : "width:200px;min-height:220px",
    PARCHMENT_BG, PARCHMENT_SHADOW,
    "border:2px solid " + T.borderGold,
    "padding:" + (mob ? "12px 14px" : "20px 16px"),
    "display:flex",
    mob ? "flex-direction:row;align-items:center;gap:12px" : "flex-direction:column;align-items:center;gap:10px",
    "transition:transform 0.12s,box-shadow 0.12s",
    "box-sizing:border-box"
  ].join(";");

  var iconEl = document.createElement("div");
  iconEl.style.cssText = [
    "font-size:" + (mob ? "28px" : "40px"),
    "line-height:1", "flex-shrink:0"
  ].join(";");

  var textWrap = document.createElement("div");
  textWrap.style.cssText = [
    "display:flex", "flex-direction:column",
    mob ? "align-items:flex-start" : "align-items:center",
    "gap:4px"
  ].join(";");

  var labelEl = document.createElement("div");
  labelEl.style.cssText = [
    "font-size:" + (mob ? "14px" : "15px"), "font-weight:bold",
    "color:" + T.textLight, "text-align:" + (mob ? "left" : "center")
  ].join(";");

  var descEl = document.createElement("div");
  descEl.style.cssText = [
    "font-size:" + (mob ? "12px" : "12px"), "color:" + T.textDim,
    "text-align:" + (mob ? "left" : "center"), "line-height:1.4"
  ].join(";");

  var tierEl = document.createElement("div");
  tierEl.style.cssText = [
    "font-size:10px", "color:" + T.textDim, "letter-spacing:2px",
    "text-align:" + (mob ? "left" : "center")
  ].join(";");

  textWrap.appendChild(labelEl);
  textWrap.appendChild(descEl);
  textWrap.appendChild(tierEl);

  if (mob) {
    el.appendChild(iconEl);
    el.appendChild(textWrap);
  } else {
    el.appendChild(iconEl);
    el.appendChild(textWrap);
  }

  // hover effects
  el.addEventListener("mouseenter", function () {
    el.style.transform = "scale(1.04)";
    el.style.boxShadow = "0 0 20px rgba(212,164,74,0.4),inset 0 0 30px rgba(0,0,0,0.3)";
  });
  el.addEventListener("mouseleave", function () {
    el.style.transform = "";
    el.style.boxShadow = "";
  });

  return { el: el, iconEl: iconEl, labelEl: labelEl, descEl: descEl, tierEl: tierEl };
}

export function showCardPicker(cards, onPick) {
  if (!overlay) return;
  _onPick = onPick;
  _visible = true;

  // fill / hide cards based on how many we have
  for (var i = 0; i < 3; i++) {
    var card = cardEls[i];
    if (i < cards.length) {
      var c = cards[i];
      card.iconEl.textContent = c.icon || "\u2b50";
      card.labelEl.textContent = c.label || "";
      card.descEl.textContent = c.desc || "";
      card.tierEl.textContent = c.tier ? ("TIER " + c.tier) : "";
      card.el.style.borderColor = c.color || T.borderGold;
      card.el.style.display = "";
      // attach click with captured card data
      card.el.onclick = (function (picked) {
        return function () {
          if (!_visible) return;
          hideCardPicker();
          if (_onPick) _onPick(picked);
        };
      })(c);
    } else {
      card.el.style.display = "none";
    }
  }

  overlay.style.display = "flex";
}

export function hideCardPicker() {
  _visible = false;
  if (overlay) overlay.style.display = "none";
}

export function isCardPickerVisible() {
  return _visible;
}
