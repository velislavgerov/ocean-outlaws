# Ocean Outlaws Mobile (Bootstrap)

This folder contains the initial iOS-first mobile workspace using Expo SDK 54 + React Native + React Three Fiber.

## Included in this bootstrap

- Expo entrypoint and app config
- R3F native `Canvas` scene with animated shader ocean, player ship, enemies, and projectiles
- React Native HUD overlay layer with joystick + combat actions + run result modal
- Zustand game state for combat simulation, ability cooldowns, and wave state transitions
- Shared ship class + wave manager logic extracted for mobile reuse

## Run locally

```bash
cd mobile
npm install
npm run start
npm run test:logic
```

For native device/simulator builds:

```bash
npm run ios
npm run android
```

## Next implementation steps

1. Replace placeholder ocean material with shader prototype (`expo-gl` validation on real iPhone).
2. Continue extracting reusable gameplay systems from `game/js/*` into shared mobile logic modules.
3. Replace HUD prototype buttons with joystick + action controls via gesture handler.
4. Add Supabase project config and edge-function-backed auth stub (`game-center-auth`).


## Notes

- `@react-three/fiber` is pinned to v9 for React 19 compatibility in Expo SDK 54.
