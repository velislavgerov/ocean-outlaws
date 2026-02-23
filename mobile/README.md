# Ocean Outlaws Mobile (Bootstrap)

This folder contains the initial iOS-first mobile workspace using Expo + React Native + React Three Fiber.

## Included in this bootstrap

- Expo entrypoint and app config
- R3F native `Canvas` scene with a placeholder ocean and ship
- React Native HUD overlay layer
- Zustand game state for basic HUD actions (fire, reload, boost, next wave)

## Run locally

```bash
cd mobile
npm install
npm run start
```

For native device/simulator builds:

```bash
npm run ios
npm run android
```

## Next implementation steps

1. Replace placeholder ocean material with shader prototype (`expo-gl` validation on real iPhone).
2. Move reusable gameplay logic from `game/js/*` into shared modules.
3. Replace HUD prototype buttons with joystick + action controls via gesture handler.
4. Add Supabase project config and edge-function-backed auth stub (`game-center-auth`).
