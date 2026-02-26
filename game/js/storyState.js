// storyState.js — per-run narrative state and region helpers

var STORY_VERSION = 1;

var REGION_ORDER = ["frontier_isles", "storm_belt", "forgotten_depths"];

var REGION_INFO = {
  frontier_isles: {
    id: "frontier_isles",
    label: "Frontier Isles",
    index: 0,
    colMin: 0,
    colMax: 2
  },
  storm_belt: {
    id: "storm_belt",
    label: "Storm Belt",
    index: 1,
    colMin: 3,
    colMax: 4
  },
  forgotten_depths: {
    id: "forgotten_depths",
    label: "Forgotten Depths",
    index: 2,
    colMin: 5,
    colMax: 6
  }
};

export function getRegionInfo(regionId) {
  return REGION_INFO[regionId] || REGION_INFO.frontier_isles;
}

export function getRegionOrder() {
  return REGION_ORDER.slice();
}

export function getRegionForNode(col, totalCols) {
  var safeCols = Math.max(1, totalCols || 7);
  var c = Math.max(0, Math.min(safeCols - 1, Math.floor(col || 0)));

  // fixed 7-column design: 0-2, 3-4, 5-6
  if (safeCols === 7) {
    if (c <= 2) return "frontier_isles";
    if (c <= 4) return "storm_belt";
    return "forgotten_depths";
  }

  // fallback if chart column count changes in future
  var t = c / Math.max(1, safeCols - 1);
  if (t < 0.45) return "frontier_isles";
  if (t < 0.75) return "storm_belt";
  return "forgotten_depths";
}

export function createStoryState(runSeed) {
  var state = {
    version: STORY_VERSION,
    runSeed: runSeed || 0,
    currentRegion: "frontier_isles",
    regionVisitCounts: {
      frontier_isles: 0,
      storm_belt: 0,
      forgotten_depths: 0
    },
    factionRep: {
      navy: 0,
      pirates: 0,
      merchant: 0
    },
    flags: {},
    journal: [],
    lastEventId: null,
    lastEncounterType: null,
    nodesVisited: 0,
    eventCount: 0,
    storyScore: 0
  };
  return state;
}

function toFiniteNumber(value, fallback) {
  var n = Number(value);
  return isFinite(n) ? n : fallback;
}

function clampRep(v) {
  return Math.max(-100, Math.min(100, toFiniteNumber(v, 0)));
}

function sanitizeFlags(flags) {
  var out = {};
  if (!flags || typeof flags !== "object") return out;
  var keys = Object.keys(flags);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (!key) continue;
    out[key] = !!flags[key];
  }
  return out;
}

function sanitizeJournal(journal) {
  if (!Array.isArray(journal)) return [];
  var out = [];
  for (var i = 0; i < journal.length; i++) {
    var item = journal[i];
    if (item && typeof item === "object") {
      out.push({
        id: item.id || ("entry_" + (i + 1)),
        text: typeof item.text === "string" ? item.text : "",
        region: typeof item.region === "string" ? item.region : null,
        type: typeof item.type === "string" ? item.type : "note",
        ts: toFiniteNumber(item.ts, Date.now())
      });
    } else if (typeof item === "string") {
      out.push({ id: "entry_" + (i + 1), text: item, region: null, type: "note", ts: Date.now() });
    }
  }
  if (out.length > 80) out = out.slice(out.length - 80);
  return out;
}

export function hydrateStoryState(raw, runSeed) {
  var base = createStoryState(runSeed || 0);
  if (!raw || typeof raw !== "object") return base;

  base.version = STORY_VERSION;
  base.runSeed = toFiniteNumber(raw.runSeed, runSeed || 0);
  base.currentRegion = REGION_INFO[raw.currentRegion] ? raw.currentRegion : base.currentRegion;
  base.regionVisitCounts.frontier_isles = Math.max(0, Math.floor(toFiniteNumber(raw.regionVisitCounts && raw.regionVisitCounts.frontier_isles, 0)));
  base.regionVisitCounts.storm_belt = Math.max(0, Math.floor(toFiniteNumber(raw.regionVisitCounts && raw.regionVisitCounts.storm_belt, 0)));
  base.regionVisitCounts.forgotten_depths = Math.max(0, Math.floor(toFiniteNumber(raw.regionVisitCounts && raw.regionVisitCounts.forgotten_depths, 0)));

  base.factionRep.navy = clampRep(raw.factionRep && raw.factionRep.navy);
  base.factionRep.pirates = clampRep(raw.factionRep && raw.factionRep.pirates);
  base.factionRep.merchant = clampRep(raw.factionRep && raw.factionRep.merchant);

  base.flags = sanitizeFlags(raw.flags);
  base.journal = sanitizeJournal(raw.journal);

  base.lastEventId = typeof raw.lastEventId === "string" ? raw.lastEventId : null;
  base.lastEncounterType = typeof raw.lastEncounterType === "string" ? raw.lastEncounterType : null;
  base.nodesVisited = Math.max(0, Math.floor(toFiniteNumber(raw.nodesVisited, 0)));
  base.eventCount = Math.max(0, Math.floor(toFiniteNumber(raw.eventCount, 0)));
  base.storyScore = Math.floor(toFiniteNumber(raw.storyScore, 0));

  return base;
}

export function appendJournalEntry(state, entry) {
  if (!state || !entry) return null;
  var text = typeof entry === "string" ? entry : entry.text;
  if (!text || typeof text !== "string") return null;

  var item = {
    id: (entry.id || "journal_" + Date.now() + "_" + Math.floor(Math.random() * 10000)),
    text: text,
    region: entry.region || state.currentRegion || null,
    type: entry.type || "note",
    ts: toFiniteNumber(entry.ts, Date.now())
  };

  state.journal.push(item);
  if (state.journal.length > 80) {
    state.journal.splice(0, state.journal.length - 80);
  }
  return item;
}
