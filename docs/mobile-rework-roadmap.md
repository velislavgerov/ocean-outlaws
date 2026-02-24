# ⚓ Ocean Outlaws Mobile Rework

## Strategy & Technical Roadmap

**Primary target:** iOS (first)

**Runtime stack:** Expo (bare workflow) + React Native + React Three Fiber + expo-gl

**Backend & services:** Supabase + Apple Game Center + RevenueCat (+ optional AdMob)

---

## 1) Product Direction

Ocean Outlaws is currently a browser-based Three.js game. The rework goal is to ship a native-feeling mobile version with stronger performance, first-class platform integrations, and a backend suitable for progression, leaderboard integrity, and monetization.

The project should stay **cross-platform by architecture**, while sequencing delivery as:

1. iOS production launch
2. Android expansion using shared gameplay/backend code

---

## 2) Stack Decision Summary

### Why not WebView as the main architecture

A WebView wrapper is faster to prototype, but introduces long-term constraints:

- GPU performance and rendering headroom are limited for advanced water shaders/effects.
- IAP and Game Center need bridge code (`postMessage`) that becomes fragile over time.
- Native integrations (haptics, notifications, platform auth) are less clean.

### Chosen architecture: R3F + expo-gl

Using React Three Fiber inside Expo gives us native OpenGL rendering through `expo-gl` while keeping the app in the React Native ecosystem.

| Concern | WebView | R3F + expo-gl (chosen) |
| --- | --- | --- |
| GPU performance | Good but capped | Native GL path, higher headroom |
| IAP integration | JS/native bridge complexity | Native SDK flow via RevenueCat |
| Game Center | Bridge-dependent | First-class native path |
| Ocean shaders | More constrained | Custom GLSL with tighter control |
| Time to first build | Faster | Slower initially, better long-term |

---

## 3) Target Architecture

### Layers

1. **Rendering layer**
   - React Three Fiber + expo-gl
   - Ocean, ships, particles, camera, lighting

2. **Gameplay logic layer**
   - Framework-agnostic TypeScript modules
   - AI, combat, wave progression, collisions, balancing

3. **Native app layer**
   - React Native HUD/menus + gesture input
   - Auth, entitlements, notifications, lifecycle

4. **Cloud layer**
   - Supabase Postgres + Edge Functions
   - Auth bridge, score validation, progression sync, purchase unlock sync

### Service responsibility map

| Concern | Service |
| --- | --- |
| Rendering | R3F + expo-gl |
| Input | react-native-gesture-handler |
| Identity (iOS) | Game Center |
| API/Auth session | Supabase Edge Functions + JWT |
| Progression | Supabase Postgres |
| Leaderboards/Achievements | Game Center (native) + Supabase mirror |
| IAP | RevenueCat + StoreKit 2 |
| Optional ads | AdMob rewarded |

---

## 4) Supabase Data Model (Initial)

```sql
-- players
id uuid primary key,
game_center_id text unique,
google_play_id text unique,
display_name text,
platform text,
created_at timestamptz default now()

-- player_progression
player_id uuid primary key references players(id),
ship_unlocks jsonb,
tech_tree jsonb,
highest_wave int default 0,
total_kills int default 0,
updated_at timestamptz default now()

-- scores
id bigserial primary key,
player_id uuid references players(id),
wave_reached int,
score int,
ship_class text,
created_at timestamptz default now()

-- achievements
id bigserial primary key,
player_id uuid references players(id),
achievement_id text,
unlocked_at timestamptz default now()
```

### Required Edge Functions

- `game-center-auth` — verifies Apple signature, upserts player, returns Supabase session.
- `submit-score` — server-side score validation/anti-cheat gate before insert.
- `unlock-achievement` — server-authoritative unlock checks.
- `verify-iap` — RevenueCat webhook consumer that updates unlock entitlements.

---

## 5) Porting Plan: Three.js to R3F

### Reusable logic (high confidence)

- Wave spawning and survival progression
- Ship movement/combat math
- Damage/health/collision calculations
- Tech tree state rules
- Day/night & weather timers
- Boss sequencing scripts

### Rewrite areas (required)

| Current style | Target style |
| --- | --- |
| Imperative scene setup (`scene.add`) | Declarative JSX scene graph (`<Ship />`, `<Ocean />`) |
| Manual render loop (`requestAnimationFrame`) | R3F `useFrame` hooks |
| DOM/keyboard controls | Touch joystick + action buttons |
| HTML HUD overlay | RN layered `View` overlay |
| Local browser storage | Supabase-backed progression sync |

### Highest technical risk

Ocean shader behavior/performance in `expo-gl` must be proven early on a real iPhone target (minimum iPhone 12 class).

---

## 6) Input & HUD (Mobile First)

- Left-thumb virtual joystick for steering/throttle
- Right-thumb buttons for fire/ability/boost
- Optional tap-to-target assist
- RN absolute overlay for health, ammo, wave status, and modal screens

This keeps 3D rendering and UI concerns separated while supporting responsive mobile controls.

---

## 7) Monetization & Growth

### Recommended initial IAP catalog

- Carrier Unlock — $2.99
- Submarine Unlock — $2.99
- Full Fleet Bundle — $4.99
- Ship Skins Pack — $1.99
- Remove Ads — $1.99

### Monetization flow

1. Product setup in App Store Connect.
2. Product mapping in RevenueCat.
3. Purchases resolved by RevenueCat.
4. Webhook to Supabase `verify-iap` updates entitlements.
5. Client reads entitlements from Supabase state.

### Optional ads

Rewarded ads only between waves (no mid-combat interruption).

---

## 8) iOS Delivery Phases (9-week baseline)

### Phase 1 (Weeks 1-2): Foundation

- Bootstrap Expo bare + TypeScript app
- Install/validate `three`, `@react-three/fiber`, `expo-gl`
- Extract pure logic modules from existing codebase
- Ship an ocean shader POC on device
- Scaffold Supabase project + Edge Functions

### Phase 2 (Weeks 3-4): Core rendering

- Ocean/water material port
- Ship components + movement
- Enemy components + AI loop
- Wave spawner + central state store
- Day/night + weather updates

### Phase 3 (Week 5): Input/UI

- Virtual joystick
- Action buttons
- HUD overlay
- Upgrade/tech tree screen
- Game-over and wave-complete flows

### Phase 4 (Week 6): Auth/progression

- Game Center authentication
- `game-center-auth` edge function
- Progression sync
- Leaderboard submit hooks
- Achievement trigger pipeline

### Phase 5 (Week 7): Monetization

- RevenueCat SDK integration
- IAP storefront and purchase flow
- `verify-iap` webhook
- Entitlement-driven ship unlocks
- Optional rewarded ad loop

### Phase 6 (Week 8): Performance/polish

- Device profiling (iPhone 12 baseline)
- Draw call and particle budget tuning
- Texture compression strategy (KTX2/Basis)
- Shadow/post-processing reductions where needed
- App icon/splash/store screenshots

### Phase 7 (Week 9): Submission

- Internal/external TestFlight
- Privacy manifest + ATT checks (if ads)
- Metadata finalization in App Store Connect
- App Review submission and response

---

## 9) Android Expansion Plan (Post iOS)

The core client code remains shared. Android adds:

- Google Play Games Services auth path
- Google Play leaderboard/achievement identifiers
- Play Console distribution setup

Implementation strategy:

- Keep one `useGameAuth()` abstraction with platform switch.
- iOS path calls `game-center-auth`; Android path calls `google-play-auth`.
- Store both Apple and Google IDs on `players` for future account linking.

Expected additional effort after iOS launch: ~2 weeks.

---

## 10) Risk Register

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| Ocean shader performance on mid-range devices | Medium | Validate in Phase 1 before wider port |
| API gaps in RN + GL ecosystem | Low-Medium | Pin versions early and build fallbacks |
| IAP/App Review rejection risk | Low | Follow Apple policy and sandbox-test flows |
| Game Center signature complexity | Medium | Use proven verification approach + extra budget |
| Community support gaps in R3F RN | Medium | Keep scope tight and avoid unstable extras |

---

## 11) Immediate Repo Execution Plan

1. Create a dedicated mobile workspace (`mobile/`) with Expo bare workflow.
2. Move reusable gameplay logic into an engine package/module that can be shared.
3. Build an on-device ocean shader benchmark scene and record perf.
4. Stand up Supabase schema + edge functions in versioned migrations.
5. Deliver a thin vertical slice: one ship, one enemy type, one wave loop, one leaderboard submit path.

This sequence minimizes early risk and produces testable milestones quickly.
