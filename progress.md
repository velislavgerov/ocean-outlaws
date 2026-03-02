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

## Update 8: Optional Water Pro adapter integrated (low-regression path)
- Refactored `game/js/ocean.js` into a hybrid runtime:
  - Legacy low-poly tiled ocean remains the default backend and visual path.
  - Optional Water Pro runtime can be requested via `?water=pro`.
  - Water Pro load/boot is async and guarded; legacy ocean remains active on any failure.
- Added Water Pro runtime routing details:
  - Query params: `water`, `waterVisual`, `waterPreset`, `waterLib`.
  - Candidate module lookup paths: `/lib/threejs-water-pro.js`, `/water/threejs-water-pro.js`, `/vendor/threejs-water-pro.js`, `/threejs-water-pro.js`.
- Added global water diagnostics for regression checks:
  - `window.__ooWaterRequested`, `window.__ooWaterBackend`, `window.__ooWaterFallbackReason`.
- Updated real-game state export (`render_game_to_text`) to include `water` block.
- `game/js/main.js` now passes renderer + quality hint into ocean runtime and exposes renderer object/backend globally for feature adapters.
- README updated with setup and route flags for Water Pro integration.

Next TODO suggestions:
- Add the licensed Water Pro module file into one of the documented paths and run manual browser validation on `/?renderer=webgpu&water=pro`.
- If Water Pro exposes a deterministic height sampler, wire it fully into gameplay/weather scaling to replace legacy wave math for buoyancy and AI float sampling.

## Update 9: GH Pages `/game/` route fix for Vite output
- Updated `vite.config.js`:
  - `base` is now command-aware:
    - dev/serve: `/` (keeps local dev + smoke routes stable)
    - build: `/game/` (matches deployed route)
  - `build.outDir` changed from `../dist` to `../dist/game` so GH Pages serves the game at `/game/`.
- Updated `package.json` build script:
  - now cleans `dist` before building (`rm -rf dist`) to avoid stale root artifacts being deployed.
  - copies runtime static folders to the new output location (`dist/game/assets`, `dist/game/data`).

Validation:
- `npm run build` passes.
- Built entry is now at `dist/game/index.html`.
- Built HTML references bundle assets with `/game/...` URLs (for example `/game/assets/index-*.js`), matching deployed route expectations.
- `npm run smoke` still passes for local dev routes:
  - `/` => real game menu route (`mode=menu`)
  - `/?bootstrap=1` => bootstrap route (`mode=running`, `renderer=webgpu`)
- Visual smoke artifacts reviewed:
  - default route screenshot shows Ocean Outlaws menu;
  - bootstrap route screenshot shows loading/bootstrap screen with advancing state.

## Update 10: Dev `/game/` route parity fix
- Addressed local dev issue where opening `http://127.0.0.1:1234/game/` caused runtime asset paths (for example `assets/models/...`) to miss and return fallback/404 behavior.
- Added a dev-only Vite middleware plugin in `vite.config.js`:
  - rewrites `/game` and `/game/*` requests to `/*` during `vite serve`.
  - this makes `/game/assets/...` resolve to the real static files under `game/assets` in dev, matching production route expectations.
- Added explicit favicon link in `game/index.html` (`./icons/icon-192.png`) to avoid default favicon lookup noise.
- Updated `scripts/smoke-real-game.mjs` route coverage:
  - default smoke route is now `/game/` (configurable via `SMOKE_ROUTE` env var),
  - bootstrap check runs against `/game/?bootstrap=1`,
  - prevents regression by testing the same route developers use locally.

Validation:
- Direct HTTP checks on dev server:
  - `/game/` => HTML entry served.
  - `/game/assets/models/ships-palmov/small/pirate-ship-small.glb` => `200` with `model/gltf-binary`.
  - `/game/icons/icon-192.png` => `200` with `image/png`.
- `npm run smoke` passes with new route targets:
  - `/game/` => `mode=menu`, renderer backend present.
  - `/game/?bootstrap=1` => WebGPU bootstrap state active.
- `npm run build` still passes and keeps production output at `dist/game` with `/game/...` asset URLs.

## Update 11: Revert deploy root to `/` (fix Pages 404 regression)
- User-reported regression: deployed site root (`https://gerov.dev/ocean-outlaws/`) returned 404 after moving build output to `dist/game`.
- Restored root deploy artifact layout:
  - `vite.config.js` build output reverted to `dist` (from `dist/game`).
  - `package.json` build copy target reverted to `dist/`.
- Restored production base URLs to relative paths:
  - `vite.config.js` build `base` changed from `/game/` to `./`.
  - generated `dist/index.html` now references `./assets/...` (works under project path roots like `/ocean-outlaws/`).
- Kept dev `/game/` compatibility middleware so local `http://127.0.0.1:1234/game/` still works.
- Smoke default route restored to `/` in `scripts/smoke-real-game.mjs`.

Validation:
- `npm run build` passes.
- `npm run smoke` passes:
  - `/` => real game menu route
  - `/?bootstrap=1` => bootstrap route
- Dev server checks:
  - `/` => 200
  - `/game/` => 200
  - `/game/assets/models/ships-palmov/small/pirate-ship-small.glb` => 200 (`model/gltf-binary`)

## Update 12: GH Pages runtime asset fix (Draco + model load cascade)
- User-reported production errors on `https://gerov.dev/ocean-outlaws/`:
  - 404 for `/ocean-outlaws/libs/draco/gltf/draco_decoder.wasm`
  - 404 for `/ocean-outlaws/libs/draco/gltf/draco_wasm_wrapper.js`
  - repeated ship/enemy GLB load failures (caused by missing Draco decoder runtime for compressed assets).
- Root cause:
  - build artifact copied `game/assets` + `game/data` only;
  - Draco runtime files live under `game/libs`, so they were absent from `dist` and unavailable in Pages.
- Fix:
  - updated `package.json` build script to also copy `game/libs` into `dist`.
  - new build step: `cp -r game/assets game/data game/libs dist/`

## Update 13: Renderer default hardening (auto=WebGPU-first + lock-aware fallback)
- `game/main.js`
  - Added explicit renderer mode semantics:
    - `?renderer=webgl` => forced WebGL
    - `?renderer=webgpu` => forced WebGPU attempt (ignores session lock)
    - no query => `auto` (WebGPU preflight + fallback)
  - Added WebGPU preflight (`navigator.gpu.requestAdapter()`) with timeout and structured reasons:
    - `webgl-forced`
    - `webgpu-unavailable`
    - `webgpu-disabled-webdriver`
    - `webgpu-session-lock`
    - `webgpu-preflight-timeout`
    - `webgpu-adapter-unavailable`
    - `webgpu-preflight-failed`
  - Added session lock key `sessionStorage["oo_renderer_webgpu_lock"]` and lock setter for timeout/failure paths.
  - Injects legacy WebGPU renderer factory only when preflight passes.
- `game/webgpu/legacyRendererFactory.js`
  - Added options support (`forceAttempt`, `sessionLockKey`).
  - Added session-lock bypass logic for forced WebGPU.
  - Added lock writes on WebGPU init failure.
  - Preserved webdriver deterministic fallback behavior.
- `game/js/rendererRuntime.js`
  - Renderer selection now follows `window.__ooRequestedRenderer` semantics rather than raw URL substring checks.

Validation:
- `npm run smoke` passes.

## Update 14: Terrain stall reduction + perf observability
- `game/js/terrain.js`
  - Introduced heavy-vs-cheap terrain pass split:
    - heavy: desired-set recompute, queue/create chunk, GC
    - cheap: fog visibility + instance flush
  - Added chunk build queue and strict capped processing per heavy pass.
  - Added runtime pressure clamp hook:
    - `setTerrainRuntimePressure(terrain, active)` temporarily clamps create pressure (`preloadAhead=0`, `chunkCreateBudget=1`) without touching persisted settings.
  - Added new helpers/exports:
    - `updateTerrainVisuals`
    - `updateTerrainStreamingScheduled`
    - `getTerrainPlayerChunk`
  - Extended terrain debug state with queue/pass counters and runtime pressure flag.
- `game/js/main.js`
  - Terrain streaming now runs on cadence with immediate chunk-boundary refresh:
    - desktop: ~8Hz
    - mobile: ~5Hz
  - Cheap terrain visuals still run each frame.
  - Added frame/perf counters exposed via `render_game_to_text.perf`:
    - `frameMs`
    - `maxFrameMsRecent`
    - `hitchCountRecent`
    - `terrainLastUpdateMs`
  - Added hitch-triggered temporary terrain pressure cooldown window.

Validation:
- `npm run smoke` passes.
- `npm run smoke:stress` passes.

## Update 15: Drop/kill hot-path smoothing
- `game/js/pickup.js`
  - Added per-type pickup mesh pooling to reuse pickup meshes/materials.
  - Added cached fade material lists to avoid per-frame traverse on fade-out.
  - Added collected-path cleanup to release pooled meshes immediately.
  - Hooked optional GLB hydration back into spawned pickups (fallback mesh remains immediate).
- `game/js/crewPickup.js`
  - Added crew pickup mesh pooling.
  - Switched to shared base geometries/material templates with per-instance clones.
  - Added cached fade material lists and pooled release on collect/despawn/clear.
  - Added collected-path cleanup to avoid stale pooled objects in update loops.
- `game/js/enemy.js`
  - Added cached sinking fade material handling to remove per-frame full traversals.
  - Added adaptive explosion particle count under high active particle pressure.
  - Removed dynamic particle mesh allocation on pool exhaustion (skip instead of allocate).
  - Kept particle pooling path and reset semantics.
- `game/js/main.js`
  - Deferred non-critical kill UI work (kill feed + shake + multiplayer feed relay) to next ticks via queue while keeping immediate gameplay/resource updates synchronous.

Validation:
- `npm run smoke` passes.
- `npm run smoke:stress` passes.
- `npm run build` passes.

## Update 16: Stress smoke path added
- Added `scripts/smoke-stress-gameplay.mjs`:
  - Uses existing Playwright game client workflow.
  - Drives menu -> new voyage -> ship select -> gameplay action bursts.
  - Asserts:
    - at least one captured state reaches `mode="combat"`
    - player + terrain state present
    - `render_game_to_text.perf` numeric fields present
    - `simElapsed` progressed
    - no `errors-*.json` artifacts
- Added npm script:
  - `npm run smoke:stress`

## Next TODO suggestions
- Run manual non-headless browser check for `/?renderer=webgpu` to verify true WebGPU backend on supported GPU/driver combinations.
- Review stress action payload periodically so it tracks UI flow changes (menu/ship-select layouts).

Validation:
- `npm run build` passes.
- Dist now includes:
  - `dist/libs/draco/gltf/draco_decoder.wasm`
  - `dist/libs/draco/gltf/draco_wasm_wrapper.js`
  - expected model files under `dist/assets/models/...`
- Subpath simulation (`/ocean-outlaws/`) via local static server confirms 200 for:
  - `/ocean-outlaws/libs/draco/gltf/draco_decoder.wasm`
  - `/ocean-outlaws/libs/draco/gltf/draco_wasm_wrapper.js`
  - `/ocean-outlaws/assets/models/ships/sloop.glb`
  - `/ocean-outlaws/assets/models/vehicles/pirate-ships/pirate-ship.glb`
  - `/ocean-outlaws/assets/models/ships-palmov/small/pirate-ship-small.glb`
- `npm run smoke` passes after fix.

Next queued work (per user request):
- Make WebGPU the default renderer (with safe fallback).
- Remove freeze spikes during terrain/land streaming, item drops, and enemy death effects.
