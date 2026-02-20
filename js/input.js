// input.js — click/tap + keyboard input handler

var mouse = {
  x: 0,
  y: 0,
  clicked: false,
  clickConsumed: false
};

// keyboard action queue — consumed once per frame
var keyActions = [];

// autofire state
var autofire = false;

function onMouseMove(e) {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
}

function onMouseDown(e) {
  if (e.button === 0) {
    mouse.clicked = true;
    mouse.clickConsumed = false;
  }
}

function onTouchStart(e) {
  var touch = e.touches[0];
  mouse.x = touch.clientX;
  mouse.y = touch.clientY;
  mouse.clicked = true;
  mouse.clickConsumed = false;
}

function onTouchMove(e) {
  var touch = e.touches[0];
  mouse.x = touch.clientX;
  mouse.y = touch.clientY;
}

function onKeyDown(e) {
  var key = e.key;
  if (key === " " || key === "f" || key === "F") {
    e.preventDefault();
    keyActions.push("toggleAutofire");
  } else if (key === "1") {
    keyActions.push("weapon0");
  } else if (key === "2") {
    keyActions.push("weapon1");
  } else if (key === "3") {
    keyActions.push("weapon2");
  } else if (key === "q" || key === "Q") {
    keyActions.push("weapon0");
  } else if (key === "w" || key === "W") {
    keyActions.push("weapon1");
  } else if (key === "e" || key === "E") {
    keyActions.push("weapon2");
  } else if (key === "r" || key === "R" || key === "Shift") {
    keyActions.push("ability");
  }
}

export function initInput() {
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mousedown", onMouseDown);
  window.addEventListener("touchstart", onTouchStart, { passive: true });
  window.addEventListener("touchmove", onTouchMove, { passive: true });
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
