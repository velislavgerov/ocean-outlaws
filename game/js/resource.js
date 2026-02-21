// resource.js — resource state management: ammo, fuel, repair parts

// --- balance tuning ---
var STARTING_AMMO = 50;
var MAX_AMMO = 80;
var STARTING_FUEL = 100;
var MAX_FUEL = 100;
var FUEL_BURN_RATE = 1.5;        // fuel per second at full throttle
var LOW_FUEL_SPEED_MULT = 0.35;  // min speed multiplier at zero fuel

// --- create resource state ---
export function createResources() {
  return {
    ammo: STARTING_AMMO,
    maxAmmo: MAX_AMMO,
    fuel: STARTING_FUEL,
    maxFuel: MAX_FUEL,
    parts: 0
  };
}

// --- reset resources for restart ---
export function resetResources(res) {
  res.ammo = STARTING_AMMO;
  res.maxAmmo = MAX_AMMO;
  res.fuel = STARTING_FUEL;
  res.maxFuel = MAX_FUEL;
  res.parts = 0;
}

// --- consume fuel based on current throttle ---
export function consumeFuel(res, speedRatio, dt) {
  if (res.fuel <= 0) return;
  var burn = FUEL_BURN_RATE * speedRatio * dt;
  res.fuel = Math.max(0, res.fuel - burn);
}

// --- get speed multiplier from fuel level ---
export function getFuelSpeedMult(res) {
  if (res.fuel <= 0) return LOW_FUEL_SPEED_MULT;
  // smooth ramp: below 20% fuel starts reducing speed
  var ratio = res.fuel / res.maxFuel;
  if (ratio > 0.2) return 1.0;
  // lerp from LOW_FUEL_SPEED_MULT to 1.0 over 0-20% range
  var t = ratio / 0.2;
  return LOW_FUEL_SPEED_MULT + (1.0 - LOW_FUEL_SPEED_MULT) * t;
}

// --- try to spend ammo; returns true if ammo available ---
export function spendAmmo(res) {
  if (res.ammo <= 0) return false;
  res.ammo--;
  return true;
}

// --- add resource from pickup ---
export function addAmmo(res, amount) {
  res.ammo = Math.min(res.maxAmmo, res.ammo + amount);
}

export function addFuel(res, amount) {
  res.fuel = Math.min(res.maxFuel, res.fuel + amount);
}

export function addParts(res, amount) {
  res.parts += amount;
}
