// eventEngine.js — deterministic voyage event selection and outcome application

import { VOYAGE_EVENTS } from "./voyageEvents.js";
import { appendJournalEntry } from "./storyState.js";

function hashString(text) {
  var s = String(text || "");
  var h = 2166136261 >>> 0;
  for (var i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  var t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    var x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toFiniteNumber(value, fallback) {
  var n = Number(value);
  return isFinite(n) ? n : fallback;
}

function pickWeighted(pool, rng) {
  if (!pool || !pool.length) return null;
  var total = 0;
  var i;
  for (i = 0; i < pool.length; i++) {
    total += Math.max(0.001, toFiniteNumber(pool[i].weight, 1));
  }
  var roll = rng() * total;
  for (i = 0; i < pool.length; i++) {
    roll -= Math.max(0.001, toFiniteNumber(pool[i].weight, 1));
    if (roll <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

function regionMatches(event, regionId) {
  if (!event || !Array.isArray(event.regions) || event.regions.length === 0) return true;
  return event.regions.indexOf(regionId) >= 0;
}

function nodeTypeMatches(event, nodeType) {
  if (!event || !Array.isArray(event.nodeTypes) || event.nodeTypes.length === 0) return true;
  return event.nodeTypes.indexOf(nodeType) >= 0;
}

function checkFactionRequirement(req, storyState) {
  if (!req || typeof req !== "object") return true;
  if (!storyState || !storyState.factionRep) return false;
  var keys = Object.keys(req);
  for (var i = 0; i < keys.length; i++) {
    var faction = keys[i];
    var needed = toFiniteNumber(req[faction], 0);
    var current = toFiniteNumber(storyState.factionRep[faction], 0);
    if (current < needed) return false;
  }
  return true;
}

export function requirementsMet(requirements, storyState, context) {
  if (!requirements) return true;
  if (!storyState) return false;

  if (requirements.flag) {
    if (!storyState.flags || !storyState.flags[requirements.flag]) return false;
  }
  if (Array.isArray(requirements.flagsAll)) {
    for (var i = 0; i < requirements.flagsAll.length; i++) {
      if (!storyState.flags || !storyState.flags[requirements.flagsAll[i]]) return false;
    }
  }
  if (Array.isArray(requirements.flagsAny) && requirements.flagsAny.length > 0) {
    var hasAny = false;
    for (var j = 0; j < requirements.flagsAny.length; j++) {
      if (storyState.flags && storyState.flags[requirements.flagsAny[j]]) {
        hasAny = true;
        break;
      }
    }
    if (!hasAny) return false;
  }
  if (!checkFactionRequirement(requirements.factionMin, storyState)) return false;

  if (requirements.nodeColMin !== undefined) {
    var col = context && context.node ? context.node.col : 0;
    if (col < requirements.nodeColMin) return false;
  }
  if (requirements.nodeColMax !== undefined) {
    var col2 = context && context.node ? context.node.col : 0;
    if (col2 > requirements.nodeColMax) return false;
  }
  return true;
}

export function getChoiceAvailability(event, storyState, context) {
  var out = [];
  var choices = event && Array.isArray(event.choices) ? event.choices : [];
  for (var i = 0; i < choices.length; i++) {
    var choice = choices[i];
    var enabled = requirementsMet(choice.requirements, storyState, context);
    out.push({
      id: choice.id || ("choice_" + i),
      enabled: enabled
    });
  }
  return out;
}

export function selectEvent(opts) {
  var options = opts || {};
  var node = options.node || null;
  var storyState = options.storyState || null;
  var regionId = options.regionId || (storyState ? storyState.currentRegion : "frontier_isles");
  var nodeType = node && node.type ? node.type : "event";
  var runSeed = toFiniteNumber(options.runSeed, 0);
  var visitIndex = toFiniteNumber(options.visitIndex, 0);
  var nodeId = node && node.id !== undefined ? node.id : 0;

  var seed = (runSeed ^ hashString(regionId) ^ hashString(nodeType) ^ Math.imul(nodeId + 1, 9781) ^ Math.imul(visitIndex + 3, 1669)) >>> 0;
  var rng = mulberry32(seed);
  var pool = [];

  for (var i = 0; i < VOYAGE_EVENTS.length; i++) {
    var ev = VOYAGE_EVENTS[i];
    if (!regionMatches(ev, regionId)) continue;
    if (!nodeTypeMatches(ev, nodeType)) continue;
    if (ev.requirements && !requirementsMet(ev.requirements, storyState, { node: node })) continue;
    pool.push({
      event: ev,
      weight: Math.max(0.001, toFiniteNumber(ev.rarityWeight, 1))
    });
  }

  var picked = pickWeighted(pool, rng);
  return picked ? picked.event : null;
}

function applyFactionRep(outcome, storyState, result) {
  if (!outcome || !outcome.factionRep || !storyState || !storyState.factionRep) return;
  var keys = Object.keys(outcome.factionRep);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    var add = Math.round(toFiniteNumber(outcome.factionRep[k], 0));
    if (!add) continue;
    var prev = toFiniteNumber(storyState.factionRep[k], 0);
    storyState.factionRep[k] = clamp(prev + add, -100, 100);
    result.repChanges.push({ faction: k, delta: add, value: storyState.factionRep[k] });
  }
}

function applyFlags(outcome, storyState) {
  if (!outcome || !storyState) return;
  if (!storyState.flags) storyState.flags = {};
  if (Array.isArray(outcome.setFlags)) {
    for (var i = 0; i < outcome.setFlags.length; i++) {
      storyState.flags[outcome.setFlags[i]] = true;
    }
  }
  if (Array.isArray(outcome.clearFlags)) {
    for (var j = 0; j < outcome.clearFlags.length; j++) {
      delete storyState.flags[outcome.clearFlags[j]];
    }
  }
}

function clampHp(runState, maxHp) {
  if (!runState) return;
  var mh = Math.max(1, Math.round(toFiniteNumber(maxHp, runState.maxHp || 1)));
  runState.maxHp = mh;
  runState.hp = Math.max(1, Math.min(mh, Math.round(toFiniteNumber(runState.hp, mh))));
}

function applyGold(outcome, runState, runtimeRefs, result) {
  if (!outcome || outcome.gold === undefined || !runState) return;
  var delta = Math.round(toFiniteNumber(outcome.gold, 0));
  if (!delta) return;
  runState.gold = Math.max(0, Math.round(toFiniteNumber(runState.gold, 0) + delta));
  if (runtimeRefs && runtimeRefs.upgrades) runtimeRefs.upgrades.gold = runState.gold;
  result.goldDelta += delta;
}

function applyHp(outcome, runState, runtimeRefs, result) {
  if (!outcome || outcome.hpDelta === undefined || !runState) return;
  var delta = Math.round(toFiniteNumber(outcome.hpDelta, 0));
  if (!delta) return;
  var maxHp = runState.maxHp;
  if (runtimeRefs && runtimeRefs.classStats && runtimeRefs.classStats.hp) {
    maxHp = Math.max(maxHp || 0, runtimeRefs.classStats.hp);
  }
  if (maxHp === null || maxHp === undefined) maxHp = Math.max(1, toFiniteNumber(runState.hp, 1));
  runState.maxHp = Math.max(1, Math.round(maxHp));
  runState.hp = clamp(Math.round(toFiniteNumber(runState.hp, runState.maxHp) + delta), 1, runState.maxHp);
  result.hpDelta += delta;
}

function applyStoryScore(outcome, storyState) {
  if (!storyState || !outcome) return;
  if (outcome.storyScore === undefined) return;
  storyState.storyScore = Math.round(toFiniteNumber(storyState.storyScore, 0) + toFiniteNumber(outcome.storyScore, 0));
}

function applyJournal(outcome, storyState, result) {
  if (!outcome || !storyState) return;
  if (!outcome.journal) return;
  var text = typeof outcome.journal === "string" ? outcome.journal : String(outcome.journal || "");
  if (!text) return;
  var item = appendJournalEntry(storyState, {
    text: text,
    type: "event",
    region: storyState.currentRegion
  });
  if (item) result.journalAdded += 1;
}

function applyRandomOutcome(outcome, stateRefs, result, rng) {
  if (!outcome || !Array.isArray(outcome.random) || outcome.random.length === 0) return;
  var pool = [];
  for (var i = 0; i < outcome.random.length; i++) {
    pool.push({
      value: outcome.random[i],
      weight: Math.max(0.001, toFiniteNumber(outcome.random[i].weight, 1))
    });
  }
  var picked = pickWeighted(pool, rng);
  if (!picked || !picked.value) return;
  applyOutcome(picked.value, stateRefs, result, rng);
}

function applyOutcome(outcome, stateRefs, result, rng) {
  if (!outcome) return;
  var storyState = stateRefs.storyState;
  var runState = stateRefs.runState;
  var runtimeRefs = stateRefs.runtimeRefs;

  applyFactionRep(outcome, storyState, result);
  applyGold(outcome, runState, runtimeRefs, result);
  applyHp(outcome, runState, runtimeRefs, result);
  applyFlags(outcome, storyState);
  applyStoryScore(outcome, storyState);
  applyJournal(outcome, storyState, result);
  applyRandomOutcome(outcome, stateRefs, result, rng);

  if (outcome.combatOverride) result.combatOverride = outcome.combatOverride;
  if (outcome.encounterType) result.encounterType = outcome.encounterType;
  if (outcome.sceneRole) result.sceneRole = outcome.sceneRole;
  if (outcome.nodeLabel) result.nodeLabel = outcome.nodeLabel;
  if (outcome.resultCue) result.storyCues.push(outcome.resultCue);
  if (Array.isArray(outcome.storyCues)) {
    for (var i = 0; i < outcome.storyCues.length; i++) {
      result.storyCues.push(outcome.storyCues[i]);
    }
  }
  if (outcome.message) result.messages.push(String(outcome.message));
}

export function applyEventOutcome(args) {
  var options = args || {};
  var storyState = options.storyState || null;
  var runState = options.runState || null;
  var runtimeRefs = options.runtimeRefs || null;
  var eventId = options.eventId || "";
  var choice = options.choice || null;
  var choiceOutcome = choice && choice.outcomes ? choice.outcomes : null;
  var seed = (toFiniteNumber(options.runSeed, 0) ^ hashString(eventId) ^ hashString(choice ? choice.id : "none") ^ Math.imul(toFiniteNumber(options.visitIndex, 0) + 7, 92821)) >>> 0;
  var rng = mulberry32(seed);

  var result = {
    goldDelta: 0,
    hpDelta: 0,
    repChanges: [],
    journalAdded: 0,
    messages: [],
    storyCues: [],
    combatOverride: null,
    encounterType: null,
    sceneRole: null,
    nodeLabel: null
  };

  if (!storyState || !runState || !choiceOutcome) return result;

  applyOutcome(choiceOutcome, {
    storyState: storyState,
    runState: runState,
    runtimeRefs: runtimeRefs
  }, result, rng);

  storyState.lastEventId = eventId || null;
  storyState.lastEncounterType = result.encounterType || storyState.lastEncounterType || null;
  storyState.eventCount = Math.max(0, Math.floor(toFiniteNumber(storyState.eventCount, 0))) + 1;
  clampHp(runState, runState.maxHp);

  return result;
}

