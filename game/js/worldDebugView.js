// worldDebugView.js — live chunk/land debug overlay for infinite-world streaming
import { isMobile } from "./mobile.js";
import { T, FONT } from "./theme.js";

var panel = null;
var canvas = null;
var canvasWrap = null;
var ctx = null;
var infoEl = null;
var zoomLabel = null;
var followBtn = null;
var toggleBtn = null;

var visible = false;
var followPlayer = true;
var zoom = isMobile() ? 0.08 : 0.12; // pixels per world unit
var centerX = 0;
var centerZ = 0;
var drag = null;
var lastSnapshot = null;

var MIN_ZOOM = 0.005;
var MAX_ZOOM = 1.0;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function chunkStateColor(state) {
  if (state === "active") return { fill: "rgba(66,200,122,0.26)", stroke: "rgba(88,235,145,0.92)" };
  if (state === "loading") return { fill: "rgba(70,146,235,0.20)", stroke: "rgba(120,190,255,0.9)" };
  if (state === "queued") return { fill: "rgba(255,156,88,0.18)", stroke: "rgba(255,182,122,0.86)" };
  return { fill: "rgba(150,150,150,0.12)", stroke: "rgba(180,180,180,0.6)" };
}

function markerColor(type) {
  if (type === "port") return "#4aa3ff";
  if (type === "tree") return "#4fd676";
  if (type === "island_big") return "#dbc98f";
  if (type === "island_mid") return "#ccb881";
  return "#b8a46f";
}

function worldToCanvasX(worldX) {
  return canvas.width * 0.5 + (worldX - centerX) * zoom;
}

function worldToCanvasY(worldZ) {
  return canvas.height * 0.5 + (worldZ - centerZ) * zoom;
}

function canvasToWorldX(xPx) {
  return centerX + (xPx - canvas.width * 0.5) / zoom;
}

function canvasToWorldZ(yPx) {
  return centerZ + (yPx - canvas.height * 0.5) / zoom;
}

function refreshControls() {
  if (zoomLabel) zoomLabel.textContent = "Zoom " + zoom.toFixed(3) + " px/u";
  if (followBtn) {
    followBtn.textContent = followPlayer ? "FOLLOW ON" : "FOLLOW OFF";
    followBtn.style.opacity = followPlayer ? "1.0" : "0.75";
  }
}

function syncCanvasSize() {
  if (!canvas) return;
  var rect = canvas.getBoundingClientRect();
  var w = Math.max(320, Math.round(rect.width));
  var h = Math.max(200, Math.round(rect.height));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
}

function drawGrid(chunkSize) {
  var halfWorldX = canvas.width * 0.5 / zoom;
  var halfWorldZ = canvas.height * 0.5 / zoom;

  var minWX = centerX - halfWorldX;
  var maxWX = centerX + halfWorldX;
  var minWZ = centerZ - halfWorldZ;
  var maxWZ = centerZ + halfWorldZ;

  var startX = Math.floor(minWX / chunkSize) * chunkSize;
  var endX = Math.ceil(maxWX / chunkSize) * chunkSize;
  var startZ = Math.floor(minWZ / chunkSize) * chunkSize;
  var endZ = Math.ceil(maxWZ / chunkSize) * chunkSize;

  for (var x = startX; x <= endX; x += chunkSize) {
    var sx = worldToCanvasX(x);
    var major = (Math.round(x / chunkSize) % 4) === 0;
    ctx.strokeStyle = major ? "rgba(255,215,140,0.28)" : "rgba(255,215,140,0.13)";
    ctx.lineWidth = major ? 1.1 : 0.8;
    ctx.beginPath();
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, canvas.height);
    ctx.stroke();
  }

  for (var z = startZ; z <= endZ; z += chunkSize) {
    var sy = worldToCanvasY(z);
    var majorZ = (Math.round(z / chunkSize) % 4) === 0;
    ctx.strokeStyle = majorZ ? "rgba(255,215,140,0.28)" : "rgba(255,215,140,0.13)";
    ctx.lineWidth = majorZ ? 1.1 : 0.8;
    ctx.beginPath();
    ctx.moveTo(0, sy);
    ctx.lineTo(canvas.width, sy);
    ctx.stroke();
  }

  var ox = worldToCanvasX(0);
  var oy = worldToCanvasY(0);
  ctx.strokeStyle = "rgba(255,182,76,0.85)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(ox, 0);
  ctx.lineTo(ox, canvas.height);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, oy);
  ctx.lineTo(canvas.width, oy);
  ctx.stroke();
}

function drawPlayer(player) {
  if (!player) return;
  var px = worldToCanvasX(player.x);
  var py = worldToCanvasY(player.z);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(-player.heading || 0);
  ctx.fillStyle = "#f9f0ce";
  ctx.strokeStyle = "#d4a44a";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.lineTo(-5, 6);
  ctx.lineTo(5, 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawSnapshot(snapshot) {
  ctx.fillStyle = "rgba(8,12,20,0.92)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (!snapshot) {
    ctx.fillStyle = "rgba(220,210,180,0.9)";
    ctx.font = "14px " + FONT;
    ctx.fillText("No world data yet (start a run).", 14, 26);
    return;
  }

  var chunkSize = snapshot.chunkSize || 400;
  drawGrid(chunkSize);

  var chunkCounts = { loading: 0, active: 0, queued: 0 };
  var chunks = snapshot.chunks || [];
  for (var i = 0; i < chunks.length; i++) {
    var ch = chunks[i];
    if (!ch) continue;
    if (ch.state === "active") chunkCounts.active++;
    else if (ch.state === "queued") chunkCounts.queued++;
    else if (ch.state === "loading") chunkCounts.loading++;

    var worldX = ch.cx * chunkSize;
    var worldZ = ch.cy * chunkSize;
    var half = chunkSize * 0.5;
    var x0 = worldToCanvasX(worldX - half);
    var y0 = worldToCanvasY(worldZ - half);
    var sizePx = chunkSize * zoom;
    if (x0 > canvas.width || y0 > canvas.height || x0 + sizePx < 0 || y0 + sizePx < 0) continue;

    var col = chunkStateColor(ch.state);
    ctx.fillStyle = col.fill;
    ctx.strokeStyle = col.stroke;
    ctx.lineWidth = 1;
    ctx.fillRect(x0, y0, sizePx, sizePx);
    ctx.strokeRect(x0, y0, sizePx, sizePx);

    if ((ch.placedModelCount || 0) > 0) {
      ctx.fillStyle = "rgba(217,192,121,0.18)";
      ctx.fillRect(x0 + 1, y0 + 1, sizePx - 2, sizePx - 2);
    }
    if (sizePx >= 42) {
      ctx.fillStyle = "rgba(250,240,210,0.92)";
      ctx.font = "11px " + FONT;
      ctx.fillText(ch.cx + "," + ch.cy, x0 + 4, y0 + 13);
      if ((ch.placedModelCount || 0) > 0) {
        ctx.fillStyle = "rgba(238,204,122,0.95)";
        ctx.fillText("land " + ch.placedModelCount, x0 + 4, y0 + 26);
      }
    }
  }

  var markers = snapshot.markers || [];
  for (var m = 0; m < markers.length; m++) {
    var mk = markers[m];
    var mx = worldToCanvasX(mk.x);
    var my = worldToCanvasY(mk.z);
    if (mx < -3 || my < -3 || mx > canvas.width + 3 || my > canvas.height + 3) continue;
    ctx.fillStyle = markerColor(mk.type);
    ctx.beginPath();
    ctx.arc(mx, my, 2.1, 0, Math.PI * 2);
    ctx.fill();
  }

  var enemies = snapshot.enemies || [];
  for (var e = 0; e < enemies.length; e++) {
    var en = enemies[e];
    var ex = worldToCanvasX(en.x);
    var ey = worldToCanvasY(en.z);
    if (ex < -5 || ey < -5 || ex > canvas.width + 5 || ey > canvas.height + 5) continue;
    ctx.fillStyle = "#ff6c5c";
    ctx.beginPath();
    ctx.arc(ex, ey, 3.3, 0, Math.PI * 2);
    ctx.fill();
  }

  drawPlayer(snapshot.player);

  var terrain = snapshot.terrain || {};
  infoEl.textContent =
    "seed " + (terrain.seed !== undefined ? terrain.seed : "n/a") +
    " | active " + (terrain.activeChunks || 0) +
    " | queued " + (terrain.queuedGc || 0) +
    " | created " + (terrain.created || 0) +
    " | destroyed " + (terrain.destroyed || 0) +
    " | disposed " + (terrain.disposedResources || 0) +
    "\nstate: loading " + chunkCounts.loading + " | active " + chunkCounts.active + " | queued " + chunkCounts.queued +
    " | markers " + markers.length +
    " | enemies " + enemies.length +
    "\ncontrols: F2 toggle, +/- zoom, mouse wheel zoom, drag to pan, follow toggle";
}

function requestRedraw() {
  if (!visible || !ctx) return;
  syncCanvasSize();
  drawSnapshot(lastSnapshot);
}

function applyZoomFactor(factor, anchorX, anchorY) {
  if (!canvas) return;
  var prevZoom = zoom;
  var nextZoom = clamp(zoom * factor, MIN_ZOOM, MAX_ZOOM);
  if (Math.abs(nextZoom - prevZoom) < 1e-8) return;

  if (anchorX !== undefined && anchorY !== undefined) {
    var worldAX = canvasToWorldX(anchorX);
    var worldAZ = canvasToWorldZ(anchorY);
    zoom = nextZoom;
    centerX = worldAX - (anchorX - canvas.width * 0.5) / zoom;
    centerZ = worldAZ - (anchorY - canvas.height * 0.5) / zoom;
  } else {
    zoom = nextZoom;
  }
  refreshControls();
  requestRedraw();
}

function setVisible(v) {
  visible = !!v;
  if (panel) panel.style.display = visible ? "flex" : "none";
  if (toggleBtn) toggleBtn.style.display = visible ? "none" : "block";
  if (visible) requestRedraw();
}

export function createWorldDebugView() {
  if (panel) return;
  var mobile = isMobile();

  toggleBtn = document.createElement("button");
  toggleBtn.className = "world-debug-toggle-btn";
  toggleBtn.textContent = "WORLD DEBUG";
  toggleBtn.style.cssText = [
    "position:fixed",
    mobile ? "left:10px" : "left:14px",
    mobile ? "bottom:10px" : "bottom:14px",
    "z-index:250",
    "padding:7px 10px",
    "font-family:" + FONT,
    "font-size:" + (mobile ? "11px" : "12px"),
    "letter-spacing:0.7px",
    "color:" + T.gold,
    "background:rgba(20,16,12,0.86)",
    "border:1px solid " + T.borderGold,
    "border-radius:6px",
    "cursor:pointer",
    "opacity:0.78"
  ].join(";");
  toggleBtn.addEventListener("click", function () { setVisible(!visible); });
  document.body.appendChild(toggleBtn);

  panel = document.createElement("div");
  panel.style.cssText = [
    "position:fixed",
    "inset:0",
    "z-index:320",
    mobile ? "padding:8px" : "padding:12px",
    "background:rgba(6,9,15,0.96)",
    "font-family:" + FONT,
    "display:none",
    "flex-direction:column",
    "gap:8px",
    "box-sizing:border-box",
    "user-select:none"
  ].join(";");

  var header = document.createElement("div");
  header.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px";
  var title = document.createElement("div");
  title.textContent = "WORLD STREAM DEBUG SCREEN";
  title.style.cssText = "color:" + T.gold + ";font-size:" + (mobile ? "12px" : "14px") + ";letter-spacing:1.2px;font-weight:bold";
  var closeBtn = document.createElement("button");
  closeBtn.textContent = "CLOSE (F2)";
  closeBtn.style.cssText = "padding:5px 9px;border:1px solid " + T.borderGold + ";background:rgba(40,24,12,0.75);color:" + T.text + ";border-radius:4px;cursor:pointer;font-size:11px";
  closeBtn.addEventListener("click", function () { setVisible(false); });
  header.appendChild(title);
  header.appendChild(closeBtn);
  panel.appendChild(header);

  var controls = document.createElement("div");
  controls.style.cssText = "display:flex;align-items:center;gap:6px;flex-wrap:wrap";
  followBtn = document.createElement("button");
  followBtn.style.cssText = "padding:4px 8px;border:1px solid " + T.borderGold + ";background:rgba(40,24,12,0.75);color:" + T.text + ";border-radius:4px;cursor:pointer;font-size:11px";
  followBtn.addEventListener("click", function () {
    followPlayer = !followPlayer;
    if (followPlayer && lastSnapshot && lastSnapshot.player) {
      centerX = lastSnapshot.player.x;
      centerZ = lastSnapshot.player.z;
    }
    refreshControls();
    requestRedraw();
  });

  var recenterBtn = document.createElement("button");
  recenterBtn.textContent = "ORIGIN";
  recenterBtn.style.cssText = "padding:4px 8px;border:1px solid " + T.borderGold + ";background:rgba(40,24,12,0.75);color:" + T.text + ";border-radius:4px;cursor:pointer;font-size:11px";
  recenterBtn.addEventListener("click", function () {
    centerX = 0;
    centerZ = 0;
    followPlayer = false;
    refreshControls();
    requestRedraw();
  });

  var minusBtn = document.createElement("button");
  minusBtn.textContent = "-";
  minusBtn.style.cssText = "padding:4px 8px;border:1px solid " + T.borderGold + ";background:rgba(40,24,12,0.75);color:" + T.text + ";border-radius:4px;cursor:pointer;font-size:12px;font-weight:bold";
  minusBtn.addEventListener("click", function () { applyZoomFactor(1 / 1.18); });
  var plusBtn = document.createElement("button");
  plusBtn.textContent = "+";
  plusBtn.style.cssText = "padding:4px 8px;border:1px solid " + T.borderGold + ";background:rgba(40,24,12,0.75);color:" + T.text + ";border-radius:4px;cursor:pointer;font-size:12px;font-weight:bold";
  plusBtn.addEventListener("click", function () { applyZoomFactor(1.18); });

  zoomLabel = document.createElement("div");
  zoomLabel.style.cssText = "margin-left:4px;color:" + T.textDim + ";font-size:11px";
  controls.appendChild(followBtn);
  controls.appendChild(recenterBtn);
  controls.appendChild(minusBtn);
  controls.appendChild(plusBtn);
  controls.appendChild(zoomLabel);
  panel.appendChild(controls);

  canvasWrap = document.createElement("div");
  canvasWrap.style.cssText = "flex:1;min-height:220px;border:1px solid " + T.borderGold + ";border-radius:8px;overflow:hidden";

  canvas = document.createElement("canvas");
  canvas.width = mobile ? 360 : 960;
  canvas.height = mobile ? 220 : 520;
  canvas.style.cssText = "width:100%;height:100%;display:block;background:#0d1119;cursor:grab";
  ctx = canvas.getContext("2d");
  canvasWrap.appendChild(canvas);
  panel.appendChild(canvasWrap);

  infoEl = document.createElement("div");
  infoEl.style.cssText = "white-space:pre-line;color:" + T.textDim + ";font-size:11px;line-height:1.35;border:1px solid " + T.borderGold + ";border-radius:6px;padding:6px;background:rgba(20,16,12,0.6)";
  panel.appendChild(infoEl);

  canvas.addEventListener("wheel", function (e) {
    e.preventDefault();
    applyZoomFactor(e.deltaY < 0 ? 1.15 : (1 / 1.15), e.offsetX, e.offsetY);
  }, { passive: false });

  canvas.addEventListener("mousedown", function (e) {
    followPlayer = false;
    drag = {
      x: e.clientX,
      y: e.clientY,
      centerX: centerX,
      centerZ: centerZ
    };
    canvas.style.cursor = "grabbing";
    refreshControls();
  });

  window.addEventListener("mousemove", function (e) {
    if (!drag) return;
    var dx = e.clientX - drag.x;
    var dy = e.clientY - drag.y;
    centerX = drag.centerX - dx / zoom;
    centerZ = drag.centerZ - dy / zoom;
    requestRedraw();
  });

  window.addEventListener("mouseup", function () {
    drag = null;
    if (canvas) canvas.style.cursor = "grab";
  });

  window.addEventListener("resize", function () {
    if (!visible) return;
    requestRedraw();
  });

  window.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && visible) {
      setVisible(false);
      e.preventDefault();
    }
  });

  document.body.appendChild(panel);
  refreshControls();
}

export function isWorldDebugVisible() {
  return visible;
}

export function toggleWorldDebugView(forceValue) {
  if (forceValue === true || forceValue === false) setVisible(forceValue);
  else setVisible(!visible);
}

export function zoomWorldDebugView(factor) {
  applyZoomFactor(factor || 1.0);
}

export function getWorldDebugState() {
  return {
    visible: visible,
    zoom: zoom,
    followPlayer: followPlayer,
    centerX: centerX,
    centerZ: centerZ
  };
}

export function updateWorldDebugView(snapshot) {
  if (snapshot) {
    lastSnapshot = snapshot;
    if (followPlayer && snapshot.player) {
      centerX = snapshot.player.x;
      centerZ = snapshot.player.z;
    }
  }
  if (!visible || !ctx) return;
  drawSnapshot(lastSnapshot);
}
