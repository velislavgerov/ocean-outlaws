// voyageChart.js — canvas-rendered voyage chart overlay (Slay the Spire style)
// Nautical/parchment aesthetic. Player clicks revealed nodes to navigate.

import { getNodeTypes, getReachableNodes } from "./voyageData.js";
import { isMobile } from "./mobile.js";
import { T, FONT } from "./theme.js";

var overlay = null;
var chartCanvas = null;
var chartCtx = null;
var onSelectCallback = null;
var currentChart = null;
var currentState = null;
var hoveredNodeId = null;
var tooltipEl = null;
var nodeHitAreas = []; // {id, cx, cy, r}
var _touchStartPos = null;

var NODE_ICONS = { fleet_battle: "\u2694", harbor_raid: "\u2693", merchant_chase: "\u26F5", salvage: "\u{1F4A0}", storm_crossing: "\u2601", event: "\u{1F4DC}", boss: "\u2620" };

// --- create the chart overlay (call once) ---
export function createVoyageChart() {
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
    "background:" + T.bgOverlay,
    "z-index: 150",
    "font-family:" + FONT,
    "user-select: none",
    "overflow-y: auto",
    _mob ? "padding: 12px 0" : ""
  ].join(";");

  var title = document.createElement("div");
  title.textContent = "VOYAGE CHART";
  title.style.cssText = "font-size:28px;font-weight:bold;color:" + T.gold + ";margin-bottom:6px;text-shadow:0 2px 4px rgba(0,0,0,0.6);letter-spacing:4px";
  overlay.appendChild(title);
  var subtitle = document.createElement("div");
  subtitle.textContent = "Choose your path through these waters";
  subtitle.style.cssText = "font-size:13px;color:" + T.textDim + ";margin-bottom:12px";
  overlay.appendChild(subtitle);

  var canvasWrap = document.createElement("div");
  canvasWrap.style.cssText = "position:relative;width:700px;max-width:94vw;height:420px;max-height:60vh";
  chartCanvas = document.createElement("canvas");
  chartCanvas.width = 700;
  chartCanvas.height = 420;
  chartCanvas.style.cssText = "width:100%;height:100%;border:2px solid " + T.borderGold + ";border-radius:6px;cursor:pointer";
  chartCtx = chartCanvas.getContext("2d");
  canvasWrap.appendChild(chartCanvas);
  tooltipEl = document.createElement("div");
  tooltipEl.style.cssText = "position:absolute;padding:10px 14px;background:" + T.bgDark + ";border:1px solid " + T.borderGold + ";border-radius:4px;font-size:12px;font-family:" + FONT + ";color:" + T.text + ";pointer-events:none;display:none;" + (_mob ? "white-space:normal;max-width:200px" : "white-space:nowrap") + ";z-index:160";
  canvasWrap.appendChild(tooltipEl);
  overlay.appendChild(canvasWrap);

  var legend = document.createElement("div");
  legend.style.cssText = "margin-top:10px;font-size:11px;color:" + T.textDim + ";display:flex;flex-wrap:wrap;gap:12px;justify-content:center;font-family:" + FONT;
  var types = getNodeTypes();
  var typeKeys = ["fleet_battle", "harbor_raid", "merchant_chase", "salvage", "storm_crossing", "event", "boss"];
  for (var i = 0; i < typeKeys.length; i++) {
    var t = types[typeKeys[i]];
    legend.innerHTML += '<span style="color:' + t.color + '">' + t.icon + " " + t.label + "</span>";
  }
  overlay.appendChild(legend);

  chartCanvas.addEventListener("mousemove", onMouseMove);
  chartCanvas.addEventListener("click", onClick);
  chartCanvas.addEventListener("mouseleave", function () { hoveredNodeId = null; tooltipEl.style.display = "none"; drawChart(); });
  chartCanvas.addEventListener("touchstart", onTouchStart, { passive: false });
  chartCanvas.addEventListener("touchend", onTouchEnd, { passive: false });
  document.body.appendChild(overlay);
}

// --- canvas coordinate helpers ---
function getCanvasPos(e) {
  var rect = chartCanvas.getBoundingClientRect();
  var scaleX = chartCanvas.width / rect.width;
  var scaleY = chartCanvas.height / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY
  };
}

function getCanvasPosFromTouch(touch) {
  var rect = chartCanvas.getBoundingClientRect();
  var scaleX = chartCanvas.width / rect.width;
  var scaleY = chartCanvas.height / rect.height;
  return {
    x: (touch.clientX - rect.left) * scaleX,
    y: (touch.clientY - rect.top) * scaleY
  };
}

// --- hit detection ---
function findNodeAt(px, py) {
  for (var i = 0; i < nodeHitAreas.length; i++) {
    var n = nodeHitAreas[i];
    var dx = px - n.cx;
    var dy = py - n.cy;
    if (dx * dx + dy * dy <= n.r * n.r) return n.id;
  }
  return null;
}

// --- touch handling ---
function onTouchStart(e) {
  if (!e.touches.length) return;
  _touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}

function onTouchEnd(e) {
  if (!e.changedTouches.length || !_touchStartPos) return;
  var touch = e.changedTouches[0];
  var dx = Math.abs(touch.clientX - _touchStartPos.x);
  var dy = Math.abs(touch.clientY - _touchStartPos.y);
  if (dx > 15 || dy > 15) return; // scroll, not tap

  e.preventDefault();
  var pos = getCanvasPosFromTouch(touch);
  var nodeId = findNodeAt(pos.x, pos.y);

  if (nodeId !== null && currentChart && currentState) {
    var reachable = getReachableNodes(currentChart, currentState);
    var isReachable = false;
    for (var i = 0; i < reachable.length; i++) {
      if (reachable[i] === nodeId) { isReachable = true; break; }
    }

    if (hoveredNodeId === nodeId && isReachable) {
      // second tap — navigate
      if (onSelectCallback) onSelectCallback(nodeId);
      return;
    }
    // first tap — show tooltip
    hoveredNodeId = nodeId;
    showTooltipForNode(nodeId, touch.clientX, touch.clientY);
    drawChart();
  } else {
    hoveredNodeId = null;
    tooltipEl.style.display = "none";
    drawChart();
  }
}

// --- mouse handling ---
function onMouseMove(e) {
  var pos = getCanvasPos(e);
  var nodeId = findNodeAt(pos.x, pos.y);
  hoveredNodeId = nodeId;

  if (nodeId !== null && currentChart && currentState) {
    showTooltipForNode(nodeId, e.clientX, e.clientY);
  } else {
    tooltipEl.style.display = "none";
  }
  drawChart();
}

function onClick(e) {
  var pos = getCanvasPos(e);
  var nodeId = findNodeAt(pos.x, pos.y);
  if (nodeId === null || !currentChart || !currentState) return;

  var reachable = getReachableNodes(currentChart, currentState);
  for (var i = 0; i < reachable.length; i++) {
    if (reachable[i] === nodeId) {
      if (onSelectCallback) onSelectCallback(nodeId);
      return;
    }
  }
}

// --- tooltip ---
function showTooltipForNode(nodeId, clientX, clientY) {
  var node = getNode(nodeId);
  if (!node) return;

  var types = getNodeTypes();
  var info = types[node.type] || { label: "Unknown", icon: "?", color: "#888" };
  var isVisited = !!currentState.visited[nodeId];
  var isRevealed = !!currentState.revealed[nodeId];
  var isCurrent = currentState.currentNodeId === nodeId;
  var reachable = getReachableNodes(currentChart, currentState);
  var isReachable = false;
  for (var i = 0; i < reachable.length; i++) {
    if (reachable[i] === nodeId) { isReachable = true; break; }
  }

  var statusText = "";
  if (isCurrent) statusText = '<div style="color:' + T.gold + ';margin-top:4px">You are here</div>';
  else if (isReachable) statusText = '<div style="color:' + T.greenBright + ';margin-top:4px">Click to sail here</div>';
  else if (isVisited) statusText = '<div style="color:' + T.textDim + ';margin-top:4px">Visited</div>';
  else if (isRevealed) statusText = '<div style="color:' + T.textDim + ';margin-top:4px">Not reachable from here</div>';

  tooltipEl.innerHTML =
    '<div style="font-size:16px;margin-bottom:4px">' + info.icon + "</div>" +
    '<div style="font-size:14px;font-weight:bold;color:' + info.color + ';margin-bottom:2px">' + info.label + "</div>" +
    statusText;

  var rect = chartCanvas.getBoundingClientRect();
  var tx = clientX - rect.left + 16;
  var ty = clientY - rect.top - 10;
  if (tx + 180 > rect.width) tx = tx - 200;
  if (ty < 0) ty = 10;
  tooltipEl.style.left = tx + "px";
  tooltipEl.style.top = ty + "px";
  tooltipEl.style.display = "block";
}

function getNode(nodeId) {
  if (!currentChart) return null;
  for (var i = 0; i < currentChart.nodes.length; i++) {
    if (currentChart.nodes[i].id === nodeId) return currentChart.nodes[i];
  }
  return null;
}

// --- draw the voyage chart ---
function drawChart() {
  if (!chartCtx || !currentChart || !currentState) return;

  var W = chartCanvas.width;
  var H = chartCanvas.height;
  var ctx = chartCtx;
  var chart = currentChart;
  var state = currentState;
  var types = getNodeTypes();
  var reachable = getReachableNodes(chart, state);
  var reachableSet = {};
  for (var ri = 0; ri < reachable.length; ri++) reachableSet[reachable[ri]] = true;

  // padded draw area
  var padL = 50;
  var padR = 50;
  var padT = 30;
  var padB = 30;
  var drawW = W - padL - padR;
  var drawH = H - padT - padB;

  // clear
  ctx.clearRect(0, 0, W, H);

  // background — aged parchment
  var bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, "#2a1e12");
  bgGrad.addColorStop(0.5, "#241a10");
  bgGrad.addColorStop(1, "#1e150c");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // grid lines
  ctx.strokeStyle = "rgba(139, 109, 68, 0.10)";
  ctx.lineWidth = 1;
  for (var gx = 0; gx < W; gx += 40) {
    ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
  }
  for (var gy = 0; gy < H; gy += 40) {
    ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
  }

  // compass rose
  drawCompassRose(ctx, W - 40, 40, 24);

  // helper: node position on canvas
  function nodePos(n) {
    return {
      cx: padL + n.x * drawW,
      cy: padT + n.y * drawH
    };
  }

  // draw edges
  ctx.lineWidth = 2;
  for (var ei = 0; ei < chart.edges.length; ei++) {
    var e = chart.edges[ei];
    var fromN = getNode(e.from);
    var toN = getNode(e.to);
    if (!fromN || !toN) continue;

    var fromRevealed = !!state.revealed[e.from];
    var toRevealed = !!state.revealed[e.to];
    if (!fromRevealed && !toRevealed) continue; // fully fogged

    var p1 = nodePos(fromN);
    var p2 = nodePos(toN);

    var bothRevealed = fromRevealed && toRevealed;
    var isPath = !!state.visited[e.from] && !!state.visited[e.to];

    if (isPath) {
      ctx.strokeStyle = "rgba(212, 164, 74, 0.6)";
      ctx.setLineDash([]);
    } else if (bothRevealed) {
      ctx.strokeStyle = "rgba(212, 164, 74, 0.25)";
      ctx.setLineDash([6, 4]);
    } else {
      ctx.strokeStyle = "rgba(80, 60, 35, 0.15)";
      ctx.setLineDash([4, 6]);
    }

    ctx.beginPath();
    ctx.moveTo(p1.cx, p1.cy);
    ctx.lineTo(p2.cx, p2.cy);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // draw nodes
  nodeHitAreas = [];
  for (var ni = 0; ni < chart.nodes.length; ni++) {
    var node = chart.nodes[ni];
    var revealed = !!state.revealed[node.id];
    if (!revealed) continue; // fogged — don't draw

    var visited = !!state.visited[node.id];
    var isCurrent = state.currentNodeId === node.id;
    var isReachable = !!reachableSet[node.id];
    var isHovered = hoveredNodeId === node.id;
    var info = types[node.type] || { label: "?", icon: "?", color: "#888" };

    var p = nodePos(node);
    var r = node.type === "boss" ? 22 : 18;

    nodeHitAreas.push({ id: node.id, cx: p.cx, cy: p.cy, r: r + 6 });

    // glow for current / reachable / hovered
    if (isCurrent || (isReachable && isHovered)) {
      ctx.shadowColor = isCurrent ? T.gold : info.color;
      ctx.shadowBlur = isCurrent ? 18 : 14;
    }

    // node circle
    ctx.beginPath();
    ctx.arc(p.cx, p.cy, r, 0, Math.PI * 2);

    if (isCurrent) {
      // current position — bright gold fill
      ctx.fillStyle = "rgba(80, 60, 25, 0.95)";
      ctx.fill();
      ctx.strokeStyle = T.gold;
      ctx.lineWidth = 3;
      ctx.stroke();
    } else if (visited) {
      // visited — dimmed
      ctx.fillStyle = "rgba(30, 22, 14, 0.7)";
      ctx.fill();
      ctx.strokeStyle = "rgba(100, 80, 50, 0.3)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else if (isReachable) {
      // reachable — highlighted
      ctx.fillStyle = "rgba(45, 35, 20, 0.9)";
      ctx.fill();
      ctx.strokeStyle = info.color;
      ctx.lineWidth = isHovered ? 3 : 2;
      ctx.stroke();
    } else {
      // revealed but not reachable
      ctx.fillStyle = "rgba(30, 22, 14, 0.6)";
      ctx.fill();
      ctx.strokeStyle = "rgba(80, 60, 35, 0.3)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;

    // icon
    var iconAlpha = visited && !isCurrent ? 0.35 : 1.0;
    ctx.globalAlpha = iconAlpha;
    ctx.fillStyle = isCurrent ? T.gold : info.color;
    ctx.font = (node.type === "boss" ? "18px" : "14px") + " serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(NODE_ICONS[node.type] || info.icon, p.cx, p.cy);
    ctx.globalAlpha = 1.0;

    // label below node (only for current, reachable, or hovered)
    if (isCurrent || isReachable || isHovered) {
      ctx.fillStyle = isCurrent ? T.gold : "rgba(196, 168, 114, 0.7)";
      ctx.font = "9px serif";
      ctx.fillText(info.label, p.cx, p.cy + r + 12);
    }

    // "YOU" marker on current node
    if (isCurrent) {
      ctx.fillStyle = T.goldBright;
      ctx.font = "bold 8px serif";
      ctx.fillText("YOU", p.cx, p.cy - r - 6);
    }
  }

  // column labels (top)
  ctx.fillStyle = "rgba(139, 109, 68, 0.3)";
  ctx.font = "9px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (var c = 0; c < chart.columns; c++) {
    var cx = padL + ((c + 0.5) / chart.columns) * drawW;
    if (c === 0) ctx.fillText("START", cx, 6);
    else if (c === chart.columns - 1) ctx.fillText("EXIT", cx, 6);
  }
}

function drawCompassRose(ctx, cx, cy, r) {
  ctx.save();
  ctx.strokeStyle = "rgba(212, 164, 74, 0.25)";
  ctx.fillStyle = "rgba(212, 164, 74, 0.15)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  var dirs = ["N", "E", "S", "W"];
  var angles = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
  ctx.font = "bold 9px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(212, 164, 74, 0.4)";
  for (var d = 0; d < 4; d++) {
    var a = angles[d];
    ctx.fillText(dirs[d], cx + Math.cos(a) * (r + 8), cy + Math.sin(a) * (r + 8));
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * (r - 3), cy + Math.sin(a) * (r - 3));
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(cx, cy, 2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// --- show/hide API ---
export function showVoyageChart(chart, state, callback) {
  currentChart = chart;
  currentState = state;
  onSelectCallback = callback;
  if (overlay) {
    overlay.style.display = "flex";
    hoveredNodeId = null;
    tooltipEl.style.display = "none";
    drawChart();
  }
}

export function hideVoyageChart() {
  if (overlay) overlay.style.display = "none";
  if (tooltipEl) tooltipEl.style.display = "none";
  hoveredNodeId = null;
}

export function isVoyageChartVisible() {
  return overlay && overlay.style.display !== "none";
}
