// input.js — click/tap input handler (no keyboard controls)

var mouse = {
  x: 0,
  y: 0,
  clicked: false,
  clickConsumed: false
};

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

export function initInput() {
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mousedown", onMouseDown);
  window.addEventListener("touchstart", onTouchStart, { passive: true });
  window.addEventListener("touchmove", onTouchMove, { passive: true });
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
