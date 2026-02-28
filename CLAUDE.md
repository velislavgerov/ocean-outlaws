# CLAUDE.md — Ocean Outlaws

## Project Overview
Browser-based naval combat game built with Three.js r183, vanilla JS (ES modules), and Vite 7.
Deployed via GitHub Pages.

## Commands
- `npm run dev` — Start Vite dev server
- `npm test` — Run Playwright smoke tests (6 tests, ~37s)
- `npx playwright test --headed` — Run tests with visible browser

## Code Conventions
- **`var` over `let`/`const`** — project-wide convention per FACTORY.md
- **Vanilla JS only** — no TypeScript, no JSX
- **ES modules** — `import`/`export` throughout
- **Files under 500 lines** — split when approaching
- **No build step** — Three.js loaded via CDN import maps

## Architecture

### Entry Points
- `game/index.html` — HTML shell with loading screen, fallback panel
- `game/js/main.js` (~2600 lines) — initialization, game loop, state management

### Tick System (folio-2025 pattern)
The game loop uses an ordered event bus. Subsystems register at priority levels:

| Order | System | File |
|-------|--------|------|
| 0 | Game logic (`runFrame`) | main.js |
| 8 | Day/night, weather, ocean visuals | main.js (extracted) |
| 10 | UI effects (shake, fade, floating numbers) | main.js (extracted) |
| 11 | Sound (sailing, ambience, music) | main.js (extracted) |
| 998 | Render pass | main.js |

**Key files:**
- `game/js/eventBus.js` — Ordered event bus with sparse array storage. `on(name, cb, order)`, `off`, `trigger`, `clear`.
- `game/js/ticker.js` — RAF-based game loop driver. Creates an event bus, fires `tick` events each frame. MAX_DELTA=0.1. Provides `manualTick(dt)` for testing.

### Modules (79 JS files under `game/js/`)
- `ocean.js` — Procedural ocean with tiled geometry, CPU vertex animation, wave height function
- `ship.js` — Ship physics, movement, fuel
- `camera.js` — Third-person follow camera
- `weather.js` — Weather system (calm, storm, fog, etc.)
- `daynight.js` — Day/night cycle with star field
- `enemy.js` — Enemy AI, spawning, health
- `wave.js` — Wave/difficulty progression
- `terrain.js` — Infinite chunked terrain streaming
- `sound.js` — Procedural audio via Web Audio API
- `hud.js` — HUD overlay, minimap
- `mobile.js` — Mobile detection, quality tiers, orientation prompt
- `rendererRuntime.js` — WebGPU/WebGL renderer abstraction

### Debug Panel
Activated by `#debug` hash in URL (e.g., `localhost:1234/#debug`).
Uses Tweakpane loaded from CDN. Provides live-tunable controls for ocean, fog, and renderer.
- `game/js/debug.js` — `initDebug()`, `addDebugFolder()`, `addDebugBinding()`, `addManualBinding()`

### Shared Uniforms
Global shader uniform values updated each frame, ready for future TSL shader migration.
- `game/js/sharedUniforms.js` — time, wind, camera, dayNight, weather uniforms

### Quality System
Three tiers: `low`, `medium`, `high`. Auto-detected on mobile using `devicePixelRatio`.
- High-DPI screens (ratio >= 2) skip antialiasing
- Quality change triggers ocean geometry rebuild via `rebuildOceanForQuality()`
- Config in `mobile.js:getQualityConfig()` controls segments, rain count, triangles, etc.

### Initialization Flow
Two-phase init with loading screen:
1. Renderer, scene, ocean, camera (instant)
2. Managers, audio, terrain, shader pre-compilation
3. `hideLoadingScreen()` + `ticker.start()`

Shader pre-compilation (`game/js/preRenderer.js`) runs one render pass before gameplay to prevent first-frame stutter.

## Testing
Playwright smoke tests in `tests/smoke.spec.mjs`:
1. Game loads without console errors
2. Renderer initializes with WebGL backend
3. `render_game_to_text()` returns valid state
4. `advanceTime()` works via ticker
5. Debug panel activates with `#debug` hash
6. Mobile portrait shows orientation prompt

Tests force WebGL (`?renderer=webgl`) with SwiftShader for headless Chromium.
Config in `playwright.config.mjs`.

## Key Patterns
- **Resize through event bus:** `ticker.events.on("resize", fn)` instead of raw `window.addEventListener`
- **`window.advanceTime(ms)`:** Advances game time programmatically (for testing/debugging)
- **`window.render_game_to_text()`:** Returns JSON game state snapshot
- **`window.__ooRendererBackend`:** Reports "webgl" or "webgpu"
- **Loading progress:** `updateLoadingBar(pct, text)` during init

## File Organization
```
game/
  index.html          — Entry point
  js/
    main.js           — Game loop, init, state (~2600 lines)
    eventBus.js       — Ordered event bus
    ticker.js         — RAF game loop driver
    debug.js          — Tweakpane debug panel
    sharedUniforms.js — Global shader uniforms
    preRenderer.js    — Shader pre-compilation
    mobile.js         — Quality detection, orientation
    ocean.js          — Ocean rendering + rebuild
    ... (79 modules total)
  assets/             — Models, textures
  data/               — JSON config/presets
tests/
  smoke.spec.mjs      — Playwright smoke tests
playwright.config.mjs — Test configuration
```
