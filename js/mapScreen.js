// mapScreen.js — strategic map overlay with nautical chart aesthetic

import { getZones, loadMapState, isZoneUnlocked, getZoneStars } from "./mapData.js";

var overlay = null;
var mapCanvas = null;
var mapCtx = null;
var onSelectCallback = null;
var currentState = null;
var hoveredZone = null;
var tooltipEl = null;
var zoneHitAreas = [];   // {id, cx, cy, r} for click detection

var CONDITION_COLORS = {
  calm: "#22aa66",
  rough: "#ccaa22",
  stormy: "#cc4455"
};

// --- create the map screen (call once) ---
export function createMapScreen() {
  overlay = document.createElement("div");
  overlay.style.cssText = [
    "position: fixed",
    "top: 0",
    "left: 0",
    "width: 100%",
    "height: 100%",
    "display: none",
    "flex-direction: column",
    "align-items: center",
    "justify-content: center",
    "background: rgba(5, 5, 15, 0.95)",
    "z-index: 150",
    "font-family: monospace",
    "user-select: none"
  ].join(";");

  // title
  var title = document.createElement("div");
  title.textContent = "STRATEGIC MAP";
  title.style.cssText = [
    "font-size: 28px",
    "font-weight: bold",
    "color: #aa9966",
    "margin-bottom: 12px",
    "text-shadow: 0 0 15px rgba(170,150,100,0.3)",
    "letter-spacing: 4px"
  ].join(";");
  overlay.appendChild(title);

  // subtitle
  var subtitle = document.createElement("div");
  subtitle.textContent = "Select a zone to deploy";
  subtitle.style.cssText = [
    "font-size: 13px",
    "color: #667755",
    "margin-bottom: 16px"
  ].join(";");
  overlay.appendChild(subtitle);

  // canvas container (responsive)
  var canvasWrap = document.createElement("div");
  canvasWrap.style.cssText = [
    "position: relative",
    "width: 600px",
    "max-width: 90vw",
    "height: 500px",
    "max-height: 70vh"
  ].join(";");

  mapCanvas = document.createElement("canvas");
  mapCanvas.width = 600;
  mapCanvas.height = 500;
  mapCanvas.style.cssText = [
    "width: 100%",
    "height: 100%",
    "border: 2px solid rgba(120, 110, 80, 0.4)",
    "border-radius: 6px",
    "cursor: pointer"
  ].join(";");
  mapCtx = mapCanvas.getContext("2d");
  canvasWrap.appendChild(mapCanvas);

  // tooltip
  tooltipEl = document.createElement("div");
  tooltipEl.style.cssText = [
    "position: absolute",
    "padding: 10px 14px",
    "background: rgba(10, 15, 25, 0.95)",
    "border: 1px solid rgba(120, 110, 80, 0.5)",
    "border-radius: 6px",
    "font-size: 12px",
    "color: #aabbaa",
    "pointer-events: none",
    "display: none",
    "white-space: nowrap",
    "z-index: 160"
  ].join(";");
  canvasWrap.appendChild(tooltipEl);

  overlay.appendChild(canvasWrap);

  // legend
  var legend = document.createElement("div");
  legend.style.cssText = [
    "margin-top: 12px",
    "font-size: 11px",
    "color: #667755",
    "display: flex",
    "gap: 16px"
  ].join(";");
  legend.innerHTML = '<span style="color:#22aa66">&#9679; Calm</span>' +
    '<span style="color:#ccaa22">&#9679; Rough</span>' +
    '<span style="color:#cc4455">&#9679; Stormy</span>' +
    '<span style="color:#556666">&#9679; Locked</span>';
  overlay.appendChild(legend);

  // event listeners
  mapCanvas.addEventListener("mousemove", onMouseMove);
  mapCanvas.addEventListener("click", onClick);
  mapCanvas.addEventListener("mouseleave", function () {
    hoveredZone = null;
    tooltipEl.style.display = "none";
  });

  document.body.appendChild(overlay);
}

// --- convert canvas pixel coords to zone ---
function getCanvasPos(e) {
  var rect = mapCanvas.getBoundingClientRect();
  var scaleX = mapCanvas.width / rect.width;
  var scaleY = mapCanvas.height / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY
  };
}

function findZoneAt(px, py) {
  for (var i = 0; i < zoneHitAreas.length; i++) {
    var z = zoneHitAreas[i];
    var dx = px - z.cx;
    var dy = py - z.cy;
    if (dx * dx + dy * dy <= z.r * z.r) return z.id;
  }
  return null;
}

function onMouseMove(e) {
  var pos = getCanvasPos(e);
  var zoneId = findZoneAt(pos.x, pos.y);
  hoveredZone = zoneId;

  if (zoneId && currentState) {
    var zone = null;
    var zones = getZones();
    for (var i = 0; i < zones.length; i++) {
      if (zones[i].id === zoneId) { zone = zones[i]; break; }
    }
    if (zone) {
      var unlocked = isZoneUnlocked(currentState, zoneId);
      var stars = getZoneStars(currentState, zoneId);
      var starStr = stars > 0 ? " " + starString(stars) : "";

      tooltipEl.innerHTML = '<div style="font-size:14px;font-weight:bold;color:' +
        (unlocked ? "#ccccaa" : "#556666") + ';margin-bottom:4px">' +
        zone.name + starStr + '</div>' +
        '<div style="color:#889988">Difficulty: ' + zone.difficulty + '/6</div>' +
        '<div style="color:' + CONDITION_COLORS[zone.condition] + '">Seas: ' +
        zone.condition.charAt(0).toUpperCase() + zone.condition.slice(1) + '</div>' +
        '<div style="color:#778877">' + zone.waves + ' waves</div>' +
        '<div style="color:#778877;margin-top:4px;font-style:italic">' + zone.description + '</div>' +
        (unlocked ? '<div style="color:#aacc88;margin-top:6px">Click to deploy</div>' :
          '<div style="color:#665555;margin-top:6px">Complete adjacent zone to unlock</div>');

      // position tooltip near mouse
      var rect = mapCanvas.getBoundingClientRect();
      var tx = e.clientX - rect.left + 16;
      var ty = e.clientY - rect.top - 10;
      // keep on screen
      if (tx + 200 > rect.width) tx = tx - 220;
      if (ty < 0) ty = 10;
      tooltipEl.style.left = tx + "px";
      tooltipEl.style.top = ty + "px";
      tooltipEl.style.display = "block";
    }
  } else {
    tooltipEl.style.display = "none";
  }

  drawMap();
}

function onClick(e) {
  var pos = getCanvasPos(e);
  var zoneId = findZoneAt(pos.x, pos.y);
  if (!zoneId || !currentState) return;

  if (isZoneUnlocked(currentState, zoneId)) {
    if (onSelectCallback) onSelectCallback(zoneId);
  }
}

// --- star string helper ---
function starString(count) {
  var s = "";
  for (var i = 0; i < count; i++) s += "\u2605";
  for (var j = count; j < 3; j++) s += "\u2606";
  return s;
}

// --- draw the strategic map ---
function drawMap() {
  if (!mapCtx || !currentState) return;

  var W = mapCanvas.width;
  var H = mapCanvas.height;
  var ctx = mapCtx;
  var zones = getZones();

  // clear
  ctx.clearRect(0, 0, W, H);

  // background — dark ocean with parchment tint
  var bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, "#0a0f18");
  bgGrad.addColorStop(0.5, "#0d1420");
  bgGrad.addColorStop(1, "#08101a");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // grid lines (nautical chart)
  ctx.strokeStyle = "rgba(80, 90, 70, 0.12)";
  ctx.lineWidth = 1;
  for (var gx = 0; gx < W; gx += 40) {
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, H);
    ctx.stroke();
  }
  for (var gy = 0; gy < H; gy += 40) {
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(W, gy);
    ctx.stroke();
  }

  // compass rose (top-right corner)
  drawCompassRose(ctx, W - 50, 50, 30);

  // draw connections first (behind nodes)
  ctx.lineWidth = 2;
  for (var i = 0; i < zones.length; i++) {
    var z = zones[i];
    var cx1 = (z.x / 100) * W;
    var cy1 = (z.y / 100) * H;
    for (var c = 0; c < z.connections.length; c++) {
      var other = null;
      for (var j = 0; j < zones.length; j++) {
        if (zones[j].id === z.connections[c]) { other = zones[j]; break; }
      }
      if (!other) continue;
      // avoid drawing duplicate lines
      if (other.id < z.id) continue;

      var cx2 = (other.x / 100) * W;
      var cy2 = (other.y / 100) * H;

      var bothUnlocked = isZoneUnlocked(currentState, z.id) &&
                          isZoneUnlocked(currentState, other.id);
      ctx.strokeStyle = bothUnlocked ? "rgba(120, 110, 80, 0.4)" : "rgba(60, 60, 60, 0.2)";
      ctx.setLineDash(bothUnlocked ? [] : [6, 4]);
      ctx.beginPath();
      ctx.moveTo(cx1, cy1);
      ctx.lineTo(cx2, cy2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // draw zone nodes
  zoneHitAreas = [];
  for (var i = 0; i < zones.length; i++) {
    var z = zones[i];
    var cx = (z.x / 100) * W;
    var cy = (z.y / 100) * H;
    var r = 22;
    var unlocked = isZoneUnlocked(currentState, z.id);
    var stars = getZoneStars(currentState, z.id);
    var isHovered = hoveredZone === z.id;

    zoneHitAreas.push({ id: z.id, cx: cx, cy: cy, r: r + 6 });

    // glow for hovered unlocked zone
    if (isHovered && unlocked) {
      ctx.shadowColor = CONDITION_COLORS[z.condition] || "#aaaaaa";
      ctx.shadowBlur = 20;
    }

    // outer ring
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    if (unlocked) {
      ctx.fillStyle = "rgba(15, 20, 30, 0.9)";
      ctx.fill();
      ctx.strokeStyle = CONDITION_COLORS[z.condition] || "#888888";
      ctx.lineWidth = isHovered ? 3 : 2;
      ctx.stroke();
    } else {
      ctx.fillStyle = "rgba(15, 15, 20, 0.7)";
      ctx.fill();
      ctx.strokeStyle = "rgba(60, 60, 60, 0.4)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;

    // difficulty number
    ctx.fillStyle = unlocked ? "#ccccaa" : "#444444";
    ctx.font = "bold 16px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(z.difficulty), cx, cy);

    // zone name below
    ctx.fillStyle = unlocked ? "rgba(170, 160, 120, 0.8)" : "rgba(60, 60, 60, 0.5)";
    ctx.font = "10px monospace";
    ctx.fillText(z.name, cx, cy + r + 14);

    // star rating below name
    if (stars > 0) {
      ctx.fillStyle = "#ccaa44";
      ctx.font = "12px monospace";
      ctx.fillText(starString(stars), cx, cy + r + 28);
    }
  }
}

// --- compass rose decoration ---
function drawCompassRose(ctx, cx, cy, r) {
  ctx.save();
  ctx.strokeStyle = "rgba(120, 110, 80, 0.3)";
  ctx.fillStyle = "rgba(120, 110, 80, 0.2)";
  ctx.lineWidth = 1;

  // outer circle
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  // N/S/E/W ticks
  var dirs = [
    { label: "N", angle: -Math.PI / 2 },
    { label: "S", angle: Math.PI / 2 },
    { label: "E", angle: 0 },
    { label: "W", angle: Math.PI }
  ];
  ctx.font = "bold 10px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(120, 110, 80, 0.5)";

  for (var d = 0; d < dirs.length; d++) {
    var a = dirs[d].angle;
    var tx = cx + Math.cos(a) * (r + 10);
    var ty = cy + Math.sin(a) * (r + 10);
    ctx.fillText(dirs[d].label, tx, ty);

    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * (r - 4), cy + Math.sin(a) * (r - 4));
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.stroke();
  }

  // center dot
  ctx.beginPath();
  ctx.arc(cx, cy, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// --- show the map screen ---
export function showMapScreen(mapState, callback) {
  currentState = mapState;
  onSelectCallback = callback;
  if (overlay) {
    overlay.style.display = "flex";
    drawMap();
  }
}

// --- hide the map screen ---
export function hideMapScreen() {
  if (overlay) overlay.style.display = "none";
  tooltipEl.style.display = "none";
  hoveredZone = null;
}

// --- is map screen visible? ---
export function isMapScreenVisible() {
  return overlay && overlay.style.display !== "none";
}
