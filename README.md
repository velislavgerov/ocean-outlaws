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
