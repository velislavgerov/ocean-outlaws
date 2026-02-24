// input.js — click/tap + keyboard input handler
// QWER ability bar: Q/W/E/R mapped to slot0-slot3

var mouse = {
  x: 0,
  y: 0,
  clicked: false,
  clickConsumed: false,
  held: false,
  holdStart: 0
};

// multi-touch tracking: map from Touch.identifier → { id, x, y, zone }
var touches = {};

// fire touch state — updated by right-half touch events
var fireTouch = { active: false, x: 0, y: 0, id: -1 };

// keyboard action queue — consumed once per frame
var keyActions = [];

// autofire state (always on — no toggle key)
var autofire = true;

// game canvas reference — only clicks on canvas register as game input
var gameCanvas = null;

function isGameTarget(e) {
  return gameCanvas && e.target === gameCanvas;
}

function onMouseMove(e) {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
}

function onMouseDown(e) {
  if (e.button === 0 && isGameTarget(e)) {
    mouse.clicked = true;
    mouse.clickConsumed = false;
    mouse.held = true;
    mouse.holdStart = performance.now();
  }
}

function onMouseUp(e) {
  if (e.button === 0) {
    mouse.held = false;
  }
}

// Returns "move" for left half, "fire" for right half (including center line)
function getTouchZone(clientX) {
  return clientX < window.innerWidth / 2 ? "move" : "fire";
}

function onTouchStart(e) {
  if (isGameTarget(e)) e.preventDefault();
  var changed = e.changedTouches;
  for (var i = 0; i < changed.length; i++) {
    var t = changed[i];
    var zone = getTouchZone(t.clientX);
    touches[t.identifier] = { id: t.identifier, x: t.clientX, y: t.clientY, zone: zone };
    if (zone === "move" && isGameTarget(e)) {
      mouse.x = t.clientX;
      mouse.y = t.clientY;
      mouse.clicked = true;
      mouse.clickConsumed = false;
      mouse.held = true;
      mouse.holdStart = performance.now();
    } else if (zone === "fire" && !fireTouch.active) {
      fireTouch.active = true;
      fireTouch.x = t.clientX;
      fireTouch.y = t.clientY;
      fireTouch.id = t.identifier;
    }
  }
}

function onTouchEnd(e) {
  var changed = e.changedTouches;
  for (var i = 0; i < changed.length; i++) {
    var t = changed[i];
    var stored = touches[t.identifier];
    if (!stored) continue;
    var zone = stored.zone;
    delete touches[t.identifier];
    if (zone === "move") {
      // only clear held if no other move touch remains
      var hasMove = false;
      var keys = Object.keys(touches);
      for (var j = 0; j < keys.length; j++) {
        if (touches[keys[j]].zone === "move") { hasMove = true; break; }
      }
      if (!hasMove) mouse.held = false;
    } else if (zone === "fire" && fireTouch.id === t.identifier) {
      // reassign to another fire touch if one exists, otherwise deactivate
      var hasFire = false;
      var fkeys = Object.keys(touches);
      for (var fi = 0; fi < fkeys.length; fi++) {
        if (touches[fkeys[fi]].zone === "fire") {
          hasFire = true;
          fireTouch.id = touches[fkeys[fi]].id;
          fireTouch.x = touches[fkeys[fi]].x;
          fireTouch.y = touches[fkeys[fi]].y;
          break;
        }
      }
      if (!hasFire) { fireTouch.active = false; fireTouch.id = -1; }
    }
  }
}

function onTouchMove(e) {
  if (isGameTarget(e)) e.preventDefault();
  var changed = e.changedTouches;
  for (var i = 0; i < changed.length; i++) {
    var t = changed[i];
    var stored = touches[t.identifier];
    if (!stored) continue;
    stored.x = t.clientX;
    stored.y = t.clientY;
    if (stored.zone === "move") {
      mouse.x = t.clientX;
      mouse.y = t.clientY;
    } else if (stored.zone === "fire" && fireTouch.id === t.identifier) {
      fireTouch.x = t.clientX;
      fireTouch.y = t.clientY;
    }
  }
}

function onKeyDown(e) {
  // skip hotkeys when typing in input fields
  var tag = e.target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
  var key = e.key;
  if (key === "q" || key === "Q") {
    keyActions.push("slot0");
  } else if (key === "w" || key === "W") {
    keyActions.push("slot1");
  } else if (key === "e" || key === "E") {
    keyActions.push("slot2");
  } else if (key === "r" || key === "R") {
    keyActions.push("slot3");
  }
}

export function initInput(canvas) {
  gameCanvas = canvas || null;
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mouseup", onMouseUp);
  window.addEventListener("touchstart", onTouchStart, { passive: false });
  window.addEventListener("touchmove", onTouchMove, { passive: false });
  window.addEventListener("touchend", onTouchEnd);
  window.addEventListener("touchcancel", onTouchEnd);
  window.addEventListener("keydown", onKeyDown);
}

export function getInput() {
  // return a static no-keys object for backward compat with updateShip signature
  return { forward: false, backward: false, left: false, right: false };
}

export function getMouse() {
  return mouse;
}

export function consumeClick() {
  mouse.clicked = false;
  mouse.clickConsumed = true;
}

export function getKeyActions() {
  var actions = keyActions;
  keyActions = [];
  return actions;
}

export function getAutofire() {
  return autofire;
}

export function toggleAutofire() {
  autofire = !autofire;
  return autofire;
}

export function setAutofire(val) {
  autofire = val;
}

export function getFireTouch() {
  return fireTouch;
}
