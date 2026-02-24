import test from 'node:test';
import assert from 'node:assert/strict';
import {
  activateAbility,
  createAbilityState,
  getShipClass,
  updateAbility
} from './src/game/logic/shipClasses.js';

test('ship class lookup falls back to destroyer', () => {
  assert.equal(getShipClass('unknown').key, 'destroyer');
});

test('timed ability enters cooldown after duration', () => {
  const ability = createAbilityState('destroyer');
  assert.equal(activateAbility(ability), true);
  assert.equal(ability.active, true);

  updateAbility(ability, ability.duration + 0.1);
  assert.equal(ability.active, false);
  assert.equal(ability.cooldownTimer, ability.cooldown);
});

test('instant ability immediately goes to cooldown', () => {
  const ability = createAbilityState('cruiser');
  assert.equal(activateAbility(ability), true);
  assert.equal(ability.active, false);
  assert.equal(ability.cooldownTimer, ability.cooldown);
});
