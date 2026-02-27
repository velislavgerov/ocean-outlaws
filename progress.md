Original prompt: let's do it

## GER-14 kickoff
- Goal: bootstrap Vite + Three r183 WebGPU app with graceful unsupported-browser handling.
- Constraint: keep legacy playable path to reduce migration risk.
- Plan:
  - Preserve existing game entry as legacy.
  - Add Vite config + package setup.
  - Add new WebGPU bootstrap entry.
  - Run build + Playwright smoke.

## Update 1: Bootstrap files added
- Added `package.json` with Vite + Three dependencies.
- Added `vite.config.js` with `game/` root and `dist/` output.
- Preserved previous entrypoint at `game/legacy.html`.
- Replaced `game/index.html` with WebGPU-first shell + unsupported fallback panel.
- Added `game/main.js` WebGPU bootstrap scene + deterministic hooks (`render_game_to_text`, `advanceTime`).

## Update 2: Validation and fallback test
- Installed dependencies and generated `package-lock.json`.
- `npm run build` passes with Vite 7.3.1.
- Ran Playwright smoke (normal mode):
  - output/web-game-ger14-r3-normal/state-0.json
  - mode=`running`, renderer=`webgpu`, frame advanced.
- Added `?forceFallback=1` hook and validated fallback UX in Playwright:
  - output/web-game-ger14-r3-fallback/state-0.json
  - mode=`unsupported`, renderer=`none`, friendly fallback message visible.
- Observed no runtime console errors from game bootstrap flow.
- Known non-blocking warning: Vite build chunk-size warning due `three` bundle size (~709kB), acceptable for bootstrap stage.

## Next TODOs
- Start GER-15: CI + preview gates.
- Add status badge/instructions in README for Vite workflow.
- Optional: add browser feature checks for specific WebGPU limits/adapter details.

## Update 3: Bridge to real game under Vite
- `game/main.js` converted to route switcher:
  - default: imports existing `./js/main.js` (real game path)
  - `?bootstrap=1` or `?webgpuBootstrap=1`: imports WebGPU bootstrap path
- Moved WebGPU bootstrap implementation to `game/webgpu/bootstrap.js`.
- Added `@supabase/supabase-js` dependency so legacy multiplayer module graph resolves under Vite.

## Update 4: Real-game default path verified
- Build passes after dependency resolution (`npm run build`).
- Playwright smoke against `/` now loads the existing Ocean Outlaws game code path:
  - state: `output/web-game-ger14b-default/state-0.json`
  - mode=`menu` from legacy game state model, confirming real game booted.
- Playwright smoke against `/?bootstrap=1` still loads WebGPU bootstrap path:
  - state: `output/web-game-ger14b-bootstrap/state-0.json`
  - mode=`running`, renderer=`webgpu`.
- Result: Vite foundation now runs real game by default with bootstrap debug route preserved.

## Update 5: Renderer adapter for incremental backend migration
- Added `game/js/rendererRuntime.js`:
  - default WebGL runtime factory
  - injectable hook via `window.__ooRendererFactory`
  - normalized runtime API: `renderer`, `backend`, `resize`, `setQualityPixelRatio`, `getCanvas`
- Updated legacy game loop (`game/js/main.js`) to create renderer through runtime adapter.
- Added renderer metadata to `render_game_to_text` payload:
  - `renderer.backend`
  - `renderer.className`
- Validation:
  - `/` route still boots real game (`mode=menu`, renderer backend `webgl`).
  - `/?bootstrap=1` route still boots WebGPU bootstrap scene.

## Update 6: Foundation regression gate (real game + bootstrap)
- Added `scripts/smoke-real-game.mjs`.
  - Boots local Vite dev server.
  - Runs the Playwright game client against `/` and `/?bootstrap=1`.
  - Validates latest `render_game_to_text` state from each route.
  - Fails if `/` is not the real game menu route.
  - Fails if bootstrap route no longer reports WebGPU (or unsupported fallback state).
- Added npm script: `npm run smoke`.
- Added CI build workflow at `.github/workflows/build.yml` (`npm ci` + `npm run build`).
- Updated README development docs:
  - Vite install/dev commands.
  - `npm run smoke` regression guard.
  - Route notes for `/` and `/?bootstrap=1`.

Validation:
- `npm run smoke` passes.
  - `/` => `mode=menu`, `renderer.backend=webgl`.
  - `/?bootstrap=1` => WebGPU bootstrap active.
- `npm run build` passes.
- Visual check of smoke screenshots confirms:
  - default route shows Ocean Outlaws menu screen;
  - bootstrap route shows rotating cube scene.

Next TODO suggestions:
- Add a WebGPU renderer runtime implementation for the real game path behind `?renderer=webgpu` (keep WebGL as fallback during migration).
- Start extracting phase-based loop adapter (Ticker-like) around existing `runFrame` to prepare incremental core-architecture migration.
- README now documents `WEB_GAME_CLIENT` / `WEB_GAME_ACTIONS` overrides for smoke environments outside Codex defaults.
- Linear planning update: added `GER-30` (OO-7A Three.js Water Pro Migration (WebGPU)).
- Sequencing dependencies set as: `GER-17` -> `GER-30` -> `GER-21`.

## Update 7: Water Pro planning + next WebGPU migration slice
- Linear issue `GER-30` updated with explicit style guardrails:
  - keep low-poly animated water feel;
  - avoid photoreal/high-frequency shading/post;
  - use Water Pro primarily for shared wave/physics alignment.
- Added real-game renderer route request plumbing:
  - `/?renderer=webgpu` now requests WebGPU runtime for the existing game path.
- Added `game/webgpu/legacyRendererFactory.js` and integrated it in `game/main.js`.
  - Uses `WebGPURenderer` when requested.
  - Keeps safe fallback to WebGL with reason flags (`window.__ooRendererFallbackReason`).
  - In Playwright/headless (`navigator.webdriver`), force WebGL fallback to avoid nondeterministic WebGPU init stalls during automation.
- Extended `render_game_to_text` renderer metadata in `game/js/main.js`:
  - `renderer.requested`
  - `renderer.fallbackReason`

Validation:
- `npm run smoke` passes (default route + bootstrap route).
- `npm run build` passes.
- Targeted probe for `/?renderer=webgpu` in headless now deterministically reports:
  - `requested=webgpu`
  - `backend=webgl`
  - `fallbackReason=webgpu-disabled-webdriver`
  (expected for CI/headless safety)

Next TODO suggestions:
- Implement actual Water Pro integration module behind a feature flag while preserving low-poly look defaults.
- Add a browser/manual QA step (non-headless) to verify real `/?renderer=webgpu` path uses `WebGPURenderer` on supported desktop browsers.
- Fixed WebGPU runtime deprecation path:
  - `legacyRendererFactory` now uses `renderer.render()` after `renderer.init()` readiness, no `renderAsync()` call.
- Fixed deprecated time source in legacy game loop:
  - replaced `THREE.Clock` with `THREE.Timer` (`timer.connect(document); timer.update(); timer.getDelta()`).
- Revalidated: `npm run smoke` and `npm run build` pass.
