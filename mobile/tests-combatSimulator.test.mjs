import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCombatState,
  firePlayerProjectile,
  setInputVector,
  spawnEnemy,
  stepCombat
} from './src/game/logic/combatSimulator.js';

test('player movement responds to steering input', function () {
  var sim = createCombatState();
  setInputVector(sim, 0.5, -1);
  stepCombat(sim, 0.25);
  assert.notEqual(sim.player.z, 0);
});

test('player can fire projectile when ammo is available', function () {
  var sim = createCombatState();
  var fired = firePlayerProjectile(sim, 12, true);
  assert.equal(fired, true);
  assert.equal(sim.projectiles.length, 1);
});

test('enemy spawn and projectile hit reduces enemy hp', function () {
  var sim = createCombatState();
  spawnEnemy(sim, 1);
  sim.enemies[0].x = 0;
  sim.enemies[0].z = 3;
  sim.player.rot = 0;
  firePlayerProjectile(sim, 20, true);

  for (var i = 0; i < 10; i++) {
    stepCombat(sim, 0.1);
  }

  assert.ok(sim.enemies.length === 0 || sim.enemies[0].hp < sim.enemies[0].maxHp);
});
