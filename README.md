# Ocean Outlaws 🚢

Modern naval combat game built with Three.js.

**Status:** In development

## Play

Coming soon at https://thunderclawai.github.io/ocean-outlaws/

## Stack

- Three.js (3D rendering)
- Vanilla JavaScript (ES modules)
- Vite (dev/build)
- Static hosting (GitHub Pages)
- No framework

## Development

```bash
npm install
npm run dev
```

Regression guard (real game route + bootstrap route):

```bash
npm run smoke
```

Smoke command uses the Codex `develop-web-game` Playwright client by default.
If needed, override paths with:

```bash
WEB_GAME_CLIENT=/abs/path/to/web_game_playwright_client.js \
WEB_GAME_ACTIONS=/abs/path/to/action_payloads.json \
npm run smoke
```

Route notes:
- `/` loads the real Ocean Outlaws game.
- `/?renderer=webgpu` loads the real game and requests WebGPU renderer runtime (falls back safely if unavailable).
- `/?bootstrap=1` loads the isolated WebGPU bootstrap scene.

## Water Pro (Optional)

Water Pro is integrated as an optional runtime path with safe fallback to the existing low-poly ocean.

1. Add the Water Pro module file from your licensed package to one of:
   - `game/lib/threejs-water-pro.js`
   - `game/water/threejs-water-pro.js`
   - `game/vendor/threejs-water-pro.js`
2. Start the game with WebGPU + Water Pro:
   - `http://127.0.0.1:1234/?renderer=webgpu&water=pro`

Useful query params:
- `water=pro` enables Water Pro runtime loading.
- `waterVisual=legacy` keeps current low-poly visual ocean (default).
- `waterVisual=pro` switches visible surface to Water Pro when it initializes.
- `waterPreset=<name>` forwards a preset name if Water Pro exposes `loadPreset`.
- `waterLib=<path>` overrides module path (example: `/lib/threejs-water-pro.js`).
