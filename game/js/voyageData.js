// voyageData.js — voyage chart node types, seeded procedural generation, chart state
// Slay-the-Spire-style branching path map for a single zone.

var STORAGE_KEY = "ocean_outlaws_voyage";

// --- node type definitions ---
var NODE_TYPES = {
  fleet_battle: { label: "Fleet Battle", icon: "\u2694", color: "#cc4444" },        // crossed swords
  harbor_raid: { label: "Harbor Raid", icon: "\u2693", color: "#44aa88" },           // anchor
  merchant_chase: { label: "Merchant Chase", icon: "\u26F5", color: "#ddaa44" },     // ship
  salvage: { label: "Salvage", icon: "\u2620", color: "#8899aa" },                   // wreck (skull+bones works)
  storm_crossing: { label: "Storm Crossing", icon: "\u2601", color: "#6688bb" },     // cloud
  event: { label: "Event / Parley", icon: "\u{1F4DC}", color: "#bb88dd" },           // scroll
  boss: { label: "Boss Lair", icon: "\u2620", color: "#ff4444" },                    // skull
  port: { label: "Port of Call", icon: "\ud83c\udfea", color: "#44dd88" }            // shop/port
};

export function getNodeTypes() {
  return NODE_TYPES;
}

// --- simple seeded PRNG (separate from gameplay RNG) ---
// We use our own lightweight PRNG so chart generation doesn't disturb the
// gameplay RNG sequence.  mulberry32.
function createChartRNG(seed) {
  var state = seed | 0;
  return function () {
    state = (state + 0x6d2b79f5) | 0;
    var t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- generate a voyage chart for one zone ---
// Returns { columns, nodes, edges, startNodeId, exitNodeIds }
//   columns: number of columns (left→right progression)
//   nodes: [{id, col, row, type, x, y}]
//   edges: [{from, to}]
export function generateVoyageChart(seed, zoneNumber, isBossZone) {
  var rng = createChartRNG(seed);

  // 7 columns (Slay the Spire style: ~7 rows deep)
  var numCols = 7;
  // 3-4 nodes per column (width), except first and last which are narrower
  var nodesPerCol = [];
  nodesPerCol.push(1); // single start node
  for (var c = 1; c < numCols - 1; c++) {
    nodesPerCol.push(2 + Math.floor(rng() * 3)); // 2-4 nodes
  }
  nodesPerCol.push(1); // single exit node

  // build nodes
  var nodes = [];
  var nodeId = 0;
  var colNodes = []; // colNodes[col] = array of node objects in that column
  for (var col = 0; col < numCols; col++) {
    var count = nodesPerCol[col];
    var arr = [];
    for (var row = 0; row < count; row++) {
      var type = pickNodeType(rng, col, numCols, isBossZone);
      var node = {
        id: nodeId,
        col: col,
        row: row,
        rowCount: count,
        type: type,
        // x/y computed later for rendering
        x: 0,
        y: 0
      };
      nodes.push(node);
      arr.push(node);
      nodeId++;
    }
    colNodes.push(arr);
  }

  // build edges — each node in col connects to 1-2 nodes in col+1
  // guarantee every node has at least one incoming and one outgoing edge
  var edges = [];
  for (var col = 0; col < numCols - 1; col++) {
    var curr = colNodes[col];
    var next = colNodes[col + 1];

    // first pass: give each current node at least one forward connection
    for (var ci = 0; ci < curr.length; ci++) {
      // pick the "closest" node (by row ratio) plus maybe one extra
      var bestIdx = Math.round((ci / Math.max(1, curr.length - 1)) * (next.length - 1));
      edges.push({ from: curr[ci].id, to: next[bestIdx].id });

      // sometimes add a second edge for branching
      if (rng() < 0.45 && next.length > 1) {
        var alt = bestIdx + (rng() < 0.5 ? 1 : -1);
        alt = Math.max(0, Math.min(next.length - 1, alt));
        if (alt !== bestIdx) {
          edges.push({ from: curr[ci].id, to: next[alt].id });
        }
      }
    }

    // second pass: ensure every next-col node has at least one incoming edge
    for (var ni = 0; ni < next.length; ni++) {
      var hasIncoming = false;
      for (var e = 0; e < edges.length; e++) {
        if (edges[e].to === next[ni].id) { hasIncoming = true; break; }
      }
      if (!hasIncoming) {
        // connect from the nearest current-col node
        var nearIdx = Math.round((ni / Math.max(1, next.length - 1)) * (curr.length - 1));
        edges.push({ from: curr[nearIdx].id, to: next[ni].id });
      }
    }
  }

  // deduplicate edges
  var edgeSet = {};
  var uniqueEdges = [];
  for (var e = 0; e < edges.length; e++) {
    var key = edges[e].from + "-" + edges[e].to;
    if (!edgeSet[key]) {
      edgeSet[key] = true;
      uniqueEdges.push(edges[e]);
    }
  }

  // compute layout positions (0-1 range) for each node
  for (var i = 0; i < nodes.length; i++) {
    var n = nodes[i];
    // x: left-to-right based on column, with padding
    n.x = (n.col + 0.5) / numCols;
    // y: distribute rows evenly within column, with slight jitter
    if (n.rowCount === 1) {
      n.y = 0.5;
    } else {
      var spacing = 0.7 / Math.max(1, n.rowCount - 1);
      n.y = 0.15 + n.row * spacing;
    }
    // add slight jitter for organic feel
    n.y += (rng() - 0.5) * 0.06;
  }

  var startId = colNodes[0][0].id;
  var exitIds = [];
  for (var ei = 0; ei < colNodes[numCols - 1].length; ei++) {
    exitIds.push(colNodes[numCols - 1][ei].id);
  }

  return {
    columns: numCols,
    nodes: nodes,
    edges: uniqueEdges,
    startNodeId: startId,
    exitNodeIds: exitIds,
    seed: seed
  };
}

function pickNodeType(rng, col, numCols, isBossZone) {
  // first column: always fleet_battle (easy start)
  if (col === 0) return "fleet_battle";
  // last column: boss if boss zone, else fleet_battle
  if (col === numCols - 1) {
    return isBossZone ? "boss" : "fleet_battle";
  }

  // weighted pool for middle columns
  var pool = [
    { type: "fleet_battle", weight: 30 },
    { type: "harbor_raid", weight: 15 },
    { type: "merchant_chase", weight: 15 },
    { type: "salvage", weight: 15 },
    { type: "storm_crossing", weight: 12 },
    { type: "event", weight: 13 },
    { type: "port", weight: 10 }
  ];

  var total = 0;
  for (var i = 0; i < pool.length; i++) total += pool[i].weight;
  var roll = rng() * total;
  var acc = 0;
  for (var i = 0; i < pool.length; i++) {
    acc += pool[i].weight;
    if (roll < acc) return pool[i].type;
  }
  return "fleet_battle";
}

// --- voyage chart state ---
// Tracks player position, visited nodes, revealed nodes
export function createVoyageState(chart) {
  var revealed = {};
  var visited = {};

  // start node is visited + revealed
  visited[chart.startNodeId] = true;
  revealed[chart.startNodeId] = true;

  // reveal nodes adjacent to start
  revealAdjacent(chart, chart.startNodeId, revealed);

  return {
    chartSeed: chart.seed,
    currentNodeId: chart.startNodeId,
    visited: visited,
    revealed: revealed,
    completed: false
  };
}

function revealAdjacent(chart, nodeId, revealed) {
  for (var i = 0; i < chart.edges.length; i++) {
    var e = chart.edges[i];
    if (e.from === nodeId) revealed[e.to] = true;
    if (e.to === nodeId) revealed[e.from] = true;
  }
}

// --- move to a node (returns true if valid move) ---
export function moveToNode(chart, state, targetNodeId) {
  // check that target is connected and adjacent (one column forward)
  var canMove = false;
  for (var i = 0; i < chart.edges.length; i++) {
    if (chart.edges[i].from === state.currentNodeId && chart.edges[i].to === targetNodeId) {
      canMove = true;
      break;
    }
  }
  if (!canMove) return false;
  if (!state.revealed[targetNodeId]) return false;

  state.currentNodeId = targetNodeId;
  state.visited[targetNodeId] = true;
  revealAdjacent(chart, targetNodeId, state.revealed);

  // check if at exit
  for (var i = 0; i < chart.exitNodeIds.length; i++) {
    if (targetNodeId === chart.exitNodeIds[i]) {
      state.completed = true;
    }
  }

  return true;
}

// --- get nodes reachable from current position ---
export function getReachableNodes(chart, state) {
  var reachable = [];
  for (var i = 0; i < chart.edges.length; i++) {
    var e = chart.edges[i];
    if (e.from === state.currentNodeId && state.revealed[e.to]) {
      reachable.push(e.to);
    }
  }
  return reachable;
}

// --- persistence ---
export function saveVoyageState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) { /* ignore */ }
}

export function loadVoyageState() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return null;
}

export function clearVoyageState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) { /* ignore */ }
}
