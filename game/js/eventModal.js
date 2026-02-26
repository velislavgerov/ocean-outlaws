// eventModal.js — narrative event modal used for voyage event nodes

import { isMobile } from "./mobile.js";
import { T, FONT, PARCHMENT_BG, PARCHMENT_SHADOW, BTN_BASE } from "./theme.js";
import { playStoryCue } from "./storyAudio.js";

var activeModal = null;

function removeActiveModal() {
  if (!activeModal) return;
  if (activeModal.parentNode) activeModal.parentNode.removeChild(activeModal);
  activeModal = null;
}

function buildChoiceButton(choice, enabled, onClick) {
  var btn = document.createElement("button");
  btn.textContent = choice.text || "Choose";
  var disabledStyle = enabled ? "" : "opacity:0.5;cursor:not-allowed;";
  btn.style.cssText = [
    BTN_BASE,
    "width:100%",
    "display:block",
    "text-align:left",
    "margin-top:8px",
    "padding:12px 14px",
    "min-height:44px",
    "font-family:" + FONT,
    "font-size:13px",
    "line-height:1.35",
    "background:" + (enabled ? "rgba(28,20,12,0.86)" : "rgba(24,18,12,0.5)"),
    "color:" + (enabled ? T.textLight : T.textDim),
    "border:1px solid " + (enabled ? T.borderGold : T.border),
    "border-radius:6px",
    disabledStyle
  ].join(";");
  btn.disabled = !enabled;
  if (enabled) {
    btn.addEventListener("mouseenter", function () {
      playStoryCue("event_hover", { volume: 0.2 });
      btn.style.borderColor = T.goldBright;
      btn.style.transform = "translateX(3px)";
    });
    btn.addEventListener("mouseleave", function () {
      btn.style.borderColor = T.borderGold;
      btn.style.transform = "translateX(0)";
    });
    btn.addEventListener("click", function () {
      playStoryCue("event_confirm", { volume: 0.5 });
      onClick(choice);
    });
  }
  return btn;
}

export function showEventModal(event, storyState, availability, onChoice, options) {
  removeActiveModal();

  var opts = options || {};
  var _mob = isMobile();
  var regionName = opts.regionLabel || "";

  var overlay = document.createElement("div");
  overlay.style.cssText = [
    "position:fixed",
    "top:0",
    "left:0",
    "width:100%",
    "height:100%",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "padding:" + (_mob ? "10px" : "22px"),
    "background:" + T.bgOverlay,
    "z-index:220",
    "font-family:" + FONT
  ].join(";");

  var card = document.createElement("div");
  card.style.cssText = [
    PARCHMENT_BG,
    PARCHMENT_SHADOW,
    "width:100%",
    "max-width:" + (_mob ? "96vw" : "720px"),
    "max-height:92vh",
    "overflow:auto",
    "padding:" + (_mob ? "14px" : "18px"),
    "border:2px solid " + T.borderGold,
    "border-radius:10px",
    "color:" + T.textLight
  ].join(";");

  var title = document.createElement("div");
  title.textContent = event && event.title ? event.title : "Uncharted Waters";
  title.style.cssText = "font-size:" + (_mob ? "20px" : "24px") + ";font-weight:bold;color:" + T.goldBright + ";letter-spacing:1px;";
  card.appendChild(title);

  var meta = document.createElement("div");
  meta.textContent = regionName ? ("Region: " + regionName) : "";
  meta.style.cssText = "margin-top:4px;font-size:11px;color:" + T.textDim + ";";
  if (meta.textContent) card.appendChild(meta);

  var body = document.createElement("div");
  body.textContent = event && event.body ? event.body : "A strange encounter unfolds across the waves.";
  body.style.cssText = "margin-top:12px;font-size:14px;line-height:1.55;color:" + T.text + ";";
  card.appendChild(body);

  var repLine = document.createElement("div");
  var rep = storyState && storyState.factionRep ? storyState.factionRep : { navy: 0, pirates: 0, merchant: 0 };
  repLine.textContent = "Reputation — Navy: " + rep.navy + " | Pirates: " + rep.pirates + " | Merchant: " + rep.merchant;
  repLine.style.cssText = "margin-top:12px;font-size:11px;color:" + T.textDim + ";";
  card.appendChild(repLine);

  var choicesWrap = document.createElement("div");
  choicesWrap.style.cssText = "margin-top:14px;";
  card.appendChild(choicesWrap);

  var rows = event && Array.isArray(event.choices) ? event.choices : [];
  for (var i = 0; i < rows.length; i++) {
    var choice = rows[i];
    var info = availability && availability[i] ? availability[i] : { enabled: true };
    var btn = buildChoiceButton(choice, !!info.enabled, function (pickedChoice) {
      removeActiveModal();
      if (onChoice) onChoice(pickedChoice);
    });
    choicesWrap.appendChild(btn);
    if (!info.enabled) {
      var req = document.createElement("div");
      req.textContent = "Requirements not met";
      req.style.cssText = "font-size:11px;color:" + T.red + ";margin:2px 0 6px 4px;";
      choicesWrap.appendChild(req);
    }
  }

  overlay.appendChild(card);
  document.body.appendChild(overlay);
  activeModal = overlay;

  playStoryCue(event && event.openCue ? event.openCue : "event_open", { volume: 0.42 });
}

export function hideEventModal() {
  removeActiveModal();
}

export function isEventModalOpen() {
  return !!activeModal;
}

