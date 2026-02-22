# ASSETS.md — Asset Conventions

## Directory Structure

```
game/assets/
├── models/
│   ├── ships/           # Playable + enemy vessels
│   │   ├── sloop.fbx
│   │   ├── brigantine.fbx
│   │   ├── galleon.fbx
│   │   ├── manowar.fbx
│   │   ├── enemy-patrol.fbx
│   │   ├── boss-blackthorn.fbx
│   │   ├── boss-widow.fbx
│   │   └── boss-crane.fbx
│   ├── environment/     # Islands, rocks, terrain pieces
│   │   ├── islands/
│   │   ├── mountains/
│   │   ├── stones/
│   │   └── waters/
│   ├── structures/      # Buildings, piers, lighthouses
│   │   ├── houses/
│   │   ├── piers/
│   │   └── ports/
│   ├── nature/          # Trees, plants, flowers
│   │   ├── palm-trees/
│   │   ├── fir-trees/
│   │   ├── shrubs/
│   │   └── flowers/
│   ├── props/           # Barrels, crates, food, etc.
│   │   ├── barrels/
│   │   ├── boxes/
│   │   ├── food/
│   │   └── misc/
│   └── effects/         # Smoke, spray, tentacles
├── textures/
│   ├── ships.png        # Shared atlas for sailing ships
│   └── locations.png    # Shared atlas for sea locations
├── compositions/        # Pre-authored island compositions (JSON)
│   ├── palmov-30.json
│   └── ports-islands-20.json
└── manifest.json        # Asset registry (see below)
```

## Naming Conventions

- **All lowercase, kebab-case**: `pirate-ship-large-1.fbx` not `pirate ship large 1.fbx`
- **No spaces in filenames** — ever. Spaces break URL encoding and CLI tools.
- **Descriptive game names over pack names**: `sloop.fbx` not `ship medium 5.fbx`
- **Numbered variants use suffix**: `palm-tree-1.fbx`, `palm-tree-2.fbx`
- **Prefixed by role for ships**: player ships by class name, enemies by `enemy-`, bosses by `boss-`

## File Formats

| Type | Format | Notes |
|------|--------|-------|
| 3D Models | `.fbx` (current) → `.glb` (target) | FBX for now, GLB migration planned |
| Textures | `.png` | Shared atlas per pack, <256KB each |
| Compositions | `.json` | Pre-authored island groups |
| Manifest | `.json` | Asset registry for loader |

### GLB Migration (Future)
When ready, convert FBX → GLB using:
```bash
# Via gltf-transform (preferred)
npx gltf-transform cp input.fbx output.glb --compress draco

# Via Blender CLI
blender --background --python fbx2glb.py -- input.fbx output.glb
```
Switch `fbxVisual.js` → `glbVisual.js` using `GLTFLoader`. Same API surface.

## Manifest Format

`game/assets/manifest.json` — single source of truth for what assets exist:

```json
{
  "version": 1,
  "ships": {
    "sloop": { "model": "models/ships/sloop.fbx", "size": 6 },
    "brigantine": { "model": "models/ships/brigantine.fbx", "size": 7 },
    "galleon": { "model": "models/ships/galleon.fbx", "size": 8 },
    "manowar": { "model": "models/ships/manowar.fbx", "size": 9 },
    "enemy-patrol": { "model": "models/ships/enemy-patrol.fbx", "size": 6 },
    "boss-blackthorn": { "model": "models/ships/boss-blackthorn.fbx", "size": 10 },
    "boss-widow": { "model": "models/ships/boss-widow.fbx", "size": 10 },
    "boss-crane": { "model": "models/ships/boss-crane.fbx", "size": 10 }
  },
  "textures": {
    "ships": "textures/ships.png",
    "locations": "textures/locations.png"
  },
  "compositions": [
    "compositions/palmov-30.json",
    "compositions/ports-islands-20.json"
  ]
}
```

The loader reads this manifest. If a model path is missing, it falls back to procedural geometry.

## What Belongs in This Repo

✅ **Include:**
- FBX/GLB model files used by the game
- Texture atlases (PNG)
- Composition JSON presets
- Manifest file
- Asset conventions (this file)

❌ **Exclude (via .gitignore):**
- Unity `.meta` files
- Unity `.prefab` files
- Unity `.unity` scene files
- Unity `.mat` material files
- Raw source packs (keep in a separate assets repo or shared drive)
- Guideline PDFs from asset packs

## Source Packs

The raw Palmov Island packs live outside this repo:
- **Low Poly Cartoon Sailing Ships** — ships, boats, viking ships, water
- **Low Poly Sea Locations Pack** — islands, houses, environment, vehicles

Emil extracts and renames models from Unity into the structure above.

## Model Requirements

- **Triangle budget:** <5,000 per model (mobile performance)
- **Material:** Single shared texture atlas per pack (flat-color, low-poly)
- **Origin:** Bottom-center of model (ships: waterline center)
- **Forward:** +Z axis (Three.js convention)
- **Scale:** Normalized at load time via `fitToSize()` — raw FBX scale doesn't matter
