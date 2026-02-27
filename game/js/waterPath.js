// waterPath.js — bounded water-only A* planner used by player + enemy nav
import { isLand, terrainBlocksLine } from "./terrain.js";

var SQRT2 = Math.sqrt(2);
var DEFAULT_CELL_SIZE = 6;
var DEFAULT_MARGIN = 28;
var DEFAULT_CLEARANCE = 2.2;
var DEFAULT_MAX_AXIS = 60;
var DEFAULT_MAX_VISITED = 2200;
var DEFAULT_MAX_SNAP_RADIUS = 28;

var DIRS = [
  { x: 1, z: 0, cost: 1 },
  { x: -1, z: 0, cost: 1 },
  { x: 0, z: 1, cost: 1 },
  { x: 0, z: -1, cost: 1 },
  { x: 1, z: 1, cost: SQRT2, diagonal: true },
  { x: 1, z: -1, cost: SQRT2, diagonal: true },
  { x: -1, z: 1, cost: SQRT2, diagonal: true },
  { x: -1, z: -1, cost: SQRT2, diagonal: true }
];

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function cellKey(ix, iz) {
  return ix + "," + iz;
}

function worldToCell(x, minX, cellSize) {
  return Math.round((x - minX) / cellSize);
}

function cellCenterToWorld(i, minX, cellSize) {
  return minX + i * cellSize;
}

function pointDistSq(x1, z1, x2, z2) {
  var dx = x2 - x1;
  var dz = z2 - z1;
  return dx * dx + dz * dz;
}

function isWaterWithClearance(terrain, x, z, clearance) {
  if (!terrain) return true;
  if (isLand(terrain, x, z)) return false;
  if (clearance <= 0) return true;
  var offsets = [
    [clearance, 0],
    [-clearance, 0],
    [0, clearance],
    [0, -clearance]
  ];
  for (var i = 0; i < offsets.length; i++) {
    if (isLand(terrain, x + offsets[i][0], z + offsets[i][1])) return false;
  }
  return true;
}

function snapPointToWater(terrain, x, z, opts) {
  if (!terrain) return { x: x, z: z };
  var clearance = opts.clearance;
  if (!isLand(terrain, x, z)) return { x: x, z: z };
  var step = Math.max(2, opts.cellSize * 0.5);
  var maxRadius = opts.maxSnapRadius;
  var best = null;
  var bestDistSq = Infinity;
  for (var r = step; r <= maxRadius; r += step) {
    var samples = Math.max(8, Math.round((Math.PI * 2 * r) / step));
    for (var s = 0; s < samples; s++) {
      var t = (s / samples) * Math.PI * 2;
      var cx = x + Math.sin(t) * r;
      var cz = z + Math.cos(t) * r;
      if (!isWaterWithClearance(terrain, cx, cz, clearance)) continue;
      var d2 = pointDistSq(x, z, cx, cz);
      if (d2 < bestDistSq) {
        bestDistSq = d2;
        best = { x: cx, z: cz };
      }
    }
    if (best) break;
  }
  return best;
}

function pickOpenNode(open) {
  var bestIndex = 0;
  var best = open[0];
  for (var i = 1; i < open.length; i++) {
    var n = open[i];
    if (n.f < best.f || (n.f === best.f && n.h < best.h)) {
      best = n;
      bestIndex = i;
    }
  }
  return { node: best, index: bestIndex };
}

function simplifyPath(terrain, points) {
  if (!points || points.length <= 2) return points || [];
  var simplified = [points[0]];
  var fromIdx = 0;
  while (fromIdx < points.length - 1) {
    var nextIdx = points.length - 1;
    while (nextIdx > fromIdx + 1) {
      var from = points[fromIdx];
      var to = points[nextIdx];
      if (!terrain || !terrainBlocksLine(terrain, from.x, from.z, to.x, to.z)) break;
      nextIdx--;
    }
    simplified.push(points[nextIdx]);
    fromIdx = nextIdx;
  }
  return simplified;
}

function reconstructPath(node, opts, startSnap, goalSnap) {
  var points = [];
  var cur = node;
  while (cur) {
    points.push({
      x: cellCenterToWorld(cur.ix, opts.minX, opts.cellSize),
      z: cellCenterToWorld(cur.iz, opts.minZ, opts.cellSize)
    });
    cur = cur.parent;
  }
  points.reverse();
  if (points.length > 0) {
    points[0] = { x: startSnap.x, z: startSnap.z };
    points[points.length - 1] = { x: goalSnap.x, z: goalSnap.z };
  }
  return points;
}

export function planWaterPath(terrain, startX, startZ, goalX, goalZ, options) {
  if (!terrain) return [{ x: goalX, z: goalZ }];

  var opts = {
    cellSize: options && options.cellSize ? options.cellSize : DEFAULT_CELL_SIZE,
    margin: options && options.margin ? options.margin : DEFAULT_MARGIN,
    clearance: options && options.clearance ? options.clearance : DEFAULT_CLEARANCE,
    maxAxis: options && options.maxAxis ? options.maxAxis : DEFAULT_MAX_AXIS,
    maxVisited: options && options.maxVisited ? options.maxVisited : DEFAULT_MAX_VISITED,
    maxSnapRadius: options && options.maxSnapRadius ? options.maxSnapRadius : DEFAULT_MAX_SNAP_RADIUS,
    minX: 0,
    minZ: 0
  };

  if (!isLand(terrain, goalX, goalZ) && !terrainBlocksLine(terrain, startX, startZ, goalX, goalZ)) {
    return [{ x: goalX, z: goalZ }];
  }

  var startSnap = snapPointToWater(terrain, startX, startZ, opts);
  var goalSnap = snapPointToWater(terrain, goalX, goalZ, opts);
  if (!startSnap || !goalSnap) return null;

  var minX = Math.min(startSnap.x, goalSnap.x) - opts.margin;
  var maxX = Math.max(startSnap.x, goalSnap.x) + opts.margin;
  var minZ = Math.min(startSnap.z, goalSnap.z) - opts.margin;
  var maxZ = Math.max(startSnap.z, goalSnap.z) + opts.margin;

  var span = Math.max(maxX - minX, maxZ - minZ);
  var minCellForAxis = span / Math.max(4, opts.maxAxis - 2);
  if (minCellForAxis > opts.cellSize) opts.cellSize = minCellForAxis;

  var cellsX = Math.max(5, Math.ceil((maxX - minX) / opts.cellSize) + 1);
  var cellsZ = Math.max(5, Math.ceil((maxZ - minZ) / opts.cellSize) + 1);
  if (cellsX > opts.maxAxis || cellsZ > opts.maxAxis) return null;

  opts.minX = minX;
  opts.minZ = minZ;

  function inBounds(ix, iz) {
    return ix >= 0 && iz >= 0 && ix < cellsX && iz < cellsZ;
  }

  var walkableCache = new Map();
  function isWalkable(ix, iz) {
    if (!inBounds(ix, iz)) return false;
    var key = cellKey(ix, iz);
    if (walkableCache.has(key)) return walkableCache.get(key);
    var wx = cellCenterToWorld(ix, minX, opts.cellSize);
    var wz = cellCenterToWorld(iz, minZ, opts.cellSize);
    var ok = isWaterWithClearance(terrain, wx, wz, opts.clearance);
    walkableCache.set(key, ok);
    return ok;
  }

  var startCell = {
    ix: clamp(worldToCell(startSnap.x, minX, opts.cellSize), 0, cellsX - 1),
    iz: clamp(worldToCell(startSnap.z, minZ, opts.cellSize), 0, cellsZ - 1)
  };
  var goalCell = {
    ix: clamp(worldToCell(goalSnap.x, minX, opts.cellSize), 0, cellsX - 1),
    iz: clamp(worldToCell(goalSnap.z, minZ, opts.cellSize), 0, cellsZ - 1)
  };

  if (!isWalkable(startCell.ix, startCell.iz) || !isWalkable(goalCell.ix, goalCell.iz)) {
    return null;
  }

  var startKey = cellKey(startCell.ix, startCell.iz);
  var startNode = {
    ix: startCell.ix,
    iz: startCell.iz,
    g: 0,
    h: Math.hypot(goalCell.ix - startCell.ix, goalCell.iz - startCell.iz),
    parent: null
  };
  startNode.f = startNode.g + startNode.h;

  var open = [startNode];
  var openByKey = new Map();
  openByKey.set(startKey, startNode);
  var closed = new Set();
  var visited = 0;

  while (open.length > 0 && visited < opts.maxVisited) {
    var best = pickOpenNode(open);
    var current = best.node;
    open.splice(best.index, 1);
    openByKey.delete(cellKey(current.ix, current.iz));
    var currentKey = cellKey(current.ix, current.iz);
    if (closed.has(currentKey)) continue;
    closed.add(currentKey);
    visited++;

    if (current.ix === goalCell.ix && current.iz === goalCell.iz) {
      var raw = reconstructPath(current, opts, startSnap, goalSnap);
      var smoothed = simplifyPath(terrain, raw);
      if (smoothed.length <= 1) return [{ x: goalSnap.x, z: goalSnap.z }];
      smoothed.shift();
      if (!isLand(terrain, goalX, goalZ)) {
        var last = smoothed[smoothed.length - 1];
        if (!terrainBlocksLine(terrain, last.x, last.z, goalX, goalZ)) {
          smoothed[smoothed.length - 1] = { x: goalX, z: goalZ };
        }
      }
      return smoothed;
    }

    for (var i = 0; i < DIRS.length; i++) {
      var dir = DIRS[i];
      var nx = current.ix + dir.x;
      var nz = current.iz + dir.z;
      if (!isWalkable(nx, nz)) continue;
      if (dir.diagonal) {
        if (!isWalkable(current.ix + dir.x, current.iz) || !isWalkable(current.ix, current.iz + dir.z)) {
          continue;
        }
      }
      var neighborKey = cellKey(nx, nz);
      if (closed.has(neighborKey)) continue;
      var g = current.g + dir.cost;
      var node = openByKey.get(neighborKey);
      if (!node) {
        node = {
          ix: nx,
          iz: nz,
          g: g,
          h: Math.hypot(goalCell.ix - nx, goalCell.iz - nz),
          parent: current
        };
        node.f = node.g + node.h;
        open.push(node);
        openByKey.set(neighborKey, node);
      } else if (g < node.g) {
        node.g = g;
        node.f = g + node.h;
        node.parent = current;
      }
    }
  }

  return null;
}
