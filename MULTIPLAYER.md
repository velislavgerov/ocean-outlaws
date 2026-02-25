# MULTIPLAYER.md — Ocean Outlaws Networking Framework

## 1. Architecture Overview

Ocean Outlaws multiplayer uses **Supabase Realtime channels** for peer-to-peer communication with a **host-authoritative model**:

- All players connect to the same Realtime channel identified by a room code.
- One player is the **host** — they run enemy AI, boss logic, wave management, weather changes, and spawn pickups.
- All players send their own ship position and fire events.
- Non-host clients receive enemy/boss state from the host and interpolate using dead reckoning.
- If the host disconnects, **host migration** automatically promotes the next player.

The networking layer lives in three files:

| File | Responsibility |
|---|---|
| `multiplayer.js` | Room management, presence tracking, host migration, `broadcast()` primitive |
| `netSync.js` | Ship position sync (12 Hz), remote ship rendering, fire event visuals, dead reckoning |
| `combatSync.js` | Hit events, boss state, wave events, weather sync, pickup claims, kill feed, crew pickup sync |

Message routing is in `main.js` (`mpState.onBroadcast` → `handleBroadcastMessage` / `handleCombatMessage` / `processCombatAction`).

---

## 2. Host-Authoritative vs. Client-Local

| System | Authority | Notes |
|---|---|---|
| Enemy positions / AI | Host | Non-hosts dead-reckon between 5 Hz updates |
| Boss position / HP / phase | Host | Broadcast at ~5 Hz |
| Wave progression | Host | Broadcasts `wave_event` to all clients |
| Weather / time of day | Host | Periodic `weather_sync` at ~2 Hz |
| Ship position | Self (each client) | 12 Hz, threshold-gated |
| Weapon fire | Self (each client) | Remote clients see visual-only projectiles |
| Hit detection | Firing client ("shooter-favored") | Fires `hit` event; all clients apply damage |
| Gold economy | All clients (shared loot) | All players earn gold on any kill |
| Infamy | Client-local | Each player earns their own meta-progression |
| Port shop / upgrades | Client-local | Private per player; no sync needed |
| Card picker upgrades | Client-local | Each player upgrades independently between waves |
| Terrain (Palmov) | Deterministic from seed | All clients call `createTerrain(seed)` — same result |
| Resource pickups | Claim/confirm via host | First-claim wins; host confirms and broadcasts |
| Crew pickups | Claim/confirm via host | Same pattern as resource pickups |
| Audio | Client-local | All sounds including remote weapon fire play locally |
| Ocean phase | Client-local (cosmetic) | `elapsed` measured from each client's load time |
| Ship lanterns | Client-local | Remote ships have no lantern (cosmetic only) |
| Voyage chart | N/A in multiplayer | Multiplayer bypasses the roguelite chart entirely |

---

## 3. Message Type Catalog

### Ship State (`netSync.js`)

| Type | Direction | Frequency | Key Payload Fields |
|---|---|---|---|
| `ship_state` | Any → All | 12 Hz (threshold-gated) | `posX`, `posZ`, `heading`, `speed`, `health`, `maxHealth`, `weapon`, `autofire`, `shipClass`, `username` |
| `fire` | Any → All | Event-driven (~1–2/s) | `weapon`, `ox`, `oz`, `dx`, `dz` |
| `enemy_state` | Host → All | ~5 Hz | `enemies[]` (id, x, z, h, s, hp, maxHp, alive, sinking, faction) |

### Combat (`combatSync.js`)

| Type | Direction | Frequency | Key Payload Fields |
|---|---|---|---|
| `hit` | Any → All | Event-driven | `targetType`, `targetId`, `damage` |
| `enemy_death` | Host → All | Event-driven | `enemyId`, `faction` |
| `boss_spawn` | Host → All | Once per boss | `bossType`, `x`, `z` |
| `boss_state` | Host → All | ~5 Hz | `bossType`, `x`, `z`, `h`, `hp`, `maxHp`, `phase`, `alive`, `sinking` |
| `boss_defeated` | Host → All | Once | `bossType` |
| `boss_attack` | Host → All | Event-driven | `attack`, `phase` |
| `wave_event` | Host → All | Per wave transition | `event` (wave_start / wave_start_boss / wave_complete / game_over / victory), `wave`, `faction`, `boss` |
| `weather_change` | Host → All | Event-driven | `weather` |
| `weather_sync` | Host → All | ~2 Hz | `weather`, `timeOfDay` |
| `pickup_claim` | Any → All | Event-driven | `index`, `pickupType` |
| `pickup_confirmed` | Host → All | Event-driven | `index`, `playerId` |
| `crew_pickup_claim` | Any → All | Event-driven | `index` |
| `crew_pickup_confirmed` | Host → All | Event-driven | `index`, `playerId` |
| `kill_feed` | Any → All | Event-driven | `text`, `color` |
| `game_over` / `victory` | Host → All | Once | `wave` |

### Session Management (`multiplayer.js`)

| Type | Direction | Frequency | Purpose |
|---|---|---|---|
| `game_start` | Host → All | Once | Kick off game, share `terrainSeed` |
| `player_rejoin` | Rejoiner → All | On join during game | Request rejoin state from host |
| `rejoin_state` | Host → Rejoiner | On rejoin | Full snapshot (wave, weather, enemies, boss) |
| `host_migrated` | New host → All | On host disconnect | Announce new host ID |

---

## 4. Bandwidth Budget

Estimate for 4-player peak combat:

| Message | Rate | Size | KB/s |
|---|---|---|---|
| `ship_state` | 12 Hz × 4 players | ~500 B | ~24 KB/s |
| `enemy_state` | ~5 Hz | ~50 B × 12 enemies | ~3 KB/s |
| `boss_state` | ~5 Hz | ~100 B | ~0.5 KB/s |
| `weather_sync` | ~2 Hz | ~50 B | ~0.1 KB/s |
| `fire` / `hit` / events | ~2/s | ~100 B | ~0.2 KB/s |
| **Total estimate** | | | **~30–40 KB/s peak** |

Well within Supabase Realtime free-tier limits.

---

## 5. How to Add Sync to a New Feature

### Step 1 — Decide the authority model

- **Host-authoritative**: The host computes the truth and broadcasts it. Non-hosts apply received state.
- **Client-local**: Each player runs the feature independently. No sync needed.
- **Claim/confirm**: Any player can claim a shared resource; host arbitrates.

### Step 2 — Add send functions to `combatSync.js`

```js
// combatSync.js
export function sendMyFeatureEvent(mpState, data) {
  if (!mpState || !mpState.active) return;
  // Add !mpState.isHost check if host-only
  broadcast(mpState, {
    type: "my_feature",
    ...data
  });
}
```

### Step 3 — Add a handler to `handleCombatMessage()` in `combatSync.js`

```js
if (msg.type === "my_feature") {
  return {
    action: "my_feature",
    ...msg   // pass through relevant fields
  };
}
```

### Step 4 — Add a case to `processCombatAction()` in `main.js`

```js
} else if (action.action === "my_feature") {
  // Apply the received state locally
}
```

### Step 5 — Call the send function at the right time in `main.js`

For host-only events, guard with `if (mpState.isHost)`. For client events, call on the relevant player action.

### Claim/Confirm Pattern (for shared world objects)

```js
// Any player touches the object → broadcasts claim
sendMyPickupClaim(mpState, index);

// Host receives claim → first claimer wins → host broadcasts confirmed
if (mpState.isHost && !claimedSet.has(index)) {
  claimedSet.add(index);
  sendMyPickupConfirmed(mpState, index, action.senderId);
}

// All clients receive confirmed → only the winner gets the reward
if (action.playerId === mpState.playerId) {
  giveRewardToLocalPlayer();
}
removeObjectFromScene(index);
```

---

## 6. Player Join / Rejoin State

When a player rejoins mid-game, the host sends a `rejoin_state` snapshot containing:

**Included:**
- `terrainSeed` — used to deterministically recreate terrain
- `wave` / `waveState` — current wave number and phase
- `weather` — current weather key
- `timeOfDay` — current day/night position
- `enemies[]` — alive/sinking enemy positions
- `boss` — boss position, HP, phase (if active)
- `hostId` — current host player ID

**Not included (acceptable losses for a casual game):**
- Pickup positions (resource and crew pickups are cleared between waves anyway)
- Gold and upgrade state (rejoining player starts fresh)
- Run stats (`enemiesSunk`, `goldLooted`)
- Player health (rejoining player gets full HP)
- Merchant/crate state

---

## 7. Seeded RNG Rules

`rng.js` provides a seeded PRNG (`mulberry32`) used for deterministic simulation across clients.

**Rules:**
- All clients call `seedRNG(mpState.terrainSeed)` before `createTerrain()` at game start.
- `nextRandom()` **must** be called in the same order on all clients for all deterministic systems (enemy spawn positions, pickup types, boss loot rolls, etc.).
- Terrain uses its own `seededRand(seed)` function inside `terrainComposite.js`, NOT `nextRandom()` — so terrain is safely deterministic without affecting shared RNG state.
- GLB/async code **must not** call `nextRandom()` in async callbacks — async completion order differs per client and will desync shared RNG.
- If you add a new feature that uses `nextRandom()`, it must run on all clients in the same order, OR use a separate non-shared random.

---

## 8. Known Limitations and Acceptable Tradeoffs

| Limitation | Tradeoff Accepted |
|---|---|
| Hit detection is "shooter-favored" — the firing client detects hits locally and broadcasts damage | Acceptable for casual co-op; avoids authoritative server cost |
| Ocean phase is client-local — wave height can differ slightly between clients | Ship positions are authoritative (synced); visual phase offset is cosmetic |
| Remote ship lanterns not synced | Remote ships use player-color tint instead; lanterns would add network overhead |
| Rejoining player loses gold/upgrades | Simplifies rejoin flow; casual game expectation |
| All clients earn gold on any kill (shared loot) | Intentional co-op design; each player is rewarded for team kills |
| Infamy (meta-progression) increments for all kills on all clients | Each player earns Infamy independently; slight overcount on enemy sunk stat is acceptable |
| `runEnemiesSunk` increments on all clients for any kill | Known issue; acceptable for current Infamy scale |
| Wave timing can diverge if network latency delays `wave_complete` delivery | Wave completion is host-authoritative; client lag causes at most ~100 ms delay |
| No automated test infrastructure | All multiplayer testing is manual (two browser tabs) |
