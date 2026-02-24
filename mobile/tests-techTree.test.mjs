import test from 'node:test';
import assert from 'node:assert/strict';
import { canUnlock, createTechState, getTechBonuses, unlockNode } from './src/game/logic/techTree.js';

test('cannot unlock without enough gold', function () {
  var state = createTechState();
  assert.equal(canUnlock(state, 'offense', 0, 20), false);
});

test('unlocking node applies expected bonuses', function () {
  var state = createTechState();
  var cost = unlockNode(state, 'offense', 0, 100);
  assert.equal(cost, 40);
  var bonuses = getTechBonuses(state);
  assert.equal(bonuses.damage, 0.15);
});
