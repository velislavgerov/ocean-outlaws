# UI Redesign — Comprehensive Screens & HUD Upgrade Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Full redesign of all game screens, HUD, and interactions with a cinematic/prestige visual language (dark naval, Sea of Thieves / Black Flag aesthetic), dual-native desktop + landscape-mobile layouts, selective theatrical animation.

**Architecture:** Three-phase approach: (1) CSS foundation + token system, (2) three hero screens that establish the visual language, (3) cascade to all remaining screens and HUD. All screens remain as separate JS modules with inline style overrides where needed; structural layout moves to shared CSS classes in `game/css/ui.css`.

**Tech Stack:** Vanilla JS (ES modules), inline CSS via `style.cssText`, new shared `game/css/ui.css` for tokens + keyframes + utility classes, Cinzel (Google Fonts, already loaded) + Inter (system stack), Playwright smoke tests (`npm test`).

**Design reference:** `docs/plans/2026-03-01-ui-redesign-design.md` — read it before each task.

**Key conventions:**
- Use `var` (not `let`/`const`) throughout
- Mobile is **always landscape** — `isMobile()` means wide-short viewport (~667×375)
- Smoke tests: `npm test` (6 tests, ~37s) — run after every phase
- Commit after every task

---

## Phase 1 — Foundation

### Task 1: Create `game/css/ui.css`

**Files:**
- Create: `game/css/ui.css`

**Step 1: Create the file**

```css
/* ui.css — Ocean Outlaws design system tokens and shared animation keyframes */

/* ── Design Tokens ────────────────────────────────────────────── */
:root {
  /* Backgrounds */
  --oo-bg-void:      #080c12;
  --oo-bg-surface:   #0f1520;
  --oo-bg-raised:    #1a2235;
  --oo-bg-scrim:     rgba(8, 12, 18, 0.85);

  /* Text */
  --oo-text-primary:   #d4c9a8;
  --oo-text-secondary: #7a8a9a;
  --oo-text-muted:     #3d4f63;

  /* Accent */
  --oo-gold:        #c8982a;
  --oo-gold-bright: #f0c84a;
  --oo-gold-dim:    #6b4e14;

  /* Status */
  --oo-hull:    #4caf7a;
  --oo-danger:  #c0392b;
  --oo-warning: #c8782a;
  --oo-special: #5b8dd9;

  /* Typography */
  --oo-font-display: 'Cinzel', 'Palatino Linotype', Georgia, serif;
  --oo-font-ui:      Inter, 'Segoe UI', system-ui, sans-serif;
  --oo-font-mono:    'Courier New', Courier, monospace;

  /* Spacing */
  --oo-space-1:  4px;
  --oo-space-2:  8px;
  --oo-space-3: 12px;
  --oo-space-4: 16px;
  --oo-space-6: 24px;
  --oo-space-8: 32px;

  /* Radius */
  --oo-radius-sm: 2px;
  --oo-radius-md: 4px;
  --oo-radius-lg: 8px;

  /* Easing */
  --oo-ease-std:      cubic-bezier(0.4, 0, 0.2, 1);
  --oo-ease-spring:   cubic-bezier(0.16, 1, 0.3, 1);
  --oo-ease-dramatic: cubic-bezier(0.22, 1, 0.36, 1);

  /* Durations */
  --oo-dur-fast:     150ms;
  --oo-dur-std:      300ms;
  --oo-dur-slow:     600ms;
  --oo-dur-dramatic: 1200ms;
}

/* ── Keyframe Animations ──────────────────────────────────────── */
@keyframes oo-rise {
  from { opacity: 0; transform: translateY(24px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes oo-fade {
  from { opacity: 0; }
  to   { opacity: 1; }
}

@keyframes oo-fall {
  from { opacity: 0; transform: translateY(-24px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes oo-glow-pulse {
  0%, 100% { opacity: 0.6; }
  50%       { opacity: 1; }
}

@keyframes oo-count-in {
  from { opacity: 0; transform: scale(0.85); }
  to   { opacity: 1; transform: scale(1); }
}

@keyframes oo-draw-line {
  from { transform: scaleX(0); transform-origin: left; }
  to   { transform: scaleX(1); transform-origin: left; }
}

@keyframes oo-underline-in {
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
}

/* ── Utility Classes ──────────────────────────────────────────── */

/* Dark glass panel */
.oo-panel {
  background: var(--oo-bg-surface);
  border: 1px solid var(--oo-gold-dim);
  box-shadow:
    0 0 40px rgba(8, 12, 18, 0.8),
    inset 0 1px 0 rgba(200, 152, 42, 0.15);
}

/* Ghost button — text only with animated underline */
.oo-btn {
  position: relative;
  display: inline-block;
  background: none;
  border: none;
  color: var(--oo-text-primary);
  font-family: var(--oo-font-display);
  font-size: 18px;
  letter-spacing: 0.08em;
  cursor: pointer;
  padding: 8px 0;
  text-transform: uppercase;
  user-select: none;
  transition: color var(--oo-dur-std) var(--oo-ease-std);
}

.oo-btn::after {
  content: '';
  position: absolute;
  bottom: 0; left: 0;
  width: 100%; height: 1px;
  background: var(--oo-gold);
  transform: scaleX(0);
  transform-origin: center;
  transition: transform var(--oo-dur-std) var(--oo-ease-std);
}

.oo-btn:hover { color: var(--oo-gold-bright); }
.oo-btn:hover::after { transform: scaleX(1); }

.oo-btn:focus-visible {
  outline: none;
  box-shadow: -3px 0 0 var(--oo-gold);
  color: var(--oo-gold);
}

/* Ghost button with visible border (mobile touch targets) */
.oo-btn-outline {
  border: 1px solid var(--oo-gold-dim) !important;
  border-radius: var(--oo-radius-md) !important;
  padding: 0 var(--oo-space-4) !important;
  min-height: 52px !important;
}

/* Full-screen dark scrim */
.oo-scrim {
  position: fixed;
  inset: 0;
  background: var(--oo-bg-scrim);
  z-index: 170;
}

/* Divider line */
.oo-divider {
  border: none;
  border-top: 1px solid var(--oo-gold-dim);
  margin: var(--oo-space-4) 0;
}

/* Tab strip */
.oo-tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--oo-gold-dim);
  margin-bottom: var(--oo-space-4);
}

.oo-tab {
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--oo-text-secondary);
  font-family: var(--oo-font-ui);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: var(--oo-space-2) var(--oo-space-4);
  cursor: pointer;
  transition: color var(--oo-dur-fast), border-color var(--oo-dur-fast);
  margin-bottom: -1px;
}

.oo-tab:hover { color: var(--oo-text-primary); }

.oo-tab.active {
  color: var(--oo-gold);
  border-bottom-color: var(--oo-gold);
}

/* Thin progress bar track */
.oo-bar-track {
  height: 3px;
  background: var(--oo-bg-raised);
  border-radius: var(--oo-radius-sm);
  overflow: hidden;
}

.oo-bar-fill {
  height: 100%;
  border-radius: var(--oo-radius-sm);
  transition: width var(--oo-dur-std) var(--oo-ease-std);
}
```

**Step 2: Verify the file exists**

```bash
ls game/css/ui.css
```

Expected: file path printed.

**Step 3: Commit**

```bash
git add game/css/ui.css
git commit -m "feat: add ui.css design tokens, keyframes, utility classes"
```

---

### Task 2: Overhaul `theme.js`

**Files:**
- Modify: `game/js/theme.js` (full rewrite — 101 lines)

**Step 1: Replace file contents**

The new `theme.js` keeps all existing exports so callers don't break, but updates the values to the new palette and adds `injectTokens()`:

```javascript
// theme.js — cinematic/prestige design system
// Exports: T (color aliases), FONT, PARCHMENT_BG, PARCHMENT_SHADOW, SCROLL_BG, BTN_BASE
// Also writes CSS custom properties to :root for ui.css consumers

var _themeInjected = false;
function injectTheme() {
  if (_themeInjected) return;
  _themeInjected = true;

  // Load Cinzel from Google Fonts (Inter is system-stack, no request needed)
  var style = document.createElement("style");
  style.textContent = "@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&display=swap');";
  document.head.appendChild(style);
}
injectTheme();

export var FONT = "'Cinzel', 'Palatino Linotype', Georgia, serif";
export var FONT_UI = "Inter, 'Segoe UI', system-ui, sans-serif";
export var FONT_MONO = "'Courier New', Courier, monospace";

// New cinematic palette — also used as CSS var values in ui.css
// Aliases map old T.* names so callers (portScreen, infamyScreen, etc.) work without changes
export var T = {
  // backgrounds (mapped to new tokens)
  bg:         "rgba(15, 21, 32, 0.92)",     // --oo-bg-surface with alpha
  bgLight:    "rgba(26, 34, 53, 0.85)",     // --oo-bg-raised with alpha
  bgDark:     "rgba(8, 12, 18, 0.96)",      // --oo-bg-void with alpha
  bgOverlay:  "rgba(8, 12, 18, 0.85)",      // --oo-bg-scrim

  // borders
  border:       "rgba(107, 78, 20, 0.5)",   // --oo-gold-dim with alpha
  borderActive: "rgba(200, 152, 42, 0.6)",  // --oo-gold with alpha
  borderGold:   "rgba(200, 152, 42, 0.8)",  // --oo-gold brighter

  // text
  text:      "#d4c9a8",   // --oo-text-primary
  textDim:   "#7a8a9a",   // --oo-text-secondary
  textLight: "#f0c84a",   // --oo-gold-bright (was cream, now bright gold)
  textDark:  "#3d4f63",   // --oo-text-muted

  // accents
  gold:       "#c8982a",  // --oo-gold
  goldBright: "#f0c84a",  // --oo-gold-bright
  cream:      "#d4c9a8",  // --oo-text-primary (repurposed)
  brown:      "#6b4e14",  // --oo-gold-dim
  brownDark:  "#0f1520",  // --oo-bg-surface
  navy:       "#080c12",  // --oo-bg-void
  navyLight:  "#1a2235",  // --oo-bg-raised

  // status
  green:      "#4caf7a",  // --oo-hull
  greenBright:"#6dcf9a",
  red:        "#c0392b",  // --oo-danger
  redBright:  "#e05040",
  amber:      "#c8782a",  // --oo-warning
  blue:       "#5b8dd9",  // --oo-special
  blueBright: "#7aaff0",
  purple:     "#8a5aaa",
  cyan:       "#4a8a9a",

  // specific (keep original names)
  hullGreen:  "#4caf7a",
  windAmber:  "#c8782a",
  portGreen:  "#4caf7a"
};

// Dark glass panel background (replaces PARCHMENT_BG)
export var PARCHMENT_BG = "background:" + T.bg;

// Dark glass shadow (replaces PARCHMENT_SHADOW)
export var PARCHMENT_SHADOW = [
  "box-shadow:",
  "0 0 40px rgba(8,12,18,0.8),",
  "inset 0 1px 0 rgba(200,152,42,0.15)"
].join("");

// Banner background (replaces SCROLL_BG)
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
```

**Step 2: Verify smoke tests still pass**

```bash
npm test
```

Expected: 6 passed, 0 failed. If any fail, the palette change broke a color reference — check console output.

**Step 3: Commit**

```bash
git add game/js/theme.js
git commit -m "feat: overhaul theme.js with cinematic dark palette, keep exports compatible"
```

---

### Task 3: Load `ui.css` in `game/index.html`

**Files:**
- Modify: `game/index.html` (lines 7–13 — add stylesheet link)

**Step 1: Add link to `ui.css` after the manifest link**

In `<head>`, after `<link rel="manifest" href="manifest.json">`, add:

```html
<link rel="stylesheet" href="./css/ui.css">
```

**Step 2: Update the inline `<style>` block body background to use new token**

Change:
```css
background: radial-gradient(circle at 20% 20%, #15304a 0%, #0a1521 60%, #050b12 100%);
```
To:
```css
background: var(--oo-bg-void);
```

**Step 3: Update loading screen inline style to use new palette**

The `#loading-screen` div (line 96) currently uses `#0a0e1a` background and `#ffcc44` color. Update:
- `background:#0a0e1a` → `background:var(--oo-bg-void)`
- `color:#8899aa` → `color:var(--oo-text-secondary)`
- Loading bar `background:#ffcc44` → `background:var(--oo-gold)`
- Title `color:#ffcc44` → `color:var(--oo-gold)`

Note: `var()` works in inline styles for elements that appear after `<link rel="stylesheet">` loads. But since `#loading-screen` is inline and the stylesheet loads synchronously, this is safe.

**Step 4: Verify smoke tests pass**

```bash
npm test
```

Expected: 6 passed, 0 failed.

**Step 5: Commit**

```bash
git add game/index.html
git commit -m "feat: load ui.css in index.html, update loading screen to use design tokens"
```

---

## Phase 2 — Hero Screens

### Task 4: Redesign `mainMenu.js`

**Files:**
- Modify: `game/js/mainMenu.js` (full rewrite — 101 lines)

**Design spec:** See Section 3 of `docs/plans/2026-03-01-ui-redesign-design.md`.

Key decisions:
- No background panel — text floats over the ocean world
- Radial dark scrim (edges dark, center transparent) replaces solid background
- Desktop: centered column, Cinzel 72px title, ghost buttons with animated underline
- Mobile landscape: two-column layout (title left, buttons right)
- Buttons renamed: "NEW VOYAGE", "CONTINUE", "SETTINGS" (new tertiary button)
- Entry animation: title drifts up 16px over 1200ms, buttons stagger in 150ms apart
- The settings button calls a new optional `onSettings` callback

**Step 1: Write the new `mainMenu.js`**

```javascript
// mainMenu.js — cinematic main menu floating over ocean world
import { isMobile } from "./mobile.js";
import { T, FONT, FONT_UI } from "./theme.js";

var overlay = null;
var continueBtn = null;
var newRunCallback = null;
var continueRunCallback = null;
var settingsCallback = null;

export function createMainMenu() {
  var _mob = isMobile();
  overlay = document.createElement("div");
  // No solid background — radial scrim only
  overlay.style.cssText = [
    "position:fixed",
    "top:0", "left:0",
    "width:100%", "height:100%",
    "display:none",
    _mob ? "flex-direction:row" : "flex-direction:column",
    "align-items:center",
    _mob ? "justify-content:space-around" : "justify-content:center",
    // Radial scrim: transparent center, dark edges
    "background:radial-gradient(ellipse at center, rgba(8,12,18,0.3) 0%, rgba(8,12,18,0.85) 100%)",
    "z-index:250",
    "user-select:none",
    _mob ? "padding:0 env(safe-area-inset-right,20px) 0 env(safe-area-inset-left,20px)" : ""
  ].join(";");

  if (_mob) {
    _buildMobileLayout();
  } else {
    _buildDesktopLayout();
  }

  document.body.appendChild(overlay);
}

function _buildDesktopLayout() {
  // Vertical divider line
  var divider = document.createElement("div");
  divider.style.cssText = [
    "width:1px", "height:48px",
    "background:" + T.border,
    "margin-bottom:16px"
  ].join(";");
  overlay.appendChild(divider);

  var titleBlock = _makeTitleBlock(false);
  overlay.appendChild(titleBlock);

  var line = document.createElement("div");
  line.style.cssText = "width:200px;height:1px;background:" + T.border + ";margin:8px auto 24px";
  overlay.appendChild(line);

  var btnWrap = document.createElement("div");
  btnWrap.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:8px";
  overlay.appendChild(btnWrap);

  var newBtn = _makeGhostBtn("NEW VOYAGE", false, 18, T.gold);
  newBtn.addEventListener("click", function() { if (newRunCallback) newRunCallback(); });
  btnWrap.appendChild(newBtn);

  continueBtn = _makeGhostBtn("CONTINUE", false, 18, T.text);
  continueBtn.addEventListener("click", function() { if (continueRunCallback) continueRunCallback(); });
  btnWrap.appendChild(continueBtn);

  var settingsBtn = _makeGhostBtn("SETTINGS", false, 14, T.textDim);
  settingsBtn.style.marginTop = "8px";
  settingsBtn.addEventListener("click", function() { if (settingsCallback) settingsCallback(); });
  btnWrap.appendChild(settingsBtn);

  var version = document.createElement("div");
  version.style.cssText = [
    "position:fixed", "bottom:16px", "right:16px",
    "font-family:" + FONT_UI,
    "font-size:11px",
    "color:" + T.textDark,
    "letter-spacing:0.04em"
  ].join(";");
  version.textContent = "\u00a9 OCEAN OUTLAWS";
  overlay.appendChild(version);
}

function _buildMobileLayout() {
  // Left column: title
  var left = document.createElement("div");
  left.style.cssText = [
    "display:flex", "flex-direction:column", "justify-content:center",
    "flex:1", "padding:16px"
  ].join(";");

  var titleBlock = _makeTitleBlock(true);
  left.appendChild(titleBlock);
  overlay.appendChild(left);

  // Vertical divider
  var vDivider = document.createElement("div");
  vDivider.style.cssText = "width:1px;height:60%;background:" + T.border + ";align-self:center";
  overlay.appendChild(vDivider);

  // Right column: buttons
  var right = document.createElement("div");
  right.style.cssText = [
    "display:flex", "flex-direction:column", "justify-content:center",
    "gap:10px", "flex:1", "padding:16px"
  ].join(";");

  var newBtn = _makeGhostBtn("NEW VOYAGE", true, 16, T.gold);
  newBtn.addEventListener("click", function() { if (newRunCallback) newRunCallback(); });
  right.appendChild(newBtn);

  continueBtn = _makeGhostBtn("CONTINUE", true, 16, T.text);
  continueBtn.addEventListener("click", function() { if (continueRunCallback) continueRunCallback(); });
  right.appendChild(continueBtn);

  var settingsBtn = _makeGhostBtn("SETTINGS", true, 13, T.textDim);
  settingsBtn.addEventListener("click", function() { if (settingsCallback) settingsCallback(); });
  right.appendChild(settingsBtn);

  overlay.appendChild(right);
}

function _makeTitleBlock(_mob) {
  var block = document.createElement("div");

  var title = document.createElement("div");
  title.textContent = "OCEAN OUTLAWS";
  title.style.cssText = [
    "font-family:" + FONT,
    "font-size:" + (_mob ? "36px" : "72px"),
    "font-weight:700",
    "color:" + T.gold,
    "letter-spacing:0.12em",
    "text-shadow:0 2px 16px rgba(200,152,42,0.4), 0 4px 32px rgba(0,0,0,0.8)",
    "line-height:1",
    "margin-bottom:8px",
    _mob ? "text-align:left" : "text-align:center"
  ].join(";");
  block.appendChild(title);

  var sub = document.createElement("div");
  sub.textContent = "NAVAL COMBAT \u2022 ROGUELITE";
  sub.style.cssText = [
    "font-family:" + FONT_UI,
    "font-size:" + (_mob ? "11px" : "13px"),
    "color:" + T.textDim,
    "letter-spacing:0.1em",
    "text-transform:uppercase",
    _mob ? "text-align:left" : "text-align:center"
  ].join(";");
  block.appendChild(sub);

  return block;
}

function _makeGhostBtn(label, _mob, size, color) {
  var btn = document.createElement("button");
  btn.textContent = label;
  btn.className = "oo-btn" + (_mob ? " oo-btn-outline" : "");
  btn.style.cssText = [
    "font-family:" + FONT,
    "font-size:" + size + "px",
    "color:" + color,
    "letter-spacing:0.08em",
    "padding:8px 0",
    _mob ? "width:100%;min-height:52px;padding:0 16px" : "",
    "background:none",
    _mob ? "border:1px solid " + T.border : "border:none",
    "cursor:pointer",
    "user-select:none",
    "pointer-events:auto"
  ].join(";");
  return btn;
}

function _animateEntry() {
  // Title: drift up from +16px over 1200ms
  var titleEl = overlay.querySelector("div");
  if (titleEl) {
    titleEl.style.animation = "oo-rise 1.2s var(--oo-ease-spring) forwards";
  }
  // Buttons: stagger in 150ms apart after 400ms delay
  var btns = overlay.querySelectorAll("button");
  for (var i = 0; i < btns.length; i++) {
    (function(btn, idx) {
      btn.style.opacity = "0";
      setTimeout(function() {
        btn.style.transition = "opacity 0.4s ease";
        btn.style.opacity = "1";
      }, 400 + idx * 150);
    })(btns[i], i);
  }
}

export function showMainMenu(onNewRun, onContinueRun, hasContinue, onSettings) {
  newRunCallback = onNewRun;
  continueRunCallback = onContinueRun;
  settingsCallback = onSettings || null;
  if (continueBtn) {
    continueBtn.style.display = hasContinue ? "" : "none";
  }
  if (overlay) {
    overlay.style.display = "flex";
    _animateEntry();
  }
}

export function hideMainMenu() {
  if (overlay) overlay.style.display = "none";
}
```

**Step 2: Check if `main.js` passes a 4th argument to `showMainMenu`**

```bash
grep -n "showMainMenu" game/js/main.js
```

If it only passes 3 arguments, the optional `onSettings` parameter is fine (it'll be `undefined`, handled with `|| null`).

**Step 3: Verify smoke tests pass**

```bash
npm test
```

Expected: 6 passed.

**Step 4: Commit**

```bash
git add game/js/mainMenu.js
git commit -m "feat: redesign main menu — cinematic floating layout, ghost buttons, landscape mobile"
```

---

### Task 5: Redesign `infamyScreen.js`

**Files:**
- Modify: `game/js/infamyScreen.js` (full rewrite — 226 lines)

**Design spec:** See Section 4 of `docs/plans/2026-03-01-ui-redesign-design.md`.

Key decisions:
- Desktop: centered dark-glass panel, `max-width:480px`
- Mobile landscape: full-width, two-column (left=verdict+CTA, right=stats)
- Theatrical animation sequence (8 timed stages using `setTimeout`)
- New vocabulary: "CAPTAIN FALLEN" / "LEGEND SAILS ON", "RETURN TO PORT"
- Stats count up using `requestAnimationFrame` easing

**Step 1: Write the new `infamyScreen.js`**

```javascript
// infamyScreen.js — cinematic end-of-run summary (The Captain's Log)
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

  // Build panel
  var panel = document.createElement("div");
  panel.className = "oo-panel";
  panel.style.cssText = [
    _mob
      ? "width:calc(100% - 32px);max-width:100%;display:flex;flex-direction:row"
      : "width:460px;display:flex;flex-direction:column",
    "border-radius:var(--oo-radius-lg)",
    "overflow:hidden",
    "opacity:0",
    "transform:translateY(40px)"
  ].join(";");

  if (_mob) {
    // Landscape two-column layout
    var leftCol = _makeLeftCol(isVictory, data, progress, true);
    var vDivider = document.createElement("div");
    vDivider.style.cssText = "width:1px;background:" + T.border + ";align-self:stretch;margin:20px 0";
    var rightCol = _makeRightCol(data, progress, true);
    panel.appendChild(leftCol);
    panel.appendChild(vDivider);
    panel.appendChild(rightCol);
  } else {
    var singleCol = _makeSingleCol(isVictory, data, progress);
    panel.appendChild(singleCol);
  }

  overlay.appendChild(panel);

  // Run theatrical animation sequence
  _animateReveal(panel, data, isVictory);
}

function _makeLeftCol(isVictory, data, progress, _mob) {
  var col = document.createElement("div");
  col.style.cssText = "flex:1;padding:24px 20px;display:flex;flex-direction:column;justify-content:center";

  var eyebrow = document.createElement("div");
  eyebrow.textContent = "VOYAGE ENDED";
  eyebrow.style.cssText = _eyebrowStyle();
  col.appendChild(eyebrow);

  var verdict = _makeVerdict(isVictory, "28px");
  col.appendChild(verdict);

  var fleet = document.createElement("div");
  fleet.textContent = "Fleet " + (data.zonesReached || 0) + " cleared";
  fleet.style.cssText = [
    "font-family:" + FONT_UI, "font-size:13px",
    "color:" + T.textDim, "margin-top:8px", "margin-bottom:20px"
  ].join(";");
  col.appendChild(fleet);

  var btn = _makeContinueBtn(true);
  col.appendChild(btn);

  return col;
}

function _makeRightCol(data, progress, _mob) {
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

  var eyebrow = document.createElement("div");
  eyebrow.textContent = "VOYAGE ENDED";
  eyebrow.style.cssText = _eyebrowStyle();
  col.appendChild(eyebrow);

  var verdict = _makeVerdict(isVictory, "48px");
  col.appendChild(verdict);

  var fleet = document.createElement("div");
  fleet.textContent = "Fleet " + (data.zonesReached || 0) + " cleared";
  fleet.style.cssText = [
    "font-family:" + FONT_UI, "font-size:14px",
    "color:" + T.textDim, "margin:8px 0 24px"
  ].join(";");
  col.appendChild(fleet);

  var divider1 = document.createElement("hr");
  divider1.className = "oo-divider";
  col.appendChild(divider1);

  var rows = _buildStatRows(data);
  for (var i = 0; i < rows.length; i++) {
    col.appendChild(_makeStatRow(rows[i].label, rows[i].value, rows[i].color, "14px"));
  }

  var divider2 = document.createElement("hr");
  divider2.className = "oo-divider";
  col.appendChild(divider2);

  col.appendChild(_makeStatRow("INFAMY EARNED", "+" + (data.infamyEarned || 0), T.gold, "16px"));
  col.appendChild(_makeProgressBar(progress));

  var btn = _makeContinueBtn(false);
  col.appendChild(btn);

  return col;
}

function _eyebrowStyle() {
  return [
    "font-family:" + FONT_UI, "font-size:11px", "font-weight:500",
    "letter-spacing:0.1em", "text-transform:uppercase",
    "color:" + T.textDim, "margin-bottom:8px"
  ].join(";");
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

  var pct = 0;
  if (progress && progress.next !== null) {
    pct = Math.min(100, ((progress.current - progress.threshold) / (progress.next - progress.threshold)) * 100);
  }

  track.appendChild(fill);
  wrap.appendChild(track);

  var lbl = document.createElement("div");
  lbl.style.cssText = [
    "font-family:" + FONT_UI, "font-size:11px",
    "color:" + T.textDim, "margin-top:4px", "text-align:right"
  ].join(";");
  lbl.textContent = "Level " + (progress ? progress.level : 1);
  wrap.appendChild(lbl);

  // Animate bar fill after a delay
  setTimeout(function() {
    fill.style.width = pct + "%";
  }, 3600);

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

// Theatrical animation sequence
function _animateReveal(panel, data, isVictory) {
  // Stage 1 (0ms): scrim fades in
  overlay.style.transition = "opacity 0.6s ease";
  requestAnimationFrame(function() {
    overlay.style.opacity = "1";
  });

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
```

**Step 2: Verify smoke tests pass**

```bash
npm test
```

Expected: 6 passed.

**Step 3: Commit**

```bash
git add game/js/infamyScreen.js
git commit -m "feat: redesign infamy screen — Captain's Log with theatrical reveal animation"
```

---

### Task 6: Redesign `portScreen.js`

**Files:**
- Modify: `game/js/portScreen.js` (full rewrite — 494 lines)

**Design spec:** See Section 5 of `docs/plans/2026-03-01-ui-redesign-design.md`.

Key decisions:
- Dark glass panel (`max-width:640px` desktop, full-width mobile landscape)
- Header: port name (Cinzel 28px) + gold counter + ghost LEAVE button
- Tabs use `.oo-tab` / `.oo-tabs` CSS classes
- Items: ledger rows (name left, cost right), description below in fog-gray
- Unaffordable items: 40% opacity, cost in red
- Animation: panel slides up from bottom (600ms spring)
- Keep all existing data props (`createPortScreen(state)`, `showPortScreen(state, cb)`, `hidePortScreen()`)

**Step 1: Read the full portScreen.js to understand all existing sections and props before rewriting**

```bash
wc -l game/js/portScreen.js
```

Then: `Read game/js/portScreen.js` fully to understand `createPortScreen`, `showPortScreen`, `updatePortScreen`, tab system, repair section, upgrade sections, tech section — map all the data structures before rewriting.

**Step 2: Write the new portScreen.js**

The rewrite must preserve:
- All exported functions: `createPortScreen()`, `showPortScreen(state, cb)`, `hidePortScreen()`, `updatePortHpDisplay(hp, maxHp)`, `updatePortGold(gold)`
- All state fields: `upgrades`, `hpInfo`, `classKey`, `gold`, `portName`
- All tab content: REPAIRS, ARMAMENTS (weapons), UPGRADES (hull/speed/etc.), TECH

Structure:
```javascript
// portScreen.js — Harbormaster's Ledger (cinematic port shopping)
import { ... } from "./upgrade.js";
import { playUpgrade, playClick } from "./soundFx.js";
import { isMobile } from "./mobile.js";
import { T, FONT, FONT_UI, FONT_MONO } from "./theme.js";

var root = null;
var goldLabel = null;
var repairBtn = null;
var onCloseCallback = null;
var currentState = null;
var activeTab = "repairs";

// Tab definitions — keep same data, new visual treatment
var TABS = ["REPAIRS", "ARMAMENTS", "UPGRADES", "TECH"];

export function createPortScreen() {
  // Build minimal DOM skeleton; content populated in showPortScreen
  root = document.createElement("div");
  root.id = "port-screen";
  // ... (full implementation — see design doc for layout spec)
}

export function showPortScreen(state, callback) {
  currentState = state;
  onCloseCallback = callback;
  // Rebuild content, animate entry
  // ...
}

function _animateEntry() {
  root.style.transform = "translateY(60px)";
  root.style.opacity = "0";
  root.style.display = "flex";
  requestAnimationFrame(function() {
    root.style.transition = "transform 0.6s var(--oo-ease-spring), opacity 0.4s ease";
    root.style.transform = "translateY(0)";
    root.style.opacity = "1";
  });
}

export function hidePortScreen() {
  if (root) root.style.display = "none";
}
```

The full implementation follows the ledger pattern: for each tab, render items as rows with `justify-content: space-between`, dim unaffordable items with `opacity:0.4`, show repair bar using `oo-bar-track` / `oo-bar-fill` classes.

**Step 3: Verify smoke tests pass**

```bash
npm test
```

Expected: 6 passed.

**Step 4: Commit**

```bash
git add game/js/portScreen.js
git commit -m "feat: redesign port screen — Harbormaster's Ledger with slide-up entry animation"
```

---

### Task 7: Phase 2 smoke test gate

**Step 1: Run full test suite**

```bash
npm test
```

Expected: 6 passed, 0 failed.

**Step 2: Visual verification checklist** (open `http://localhost:5173` with `npm run dev`):

- [ ] Main menu floats over ocean — no solid background panel
- [ ] Title "OCEAN OUTLAWS" visible in gold Cinzel
- [ ] Buttons have ghost style (underline on hover desktop, border on mobile)
- [ ] Desktop: centered column. Mobile landscape (dev tools, 667×375): two-column
- [ ] Port screen slides up from bottom on open
- [ ] Port tabs work: REPAIRS, ARMAMENTS, UPGRADES, TECH
- [ ] Unaffordable items dimmed
- [ ] Infamy screen: dark glass panel centered
- [ ] "RETURN TO PORT" button visible

---

## Phase 3 — Full Cascade

### Task 8: Redesign `shipSelect.js`

**Files:**
- Modify: `game/js/shipSelect.js` (full rewrite — 562 lines)

**Design spec:** Section 6 (Ship Select — The Admiralty Roster) of design doc.

**Step 1: Read current shipSelect.js fully before rewriting**

```bash
wc -l game/js/shipSelect.js
```

**Step 2: Key changes to apply**

- Replace parchment card backgrounds with dark glass (`.oo-panel` class or equivalent inline)
- Selected card: `border-color: var(--oo-gold)` + `transform: translateY(-8px)`
- Cards rise staggered on entry: `animation: oo-rise 0.4s var(--oo-ease-spring)` with `animation-delay: 0, 150ms, 300ms`
- Desktop: flex-row, 3 cards side-by-side
- Mobile landscape: `overflow-x:auto; scroll-snap-type:x mandatory` with each card `scroll-snap-align:center`
- Stats: Inter font, fog-gray labels, cream values (keep same data)

**Step 3: Verify smoke tests pass**

```bash
npm test
```

**Step 4: Commit**

```bash
git add game/js/shipSelect.js
git commit -m "feat: redesign ship select — Admiralty Roster with dark glass cards and stagger entry"
```

---

### Task 9: Redesign `cardPicker.js`

**Files:**
- Modify: `game/js/cardPicker.js` (full rewrite — 162 lines)

**Design spec:** Section 6 (Card Picker — Dispatches from the Fleet) of design doc.

**Step 1: Key changes to apply**

- Replace parchment backgrounds with dark glass panels
- Icon: increase canvas draw area to 64px (was likely 48px)
- Card name: Cinzel 20px, `--oo-text-primary`
- Description: Inter 14px, `--oo-text-secondary`
- Selection animation: chosen card `transform:scale(1.05)` briefly, others `opacity:0.2` + slide away
- Entry animation: cards fall from above with stagger — `animation: oo-fall 0.4s var(--oo-ease-spring)` with delays `0ms, 200ms, 400ms`
- Gold border glow on selected: `box-shadow: 0 0 16px rgba(200,152,42,0.4)`
- Mobile landscape: three cards side-by-side (this layout naturally works for landscape)

**Step 2: Verify smoke tests pass**

```bash
npm test
```

**Step 3: Commit**

```bash
git add game/js/cardPicker.js
git commit -m "feat: redesign card picker — Dispatches from the Fleet with dark glass and stagger drop"
```

---

### Task 10: Redesign `settingsMenu.js`

**Files:**
- Modify: `game/js/settingsMenu.js` (significant update — 583 lines)

**Design spec:** Section 6 (Settings — Captain's Orders) of design doc.

**Step 1: Key changes to apply**

- Panel: `320px` wide, anchored top-right below gear icon, dark glass
- Remove any full-screen overlay — panel floats without scrim
- Entry animation: `animation: oo-fall 0.3s ease-out` (drops from gear button)
- Sections: Game Info, Audio, Quality, Danger Zone — clean list, no tabs
- Volume slider: style `appearance:none`, track `background:var(--oo-gold-dim)`, thumb `background:var(--oo-gold)`
- Quality buttons: row of 3 ghost-style buttons with active state `border-color:var(--oo-gold)`
- New Game button: `color:var(--oo-danger)`, `border-color:var(--oo-danger)` (danger zone treatment)
- Mobile landscape: `280px` wide, same anchor

**Step 2: Verify smoke tests pass**

```bash
npm test
```

**Step 3: Commit**

```bash
git add game/js/settingsMenu.js
git commit -m "feat: redesign settings menu — Captain's Orders floating panel with drop animation"
```

---

### Task 11: Redesign `mapScreen.js`

**Files:**
- Modify: `game/js/mapScreen.js` (chrome update — 255 lines)

**Design spec:** Section 6 (Map Screen — Navigation Chart) of design doc.

**Step 1: Key changes — chrome only, canvas map unchanged**

- Outer container: fade in/out (`opacity:0→1`, `300ms`)
- Frame border: `1px solid var(--oo-gold-dim)` with dark glass background
- Legend: single row below map, Inter 12px, fog-gray labels with colored dots
- Close button: ghost style top-right, text "[M] CLOSE"
- Remove bold "Press M to close" text, replace with subtle footer label

**Step 2: Verify smoke tests pass**

```bash
npm test
```

**Step 3: Commit**

```bash
git add game/js/mapScreen.js
git commit -m "feat: update map screen chrome — Navigation Chart dark glass frame with fade"
```

---

### Task 12: Redesign `lobbyScreen.js`

**Files:**
- Modify: `game/js/lobbyScreen.js` (moderate update — 431 lines)

**Design spec:** Section 6 (Lobby — Crew Manifest) of design doc.

**Step 1: Key changes to apply**

- Room code: Cinzel mono-style, `font-size:28px`, centered at top of panel
- Panel: dark glass, `max-width:480px` desktop / full-width mobile landscape
- Player rows: `height:40px`, avatar circle (40px) + name (Inter 14px cream) + class (Inter 12px fog-gray) + READY badge (green/muted)
- Class selector: compact strip of ghost buttons, active = gold border
- READY and START buttons: ghost style, minimum `44px` height
- Entry animation: same `oo-rise` as port screen

**Step 2: Verify smoke tests pass**

```bash
npm test
```

**Step 3: Commit**

```bash
git add game/js/lobbyScreen.js
git commit -m "feat: redesign lobby — Crew Manifest dark glass with rise animation"
```

---

### Task 13: Redesign `hud.js` — floating elements, new ability bar

**Files:**
- Modify: `game/js/hud.js` (significant update — 543 lines)

**Design spec:** Section 7 of design doc.

**Step 1: Read full `hud.js` before making changes**

```bash
wc -l game/js/hud.js
```

**Step 2: Hull/fuel bar changes**

Current: bars inside a panel div with background. New: bars float directly on screen with no container background.

- Remove any `background` from the bars' parent container
- Hull bar: `height:3px` (was `8px`), color `var(--oo-hull)`
- Hull label: hide when full, show "HULL XX" in Inter 11px fog-gray when damaged
- Fuel bar: `height:2px`, `width:80px`, amber, no label unless `fuel < 20%`
- Port proximity label: Inter 11px fog-gray, `text-shadow:0 1px 4px rgba(0,0,0,0.8)` for legibility

**Step 3: Ability bar slot changes**

Each slot (canvas-drawn or DOM):
- Size: `52px` desktop, `44px` mobile landscape
- Per-slot background: `rgba(15,21,32,0.7)` + `1px solid rgba(200,152,42,0.2)` + `border-radius:4px`
- Active slot: border brightens to `rgba(200,152,42,0.8)`
- Key label: Inter 10px fog-gray

**Step 4: Ammo and gold counter changes**

- Ammo: Inter 13px `var(--oo-text-primary)`, mono spacing, red at ≤5
- Gold: replace 💰 emoji with a `●` character in `var(--oo-gold)`, Inter 13px
- Both float directly, `text-shadow:0 1px 4px rgba(0,0,0,0.9)` for legibility

**Step 5: Minimap border**

Change minimap circular border to `1px solid rgba(200,152,42,0.3)`. Remove any background panel.

**Step 6: Banner text**

Update banner to use `font-family:var(--oo-font-display)`, `color:var(--oo-gold)`, `font-size:16px`.

**Step 7: Verify smoke tests pass**

```bash
npm test
```

**Step 8: Commit**

```bash
git add game/js/hud.js
git commit -m "feat: redesign HUD — floating elements, no panels, slimmer bars, dark-glass ability slots"
```

---

### Task 14: Redesign `bossHud.js` and `crewHud.js`

**Files:**
- Modify: `game/js/bossHud.js` (update — 173 lines)
- Modify: `game/js/crewHud.js` (update — 123 lines)

**Step 1: bossHud.js changes**

- Boss bar container: dark glass (`var(--oo-bg-surface)`, `1px solid var(--oo-gold-dim)`)
- Boss name: Cinzel `font-family`, `var(--oo-text-primary)`
- Bar fill: segmented gold (`var(--oo-gold)`)
- Phase indicator: fog-gray Inter 11px
- Entry animation: `oo-fall 0.6s var(--oo-ease-spring)` drops from top

**Step 2: crewHud.js changes**

- Crew icons: circular, `border: 1px solid var(--oo-gold-dim)`, floating (no panel background)
- Tooltip: dark glass popup, Inter 12px, fog-gray labels / cream values
- No background container for the icon row

**Step 3: Verify smoke tests pass**

```bash
npm test
```

**Step 4: Commit**

```bash
git add game/js/bossHud.js game/js/crewHud.js
git commit -m "feat: update boss HUD and crew HUD — dark glass, Cinzel boss name, floating crew icons"
```

---

### Task 15: Update `uiEffects.js`

**Files:**
- Modify: `game/js/uiEffects.js` (update — 267 lines)

**Step 1: Floating damage numbers**

Change font to Inter mono (`var(--oo-font-mono)`). Keep existing color logic (red for damage, gold for crit).

**Step 2: Kill feed**

Update font to Inter 12px, labels use `var(--oo-text-secondary)`, values use `var(--oo-text-primary)`.

**Step 3: Low-hull edge vignette**

Add (or update) the screen-edge vignette when hull is low:
```javascript
// In the low-hull pulse handler:
damageIndicator.style.background =
  "radial-gradient(ellipse at center, transparent 60%, rgba(192,57,43,0.08) 100%)";
```
Max opacity `0.08` — barely perceptible, not jarring.

**Step 4: Verify smoke tests pass**

```bash
npm test
```

**Step 5: Commit**

```bash
git add game/js/uiEffects.js
git commit -m "feat: update UI effects — Inter mono damage numbers, refined edge vignette"
```

---

### Task 16: Final verification pass

**Step 1: Full smoke test suite**

```bash
npm test
```

Expected: 6 passed, 0 failed.

**Step 2: Visual walkthrough** (run `npm run dev`, open `http://localhost:5173`):

Desktop at 1280×800:
- [ ] Main menu: title floats over ocean, ghost buttons, no solid background
- [ ] New Voyage → Ship Select: dark glass cards, stagger entry
- [ ] Select ship → gameplay starts
- [ ] Port screen: ledger layout, tabs switch, repair bar visible
- [ ] Card picker: dark glass panels, drop animation
- [ ] Settings gear → floating panel, no scrim
- [ ] M key → map screen with dark chrome
- [ ] HUD: hull/fuel as thin floating lines, ability slots with dark glass
- [ ] Boss encounter: bar drops from top in Cinzel style
- [ ] Game over → infamy screen: theatrical reveal sequence

Mobile landscape (dev tools, ~667×375 device):
- [ ] Main menu: two-column layout (title left, buttons right)
- [ ] Buttons have visible borders for touch targets
- [ ] Port screen: full-width, compact rows, horizontal tabs
- [ ] Infamy screen: two-column layout
- [ ] HUD: inline hull/fuel top-left, 44px ability slots bottom-right

**Step 3: Fix any visual regressions found during walkthrough, then commit fixes**

**Step 4: Tag the release**

```bash
git tag ui-redesign-v1
```

---

## Appendix — Useful References

**Smoke tests:** `tests/smoke.spec.mjs` — 6 tests, run with `npm test`

**Design doc:** `docs/plans/2026-03-01-ui-redesign-design.md`

**Key imports in every screen module:**
```javascript
import { isMobile } from "./mobile.js";
import { T, FONT, FONT_UI, FONT_MONO } from "./theme.js";
```
Note: `FONT_UI` and `FONT_MONO` are new exports added in Task 2. Verify they exist before importing.

**Mobile landscape assumption:** `isMobile()` returns true when on a mobile device. The game forces landscape via orientation prompt so all mobile layout branches assume wide-short viewports (~667×375 or ~844×390).

**CSS variable usage in inline styles:** CSS `var()` works in `element.style.cssText` strings when the variable is defined on `:root`. For example:
```javascript
el.style.cssText = "color:var(--oo-gold);background:var(--oo-bg-surface)";
```

**Transition on dynamically-created elements:** To animate an element on creation (e.g., rise from below), set initial transform/opacity first, then trigger the transition in a `requestAnimationFrame` callback:
```javascript
el.style.opacity = "0";
el.style.transform = "translateY(40px)";
requestAnimationFrame(function() {
  el.style.transition = "opacity 0.6s ease, transform 0.8s var(--oo-ease-spring)";
  el.style.opacity = "1";
  el.style.transform = "translateY(0)";
});
```
