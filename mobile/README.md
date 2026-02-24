# Ocean Outlaws Mobile (Bootstrap)

This folder contains the initial iOS-first mobile workspace using Expo SDK 54 + React Native + React Three Fiber.

## Included in this bootstrap

- Expo entrypoint and app config
- Platform-specific R3F scenes: native uses `@react-three/fiber/native` + `expo-gl`, web uses `@react-three/fiber`
- React Native HUD overlay layer with joystick + combat actions + run result modal
- Zustand game state for combat simulation, ability cooldowns, wave state, and migrated tech/environment systems
- Shared ship class + wave manager logic extracted for mobile reuse
- FBX model loading for player/enemy ships from `game/assets/models/ships/*` (with Metro FBX asset config)

## Run locally

```bash
cd mobile
npm install
npm run start
cp .env.example .env
npm run test:logic
```

For native device/simulator builds:

```bash
npm run ios
npm run android
npm run web
```

## Next implementation steps

1. Replace placeholder ocean material with shader prototype (`expo-gl` validation on real iPhone).
2. Continue extracting reusable gameplay systems from `game/js/*` into shared mobile logic modules.
3. Replace HUD prototype buttons with joystick + action controls via gesture handler.
4. Add Supabase project config and edge-function-backed auth stub (`game-center-auth`).


## Notes

- `@react-three/fiber` is pinned to v9 for React 19 compatibility in Expo SDK 54.

- `metro.config.js` includes `fbx` in asset extensions and repo-root watch folder so mobile can load shared assets from `game/assets`.


## Backend scaffold

- Supabase SQL migration bootstrap: `../supabase/migrations/20260223_init_mobile_schema.sql`
- Edge function stubs: `game-center-auth`, `submit-score`, `unlock-achievement`, `verify-iap` under `../supabase/functions/`
- Mobile client wrappers: `src/services/supabaseClient.js`, `src/game/backend/*`


## Migration progress

- Migrated tech tree logic slice (`src/game/logic/techTree.js`) and environment/day-weather cycle (`src/game/logic/weatherCycle.js`).
- HUD now exposes a lightweight tech panel and weather cycle control to validate migrated systems in runtime.

## Cross-platform rendering notes

- `OceanScene.native.js` uses `@react-three/fiber/native` (expo-gl backend) for iOS/Android.
- `OceanScene.web.js` uses `@react-three/fiber` for Expo Web + React Native Web.
- This keeps one game state/store while using platform-appropriate render backends.
