# Adapting folio-2025 Water, Colour, and Aesthetic Techniques to Ocean Outlaws

## Goal

Translate the **architecture** from folio-2025 into Ocean Outlaws' constraints (vanilla JS, ES modules, no build step):

- Water is a dedicated render system driven by time/weather/view.
- Colour is centrally controlled (palette/design tokens).
- Performance and quality levels are explicit runtime systems.

## 1) System architecture to mirror

Implement a single world-state authority:

- `TimeService` (time of day, season)
- `WeatherService` (wind, storm, fog density, precipitation intensity)
- `ViewService` (camera distance/height and quality hints)

Then feed these into:

- `WaterSurfaceSystem`
- `FogSystem`
- `LightingSystem`
- `QualityManager`

### Recommended update order each frame

1. Input
2. Time/season update
3. Weather update
4. Physics step
5. Water uniforms update
6. Lighting/fog update
7. Render
8. Monitoring + quality adjustment

## 2) Water shader tiers (for graceful degradation)

### Tier A (baseline, always available)

- 3-5 sine waves (vertex displacement)
- Fresnel blend between deep/shallow colours
- Simple sun specular
- Optional horizon reflection tint

**Use for:** low-end/mobile fallback and guaranteed playability.

### Tier B (default target)

- 4-8 Gerstner waves
- Dual scrolling normal layers
- Cheap foam stripe at waterline/intersection bands
- Environment/sky reflection contribution

**Use for:** normal desktop/laptop quality.

### Tier C (high-end only)

- Tier B + optional depth-aware shoreline foam
- Optional planar reflection RT or SSR
- Optional bloom polish

**Use for:** high preset only, protected by frame-time budget checks.

## 3) Shared water uniforms (single source of truth)

All tiers should read from one uniform schema:

- `uTime`
- `uWindDir`, `uWindSpeed`
- `uStorm`
- `uSeaLevel`
- `uWaveAmp`, `uWaveFreq`, `uWaveSteepness`
- `uSunDir`
- `uCameraPos`
- `uDeepColor`, `uShallowColor`
- `uFogColor`, `uFogDensity`

This keeps quality switching predictable and reduces shader branching complexity.

## 4) Palette-driven art direction

Create a small palette token file (JSON/JS module) and derive all runtime colours from it:

- Water deep/shallow
- Sky zenith/horizon
- Fog colour
- UI foreground/background/accent
- Highlight/bloom tint

### Suggested palette sets

- Caribbean Noon (bright arcade)
- North Atlantic Storm (muted tactical)
- Sunset Corsair (cinematic warm/cool split)
- Night Stealth Neon (high-contrast mission mode)

## 5) Quality presets and automatic fallback

Expose user-facing presets and auto-adjust logic:

### Presets

- **Low:** Tier A water, no SSR, no bloom, reduced render scale
- **Medium:** Tier B water, light bloom, full render scale
- **High:** Tier C options enabled behind runtime checks

### Auto-degrade ladder (when frame time exceeds budget)

1. Disable SSR / expensive reflections
2. Reduce bloom
3. Reduce wave count and normal layers
4. Lower render scale
5. Reduce shadow quality

## 6) Boat physics alignment (Rapier)

Use buoyancy probes sampled against the **same water height function** used by rendering:

- Multiple hull probes apply spring-damper buoyancy forces
- Add stronger lateral drag than forward drag
- Add angular damping for storm stability
- Apply propulsion force at stern; steering as yaw torque tied to speed

Keeping shader and physics wave functions synchronized avoids visual/physical mismatch.

## 7) No-build-step implementation notes

- Keep shaders in JS template literals or static `.glsl` files fetched at runtime.
- Use import maps for `three` and `three/addons/`.
- Keep addon and core Three.js versions matched.
- Minimize shader permutations; prefer uniform-driven tier toggles.

## 8) Suggested implementation roadmap

1. Add `TimeService` + `WeatherService` + tokenized palette module.
2. Ship Tier A water and wire to weather/time uniforms.
3. Add monitoring HUD and quality manager.
4. Add buoyancy-probe boat controller (Rapier).
5. Upgrade to Tier B (Gerstner + foam stripe + normals).
6. Add bloom and optional high-tier reflections.
7. Add compressed texture pipeline (KTX2/BasisU) for memory/bandwidth stability.

---

This plan intentionally focuses on **architecture parity** and **runtime controls** rather than engine-specific implementation details, so Ocean Outlaws can keep its no-build-step workflow while adopting the strongest production patterns from folio-2025.
