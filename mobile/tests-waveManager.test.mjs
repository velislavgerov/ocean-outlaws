import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createWaveManager,
  consumeSpawn,
  updateWaveState,
  WAVE_STATE_ACTIVE,
  WAVE_STATE_GAME_OVER,
  WAVE_STATE_SPAWNING,
  WAVE_STATE_WAITING
} from './src/game/logic/waveManager.js';

test('wave manager starts in waiting state', () => {
  const mgr = createWaveManager();
  assert.equal(mgr.state, WAVE_STATE_WAITING);
  assert.equal(mgr.wave, 1);
});

test('waiting transitions to spawning after countdown', () => {
  const mgr = createWaveManager();
  const event = updateWaveState(mgr, 0, 100, 3.1);
  assert.equal(event, 'wave_start');
  assert.equal(mgr.state, WAVE_STATE_SPAWNING);
  assert.ok(mgr.enemiesToSpawn > 0);
});

test('consumeSpawn drains queue and flips to active', () => {
  const mgr = createWaveManager();
  updateWaveState(mgr, 0, 100, 3.1);
  while (consumeSpawn(mgr)) {}
  assert.equal(mgr.enemiesToSpawn, 0);
  assert.equal(mgr.state, WAVE_STATE_ACTIVE);
});

test('player death produces game_over terminal state', () => {
  const mgr = createWaveManager();
  const event = updateWaveState(mgr, 0, 0, 0.016);
  assert.equal(event, 'game_over');
  assert.equal(mgr.state, WAVE_STATE_GAME_OVER);
});
