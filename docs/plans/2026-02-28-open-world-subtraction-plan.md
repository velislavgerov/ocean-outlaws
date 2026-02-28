# Open World Subtraction — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Execute via Ralph Loop with completion promise `OPEN_WORLD_COMPLETE`.

**Goal:** Remove the Slay-the-Spire voyage chart and narrative event system, replacing the node-by-node progression with proximity-based open world exploration and hybrid combat (free-roaming patrols + wave-based boss zones).

**Architecture:** Bottom-up subtraction. First delete dead files, then gut the imports and functions from `main.js`, then build the new `startOpenWorld()` flow adapting the existing `startZoneCombat()` pattern. Finally add spatial enemy spawning and repurpose the map screen as a toggleable overlay.

**Tech Stack:** Three.js r183, vanilla JS (ES modules, `var` convention), Vite 7, Playwright smoke tests

**Conventions:**
- `var` over `let`/`const` (per CLAUDE.md)
- Files under 500 lines
- No TypeScript
- Run `npm test` after each phase

**Design doc:** `docs/plans/2026-02-28-open-world-subtraction-design.md`

---

## Phase 1: Delete Dead Files

### Task 1: Delete voyage chart, narrative events, and story files

**Files:**
- Delete: `game/js/voyageChart.js`
- Delete: `game/js/voyageData.js`
- Delete: `game/js/voyageEvents.js`
- Delete: `game/js/storyState.js`
- Delete: `game/js/eventEngine.js`
- Delete: `game/js/eventModal.js`
- Delete: `game/js/storyAudio.js`
- Delete: `game/js/storySetDressing.js`

**Step 1: Delete the 8 files**

```bash
cd game/js
rm voyageChart.js voyageData.js voyageEvents.js storyState.js eventEngine.js eventModal.js storyAudio.js storySetDressing.js
```

**Step 2: Commit**

```bash
git add -u game/js/
git commit -m "chore: delete voyage chart, narrative events, and story files (~1750 LOC)"
```

Note: The game will NOT work after this step — `main.js` still imports these files. That's expected; we fix it in Task 2.

---

## Phase 2: Gut main.js — Remove Imports and Dead Code

### Task 2: Remove all deleted-file imports from main.js

**Files:**
- Modify: `game/js/main.js`

**Step 1: Remove these import lines**

Remove the following imports (exact lines as of current code):

```js
// Line 28 — remove entirely:
import { createVoyageChart, showVoyageChart, hideVoyageChart } from "./voyageChart.js";
// Line 29 — remove entirely:
import { generateVoyageChart, createVoyageState, moveToNode, getReachableNodes, getNodeTypes, saveVoyageState, loadVoyageState, clearVoyageState } from "./voyageData.js";
// Line 58 — remove entirely:
import { createStoryState, hydrateStoryState, getRegionForNode, getRegionInfo, appendJournalEntry } from "./storyState.js";
// Line 59 — remove entirely:
import { selectEvent, applyEventOutcome, getChoiceAvailability } from "./eventEngine.js";
// Line 60 — remove entirely:
import { showEventModal, hideEventModal } from "./eventModal.js";
// Line 61 — remove entirely:
import { createStorySetDressing, spawnStorySetDressing, clearStorySetDressing, shiftStorySetDressing } from "./storySetDressing.js";
// Line 62 — remove entirely:
import { preloadStoryAudio, playStoryCue } from "./storyAudio.js";
```

That's 7 import lines removed.

**Step 2: Remove `mapData.js` imports that are no longer needed**

From line 27, remove: `calcStars`, `completeZone`, `buildZoneWaveConfigs`, `saveMapState`

The line currently reads:
```js
import { loadMapState, resetMapState, getZone, calcStars, completeZone, buildZoneWaveConfigs, saveMapState } from "./mapData.js";
```

Change it to:
```js
import { loadMapState, resetMapState, getZone } from "./mapData.js";
```

We keep `loadMapState`, `resetMapState`, `getZone` because the map overlay will still show zone info.

**Step 3: Commit**

```bash
git add game/js/main.js
git commit -m "refactor: remove imports for deleted voyage/story/event files"
```

---

### Task 3: Remove dead global variables and constants from main.js

**Files:**
- Modify: `game/js/main.js`

**Step 1: Remove these variable declarations**

Remove `currentRunSeed` (line 78):
```js
var currentRunSeed = null; // non-null when in a roguelite run
```

Remove `currentNode` (line 79):
```js
var currentNode = null; // current voyage chart node being fought
```

Remove `activeStoryState` (line 81):
```js
var activeStoryState = null; // per-run narrative state (single-player only)
```

Remove `pendingEncounterOverride` (line 82):
```js
var pendingEncounterOverride = null; // event-driven encounter modifiers for next combat node
```

Remove `HARBOR_STORY_BEATS` (lines 84-99 — the entire object).

Remove `activeChart` and `activeVoyageState` (around line 259-260):
```js
var activeChart = null;
var activeVoyageState = null;
```

Remove `storySetDressing` creation (search for `createStorySetDressing` call around line 376):
```js
var storySetDressing = createStorySetDressing();
```

**Step 2: Commit**

```bash
git add game/js/main.js
git commit -m "refactor: remove dead voyage/story global variables from main.js"
```

---

### Task 4: Remove all dead functions from main.js

**Files:**
- Modify: `game/js/main.js`

**Step 1: Remove these entire functions**

Search and delete each function body (including the `function` line and closing brace):

1. `markHarborStoryBeat` — the function that applies harbor story beats
2. `markStoryProgressForNode` — tracks node visit, region transitions
3. `reopenVoyageAfterNode` — 1.5s timeout to reopen voyage chart
4. `openRunVoyageChart` — generates and shows voyage chart
5. `startNodeEncounter` — routes to salvage/event/port/combat by node type
6. `buildNodeWaveConfigs` — creates wave configs from node type and column
7. `startNodeCombat` — initializes combat scene for a voyage node
8. `updateRunAfterNode` — updates run stats after completing a node
9. `endRunVictory` — shows infamy screen after completing all nodes
10. `endRunDefeat` — shows infamy screen after death in run mode
11. `handleZoneVictory` — calculates stars and marks zone complete
12. `regionLabelForNode` — gets region label for a node
13. `withActiveRunState` — creates/loads active run state helper
14. `saveActiveRunState` — saves current run state helper

Also remove:
- `continueRun` function — no longer needed (no run to continue)
- The `handleShipSelect` function body needs to be **rewritten** (Task 6), so leave it for now but note it calls `openRunVoyageChart` which will be gone.

**Step 2: Commit**

```bash
git add game/js/main.js
git commit -m "refactor: remove 14 dead voyage/story functions from main.js"
```

---

### Task 5: Clean up all remaining references to deleted code in main.js

**Files:**
- Modify: `game/js/main.js`

**Step 1: Fix the restart callback**

In `setRestartCallback` (around line 1661), remove references to deleted symbols. The callback currently calls:
- `hideVoyageChart()` — remove
- `hideEventModal()` — remove
- `clearVoyageState()` — remove
- `clearStorySetDressing(storySetDressing)` — remove
- `activeChart = null; activeVoyageState = null;` — remove
- `currentRunSeed = null; currentNode = null;` — remove
- `activeStoryState = null; pendingEncounterOverride = null;` — remove

Keep all other cleanup in the restart callback (resetWaveManager, resetEnemyManager, clearPorts, etc.).

**Step 2: Fix the init area**

Around line 404, the initialization calls `hideVoyageChart()`, `hideEventModal()`, etc. Remove those two calls.

Also remove the `createStorySetDressing()` initialization call if not already removed.

**Step 3: Fix the victory/defeat event handling in runFrame()**

In the `event === "victory"` branch (around line 2195-2246), there are two paths:
- `if (currentRunSeed !== null)` — this was the voyage run path. **Remove this entire branch.** It calls `endRunVictory`, `openRunVoyageChart`, `updateRunAfterNode`, etc.
- `else` — this was the zone combat path. **Keep this** — it becomes the only victory path.

In the `event === "game_over"` branch (around line 2175-2194), similarly:
- `if (currentRunSeed !== null)` — remove (calls `endRunDefeat`)
- `else` — keep as the only game over path

In the `event === "wave_complete"` branch (around line 2139-2174):
- Remove the line `if (nextRandom() < 0.15 && ship && currentRunSeed !== null)` — change to just `if (nextRandom() < 0.15 && ship)`

In the boss wave start event (around line 2119-2138):
- Remove the line referencing `currentNode` and `activeChart`: simplify difficulty to use zone difficulty or a default.
  Replace:
  ```js
  var difficulty = zone ? zone.difficulty :
    (currentNode ? 1 + Math.floor(currentNode.col * 5 / Math.max(1, activeChart ? activeChart.columns - 1 : 6)) :
    (waveMgr.currentConfig.bossDifficulty || 1));
  ```
  With:
  ```js
  var difficulty = zone ? zone.difficulty : (waveMgr.currentConfig.bossDifficulty || 1);
  ```

Remove the `playStoryCue("boss_omen", ...)` call on the boss spawn line (playStoryCue is deleted).

**Step 4: Fix the rollingOriginShift function**

Remove the line:
```js
shiftStorySetDressing(storySetDressing, shiftX, shiftZ);
```

**Step 5: Fix `startNewRun` function**

Remove references to deleted symbols:
```js
clearVoyageState();
hideEventModal();
activeChart = null;
activeVoyageState = null;
currentRunSeed = null;
currentNode = null;
activeStoryState = null;
pendingEncounterOverride = null;
```

The remaining `startNewRun` should be:
```js
function startNewRun() {
  hideMainMenu();
  clearCombatTarget();
  clearRunState();
  runEnemiesSunk = 0;
  runGoldLooted = 0;
  runZonesReached = 0;
  resetUpgrades(upgrades);
  upgrades.gold = 0;
  resetCrew(crew);
  showShipSelectScreen(handleShipSelect, upgrades, infamyState);
}
```

**Step 6: Remove the `continueRun` usage**

Change the main menu startup call from:
```js
showMainMenu(startNewRun, continueRun, hasActiveRun());
```
To:
```js
showMainMenu(startNewRun, null, false);
```

And do the same in the restart callback where `showMainMenu` is called.

**Step 7: Fix auto-save**

Remove `mapState: mapState` from the `performAutoSave()` call (mapState tracking is being simplified).

**Step 8: Run smoke tests**

```bash
npm test
```

The game should load and show the menu without JS errors. Selecting a ship will fail (handleShipSelect still references `openRunVoyageChart`) — that's fixed in Task 6.

**Step 9: Commit**

```bash
git add game/js/main.js
git commit -m "refactor: clean up all remaining references to deleted voyage/story code"
```

---

## Phase 3: Build Open World Entry Flow

### Task 6: Rewrite handleShipSelect and create startOpenWorld

**Files:**
- Modify: `game/js/main.js`

**Step 1: Rewrite `handleShipSelect`**

Replace the existing `handleShipSelect` with:

```js
function handleShipSelect(classKey) {
  selectedClass = classKey;
  hideShipSelectScreen();
  startOpenWorld(classKey);
}
```

**Step 2: Create `startOpenWorld` function**

This is adapted from the existing `startZoneCombat`. Place it after `handleShipSelect`:

```js
function startOpenWorld(classKey) {
  runEnemiesSunk = 0;
  runGoldLooted = 0;
  runZonesReached = 0;
  clearCombatTarget();
  var classCfg = getShipClass(classKey);
  setMerchantPlayerSpeed(merchantMgr, classCfg.stats.maxSpeed);
  resetResources(resources);
  resetEnemyManager(enemyMgr, scene);
  resetUpgrades(upgrades);
  resetDrones(droneMgr, scene);
  resetCrew(crew);
  if (activeBoss) { removeBoss(activeBoss, scene); activeBoss = null; setNavBoss(null); }
  hideBossHud();
  if (activeTerrain) { removeTerrain(activeTerrain, scene); activeTerrain = null; }

  var worldSeed = Date.now() + Math.floor(Math.random() * 10000);
  seedRNG(worldSeed);
  activeTerrain = createTerrain(worldSeed, 3);
  scene.add(activeTerrain.mesh);

  var worldRoleContext = {
    zoneId: "open_world",
    condition: "calm",
    difficulty: 3
  };
  currentRoleContext = worldRoleContext;
  clearPorts(portMgr, scene);
  initPorts(portMgr, activeTerrain, scene, worldRoleContext);
  clearCrates(crateMgr, scene);
  clearMerchants(merchantMgr, scene);
  setPickupRoleContext(pickupMgr, worldRoleContext);

  if (ship && ship.mesh) scene.remove(ship.mesh);
  ship = createShip(classCfg);
  scene.add(ship.mesh);
  setPlayerMaxHp(enemyMgr, classCfg.stats.hp);
  setPlayerHp(enemyMgr, classCfg.stats.hp);
  setPlayerArmor(enemyMgr, classCfg.stats.armor);
  weapons = createWeaponState(ship);
  abilityState = createAbilityState(classKey);
  initNav(cam.camera, ship, scene, enemyMgr, activeTerrain, portMgr);
  resetDrones(droneMgr, scene);
  setWeather(weather, "calm");
  setTimeOfDay(dayNight, 0.35);
  setSailClass(classKey);
  gameFrozen = false;
  gameStarted = true;
  cardPickerOpen = false;
  activeZoneId = "open_world";
  fadeIn(0.6);
  showBanner("Open Seas — Explore at Will!", 3);

  // Disable wave manager initially (no waves until boss zone)
  resetWaveManager(waveMgr, []);
}
```

**Step 3: Run smoke tests**

```bash
npm test
```

Expected: All pass. The game should load, show menu, allow ship selection, and drop into the open world.

**Step 4: Commit**

```bash
git add game/js/main.js
git commit -m "feat: add startOpenWorld() — drops player directly into open world after ship select"
```

---

## Phase 4: Spatial Enemy Spawning

### Task 7: Add proximity-based enemy spawning to the game loop

**Files:**
- Modify: `game/js/main.js`

**Step 1: Add spatial spawner state variables**

After the existing global variable declarations (around line 75):

```js
var PATROL_SPAWN_RADIUS = 120;
var PATROL_DESPAWN_RADIUS = 180;
var PATROL_MAX_ENEMIES = 8;
var PATROL_SPAWN_INTERVAL = 4.0;
var patrolSpawnTimer = 0;
```

**Step 2: Add the spatial enemy spawning function**

```js
function updatePatrolSpawning(dt) {
  if (!ship || !gameStarted || gameFrozen) return;
  patrolSpawnTimer -= dt;
  if (patrolSpawnTimer > 0) return;
  patrolSpawnTimer = PATROL_SPAWN_INTERVAL;

  // Count alive non-ambient enemies
  var aliveCount = 0;
  for (var i = 0; i < enemyMgr.enemies.length; i++) {
    if (enemyMgr.enemies[i].alive && !enemyMgr.enemies[i].ambient) aliveCount++;
  }
  if (aliveCount >= PATROL_MAX_ENEMIES) return;

  // Distance from origin determines difficulty
  var distFromOrigin = Math.sqrt(ship.posX * ship.posX + ship.posZ * ship.posZ);
  var difficultyScale = Math.min(6, 1 + Math.floor(distFromOrigin / 200));

  // Faction based on distance: pirates close, navy mid, mixed far
  var faction = "pirate";
  if (distFromOrigin > 600) faction = ["pirate", "navy"][Math.floor(nextRandom() * 2)];
  else if (distFromOrigin > 300) faction = nextRandom() < 0.6 ? "pirate" : "navy";

  // Spawn at edge of patrol radius
  var angle = nextRandom() * Math.PI * 2;
  var spawnDist = PATROL_SPAWN_RADIUS * (0.8 + nextRandom() * 0.4);
  var spawnX = ship.posX + Math.cos(angle) * spawnDist;
  var spawnZ = ship.posZ + Math.sin(angle) * spawnDist;

  var waveConfig = {
    hpMult: 1.0 + (difficultyScale - 1) * 0.2,
    speedMult: 1.0 + (difficultyScale - 1) * 0.05,
    fireRateMult: 1.0 + (difficultyScale - 1) * 0.1,
    faction: faction
  };

  spawnEnemy(enemyMgr, ship.posX, ship.posZ, scene, waveConfig, activeTerrain, currentRoleContext);
}
```

**Step 3: Add patrol despawning function**

```js
function despawnDistantEnemies() {
  if (!ship) return;
  for (var i = 0; i < enemyMgr.enemies.length; i++) {
    var e = enemyMgr.enemies[i];
    if (!e.alive || e.ambient) continue;
    var dx = e.posX - ship.posX;
    var dz = e.posZ - ship.posZ;
    if (dx * dx + dz * dz > PATROL_DESPAWN_RADIUS * PATROL_DESPAWN_RADIUS) {
      e.alive = false;
      if (e.mesh) scene.remove(e.mesh);
    }
  }
}
```

**Step 4: Wire into the game loop**

In `runFrame()`, inside the `if (!gameFrozen && gameStarted)` block, after `updateEnemies(...)`:

```js
updatePatrolSpawning(dt);
despawnDistantEnemies();
```

**Step 5: Run smoke tests**

```bash
npm test
```

Expected: All pass. Enemies now spawn around the player based on distance.

**Step 6: Commit**

```bash
git add game/js/main.js
git commit -m "feat: add proximity-based patrol enemy spawning with distance difficulty scaling"
```

---

## Phase 5: Boss Zones

### Task 8: Add boss zone system

**Files:**
- Modify: `game/js/main.js`

**Step 1: Add boss zone state**

After the patrol spawn variables:

```js
var BOSS_ZONE_RADIUS = 60;
var bossZones = [];
var bossZonesInitialized = false;

function initBossZones() {
  bossZones = [
    { x: 300, z: 300, type: "battleship", difficulty: 2, defeated: false, label: "Pirate Stronghold" },
    { x: -400, z: 200, type: "battleship", difficulty: 3, defeated: false, label: "Navy Blockade" },
    { x: 0, z: -500, type: "kraken", difficulty: 4, defeated: false, label: "Kraken's Lair" },
    { x: 500, z: -300, type: "carrier", difficulty: 5, defeated: false, label: "Armada Flagship" }
  ];
  bossZonesInitialized = true;
}
```

**Step 2: Add boss zone detection function**

```js
function checkBossZoneEntry() {
  if (!ship || !gameStarted || gameFrozen) return;
  if (activeBoss && activeBoss.alive) return; // already fighting a boss

  for (var i = 0; i < bossZones.length; i++) {
    var zone = bossZones[i];
    if (zone.defeated) continue;
    var dx = ship.posX - zone.x;
    var dz = ship.posZ - zone.z;
    if (dx * dx + dz * dz < BOSS_ZONE_RADIUS * BOSS_ZONE_RADIUS) {
      // Enter boss zone: spawn boss and start wave combat
      activeBoss = createBoss(zone.type, zone.x, zone.z, scene, zone.difficulty);
      if (activeBoss) {
        setNavBoss(activeBoss);
        showBossHud(activeBoss.def.name);
        showBanner("BOSS: " + zone.label + "!", 4);
        playWaveHorn();
        triggerScreenShake(0.8);

        // Set up wave combat for this boss zone
        var bossWaves = [
          { wave: 1, enemies: 2 + zone.difficulty, hpMult: 1.0 + zone.difficulty * 0.2, speedMult: 1.0, fireRateMult: 1.0, faction: "pirate" },
          { wave: 2, enemies: 1 + Math.floor(zone.difficulty / 2), hpMult: 1.0 + zone.difficulty * 0.3, speedMult: 1.1, fireRateMult: 1.1, faction: "navy", boss: zone.type, bossDifficulty: zone.difficulty }
        ];
        resetWaveManager(waveMgr, bossWaves);

        zone._active = true;
      }
      return;
    }
  }
}
```

**Step 3: Add boss zone defeat handling**

In the existing `event === "victory"` handler (the zone combat branch that we kept), add boss zone defeat tracking. After `handleZoneVictory()` is removed, the victory path should become:

```js
} else if (event === "victory") {
  clearCombatTarget();
  if (mpActive && mpState.isHost) {
    sendWaveEvent(mpState, "victory", { wave: waveMgr.wave });
  }
  // Mark boss zone as defeated
  for (var bzi = 0; bzi < bossZones.length; bzi++) {
    if (bossZones[bzi]._active) {
      bossZones[bzi].defeated = true;
      bossZones[bzi]._active = false;
    }
  }
  // Reset wave manager (back to free-roaming)
  resetWaveManager(waveMgr, []);
  performAutoSave();
  gameFrozen = true;
  hideBossHud();
  var vicData = awardRunInfamy("victory");
  fadeOut(0.4, function () {
    showInfamyScreen(vicData, function () {
      // Return to open world (unfreeze)
      gameFrozen = false;
      gameStarted = true;
      fadeIn(0.4);
      showBanner("Boss defeated! Continue exploring.", 3);
    });
    fadeIn(0.4);
  });
}
```

**Step 4: Wire into game loop**

In `runFrame()`, inside the `if (!gameFrozen && gameStarted)` block, after `updatePatrolSpawning(dt)`:

```js
checkBossZoneEntry();
```

**Step 5: Initialize boss zones in startOpenWorld**

At the end of `startOpenWorld()`, before the banner:

```js
initBossZones();
```

**Step 6: Add boss zone markers to minimap**

In the HUD update call (the `updateHUD(...)` invocation in `runFrame`), the minimap data already receives enemies and ports. We need to add boss zone markers. Find where `updateMinimap` is called and add boss zone data:

After the minimap update for enemies/ports, add:

```js
// Boss zone markers on minimap
if (bossZonesInitialized) {
  for (var bmi = 0; bmi < bossZones.length; bmi++) {
    var bz = bossZones[bmi];
    if (bz.defeated) continue;
    // Add as a special marker type — minimap already handles arbitrary marker objects
  }
}
```

Note: The exact minimap integration depends on `minimap.js` API. If the minimap doesn't support custom markers, skip this sub-step — the boss zones will still work, just without minimap indicators. This can be added as a polish task later.

**Step 7: Fix the game_over handler**

The game_over handler should also reset wave manager back to free-roaming and unfreeze for open world:

```js
} else if (event === "game_over") {
  clearCombatTarget();
  if (mpActive && mpState.isHost) {
    sendWaveEvent(mpState, "game_over", { wave: waveMgr.wave });
  }
  // Clear active boss zone
  for (var bzi = 0; bzi < bossZones.length; bzi++) {
    if (bossZones[bzi]._active) bossZones[bzi]._active = false;
  }
  lastZoneResult = "game_over";
  gameFrozen = true;
  upgrades.gold = 0;
  hideBossHud();
  var goData = awardRunInfamy("defeat");
  fadeOut(0.4, function () {
    showInfamyScreen(goData, function () {
      showGameOver(waveMgr.wave);
    });
    fadeIn(0.4);
  });
}
```

**Step 8: Run smoke tests**

```bash
npm test
```

Expected: All pass.

**Step 9: Commit**

```bash
git add game/js/main.js
git commit -m "feat: add boss zone system with wave combat and defeat tracking"
```

---

## Phase 6: Map Screen → World Map Overlay

### Task 9: Repurpose mapScreen as toggleable in-game overlay

**Files:**
- Modify: `game/js/mapScreen.js`
- Modify: `game/js/main.js`
- Modify: `game/js/input.js` (if M key not already mapped)

**Step 1: Modify mapScreen.js**

The current `mapScreen.js` is a full-screen overlay with zone selection. We need to:
1. Make it semi-transparent (not opaque background)
2. Remove zone click-to-select behavior
3. Add player position indicator
4. Add boss zone markers
5. Make it toggleable (show/hide without state transitions)

Read the current `mapScreen.js` fully and modify:

- Change the background from opaque to `rgba(10, 14, 26, 0.7)` (semi-transparent)
- Remove the `callback` parameter from `showMapScreen` — it no longer triggers zone combat
- Add a `playerPos` parameter: `showMapScreen(mapState, playerPos, bossZones)`
- Draw the player position as a gold dot
- Draw boss zone markers as skull/crossbones circles
- Add a close button or respond to M key / Escape to hide

The exact implementation depends on the current canvas rendering code in `mapScreen.js`. The key changes are:
- No zone selection callback
- Semi-transparent overlay
- Player + boss zone markers drawn on the map
- Toggle behavior (M key or button)

**Step 2: Add M key binding to input.js**

In `game/js/input.js`, add `"m"` or `"KeyM"` to the key actions map, mapped to a `"toggleMap"` action.

**Step 3: Wire map toggle into main.js**

In `runFrame()`, in the key actions processing, add:

```js
if (act === "toggleMap") {
  if (isMapScreenVisible()) {
    hideMapScreen();
  } else {
    showMapScreen(mapState, { x: ship.posX, z: ship.posZ }, bossZones);
  }
}
```

Note: `isMapScreenVisible` is already exported from `mapScreen.js`.

**Step 4: Run smoke tests**

```bash
npm test
```

Expected: All pass.

**Step 5: Commit**

```bash
git add game/js/mapScreen.js game/js/main.js game/js/input.js
git commit -m "feat: repurpose map screen as toggleable world map overlay with player and boss markers"
```

---

## Phase 7: Delete mapData.js Zone Progression

### Task 10: Remove mapData.js zone progression (keep zone definitions for reference)

**Files:**
- Modify: `game/js/mapData.js`
- Modify: `game/js/main.js`

**Step 1: Simplify mapData.js**

The zone definitions in `mapData.js` (Shallow Cove through Leviathan's Maw) can remain as reference data for the world map labels. But remove:
- `calcStars` function
- `completeZone` function
- `buildZoneWaveConfigs` function
- `saveMapState` function
- Star rating tracking
- Zone unlock logic

Keep:
- `ZONES` array (zone names, positions, difficulty labels)
- `getZone(id)` function
- `loadMapState()` / `resetMapState()` (simplified — just returns zone list)

**Step 2: Remove mapState usage from main.js**

- Remove `var mapState = loadMapState();` global
- Remove `mapState` from the auto-save object
- Remove the `if (savedGame.mapState) mapState = savedGame.mapState;` line in save loading
- Remove `mapState = resetMapState();` from initialization

**Step 3: Run smoke tests**

```bash
npm test
```

Expected: All pass.

**Step 4: Commit**

```bash
git add game/js/mapData.js game/js/main.js
git commit -m "refactor: simplify mapData.js — remove zone progression, keep zone definitions"
```

---

## Phase 8: Clean Up runState.js

### Task 11: Simplify runState.js — remove story state dependency

**Files:**
- Modify: `game/js/runState.js`

**Step 1: Remove `createStoryState` import and usage**

`runState.js` currently imports `createStoryState` from `storyState.js` (which is deleted). Remove the import and the `storyState` field from `createRunState`:

The function should become:
```js
export function createRunState(seed) {
  return {
    seed: seed,
    selectedClass: null,
    gold: 0,
    upgradeLevels: null,
    crewRoster: null,
    crewAssigned: null,
    enemiesSunk: 0,
    goldLooted: 0,
    nodesCompleted: 0,
    active: true,
    hp: null,
    maxHp: null
  };
}
```

**Step 2: Run smoke tests**

```bash
npm test
```

Expected: All pass.

**Step 3: Commit**

```bash
git add game/js/runState.js
git commit -m "refactor: remove story state dependency from runState.js"
```

---

## Phase 9: Final Verification and Polish

### Task 12: Verify complete game flow end-to-end

**Files:**
- Modify: `tests/smoke.spec.mjs` (add new tests)

**Step 1: Add open world smoke test**

Add to `tests/smoke.spec.mjs`:

```js
test("open world flow works", async ({ page }) => {
  var errors = [];
  page.on("pageerror", function (err) { errors.push(err.message); });

  await page.goto("/");
  await page.waitForTimeout(3000);

  // Should show menu
  var state = await page.evaluate(function () {
    return window.render_game_to_text();
  });
  expect(state).not.toBeNull();
  expect(state.mode).toBe("menu");

  // No critical errors
  var critical = errors.filter(function (e) {
    return e.indexOf("ResizeObserver") === -1;
  });
  expect(critical).toEqual([]);
});
```

**Step 2: Run full test suite**

```bash
npm test
```

Expected: All tests pass including the new one.

**Step 3: Verify no remaining references to deleted files**

```bash
grep -r "voyageChart\|voyageData\|voyageEvents\|storyState\|eventEngine\|eventModal\|storyAudio\|storySetDressing" game/js/ --include="*.js" -l
```

Expected: No files listed (all references cleaned up).

```bash
grep -r "currentRunSeed\|currentNode\|activeVoyageState\|activeChart\|pendingEncounterOverride\|HARBOR_STORY_BEATS\|activeStoryState" game/js/main.js
```

Expected: No matches.

**Step 4: Commit**

```bash
git add tests/smoke.spec.mjs
git commit -m "test: add open world flow smoke test and verify no remaining voyage references"
```

---

## Summary of Deliverables

| Phase | Tasks | Key Changes |
|-------|-------|-------------|
| 1 | 1 | Delete 8 files (~1,750 LOC) |
| 2 | 2-5 | Remove imports, variables, 14 functions, fix all references in main.js |
| 3 | 6 | New `startOpenWorld()` function, rewrite `handleShipSelect` |
| 4 | 7 | Proximity-based patrol spawning with distance difficulty scaling |
| 5 | 8 | Boss zone system with wave combat at fixed locations |
| 6 | 9 | Map screen → toggleable world map overlay |
| 7 | 10 | Simplify mapData.js — remove zone progression |
| 8 | 11 | Clean runState.js of story dependency |
| 9 | 12 | End-to-end verification and smoke tests |

**Total: 12 tasks, 8 files deleted, ~1,750 LOC removed, ~200 LOC added**

Each phase is independently testable via `npm test`. The game remains functional after each phase (except briefly during Phase 2 while imports are being cleaned up — Phase 3 restores functionality).
