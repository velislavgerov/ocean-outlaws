# GLB texture regression (white models)

## Investigation summary
The GLB migration switched loader/runtime code correctly, but the conversion pipeline did not preserve the legacy atlas texture links that FBX runtime remapping previously provided.

## Root cause
- Pre-migration (`fbxVisual.js`), FBX loading used URL remapping so `Texture Main.png` resolved to:
  - `assets/textures/ships.png` for ship-like models.
  - `assets/textures/locations.png` for everything else.
- During FBX → GLB conversion, many assets were exported without any `images`/`textures` entries.
- Result: materials named `texture main` load with UVs but no `map`, and render as white/flat under toon conversion.

## Straightforward preservation fix
For future/repeat migrations, preserve texture bindings at conversion time:
- `scripts/convert-fbx-to-glb.sh` now creates temporary `Texture Main.png` aliases (copied from the correct atlas) before invoking `FBX2glTF`.
- This allows FBX2glTF to resolve and embed texture data into the generated GLB, so textures survive the migration itself.

## Runtime safeguard (for already-converted assets)
`game/js/glbVisual.js` still applies a fallback map, but only for legacy atlas materials (`texture main`) that are missing a texture map. This avoids overriding intentionally untextured materials while keeping existing converted assets usable.
