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

// keyboard action queue — consumed once per frame
var keyActions = [];

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

function onTouchStart(e) {
  var touch = e.touches[0];
  mouse.x = touch.clientX;
  mouse.y = touch.clientY;
  if (isGameTarget(e)) {
    mouse.clicked = true;
    mouse.clickConsumed = false;
    mouse.held = true;
    mouse.holdStart = performance.now();
  }
}

function onTouchEnd() {
  mouse.held = false;
}

function onTouchMove(e) {
  var touch = e.touches[0];
  mouse.x = touch.clientX;
  mouse.y = touch.clientY;
}

function onKeyDown(e) {
  // skip hotkeys when typing in input fields
  var tag = e.target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
  var key = e.key;
  if (key === "F2") {
    keyActions.push("worldDebugToggle");
    e.preventDefault();
  } else if (key === "+" || key === "=") {
    keyActions.push("worldDebugZoomIn");
    e.preventDefault();
  } else if (key === "-" || key === "_") {
    keyActions.push("worldDebugZoomOut");
    e.preventDefault();
  } else if (key === "q" || key === "Q") {
    keyActions.push("slot0");
  } else if (key === "w" || key === "W") {
    keyActions.push("slot1");
  } else if (key === "e" || key === "E") {
    keyActions.push("slot2");
  } else if (key === "r" || key === "R") {
    keyActions.push("slot3");
  } else if (key === "m" || key === "M") {
    keyActions.push("toggleMap");
  }
}

export function initInput(canvas) {
  gameCanvas = canvas || null;
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mouseup", onMouseUp);
  window.addEventListener("touchstart", onTouchStart, { passive: true });
  window.addEventListener("touchmove", onTouchMove, { passive: true });
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
