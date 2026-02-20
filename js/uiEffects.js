// uiEffects.js — damage indicators, floating damage numbers, kill feed, fade transitions

var COLORS = {
  bg: "rgba(5,10,20,0.7)",
  border: "rgba(80,100,130,0.4)",
  textMuted: "#667788",
  textNormal: "#8899aa",
  damage: "#ff4444",
  heal: "#44dd66",
  kill: "#ffcc44",
  event: "#44aaff"
};

// --- damage direction indicators ---
var indicators = [];
var indicatorContainer = null;

function ensureIndicatorContainer() {
  if (indicatorContainer) return;
  indicatorContainer = document.createElement("div");
  indicatorContainer.style.cssText = [
    "position:fixed", "top:0", "left:0", "width:100%", "height:100%",
    "pointer-events:none", "z-index:15"
  ].join(";");
  document.body.appendChild(indicatorContainer);
}

export function showDamageIndicator(angle) {
  ensureIndicatorContainer();
  var el = document.createElement("div");
  // angle: radians, 0 = from front, PI = from behind
  // map to screen edge position
  var deg = ((angle * 180 / Math.PI) % 360 + 360) % 360;
  var w = 120, h = 60;
  var css = [
    "position:absolute", "width:" + w + "px", "height:" + h + "px",
    "pointer-events:none", "opacity:0.8",
    "transition:opacity 0.3s"
  ];

  // position on screen edge based on angle
  if (deg >= 315 || deg < 45) {
    // top (hit from front)
    css.push("top:0", "left:50%", "transform:translateX(-50%)");
    css.push("background:linear-gradient(to bottom, rgba(255,50,50,0.6), transparent)");
  } else if (deg >= 45 && deg < 135) {
    // right
    css.push("top:50%", "right:0", "transform:translateY(-50%)");
    css.push("width:" + h + "px", "height:" + w + "px");
    css.push("background:linear-gradient(to left, rgba(255,50,50,0.6), transparent)");
  } else if (deg >= 135 && deg < 225) {
    // bottom
    css.push("bottom:0", "left:50%", "transform:translateX(-50%)");
    css.push("background:linear-gradient(to top, rgba(255,50,50,0.6), transparent)");
  } else {
    // left
    css.push("top:50%", "left:0", "transform:translateY(-50%)");
    css.push("width:" + h + "px", "height:" + w + "px");
    css.push("background:linear-gradient(to right, rgba(255,50,50,0.6), transparent)");
  }

  el.style.cssText = css.join(";");
  indicatorContainer.appendChild(el);
  indicators.push({ el: el, life: 0.5 });
}

export function updateIndicators(dt) {
  var alive = [];
  for (var i = 0; i < indicators.length; i++) {
    var ind = indicators[i];
    ind.life -= dt;
    if (ind.life <= 0) {
      if (ind.el.parentNode) ind.el.parentNode.removeChild(ind.el);
    } else {
      ind.el.style.opacity = String(Math.min(0.8, ind.life / 0.3));
      alive.push(ind);
    }
  }
  indicators = alive;
}

// --- floating damage numbers ---
var floatingNumbers = [];
var numberContainer = null;

function ensureNumberContainer() {
  if (numberContainer) return;
  numberContainer = document.createElement("div");
  numberContainer.style.cssText = [
    "position:fixed", "top:0", "left:0", "width:100%", "height:100%",
    "pointer-events:none", "z-index:16", "overflow:hidden"
  ].join(";");
  document.body.appendChild(numberContainer);
}

export function showFloatingNumber(screenX, screenY, text, color) {
  ensureNumberContainer();
  var el = document.createElement("div");
  el.textContent = text;
  el.style.cssText = [
    "position:absolute", "font-family:monospace", "font-weight:bold",
    "font-size:16px", "color:" + (color || COLORS.damage),
    "text-shadow:0 0 6px " + (color || COLORS.damage),
    "pointer-events:none", "white-space:nowrap",
    "left:" + screenX + "px", "top:" + screenY + "px",
    "transform:translate(-50%,-50%)"
  ].join(";");
  numberContainer.appendChild(el);
  floatingNumbers.push({ el: el, life: 1.0, startY: screenY });
}

export function updateFloatingNumbers(dt) {
  var alive = [];
  for (var i = 0; i < floatingNumbers.length; i++) {
    var num = floatingNumbers[i];
    num.life -= dt;
    if (num.life <= 0) {
      if (num.el.parentNode) num.el.parentNode.removeChild(num.el);
    } else {
      var progress = 1 - num.life;
      var yOffset = progress * 40;
      num.el.style.top = (num.startY - yOffset) + "px";
      num.el.style.opacity = String(Math.min(1, num.life / 0.3));
      var scale = 1 + progress * 0.3;
      num.el.style.transform = "translate(-50%,-50%) scale(" + scale + ")";
      alive.push(num);
    }
  }
  floatingNumbers = alive;
}

// --- kill feed ---
var killFeedContainer = null;
var killFeedItems = [];
var MAX_FEED_ITEMS = 5;

function ensureKillFeed() {
  if (killFeedContainer) return;
  killFeedContainer = document.createElement("div");
  killFeedContainer.style.cssText = [
    "position:fixed", "bottom:20px", "right:20px",
    "font-family:monospace", "font-size:12px",
    "pointer-events:none", "z-index:10",
    "display:flex", "flex-direction:column-reverse", "gap:3px",
    "max-width:280px"
  ].join(";");
  document.body.appendChild(killFeedContainer);
}

export function addKillFeedEntry(text, color) {
  ensureKillFeed();
  var el = document.createElement("div");
  el.textContent = text;
  el.style.cssText = [
    "padding:3px 8px", "background:" + COLORS.bg,
    "border:1px solid " + COLORS.border, "border-radius:3px",
    "color:" + (color || COLORS.textNormal),
    "opacity:1", "transition:opacity 0.3s",
    "white-space:nowrap", "overflow:hidden", "text-overflow:ellipsis"
  ].join(";");
  killFeedContainer.appendChild(el);
  killFeedItems.push({ el: el, life: 5.0 });

  // limit visible items
  while (killFeedItems.length > MAX_FEED_ITEMS) {
    var old = killFeedItems.shift();
    if (old.el.parentNode) old.el.parentNode.removeChild(old.el);
  }
}

export function updateKillFeed(dt) {
  var alive = [];
  for (var i = 0; i < killFeedItems.length; i++) {
    var item = killFeedItems[i];
    item.life -= dt;
    if (item.life <= 0) {
      if (item.el.parentNode) item.el.parentNode.removeChild(item.el);
    } else {
      item.el.style.opacity = String(Math.min(1, item.life / 0.5));
      alive.push(item);
    }
  }
  killFeedItems = alive;
}

// --- fade transition overlay ---
var fadeOverlay = null;
var fadeState = { active: false, direction: "in", progress: 0, duration: 0.5, callback: null };

function ensureFadeOverlay() {
  if (fadeOverlay) return;
  fadeOverlay = document.createElement("div");
  fadeOverlay.style.cssText = [
    "position:fixed", "top:0", "left:0", "width:100%", "height:100%",
    "background:#0a0e1a", "pointer-events:none", "z-index:200",
    "opacity:0"
  ].join(";");
  document.body.appendChild(fadeOverlay);
}

export function fadeOut(duration, callback) {
  ensureFadeOverlay();
  fadeState.active = true;
  fadeState.direction = "out";
  fadeState.progress = 0;
  fadeState.duration = duration || 0.5;
  fadeState.callback = callback || null;
}

export function fadeIn(duration, callback) {
  ensureFadeOverlay();
  fadeState.active = true;
  fadeState.direction = "in";
  fadeState.progress = 0;
  fadeState.duration = duration || 0.5;
  fadeState.callback = callback || null;
  fadeOverlay.style.opacity = "1";
}

export function updateFade(dt) {
  if (!fadeState.active || !fadeOverlay) return;
  fadeState.progress += dt;
  var t = Math.min(1, fadeState.progress / fadeState.duration);
  if (fadeState.direction === "out") {
    fadeOverlay.style.opacity = String(t);
  } else {
    fadeOverlay.style.opacity = String(1 - t);
  }
  if (t >= 1) {
    fadeState.active = false;
    if (fadeState.callback) fadeState.callback();
  }
}

// --- screen shake state ---
var shakeState = { offsetX: 0, offsetY: 0, intensity: 0, decay: 8 };

export function triggerScreenShake(intensity) {
  shakeState.intensity = Math.max(shakeState.intensity, intensity);
}

export function updateScreenShake(dt) {
  if (shakeState.intensity < 0.01) {
    shakeState.intensity = 0;
    shakeState.offsetX = 0;
    shakeState.offsetY = 0;
    return shakeState;
  }
  shakeState.offsetX = (Math.random() - 0.5) * 2 * shakeState.intensity;
  shakeState.offsetY = (Math.random() - 0.5) * 2 * shakeState.intensity;
  shakeState.intensity *= Math.exp(-shakeState.decay * dt);
  return shakeState;
}

export function getShakeOffset() {
  return shakeState;
}

// --- update all UI effects ---
export function updateUIEffects(dt) {
  updateIndicators(dt);
  updateFloatingNumbers(dt);
  updateKillFeed(dt);
  updateFade(dt);
  updateScreenShake(dt);
}
