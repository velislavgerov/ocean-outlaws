# UI Redesign — Comprehensive Screens & HUD Upgrade

**Date:** 2026-03-01
**Status:** Approved
**Scope:** Full redesign of all screens, HUD, and interactions with a consistent cinematic/prestige visual language.

---

## Design Decisions

| Question | Decision |
|----------|----------|
| Scope | Full blank-slate redesign — visual, IA, screen flows |
| Aesthetic | Cinematic/prestige — Sea of Thieves meets Black Flag |
| Platform | Dual-native — desktop and landscape mobile both first-class |
| Motion | Selective drama — theatrical for key moments, clean for routine UI |
| Weakest screens | All equally weak — no sacred cows |
| Approach | Hero screens first (main menu, infamy, port), then cascade |

---

## Section 1 — Foundation: CSS Architecture & Design Tokens

### Problem
~4,300 lines of inline `style.cssText` across 16 JS files. No single source of truth for spacing, radius, or timing. `theme.js` has colors only.

### Solution

**New file: `game/css/ui.css`**
- CSS custom properties (design tokens) on `:root`
- `@keyframes` animation definitions
- Shared utility classes (`.oo-panel`, `.oo-btn`, `.oo-label`)

**Expanded `theme.js`**
- Writes tokens to `:root` programmatically (supports runtime quality-tier theming)
- Exports new color palette as `T` object

**Token Categories:**
```css
--oo-color-*       Colors (background, surface, text, accent, danger)
--oo-font-*        Fonts and sizes (display, body, label sizes)
--oo-space-*       Spacing scale (4, 8, 12, 16, 24, 32, 48, 64px)
--oo-radius-*      Border radii (sm: 2px, md: 4px, lg: 8px)
--oo-ease-*        Easing curves (standard, dramatic, spring)
--oo-duration-*    Transition durations (fast: 150ms, std: 300ms, slow: 600ms, dramatic: 1200ms)
```

Screen modules use shared CSS classes for structural layout; per-element overrides remain inline only where necessary.

---

## Section 2 — Visual Language

### Color Palette

**Backgrounds**
```
--oo-color-bg-void      #080c12              Near-black deep ocean (base)
--oo-color-bg-surface   #0f1520              Dark navy (panels, overlays)
--oo-color-bg-raised    #1a2235              Slightly lighter (card surfaces)
--oo-color-bg-scrim     rgba(8,12,18, 0.85)  Full-screen overlays
```

**Text**
```
--oo-color-text-primary    #d4c9a8   Aged cream (primary readable text)
--oo-color-text-secondary  #7a8a9a   Fog gray (labels, secondary info)
--oo-color-text-muted      #3d4f63   Muted slate (disabled states)
```

**Accent**
```
--oo-color-gold         #c8982a   Brass/gold (interactive, active)
--oo-color-gold-bright  #f0c84a   Bright gold (highlights, hover)
--oo-color-gold-dim     #6b4e14   Dim gold (borders, dividers)
```

**Status**
```
--oo-color-hull     #4caf7a   Sea green (health)
--oo-color-danger   #c0392b   Deep red (damage, low resources)
--oo-color-warning  #c8782a   Amber (caution, low fuel)
--oo-color-special  #5b8dd9   Steel blue (class abilities)
```

### Typography

| Role | Font | Size (desktop) | Size (mobile landscape) | Treatment |
|------|------|----------------|------------------------|-----------|
| Display | Cinzel 700 | 48–72px | 32–48px | Letter-spacing 0.12em |
| Heading | Cinzel 400 | 24–36px | 20–28px | Letter-spacing 0.08em |
| UI Label | Inter 500 | 13–16px | 12–14px | Uppercase, letter-spacing 0.06em |
| Body | Inter 400 | 14–16px | 13–15px | Normal case |
| Mono | system monospace | 12–14px | 11–13px | Numbers, counters |

### Surface Treatment

Panels use **dark glass** — no parchment gradients:
```css
background: var(--oo-color-bg-surface);
border: 1px solid var(--oo-color-gold-dim);
box-shadow: 0 0 40px rgba(8,12,18,0.8), inset 0 1px 0 rgba(200,152,42,0.15);
```

### Motion Language

**Routine UI** — `150–300ms ease-out`. Bar updates, tooltips, tab switches.

**Screen transitions** — `300ms ease-in-out` with 8–12px vertical drift. Content slides into position.

**Theatrical moments** — dark scrim first, panel rises, content staggers in, numbers count up.

**Keyframes defined in `ui.css`:**
```css
@keyframes oo-rise       { from { opacity:0; transform: translateY(24px) } }
@keyframes oo-fade       { from { opacity:0 } }
@keyframes oo-glow-pulse { 0%,100% { opacity:0.6 } 50% { opacity:1 } }
@keyframes oo-count-in   { from { opacity:0; transform: scale(0.85) } }
```

---

## Section 3 — Hero Screen: Main Menu

### Concept
Text floats directly over the live 3D ocean world. No panel or box behind the menu. A radial dark scrim (center-transparent, edges dark) frames the composition.

### Vocabulary
- "NEW RUN" → **"NEW VOYAGE"**
- "CONTINUE RUN" → **"CONTINUE"**
- Settings remains tertiary, visually subordinate

### Desktop Layout
```
[ocean world — always rendering behind]
[radial dark scrim overlay]

                    OCEAN OUTLAWS              ← Cinzel 72px, gold
               ─────────────────────          ← 1px gold-dim line
              NAVAL COMBAT • ROGUELITE         ← Inter 13px, fog-gray

                   [ NEW VOYAGE ]              ← Cinzel 18px gold
                   [ CONTINUE  ]              ← Cinzel 18px cream
                   [ SETTINGS  ]              ← Cinzel 14px muted

v0.x.x                            © OCEAN OUTLAWS  ← Inter 11px, muted
```

**Buttons:** Ghost style — text only, fine underline animates from center on hover (`scaleX(0→1)`, 300ms). Keyboard focus: `3px solid gold` left-bar.

**Entry animation:** Title drifts up 16px over 1200ms as loading screen fades. Menu items stagger in 150ms apart.

### Mobile Layout (Landscape ~667×375)
```
[ocean world behind, radial dark vignette]

  OCEAN OUTLAWS      │  [ NEW VOYAGE  ]
  ──────────────     │  [ CONTINUE   ]
  NAVAL COMBAT       │  [ SETTINGS   ]
  ROGUELITE          │

  v0.x.x             │            ©OO
```

Two-column. Left: title block vertically centered, left-anchored. Right: button stack vertically centered. Vertical `1px gold-dim` divider. Buttons full-width of right column, `52px` min-height, `1px gold-dim` border for touch targets.

---

## Section 4 — Hero Screen: Infamy / End-of-Run

### Concept: The Captain's Log

End-of-run reimagined as a ship's log entry. Theatrical animation tells a story: darkness → verdict → accounting.

### Vocabulary
- "GAME OVER" → **"CAPTAIN FALLEN"** (deep red)
- "VICTORY" → **"LEGEND SAILS ON"** (bright gold)
- "RESTART" / "CONTINUE" → **"RETURN TO PORT"**

### Desktop Layout
```
[dark scrim 85%]

     ┌───────────────────────────┐
     │  VOYAGE ENDED             │  ← fog-gray Inter 12px caps
     │                           │
     │  ╔═══════════════════╗    │
     │  ║  CAPTAIN FALLEN   ║    │  ← Cinzel 48px, deep red / gold
     │  ╚═══════════════════╝    │
     │                           │
     │  Fleet 7 of 10            │  ← Inter 14px cream
     │                           │
     │  ─────────────────────    │  ← gold-dim divider
     │                           │
     │  GOLD PLUNDERED   2,450   │  ← label / mono value
     │  SHIPS SUNK          47   │
     │  ZONES CLEARED        6   │
     │  DISTANCE        184 km   │
     │                           │
     │  ─────────────────────    │
     │                           │
     │  INFAMY EARNED     +320   │  ← gold, prominent
     │  ████████████░░░░  Lv 4   │  ← thin gold progress bar
     │                           │
     │       [ RETURN TO PORT ]  │  ← ghost btn
     └───────────────────────────┘
```

Panel: dark glass, `max-width: 480px`, centered. Fine gold border. No close button — player must engage.

### Theatrical Animation Sequence
| Time | Event |
|------|-------|
| 0ms | Dark scrim fades in (600ms ease) |
| 600ms | Panel rises from +40px (800ms spring) |
| 1000ms | "VOYAGE ENDED" label fades in |
| 1300ms | Result title slams in with scale pulse (1.05→1.0, 300ms) |
| 1800ms | Divider draws left-to-right (600ms ease) |
| 2000ms | Stats stagger in, one per 150ms |
| 2800ms | Infamy value counts up from 0 (800ms ease-out) |
| 3600ms | Progress bar fills with easing |
| 4200ms | CTA button fades in |

### Mobile Layout (Landscape)
```
[dark scrim]
┌──────────────────────────────────────────────────────┐
│  LEFT COLUMN              │  RIGHT COLUMN            │
│                           │                          │
│  VOYAGE ENDED             │  GOLD PLUNDERED   2,450  │
│                           │  SHIPS SUNK          47  │
│  CAPTAIN                  │  ZONES CLEARED        6  │
│  FALLEN                   │  DISTANCE        184 km  │
│                           │  ──────────────────────  │
│  Fleet 7 of 10            │  INFAMY EARNED     +320  │
│                           │  ████████░░  Lv 4        │
│  [ RETURN TO PORT ]       │                          │
└──────────────────────────────────────────────────────┘
```

Full-width panel. Left: verdict + result title (28px) + fleet progress + CTA. Right: stats ledger + infamy + progress bar. Vertical `1px gold-dim` divider.

---

## Section 5 — Hero Screen: Port Screen

### Concept: The Harbormaster's Ledger

Dockside transaction record — sparse, ledger-style, authoritative.

### Desktop Layout
```
[dark scrim 85%]
┌───────────────────────────────────────────────────┐
│  PORT OF TORTUGA              💰 2,450  [LEAVE]   │  ← header
│  ─────────────────────────────────────────────    │
│                                                   │
│  REPAIRS  │  ARMAMENTS  │  UPGRADES  │  TECH      │  ← tabs
│  ─────────────────────────────────────────────    │
│                                                   │
│  Hull Repair           Full HP restored   300g    │  ← item
│  [████████████░░░░]    Hull: 64 / 100             │
│  [ REPAIR HULL ]                                  │
│                                                   │
│  Fuel Resupply         Full tank          120g    │
│  [ RESUPPLY  ]                                    │
└───────────────────────────────────────────────────┘
```

- Panel: `max-width: 640px`, centered, dark glass
- Header: port name Cinzel 28px + gold counter mono brass + ghost LEAVE button
- Tabs: Inter 12px uppercase, active = `2px gold` underline, inactive = fog-gray
- Items: name (Inter 15px cream) + right-aligned cost (mono brass), description below (fog-gray 13px)
- Unaffordable: row dimmed 40%, cost turns red
- Repair bar: `4px` track, same visual language as HUD hull bar
- Buttons: full-width within section, ghost style

### Mobile Layout (Landscape)
```
┌────────────────────────────────────────────────────┐
│  PORT OF TORTUGA          💰 2,450        [LEAVE]  │
│  ── REPAIRS │ ARMAMENTS │ UPGRADES │ TECH ──────── │
│                                                    │
│  Hull Repair       Full HP restored         300g  │
│  [██████░░░░]  64/100                             │
│  [ REPAIR HULL ]                                  │
│                                                   │
│  Fuel Resupply     Full tank                120g  │
│  [ RESUPPLY  ]                                    │
└────────────────────────────────────────────────────┘
```

Full-screen panel. Horizontal tab strip (scrollable if needed). Reduced vertical padding (`12px` between items). Safe area insets for notch/home bar.

**Animation:** Panel slides up from bottom edge (600ms spring — ship pulling into dock). Tab content crossfades (150ms). Gold counter flashes briefly on spend.

---

## Section 6 — Remaining Screens

### Ship Select — The Admiralty Roster

Desktop: Full-screen overlay. Three tall dark-glass class cards arranged horizontally. Each card: ship silhouette (canvas/SVG), class name (Cinzel), 4-row stat block. Selected card: gold border + `translateY(-8px)`. Multiplayer button bottom-right ghost btn. Cards rise staggered on entry (150ms apart).

Mobile landscape: Cards in horizontal `scroll-snap-type: x mandatory` row. Selected card snaps to center. Stats shown in a fixed comparison strip below the scrollable row.

---

### Card Picker — Dispatches from the Fleet

Three dark-glass upgrade panels. Each: large icon (canvas, 64px), upgrade name (Cinzel 20px), description (Inter 14px). Selected: gold border glow (`box-shadow: 0 0 16px rgba(200,152,42,0.4)`).

Desktop: Three cards side-by-side centered. `max-width: 900px`.
Mobile landscape: Three cards side-by-side (naturally landscape-friendly), reduced padding.

Animation: Cards drop from above with stagger (200ms apart, 400ms spring). On selection: chosen card scales `1.05`, others fade to 20% and slide away.

---

### Settings — Captain's Orders

Minimal floating panel over the game world. Triggered by gear button (top-right).

Desktop: `320px` wide, anchored top-right below gear button. Sections: Game Info, Audio (mute + volume slider), Quality (low/medium/high), Danger Zone (New Game, red). Clean list, no tabs.

Mobile landscape: `280px` wide, top-right anchored. Volume slider full-width of panel.

Animation: Drops down from gear button origin (300ms ease-out). Closes upward.

---

### Map Screen — Navigation Chart

Canvas world map unchanged. Chrome redesigned: dark glass frame with legend (You / Boss Zone / Defeated), `[CLOSE]` ghost button top-right, subtle footer hint instead of bold "Press M".

Desktop and mobile landscape: Map canvas `80vmin` square, centered. Legend in compact single row below.

Animation: Fade in/out (300ms).

---

### Lobby — The Crew Manifest

Room code: Cinzel mono-style, prominent. Player slots as rows (avatar circle + name + class + READY badge). Class selector compact strip. READY and START buttons bottom-right.

Desktop: `480px` centered dark-glass panel.
Mobile landscape: Full-width panel, rows `40px` height.

Animation: Rise-from-below (same as Port Screen).

---

## Section 7 — HUD Redesign

### Principle: Recede Into the World

No panel backgrounds. Every element floats over the game with text-shadow and subtle opacity only. Players read instruments, not a UI layer.

### Desktop Layout
```
● ──────────────  HULL                    [Minimap]
● ──────────      FUEL
TORTUGA 45m

                     [game world]

          ╔═══╗  ╔═══╗  ╔═══╗  ╔═══╗
          ║ Q ║  ║ W ║  ║ E ║  ║ R ║
          ╚═══╝  ╚═══╝  ╚═══╝  ╚═══╝
     • 15/30                       ● 2,450
```

**Top-Left:**
- Hull: `120px × 3px` floating line. Label "HULL 64" (fog-gray Inter 11px) appears only when damaged.
- Fuel: `80px × 2px` amber line below. Label only when low.
- Port proximity: fog-gray Inter 11px, contextual appear/fade.

**Top-Right:**
- Minimap: `100px` circular canvas. Border `1px solid rgba(200,152,42,0.3)`.

**Bottom-Center — Ability Bar:**
- 4 slots: `52px × 52px`, `12px` gap
- Per-slot dark glass: `rgba(15,21,32,0.7)` + `1px solid rgba(200,152,42,0.2)`
- Icon: canvas-drawn 32px
- Cooldown arc: `rgba(8,12,18,0.75)` fill + gold stroke
- Key label: Inter 10px fog-gray, bottom of slot
- Active: slot border brightens to full gold

**Bottom-Left:** Ammo — Inter 13px cream, mono. Red at ≤5.
**Bottom-Right:** Gold — Inter 13px brass. `●` dot instead of 💰 emoji.

### Mobile Layout (Landscape)
```
● HULL  FUEL                          [Minimap 80px]

                  [game world]

• 12/30             ╔══╗╔══╗╔══╗╔══╗    ● 450
                    ║Q ║║W ║║E ║║R ║
                    ╚══╝╚══╝╚══╝╚══╝
```

- Hull/fuel bars inline horizontal top-left
- Minimap top-right, `80px`
- Ability bar bottom-right (away from resting thumbs), `44px` slots
- Ammo bottom-left, gold counter right of ability bar

### Theatrical HUD Moments

| Event | Treatment |
|-------|-----------|
| Weapon tier upgrade | Banner slides from top-center (Cinzel 16px gold, 3s auto-hide) |
| Low hull | Bar pulses `oo-glow-pulse` red + subtle red edge vignette (8% opacity max) |
| Boss appears | Boss HP bar drops from top-center (600ms spring), segmented gold, Cinzel name |
| Floating damage numbers | Updated to Inter mono, new color tokens |

---

## Section 8 — Implementation Approach

### Phasing

**Phase 1 — Foundation**
- Create `game/css/ui.css` with all tokens and `@keyframes`
- Overhaul `theme.js` — write tokens to `:root`, export new palette
- Update `game/index.html` to load stylesheet

**Phase 2 — Hero Screens**
- Redesign `mainMenu.js`
- Redesign `infamyScreen.js`
- Redesign `portScreen.js`

**Phase 3 — Full Cascade**
- `shipSelect.js`, `cardPicker.js`, `settingsMenu.js`, `mapScreen.js`, `lobbyScreen.js`
- `hud.js`, `bossHud.js`, `crewHud.js`, `uiEffects.js`

### Technical Constraints

- No external dependencies — `ui.css` is a local file
- `var` convention — all new JS follows project-wide `var` over `let/const`
- Inline CSS only for per-element overrides; structural layout via shared CSS classes
- Canvas elements unchanged (minimap, ability slots, boss bar phases)
- `isMobile()` + `_mob` pattern retained; landscape assumed when mobile
- CSS transitions preferred over JS animation for performance

### File Changes Summary

| Action | Files |
|--------|-------|
| New | `game/css/ui.css` |
| Major rewrite | `theme.js`, `mainMenu.js`, `infamyScreen.js`, `portScreen.js`, `hud.js` |
| Moderate update | `shipSelect.js`, `cardPicker.js`, `settingsMenu.js`, `bossHud.js`, `crewHud.js` |
| Minor update | `mapScreen.js`, `lobbyScreen.js`, `uiEffects.js`, `game/index.html` |
