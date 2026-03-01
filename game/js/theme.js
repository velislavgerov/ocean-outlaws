// theme.js — cinematic/prestige design system (dark naval, Sea of Thieves / Black Flag)
// Exports: T (color aliases), FONT, FONT_UI, FONT_MONO, PARCHMENT_BG, PARCHMENT_SHADOW, SCROLL_BG, BTN_BASE
// All old export names preserved for backward compatibility with existing callers.

var _themeInjected = false;
function injectTheme() {
  if (_themeInjected) return;
  _themeInjected = true;
  // Cinzel loaded from Google Fonts; Inter is system stack (no extra request needed)
  var style = document.createElement("style");
  style.textContent = "@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&display=swap');";
  document.head.appendChild(style);
}
injectTheme();

export var FONT      = "'Cinzel', 'Palatino Linotype', Georgia, serif";
export var FONT_UI   = "Inter, 'Segoe UI', system-ui, sans-serif";
export var FONT_MONO = "'Courier New', Courier, monospace";

// Cinematic palette — dark naval. Old T.* names preserved for callers.
export var T = {
  // backgrounds
  bg:         "rgba(15, 21, 32, 0.92)",
  bgLight:    "rgba(26, 34, 53, 0.85)",
  bgDark:     "rgba(8, 12, 18, 0.96)",
  bgOverlay:  "rgba(8, 12, 18, 0.85)",

  // borders
  border:       "rgba(107, 78, 20, 0.5)",
  borderActive: "rgba(200, 152, 42, 0.6)",
  borderGold:   "rgba(200, 152, 42, 0.8)",

  // text
  text:      "#d4c9a8",
  textDim:   "#7a8a9a",
  textLight: "#f0c84a",
  textDark:  "#3d4f63",

  // accents
  gold:       "#c8982a",
  goldBright: "#f0c84a",
  cream:      "#d4c9a8",
  brown:      "#6b4e14",
  brownDark:  "#0f1520",
  navy:       "#080c12",
  navyLight:  "#1a2235",

  // status
  green:       "#4caf7a",
  greenBright: "#6dcf9a",
  red:         "#c0392b",
  redBright:   "#e05040",
  amber:       "#c8782a",
  blue:        "#5b8dd9",
  blueBright:  "#7aaff0",
  purple:      "#8a5aaa",
  cyan:        "#4a8a9a",

  // specific (legacy names)
  hullGreen: "#4caf7a",
  windAmber: "#c8782a",
  portGreen: "#4caf7a"
};

// Dark glass panel background (replaces old parchment gradient)
export var PARCHMENT_BG = "background:" + T.bg;

// Dark glass shadow
export var PARCHMENT_SHADOW = [
  "box-shadow:",
  "0 0 40px rgba(8,12,18,0.8),",
  "inset 0 1px 0 rgba(200,152,42,0.15)"
].join("");

// Banner/scroll background
export var SCROLL_BG = "background:" + T.bg;

// Button base style
export var BTN_BASE = [
  "font-family:" + FONT,
  "border-radius:4px",
  "cursor:pointer",
  "pointer-events:auto",
  "user-select:none",
  "text-align:center",
  "border:1px solid " + T.border,
  "background:none",
  "color:" + T.text,
  "text-shadow:0 1px 2px rgba(0,0,0,0.4)"
].join(";");
