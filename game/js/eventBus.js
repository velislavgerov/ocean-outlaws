// eventBus.js — ordered event system inspired by folio-2025
// Callbacks fire in ascending order (sparse array). Lower order = earlier execution.

export function createEventBus() {
  var callbacks = {};

  function on(name, callback, order) {
    if (order === undefined) order = 1;
    if (!callbacks[name]) callbacks[name] = [];
    if (!callbacks[name][order]) callbacks[name][order] = [];
    callbacks[name][order].push(callback);
  }

  function off(name, callback) {
    if (!callbacks[name]) return;
    for (var i = 0; i < callbacks[name].length; i++) {
      var group = callbacks[name][i];
      if (!group) continue;
      var idx = group.indexOf(callback);
      if (idx !== -1) {
        group.splice(idx, 1);
        return;
      }
    }
  }

  function trigger(name) {
    if (!callbacks[name]) return;
    var args = [];
    for (var i = 1; i < arguments.length; i++) args.push(arguments[i]);
    var groups = callbacks[name];
    for (var o = 0; o < groups.length; o++) {
      var group = groups[o];
      if (!group) continue;
      for (var c = 0; c < group.length; c++) {
        group[c].apply(null, args);
      }
    }
  }

  function clear(name) {
    if (name) {
      delete callbacks[name];
    } else {
      callbacks = {};
    }
  }

  return { on: on, off: off, trigger: trigger, clear: clear };
}
