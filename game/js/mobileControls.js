// mobileControls.js — virtual joystick for mobile touch input
import { isMobile } from "./mobile.js";

var joystick = { active: false, dx: 0, dy: 0 };
var joystickTouchId = -1;
var joystickCenterX = 0;
var joystickCenterY = 0;
var JOYSTICK_RADIUS = 50; // max knob travel in px

var baseEl = null;
var knobEl = null;

export function initMobileControls() {
  if (!isMobile()) return;

  // --- joystick base (bottom-left) ---
  baseEl = document.createElement("div");
  baseEl.style.cssText = [
    "position:fixed", "left:24px", "bottom:24px",
    "width:120px", "height:120px",
    "border-radius:50%",
    "background:rgba(255,255,255,0.08)",
    "border:2px solid rgba(255,255,255,0.15)",
    "touch-action:none", "user-select:none",
    "z-index:20", "pointer-events:auto"
  ].join(";");

  // --- joystick knob ---
  knobEl = document.createElement("div");
  knobEl.style.cssText = [
    "position:absolute",
    "left:50%", "top:50%",
    "width:48px", "height:48px",
    "margin-left:-24px", "margin-top:-24px",
    "border-radius:50%",
    "background:rgba(255,255,255,0.25)",
    "border:2px solid rgba(255,255,255,0.35)",
    "pointer-events:none",
    "transition:background 0.1s"
  ].join(";");
  baseEl.appendChild(knobEl);

  document.body.appendChild(baseEl);

  // --- touch handlers on joystick base ---
  baseEl.addEventListener("touchstart", onJoystickStart, { passive: false });
  baseEl.addEventListener("touchmove", onJoystickMove, { passive: false });
  baseEl.addEventListener("touchend", onJoystickEnd, { passive: false });
  baseEl.addEventListener("touchcancel", onJoystickEnd, { passive: false });
}

function getBaseCenter() {
  var rect = baseEl.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function onJoystickStart(e) {
  e.preventDefault();
  e.stopPropagation();
  if (joystickTouchId !== -1) return; // already tracking a touch
  var t = e.changedTouches[0];
  joystickTouchId = t.identifier;
  var center = getBaseCenter();
  joystickCenterX = center.x;
  joystickCenterY = center.y;
  updateJoystick(t.clientX, t.clientY);
}

function onJoystickMove(e) {
  e.preventDefault();
  e.stopPropagation();
  for (var i = 0; i < e.changedTouches.length; i++) {
    if (e.changedTouches[i].identifier === joystickTouchId) {
      updateJoystick(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
      break;
    }
  }
}

function onJoystickEnd(e) {
  e.preventDefault();
  e.stopPropagation();
  for (var i = 0; i < e.changedTouches.length; i++) {
    if (e.changedTouches[i].identifier === joystickTouchId) {
      joystickTouchId = -1;
      joystick.active = false;
      joystick.dx = 0;
      joystick.dy = 0;
      // reset knob to center
      knobEl.style.transform = "none";
      knobEl.style.left = "50%";
      knobEl.style.top = "50%";
      break;
    }
  }
}

function updateJoystick(touchX, touchY) {
  var rawDx = touchX - joystickCenterX;
  var rawDy = touchY - joystickCenterY;
  var dist = Math.sqrt(rawDx * rawDx + rawDy * rawDy);

  // clamp to radius
  var clampedDx = rawDx;
  var clampedDy = rawDy;
  if (dist > JOYSTICK_RADIUS) {
    clampedDx = (rawDx / dist) * JOYSTICK_RADIUS;
    clampedDy = (rawDy / dist) * JOYSTICK_RADIUS;
    dist = JOYSTICK_RADIUS;
  }

  // normalize to -1..1
  joystick.dx = clampedDx / JOYSTICK_RADIUS;
  joystick.dy = clampedDy / JOYSTICK_RADIUS;
  joystick.active = true;

  // move knob visual
  knobEl.style.left = "calc(50% + " + clampedDx + "px)";
  knobEl.style.top = "calc(50% + " + clampedDy + "px)";
}

export function getJoystickState() {
  return joystick;
}
