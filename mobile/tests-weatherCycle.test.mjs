import test from 'node:test';
import assert from 'node:assert/strict';
import { createEnvironmentState, cycleWeather, getTimeLabel, getWeatherPreset, tickEnvironment } from './src/game/logic/weatherCycle.js';

test('environment ticks time forward', function () {
  var env = createEnvironmentState();
  var before = env.timeOfDay;
  tickEnvironment(env, 60);
  assert.ok(env.timeOfDay > before);
});

test('weather cycle rotates preset', function () {
  var env = createEnvironmentState();
  var before = getWeatherPreset(env).label;
  cycleWeather(env);
  var after = getWeatherPreset(env).label;
  assert.notEqual(after, before);
  assert.ok(getTimeLabel(env).includes(':'));
});
