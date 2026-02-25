# Ocean Outlaws 3D Asset Utilization Opportunities

## Objective
Leverage the existing 3D model inventory to increase world readability, thematic variety, and progression feedback—without requiring net-new art production.

This document focuses on opportunities where gameplay systems currently use procedural placeholder geometry (or minimal visual variation) and can be upgraded using assets already present under `game/assets/models/` and cataloged in `game/data/testLabModelCatalog.json`.

## Current-State Snapshot

### What we already have available
- Test Lab catalog entries: **239** total, across `ship`, `tree`, `island`, `port`, and `water` groups.
- Active gameplay composite preset (`compositePresetsPalmov30.json`) uses **77 unique model paths**.
- Estimated immediately available but not currently used by active gameplay composition: **162 cataloged models**.

### High-value gaps in current gameplay visuals
1. **Supply ports** are still generated from primitive meshes (`BoxGeometry`, `CylinderGeometry`, sphere lamp), even though we have piers, houses, props, and fences in the asset set.
2. **Resource pickups/drops** are still primitive crate/barrel geometry with color tinting, despite having collectible-like props (barrels, boxes, bags, fish, bottles, baskets, food).
3. **Map composition runtime** currently loads a single composite file (`compositePresetsPalmov30.json`), leaving large themed sets and alternate compositions underused.

## Opportunity Matrix (Comprehensive)

## 1) Ports, Harbors, and Shoreline Economy Spaces

### 1.1 Replace procedural port mesh with modular GLB harbor kits
**Current behavior:** `buildPortMesh()` in `port.js` builds a minimal pier + crate + barrel + lamp from primitives.

**Assets to leverage now:**
- Main anchors: `environment/wooden-piers/*`, `environment/wooden-platforms/*`, `environment/destroyed-wooden-pier.glb`
- Harbor dressing: `environment/barrels/*`, `environment/boxes/*`, `environment/bags/*`, `environment/boards/*`, `environment/lamppost.glb`, `environment/bench.glb`, `environment/chairs/*`, `environment/tables/*`
- Harbor structures: `houses/trading/*`, `houses/pirate/*`, `houses/lighthouse.glb`, `houses/house.glb`
- Boundary/readability: `environment/fences/stone/*`, `environment/fences/untreated/*`, `environment/wooden-posts/*`

**Gameplay benefit:**
- Ports become recognizable POIs at distance.
- Better affordance for repair/restock interactions.
- Easier future addition of dock-specific mechanics (shop NPCs, queueing, quests).

**Implementation notes:**
- Define 3-5 reusable port composition templates (small cove dock, merchant quay, pirate shack dock, lighthouse jetty, damaged dock).
- Swap template by biome/zone difficulty or faction influence.

### 1.2 Faction-themed ports
**Assets to leverage now:**
- Pirate themes: `houses/pirate/*`, `vehicles/pirate-ships/*`
- Merchant/trade themes: `houses/trading/*`, `food-tents/*`, `bag-grain*`, `basket.glb`, `box*`
- Neutral/civil themes: `house.glb`, `lighthouse.glb`, benches/tables/chairs

**Gameplay benefit:**
- Visual storytelling of control/safety at each port.
- Allows map progression feedback through environment state changes.

### 1.3 Port upgrade visual progression
**Assets to leverage now:**
- Tier progression using more complete pier + props sets (`wooden-pier` -> `wooden-pier-5` + lamppost + fenced market details).

**Gameplay benefit:**
- Port level/relationship can be read without UI.

---

## 2) Drops, Collectibles, and Salvage Readability

### 2.1 Replace primitive pickup meshes with type-specific prop models
**Current behavior:** `pickup.js` builds drops from primitive box/cylinder geometry.

**Assets to leverage now by pickup type:**
- Ammo: `environment/boxes/*`, `environment/barrels/barrel-stand.glb`
- Fuel: `environment/barrels/*`, `environment/bottles/*`
- Parts: `environment/boards/*`, `environment/wooden-posts/*`, `environment/wooden-platforms/*`
- Gold/loot: `environment/basket.glb`, `environment/mug.glb`, `environment/bags/*`
- Food/heal style pickups (future): `environment/food/*`, `environment/drying-fish.glb`, `environment/fish.glb`

**Gameplay benefit:**
- No need to infer pickup type only from color.
- Stronger “salvage from wreckage” fantasy.

### 2.2 Add rarity/quality variants via existing prop families
**Assets to leverage now:**
- Use numbered variants (e.g., `barrel`, `barrel-2`, `barrel-3`; `box`, `box-2`, `box-3`) for common/uncommon/rare visuals.

**Gameplay benefit:**
- Better reward anticipation before collection.

### 2.3 Wreck-drop bundles
**Assets to leverage now:**
- `vehicles/destroyed/*` fragments + floating props (`boards`, `barrels`, `bags`, `bottles`) as temporary salvage fields.

**Gameplay benefit:**
- Post-combat scenes feel consequential.
- Opportunity for risk/reward mini-loops (linger for loot vs continue combat).

---

## 3) Island Biome and Encounter Set Dressing

### 3.1 Use additional island/location packs in runtime rotation
**Current behavior:** Runtime composition path defaults to `compositePresetsPalmov30.json`.

**Assets to leverage now:**
- Location anchors in `lands/*`, `islands/*`, `waters/water-location-*`
- Supplemental terrain detail in `mountains/*`, `stones/*`, `trees/*`, `plants/*`

**Gameplay benefit:**
- More zone distinctiveness and replay variety.
- Better tie between named map zones and in-world silhouettes.

### 3.2 Encounter-specific visual language
**Assets to leverage now:**
- Sea monster zones: `environment/tentacles/*`, `land-sea-monster-attack.glb`, `water-location-sea-monster-attack.glb`
- Secret/ruin zones: `land-secret-island.glb`, `houses/secret/*`, `stones/ancient/*`
- Trade zones: `land-trade-port.glb`, `houses/trading/*`, market props
- Lighthouse/nav zones: `island-lighthouse-pier.glb`, `houses/lighthouse.glb`, piers/lampposts

**Gameplay benefit:**
- Faster player comprehension of threat/opportunity by silhouette.

### 3.3 Coastal traffic and static ambient vessels
**Assets to leverage now:**
- `vehicles/sailboats/*`, `vehicles/boat.glb`, `ships-palmov/boats/*`, `ships-palmov/small/*`

**Gameplay benefit:**
- World feels populated, not just combat-spawned.

---

## 4) Enemy, Mission, and Boss Scene Enhancement

### 4.1 Expand enemy ship silhouette diversity without balance changes
**Assets to leverage now:**
- `ships-palmov/small|medium|large/*`, `ships-palmov/viking/*`, `vehicles/pirate-ships/*`

**Gameplay benefit:**
- More visual variety at same stat tiers.
- Easier faction recognition.

### 4.2 Boss arena staging assets
**Assets to leverage now:**
- Kraken/monster arenas: `environment/tentacles/*`, `waterfall.glb`, dramatic rock sets (`mountain-arch*`, `ancient-stone*`)
- Human boss arenas: fortress-like fence/pier/house clusters.

**Gameplay benefit:**
- Boss fights feel authored rather than regular-wave scaling.

### 4.3 Convoy/escort mission dressing (future mode)
**Assets to leverage now:**
- Merchant convoy from `vehicles/sailboats/*` + cargo props (`bags`, `boxes`, `food`).

**Gameplay benefit:**
- Enables non-combat objective formats using existing art.

---

## 5) UI/Meta Loops that Can Use Existing Models

### 5.1 Upgrade screens and card reward previews
**Assets to leverage now:**
- `ship` catalog entries as rotating 3D previews.
- Prop assets for reward cards (crate, barrel, fish, etc.).

**Gameplay benefit:**
- Better polish and player understanding in meta UI.

### 5.2 Port screen diorama backgrounds
**Assets to leverage now:**
- `houses/*`, `wooden-piers/*`, market props + faction ship parked in background.

**Gameplay benefit:**
- Port interactions feel physically located in-world.

### 5.3 Minimap/legend icon derivation from model families
**Assets to leverage now:**
- Use consistent iconography tied to model categories (pirate-house icon, lighthouse icon, tentacle icon).

**Gameplay benefit:**
- Stronger map readability and onboarding.

---

## 6) Technical Integration Opportunities

### 6.1 Asset role registry (lightweight)
Create a small JSON mapping from model paths to gameplay roles:
- `port_modules`, `pickup_ammo`, `pickup_fuel`, `pickup_parts`, `pickup_gold`, `encounter_sea_monster`, etc.

This enables deterministic selection and future balancing without hardcoding asset paths in multiple systems.

### 6.2 Weighted variation pools by zone and faction
Define weighted pools of models for each system:
- Port template pool by faction.
- Pickup model pool by resource type and rarity.
- Ambient vessel pool by zone danger level.

### 6.3 Budget-aware LOD/quality gates
Reuse existing quality settings to control:
- Prop density at ports.
- Drop bundle complexity.
- Ambient traffic count.

### 6.4 Collision policy per asset role
- Keep colliders for major navigational blockers (islands, buildings, large piers).
- Disable/simplify collider on small props and floating pickups.

---

## Prioritized Roadmap

### Phase 1 (High impact, low risk)
1. **Port visual overhaul:** replace primitive `buildPortMesh()` with modular GLB compositions.
2. **Pickup mesh overhaul:** replace primitive crate/barrel with role-specific prop models.
3. **Add 2-3 themed port variants** (merchant, pirate, neutral).

### Phase 2 (Medium effort, high replay value)
1. Rotate/add additional composition sets for zone-specific visuals.
2. Add ambient vessel spawning using small/boat model pools.
3. Add wreck-drop salvage bundles from destroyed ship + prop fragments.

### Phase 3 (Polish + depth)
1. Boss arena prop kits per boss type.
2. Port upgrade progression visuals by reputation or game stage.
3. UI 3D previews in port and reward contexts.

---

## Suggested Success Metrics
- **Visual variety:** unique model paths spawned per 10-minute run.
- **System coverage:** % of gameplay systems using GLB assets instead of primitives.
- **Player readability:** reduced time-to-identify pickup/resource type in playtests.
- **Engagement proxy:** average time spent at port and around post-combat salvage zones.

## Immediate Candidate Asset Pools (Quick Start)

### Port module starter set
- `assets/models/environment/wooden-piers/wooden-pier.glb`
- `assets/models/environment/wooden-platforms/wooden-platform.glb`
- `assets/models/environment/lamppost.glb`
- `assets/models/houses/trading/trading-house.glb`
- `assets/models/environment/boxes/box.glb`
- `assets/models/environment/barrels/barrel.glb`

### Pickup starter set
- Ammo: `assets/models/environment/boxes/box-2.glb`
- Fuel: `assets/models/environment/barrels/barrel-2.glb`
- Parts: `assets/models/environment/boards/board.glb`
- Gold: `assets/models/environment/basket.glb`

### Encounter flavor set
- Sea monster: `assets/models/environment/tentacles/tentacles.glb`
- Trade route: `assets/models/vehicles/sailboats/sailboat.glb`
- Ruins: `assets/models/stones/ancient/ancient-stone-12.glb`

---

## Conclusion
Ocean Outlaws already has a deep, production-ready 3D asset library; the biggest wins now come from **wiring this inventory into active gameplay systems** (ports, pickups, encounter staging), not from creating new art. Converting just ports and pickups from primitives to existing GLBs would materially improve perceived production value and support future feature depth.
