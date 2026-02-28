# Weapon Tier Upgrades Design

Add per-weapon tier upgrades to the 3 existing weapons (Cannon, Chain Shot, Fire Bomb). Each weapon has 3 tiers: base, improved, and master. Higher tiers improve stats and the top tier unlocks a unique perk. Upgrades drop as loot from defeated enemies and bosses.

## Tier Definitions

Tiers are defined as arrays inside each weapon's config. Each tier overrides specific base stats. Anything not specified falls through to the base config.

### Cannon

| Tier | Name | Damage | Fire Rate | Proj Speed | Perk |
|------|------|--------|-----------|------------|------|
| 0 | Iron Cannon | 1 | 1.0 | 35 | — |
| 1 | Bronze Cannon | 1.5 | 0.85 | 40 | — |
| 2 | Steel Cannon | 2.2 | 0.7 | 45 | **Pierce**: projectile passes through the first target and hits a second |

### Chain Shot

| Tier | Name | Damage | Homing Turn Rate | Perk |
|------|------|--------|-------------------|------|
| 0 | Rope Shot | 3 | 1.8 | — |
| 1 | Barbed Chain | 4.5 | 2.4 | — |
| 2 | Anchor Chain | 6 | 3.0 | **Slow**: hit enemy moves at 50% speed for 3s |

### Fire Bomb

| Tier | Name | Damage | Splash Scale | Perk |
|------|------|--------|-------------|------|
| 0 | Tar Bomb | 6 | 3.5 | — |
| 1 | Greek Fire | 9 | 4.5 | — |
| 2 | Hellfire Bomb | 13 | 6.0 | **Burn**: leaves a burning area on water for 4s, damages enemies passing through |

## Weapon State

`createWeaponState` returns a `weaponTiers` object tracking the current tier per weapon:

```
{ cannon: 0, chainshot: 0, firebomb: 0 }
```

A helper `getEffectiveConfig(weaponKey, tier)` merges the base weapon config with the active tier's stat overrides. `fireWeapon` and `updateWeapons` read from this merged config instead of the raw base.

Existing global upgrade multipliers (+Damage, +Fire Rate, +Projectile Speed from `upgrade.js`) stack on top of tier stats multiplicatively.

## Perk Implementations

### Pierce (Steel Cannon)

When a pierce-projectile hits an enemy, decrement `pierceCount` instead of destroying the projectile. The projectile continues traveling and can hit one more target before being consumed. Set `pierceCount = 1` at projectile creation when the perk is active.

### Slow (Anchor Chain)

On hit, set `enemy.slowTimer = 3` and `enemy.slowMult = 0.5` on the target. The enemy update loop in `enemy.js` checks for `slowTimer > 0` and multiplies movement speed by `slowMult`. Timer decrements each frame. No visual change needed beyond the existing hit effect.

### Burn (Hellfire Bomb)

On impact, spawn a burn zone at the hit location: a flat translucent circle on the water surface. Lasts 4 seconds. Each tick, any enemy whose position falls within the burn radius takes damage (1 HP/s). Reuses scaled splash effect visuals. Burn zones are tracked in the weapon effects array and cleaned up on expiry.

## Acquisition: Loot Drops Only

No port purchases. Weapon upgrades are obtained exclusively through loot drops.

### Drop sources
- **Boss kills**: guaranteed weapon upgrade drop
- **Rare enemy kills**: small chance (~10%) to drop a weapon upgrade

### Drop behavior
- The pickup specifies which weapon it upgrades, randomly weighted toward lower-tier weapons
- Collecting it immediately upgrades that weapon to the next tier
- Banner notification on collect (e.g., "Cannon upgraded to Bronze Cannon!")
- If the target weapon is already at max tier, re-roll to another weapon
- If all weapons are maxed, the drop converts to gold

### Pickup visual
- Distinct glowing pickup, color-coded per weapon type:
  - Gold for Cannon upgrades
  - Red for Chain Shot upgrades
  - Blue for Fire Bomb upgrades

### Persistence
- Weapon tiers saved in run state alongside upgrade levels and crew
- Tiers reset to 0 on new game

## Files Modified

- **`weapon.js`** (~150 LOC): add tier arrays to weapon configs, `getEffectiveConfig` helper, `weaponTiers` in state, pierce/burn perk logic in `fireWeapon`/`updateWeapons`, rename internal weapon keys from turret/missile/torpedo to cannon/chainshot/firebomb
- **`enemy.js`** (~15 LOC): slow debuff check in enemy movement update
- **`pickup.js`** (~40 LOC): new `"weapon_upgrade"` pickup type with weapon-colored visuals
- **`boss.js`** (~10 LOC): spawn weapon upgrade pickup on boss defeat
- **`hud.js`** (~20 LOC): show current weapon tier name instead of base name in HUD
- **`runState.js`** (~5 LOC): save/load weapon tiers

## Systems Unchanged

Ammo system (single shared pool, per-weapon ammo costs), ship classes and their abilities, upgrade tree (global multipliers), card picker, crew bonuses, multiplayer sync.
