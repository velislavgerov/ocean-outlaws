// theme.js — shared parchment/nautical color palette and font injection
// CSS-only retheme: warm browns, aged cream, navy blue, gold accents

// inject nautical serif font + base parchment styles
var _themeInjected = false;
function injectTheme() {
  if (_themeInjected) return;
  _themeInjected = true;
  var style = document.createElement("style");
  style.textContent = [
    "@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&display=swap');",
    ".parchment-font, .parchment-font * { font-family: 'Cinzel', 'Palatino Linotype', 'Book Antiqua', Palatino, Georgia, serif !important; }"
  ].join("\n");
  document.head.appendChild(style);
}
injectTheme();

// nautical font stack (serif, pirate-ish feel)
export var FONT = "'Cinzel', 'Palatino Linotype', 'Book Antiqua', Palatino, Georgia, serif";

// parchment/nautical color palette
export var T = {
  // backgrounds
  bg: "rgba(30, 22, 14, 0.85)",
  bgLight: "rgba(60, 45, 28, 0.75)",
  bgDark: "rgba(20, 14, 8, 0.92)",
  bgOverlay: "rgba(20, 14, 8, 0.94)",

  // borders
  border: "rgba(139, 109, 68, 0.45)",
  borderActive: "rgba(180, 140, 80, 0.6)",
  borderGold: "rgba(212, 164, 74, 0.7)",

  // text
  text: "#c4a872",
  textDim: "#8b7a5a",
  textLight: "#e8d5a8",
  textDark: "#5a4a32",

  // accents
  gold: "#d4a44a",
  goldBright: "#f0c860",
  cream: "#f0e6c8",
  brown: "#8b6914",
  brownDark: "#5c4a1e",
  navy: "#1a2a4a",
  navyLight: "#2a3a5a",

  // status
  green: "#5a9a4a",
  greenBright: "#78b868",
  red: "#aa3333",
  redBright: "#cc4444",
  amber: "#c8922a",
  blue: "#4a7a9a",
  blueBright: "#5a9aba",
  purple: "#8a5aaa",
  cyan: "#4a8a9a",

  // specific
  hullGreen: "#6a8a44",
  windAmber: "#c89a2a",
  portGreen: "#5aaa68"
};

// parchment background CSS — simulates aged paper using CSS gradients
export var PARCHMENT_BG = [
  "background: linear-gradient(135deg,",
  "  rgba(60, 45, 28, 0.95) 0%,",
  "  rgba(50, 38, 22, 0.92) 25%,",
  "  rgba(55, 42, 26, 0.94) 50%,",
  "  rgba(45, 34, 20, 0.93) 75%,",
  "  rgba(52, 40, 24, 0.95) 100%)"
].join("");

// rough parchment edge shadow
export var PARCHMENT_SHADOW = "box-shadow: inset 0 0 30px rgba(0,0,0,0.3), 0 2px 12px rgba(0,0,0,0.4)";

// banner/scroll background
export var SCROLL_BG = [
  "background: linear-gradient(180deg,",
  "  rgba(70, 55, 35, 0.95) 0%,",
  "  rgba(55, 42, 26, 0.92) 10%,",
  "  rgba(60, 48, 30, 0.94) 50%,",
  "  rgba(55, 42, 26, 0.92) 90%,",
  "  rgba(70, 55, 35, 0.95) 100%)"
].join("");

// button base style
export var BTN_BASE = [
  "font-family:" + FONT,
  "border-radius:4px",
  "cursor:pointer",
  "pointer-events:auto",
  "user-select:none",
  "text-align:center",
  "border:1px solid " + T.border,
  "background:" + T.bgLight,
  "color:" + T.text,
  "text-shadow:0 1px 2px rgba(0,0,0,0.4)"
].join(";");
