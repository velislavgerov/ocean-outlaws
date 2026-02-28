// ticker.js — game loop driver with ordered tick events
// Wraps requestAnimationFrame. Subsystems register via events.on('tick', fn, order).
// Inspired by folio-2025 ordered update system.

import { createEventBus } from "./eventBus.js";

export function createTicker() {
  var events = createEventBus();
  var elapsed = 0;
  var delta = 0;
  var running = false;
  var rafId = null;
  var lastTime = 0;
  var MAX_DELTA = 0.1;

  function update(time) {
    if (!running) return;
    rafId = requestAnimationFrame(update);

    var now = time * 0.001;
    if (lastTime === 0) lastTime = now;
    delta = Math.min(now - lastTime, MAX_DELTA);
    lastTime = now;
    elapsed += delta;

    events.trigger("tick", delta, elapsed);
  }

  function start() {
    if (running) return;
    running = true;
    lastTime = 0;
    rafId = requestAnimationFrame(update);
  }

  function stop() {
    running = false;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function manualTick(dt) {
    delta = Math.min(dt, MAX_DELTA);
    elapsed += delta;
    events.trigger("tick", delta, elapsed);
  }

  return {
    events: events,
    start: start,
    stop: stop,
    manualTick: manualTick,
    getElapsed: function () { return elapsed; },
    getDelta: function () { return delta; }
  };
}
