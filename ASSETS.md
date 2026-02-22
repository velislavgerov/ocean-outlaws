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
| 3D Models | `.glb` | Draco-compressed, exported from Unity via UnityGLTF |
| Textures | Embedded in GLB | Flat-color materials, no large atlases |
| Compositions | `.json` | Pre-authored island groups |
| Manifest | `.json` | Asset registry for loader |

## Export Pipeline

Models are exported from Unity following `docs/unity-export-guide.pdf`:

1. **Unity** → UnityGLTF plugin exports raw GLB to `exports/raw/`
2. **gltf-transform** → Draco compression to `exports/optimized/`
   ```bash
   gltf-transform optimize exports/raw/ship_sloop.glb exports/optimized/ship_sloop.glb --compress draco
   ```
3. **Copy** optimized GLBs into `game/assets/models/` per directory structure above

### Size Targets

| Asset type | Target size | Triangle budget |
|-----------|------------|----------------|
| Ship models | <150KB each | <5,000 tris |
| Environment | <250KB each | <8,000 tris |

### Runtime Loader
```js
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);
```

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

- **Triangle budget:** <5,000 per ship, <8,000 per environment piece
- **Material:** Flat-color low-poly (no PBR, no large textures)
- **Origin:** Bottom-center of model (ships: waterline center)
- **Forward:** +Z axis (Three.js convention)
- **Scale:** Normalized at load time via `fitToSize()` — export scale doesn't matter

## Sail Mesh Naming Convention (Ships)

Ship models must follow this naming for runtime faction recoloring:

| Mesh name | Purpose |
|-----------|---------|
| `sail_main` | Main mast sail |
| `sail_fore` | Fore mast sail |
| `sail_mizzen` | Mizzen mast sail |
| `sail_main_01`, `sail_main_02` | Multiple sails on same mast |

**Rules:**
- Any mesh with `sail` in its name gets recolored at runtime for faction colors
- Hull, deck, rigging meshes must NOT contain the word `sail`
- Rename in Unity Hierarchy BEFORE exporting GLB

**Faction colors:**
```js
player:   0xf5f0dc  // Cream/natural
pirates:  0xff2200  // Red
navy:     0x1a3a6b  // Navy blue
merchant: 0xc8a850  // Gold/tan
```
