# Open World Subtraction Design

Remove the Slay-the-Spire voyage chart and narrative event system. Replace the rigid node-by-node progression with proximity-based open world exploration and a hybrid combat model.

## What Gets Deleted (~1,750 LOC)

| File | LOC | Why |
|------|-----|-----|
| `voyageChart.js` | 457 | Canvas-rendered branching node map UI |
| `voyageData.js` | 269 | Chart generation, node movement, voyage state persistence |
| `voyageEvents.js` | 451 | 20+ narrative event templates with branching choices |
| `storyState.js` | 171 | Per-run faction reputation, journal, narrative flags |
| `eventEngine.js` | 150 | Deterministic event selection and outcome application |
| `eventModal.js` | ~100 | Event choice modal UI |
| `storyAudio.js` | ~50 | Story cue playback |
| `storySetDressing.js` | ~100 | Story-themed ambient scene objects |

Also deleted: `mapData.js` zone definitions and completion tracking (star ratings, zone unlocks).

## New Game Flow

```
Menu → Ship Select → Infamy Screen → Open World (persistent)
                                        ↓ (death or voluntary end)
                                      Infamy Screen → Menu
```

The voyage chart step is eliminated. After ship selection and infamy display, the player drops directly into a continuous open world.

## Enemy Spawning: Hybrid Model

### Free-roaming patrols
- Enemy ships spawn around the player based on distance from origin.
- Closer = easier (fewer ships, lower HP/speed). Further = harder (more ships, tougher factions).
- Existing faction system (pirate/navy/merchant) maps to spatial regions.
- Enemies despawn when far from the player and respawn as the player moves, keeping performance stable.

### Boss encounters at fixed locations
- Specific world locations marked on the minimap with boss zone indicators.
- Entering a boss zone triggers wave-based combat using the existing `wave.js` system.
- Defeating a boss clears the zone and awards loot via `cardPicker.js` / `boss.js`.
- Provides structured climactic fights within the open world.

### Ports unchanged
- Already spawn on coastlines independently of the voyage system.
- Player sails to them for resupply, repair, and upgrades.

## Map Screen → World Map Overlay

The full-screen zone-selection `mapScreen.js` becomes a toggleable in-game overlay:

- Toggle with M key or HUD button (no screen transition).
- Shows top-down view: player position, discovered ports, boss zone markers, region boundaries with difficulty labels.
- Semi-transparent over the 3D world.
- Closing returns to normal gameplay immediately.
- `mapData.js` zone star ratings and unlock progression are removed.

## Changes in main.js

### Removed
- `openRunVoyageChart`, `reopenVoyageAfterNode`, `startNodeEncounter`, `startNodeCombat`, `buildNodeWaveConfigs`
- `markStoryProgressForNode`, `markHarborStoryBeat`, `updateRunAfterNode`
- `startNewRun` / `continueRun` roguelite run flow
- State variables: `activeStoryState`, `pendingEncounterOverride`, `currentNode`, `activeChart`, `activeVoyageState`, `HARBOR_STORY_BEATS`, `currentRunSeed`

### Added
- `startOpenWorld(classKey)`: creates terrain, ocean, weather, drops player ship, begins spatial enemy spawning and places boss zones.
- Spatial enemy spawner: distance-based difficulty scaling, faction assignment by region, despawn/respawn lifecycle.
- Boss zone entry detection: triggers wave-based combat when player enters a boss zone radius.

### Adapted
- `startZoneCombat` serves as the basis for `startOpenWorld` — already creates terrain, ports, enemies, weather without voyage node dependencies.
- Wave manager repurposed for boss encounters only.
- Card picker / upgrade rewards triggered after boss kills.

## Systems Unchanged

Combat (weapons, firing, targeting), ships (classes, physics, models), terrain (procedural generation, streaming, collision), ocean (waves, rendering), ports (coastline spawning, resupply, city batteries), upgrades (gold, tech tree, card picker), crew (officers, stations, recruitment), weather/day-night, HUD (health, ammo, minimap), audio, mobile controls, multiplayer, infamy/legend meta-progression, save system.
