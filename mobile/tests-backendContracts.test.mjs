import test from 'node:test';
import assert from 'node:assert/strict';
import { hasSupabaseEnv } from './src/config/env.js';

test('supabase env is absent by default in local test runtime', function () {
  assert.equal(hasSupabaseEnv(), false);
});
