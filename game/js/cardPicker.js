// cardPicker.js — mid-combat card picker overlay (Vampire Survivors style)
// "Dispatches from the Fleet" — dark glass panels, stagger drop-in animation
import { T, FONT, FONT_UI, PARCHMENT_SHADOW } from "./theme.js";
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
    "display:none", "flex-direction:column", "align-items:center", "justify-content:center",
    "overflow-y:auto", "padding:" + (mob ? "16px 0" : "24px 0"),
    "background:var(--oo-bg-scrim)", "z-index:90",
    "font-family:" + FONT, "user-select:none"
  ].join(";");

  var title = document.createElement("div");
  title.textContent = "DISPATCHES FROM THE FLEET";
  title.style.cssText = [
    "font-size:" + (mob ? "13px" : "16px"), "font-weight:bold",
    "color:" + T.gold, "margin-bottom:" + (mob ? "10px" : "18px"),
    "letter-spacing:5px", "text-shadow:0 2px 8px rgba(0,0,0,0.8)",
    "font-family:" + FONT, "text-transform:uppercase"
  ].join(";");
  overlay.appendChild(title);

  var row = document.createElement("div");
  row.style.cssText = [
    "display:flex",
    "flex-direction:row",
    "gap:" + (mob ? "8px" : "16px"),
    "align-items:stretch", "justify-content:center",
    "max-width:" + (mob ? "95vw" : "900px"),
    "padding:" + (mob ? "0 8px" : "0 12px"),
    "width:100%"
  ].join(";");

  cardEls = [];
  for (var i = 0; i < 3; i++) {
    var card = _buildCard(mob, i);
    row.appendChild(card.el);
    cardEls.push(card);
  }

  overlay.appendChild(row);
  document.body.appendChild(overlay);
}

function _buildCard(mob, idx) {
  var el = document.createElement("div");
  el.style.cssText = [
    "position:relative", "cursor:pointer", "pointer-events:auto",
    "border-radius:var(--oo-radius-lg)",
    "flex:1",
    mob ? "min-width:0;max-width:200px" : "min-width:220px;max-width:280px",
    "background:" + T.bg,
    PARCHMENT_SHADOW,
    "border:1px solid var(--oo-gold-dim)",
    "padding:" + (mob ? "12px 10px" : "20px 16px"),
    "display:flex",
    "flex-direction:column", "align-items:center", "gap:" + (mob ? "6px" : "10px"),
    "transition:transform 0.2s,box-shadow 0.2s,opacity 0.25s",
    "box-sizing:border-box"
  ].join(";");

  var iconEl = document.createElement("div");
  iconEl.style.cssText = [
    "font-size:" + (mob ? "36px" : "48px"),
    "line-height:1", "flex-shrink:0",
    "margin-bottom:" + (mob ? "2px" : "4px")
  ].join(";");

  var labelEl = document.createElement("div");
  labelEl.style.cssText = [
    "font-size:" + (mob ? "14px" : "18px"), "font-weight:bold",
    "color:" + T.text, "text-align:center",
    "font-family:" + FONT, "letter-spacing:1px",
    "line-height:1.2"
  ].join(";");

  var descEl = document.createElement("div");
  descEl.style.cssText = [
    "font-size:" + (mob ? "11px" : "13px"), "color:" + T.textDim,
    "text-align:center", "line-height:1.4",
    "font-family:" + FONT_UI
  ].join(";");

  var tierEl = document.createElement("div");
  tierEl.style.cssText = [
    "font-size:" + (mob ? "9px" : "10px"), "color:" + T.textDim,
    "letter-spacing:2px", "text-align:center",
    "font-family:" + FONT_UI, "text-transform:uppercase",
    "margin-top:auto"
  ].join(";");

  el.appendChild(iconEl);
  el.appendChild(labelEl);
  el.appendChild(descEl);
  el.appendChild(tierEl);

  // hover effects (desktop)
  el.addEventListener("mouseenter", function () {
    if (!_visible) return;
    el.style.transform = "scale(1.04)";
    el.style.boxShadow = "0 0 20px rgba(200,152,42,0.35),inset 0 1px 0 rgba(200,152,42,0.25),0 0 40px rgba(8,12,18,0.8)";
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
    // reset state from any previous pick animation
    card.el.style.opacity = "1";
    card.el.style.transform = "";
    card.el.style.animation = "";

    if (i < cards.length) {
      var c = cards[i];
      card.iconEl.textContent = c.icon || "\u2b50";
      card.labelEl.textContent = c.label || "";
      card.descEl.textContent = c.desc || "";
      card.tierEl.textContent = c.tier ? ("TIER " + c.tier) : "";
      card.el.style.borderColor = c.color || "var(--oo-gold-dim)";
      card.el.style.display = "";

      // staggered fall-in animation
      // force reflow to restart animation
      void card.el.offsetWidth;
      card.el.style.animation = "oo-fall 0.4s var(--oo-ease-spring) " + (i * 200) + "ms both";

      // attach click with captured card data and index
      card.el.onclick = (function (picked, pickedIdx) {
        return function () {
          if (!_visible) return;
          _animateSelection(pickedIdx);
          setTimeout(function () {
            hideCardPicker();
            if (_onPick) _onPick(picked);
          }, 320);
        };
      })(c, i);
    } else {
      card.el.style.display = "none";
    }
  }

  overlay.style.display = "flex";
}

function _animateSelection(chosenIdx) {
  for (var i = 0; i < cardEls.length; i++) {
    var card = cardEls[i];
    if (card.el.style.display === "none") continue;
    if (i === chosenIdx) {
      // chosen: scale up then settle, add gold glow
      card.el.style.transition = "transform 0.15s var(--oo-ease-spring),box-shadow 0.15s,opacity 0.25s";
      card.el.style.transform = "scale(1.05)";
      card.el.style.boxShadow = "0 0 16px rgba(200,152,42,0.4),0 0 40px rgba(8,12,18,0.8),inset 0 1px 0 rgba(200,152,42,0.25)";
      card.el.style.borderColor = T.gold;
    } else {
      // others: fade out and slide slightly away
      card.el.style.transition = "opacity 0.25s,transform 0.25s";
      card.el.style.opacity = "0.2";
      var dir = i < chosenIdx ? "-1" : "1";
      card.el.style.transform = "translateX(" + (parseInt(dir) * 12) + "px)";
    }
  }
}

export function hideCardPicker() {
  _visible = false;
  if (overlay) overlay.style.display = "none";
}

export function isCardPickerVisible() {
  return _visible;
}
