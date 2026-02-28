// mapScreen.js — world map overlay (open world mode)
// Toggled with M key in-game. Shows player position and boss zone locations.

import { isMobile } from "./mobile.js";
import { T, FONT } from "./theme.js";

var overlay = null;
var mapCanvas = null;
var mapCtx = null;
var currentPlayerPos = null;
var currentBossZones = null;

var WORLD_RANGE = 700; // world coords visible on map: ±WORLD_RANGE

export function createMapScreen() {
  var _mob = isMobile();
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
    _mob ? "justify-content: flex-start" : "justify-content: center",
    "background: rgba(6, 10, 20, 0.82)",
    "z-index: 150",
    "font-family:" + FONT,
    "user-select: none"
  ].join(";");

  var title = document.createElement("div");
  title.textContent = "WORLD MAP";
  title.style.cssText = [
    "font-size: 24px",
    "font-weight: bold",
    "color:" + T.gold,
    "margin-bottom: 8px",
    "letter-spacing: 4px",
    "text-shadow: 0 2px 6px rgba(0,0,0,0.7)"
  ].join(";");
  overlay.appendChild(title);

  var hint = document.createElement("div");
  hint.textContent = "Press M or ESC to close";
  hint.style.cssText = "font-size: 11px; color:" + T.textDim + "; margin-bottom: 12px;";
  overlay.appendChild(hint);

  var canvasWrap = document.createElement("div");
  canvasWrap.style.cssText = [
    "position: relative",
    "width: 540px",
    "max-width: 92vw",
    "height: 460px",
    "max-height: 66vh"
  ].join(";");

  mapCanvas = document.createElement("canvas");
  mapCanvas.width = 540;
  mapCanvas.height = 460;
  mapCanvas.style.cssText = [
    "width: 100%",
    "height: 100%",
    "border: 2px solid " + T.borderGold,
    "border-radius: 6px"
  ].join(";");
  mapCtx = mapCanvas.getContext("2d");
  canvasWrap.appendChild(mapCanvas);
  overlay.appendChild(canvasWrap);

  var legend = document.createElement("div");
  legend.style.cssText = [
    "margin-top: 10px",
    "font-size: 11px",
    "color:" + T.textDim,
    "display: flex",
    "gap: 18px",
    "font-family:" + FONT
  ].join(";");
  legend.innerHTML =
    '<span style="color:' + T.gold + '">&#9679; You</span>' +
    '<span style="color:#ff5555">&#9650; Boss Zone</span>' +
    '<span style="color:#44dd77">&#10003; Defeated</span>';
  overlay.appendChild(legend);

  document.addEventListener("keydown", function (e) {
    if ((e.key === "Escape" || e.key === "m" || e.key === "M") && isMapScreenVisible()) {
      hideMapScreen();
    }
  });

  document.body.appendChild(overlay);
}

function worldToCanvas(wx, wz, W, H) {
  return {
    x: (wx / WORLD_RANGE * 0.5 + 0.5) * W,
    y: (wz / WORLD_RANGE * 0.5 + 0.5) * H
  };
}

function drawMap() {
  if (!mapCtx) return;
  var W = mapCanvas.width;
  var H = mapCanvas.height;
  var ctx = mapCtx;

  ctx.clearRect(0, 0, W, H);

  // ocean background
  var bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#08111e");
  bg.addColorStop(1, "#040c18");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // subtle grid
  ctx.strokeStyle = "rgba(50, 90, 130, 0.14)";
  ctx.lineWidth = 1;
  for (var gx = 0; gx <= W; gx += 54) {
    ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
  }
  for (var gy = 0; gy <= H; gy += 46) {
    ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
  }

  // origin dashed crosshair
  var orig = worldToCanvas(0, 0, W, H);
  ctx.strokeStyle = "rgba(80, 130, 180, 0.22)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 6]);
  ctx.beginPath(); ctx.moveTo(0, orig.y); ctx.lineTo(W, orig.y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(orig.x, 0); ctx.lineTo(orig.x, H); ctx.stroke();
  ctx.setLineDash([]);

  // compass rose
  drawCompassRose(ctx, W - 38, 38, 22);

  // boss zones
  if (currentBossZones) {
    for (var i = 0; i < currentBossZones.length; i++) {
      var bz = currentBossZones[i];
      var bp = worldToCanvas(bz.x, bz.z, W, H);
      var br = 16;
      var col = bz.defeated ? "#44dd77" : "#ff5555";

      // outer glow ring
      if (!bz.defeated) {
        ctx.beginPath();
        ctx.arc(bp.x, bp.y, br + 9, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255, 60, 60, 0.2)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // zone circle
      ctx.beginPath();
      ctx.arc(bp.x, bp.y, br, 0, Math.PI * 2);
      ctx.fillStyle = bz.defeated ? "rgba(30, 100, 55, 0.45)" : "rgba(110, 20, 20, 0.5)";
      ctx.fill();
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.stroke();

      // icon
      ctx.fillStyle = col;
      ctx.font = "bold 12px " + FONT;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(bz.defeated ? "\u2713" : "\u2620", bp.x, bp.y);

      // label below
      ctx.fillStyle = bz.defeated ? "rgba(68,221,119,0.65)" : "rgba(255,120,120,0.85)";
      ctx.font = "9px " + FONT;
      ctx.fillText(bz.label, bp.x, bp.y + br + 11);
    }
  }

  // player dot
  if (currentPlayerPos) {
    var pp = worldToCanvas(currentPlayerPos.x, currentPlayerPos.z, W, H);
    ctx.shadowColor = T.gold;
    ctx.shadowBlur = 12;
    ctx.fillStyle = T.gold;
    ctx.beginPath();
    ctx.arc(pp.x, pp.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // direction arrow pointing up
    ctx.strokeStyle = T.gold;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pp.x, pp.y - 10);
    ctx.lineTo(pp.x - 4, pp.y - 2);
    ctx.lineTo(pp.x + 4, pp.y - 2);
    ctx.closePath();
    ctx.stroke();

    // coords
    ctx.fillStyle = "rgba(212,164,74,0.65)";
    ctx.font = "9px " + FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(
      Math.round(currentPlayerPos.x) + ", " + Math.round(currentPlayerPos.z),
      pp.x, pp.y + 8
    );
  }
}

function drawCompassRose(ctx, cx, cy, r) {
  ctx.save();
  ctx.strokeStyle = "rgba(80, 130, 180, 0.4)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  var dirs = [
    { label: "N", a: -Math.PI / 2 },
    { label: "S", a: Math.PI / 2 },
    { label: "E", a: 0 },
    { label: "W", a: Math.PI }
  ];
  ctx.font = "bold 9px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(80, 140, 200, 0.6)";
  for (var d = 0; d < dirs.length; d++) {
    var a = dirs[d].a;
    ctx.fillText(dirs[d].label, cx + Math.cos(a) * (r + 9), cy + Math.sin(a) * (r + 9));
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * (r - 3), cy + Math.sin(a) * (r - 3));
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.stroke();
  }
  ctx.restore();
}

export function showMapScreen(playerPos, bossZonesArr) {
  currentPlayerPos = playerPos || null;
  currentBossZones = bossZonesArr || [];
  if (overlay) {
    overlay.style.display = "flex";
    drawMap();
  }
}

export function hideMapScreen() {
  if (overlay) overlay.style.display = "none";
}

export function isMapScreenVisible() {
  return !!(overlay && overlay.style.display !== "none");
}
