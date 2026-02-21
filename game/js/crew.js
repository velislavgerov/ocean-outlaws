// crew.js — officer/crew system: data, procedural names, roster management, bonuses

// --- stations ---
var STATIONS = ["weapons", "engine", "helm", "medical"];

// --- station bonus definitions ---
var STATION_BONUSES = {
  weapons: { stat: "fireRate", perRank: 0.05, label: "+{pct}% Fire Rate" },
  engine:  { stat: "maxSpeed", perRank: 0.05, label: "+{pct}% Max Speed" },
  helm:    { stat: "turnRate", perRank: 0.05, label: "+{pct}% Turn Rate" },
  medical: { stat: "repair",   perRank: 0.05, label: "+{pct}% Repair Eff." }
};

// --- procedural name parts (naval-themed) ---
var FIRST_NAMES = [
  "Ahab", "Nemo", "Drake", "Bligh", "Horatio",
  "Morgan", "Jolly", "Calico", "Bart", "Flint",
  "Blythe", "Coral", "Marina", "Pearl", "Tempest",
  "Harpoon", "Anchor", "Keel", "Bosun", "Rigger",
  "Salty", "Barnacle", "Gale", "Storm", "Tide"
];

var LAST_NAMES = [
  "Blackbeard", "Ironside", "Wavecrest", "Saltborn", "Deepwater",
  "Gunwhale", "Broadside", "Keelhaul", "Driftwood", "Seaspray",
  "Tidecaller", "Stormhelm", "Reefsong", "Bowsprit", "Quarterdeck",
  "Foghorn", "Rudderfoot", "Hullbreaker", "Anchorstone", "Shellback"
];

// --- emoji portraits per specialty ---
var PORTRAITS = {
  weapons: ["\u2694\ufe0f", "\ud83d\udca3", "\ud83c\udfaf", "\ud83d\udd2b"],
  engine:  ["\u2699\ufe0f", "\ud83d\udd27", "\u26a1", "\ud83d\udee2\ufe0f"],
  helm:    ["\ud83e\udded", "\u2693", "\ud83c\udfa1", "\ud83d\udccd"],
  medical: ["\u2764\ufe0f", "\ud83d\udc8a", "\ud83e\ude7a", "\u2695\ufe0f"]
};

// --- generate a random officer ---
var _nameCounter = 0;

function randomOfficer(specialty, rank) {
  _nameCounter++;
  var seed = Date.now() + _nameCounter;
  var first = FIRST_NAMES[(seed * 7 + _nameCounter * 3) % FIRST_NAMES.length];
  var last = LAST_NAMES[(seed * 13 + _nameCounter * 11) % LAST_NAMES.length];
  var portraits = PORTRAITS[specialty] || PORTRAITS.weapons;
  var portrait = portraits[(seed * 5) % portraits.length];

  return {
    id: "officer_" + _nameCounter + "_" + Date.now(),
    name: first + " " + last,
    portrait: portrait,
    specialty: specialty,
    rank: rank || 1
  };
}

// --- create crew state ---
export function createCrewState() {
  return {
    roster: [],           // all officers the player has
    assigned: {           // station -> officer id (or null)
      weapons: null,
      engine: null,
      helm: null,
      medical: null
    }
  };
}

// --- reset crew state ---
export function resetCrew(state) {
  state.roster = [];
  state.assigned = { weapons: null, engine: null, helm: null, medical: null };
}

// --- add an officer to roster ---
export function addOfficer(state, officer) {
  state.roster.push(officer);
}

// --- generate a random officer reward ---
export function generateOfficerReward(rank) {
  var spec = STATIONS[Math.floor(Math.random() * STATIONS.length)];
  var r = rank || (Math.random() < 0.6 ? 1 : (Math.random() < 0.7 ? 2 : 3));
  return randomOfficer(spec, r);
}

// --- assign officer to a station ---
// Returns true if assigned, false if invalid.
export function assignOfficer(state, officerId, station) {
  if (STATIONS.indexOf(station) === -1) return false;
  var officer = findOfficer(state, officerId);
  if (!officer) return false;

  // un-assign from any previous station
  for (var s = 0; s < STATIONS.length; s++) {
    if (state.assigned[STATIONS[s]] === officerId) {
      state.assigned[STATIONS[s]] = null;
    }
  }

  state.assigned[station] = officerId;
  return true;
}

// --- unassign officer from a station ---
export function unassignStation(state, station) {
  if (STATIONS.indexOf(station) === -1) return;
  state.assigned[station] = null;
}

// --- get the officer assigned to a station (or null) ---
export function getAssigned(state, station) {
  var id = state.assigned[station];
  if (!id) return null;
  return findOfficer(state, id);
}

// --- compute crew bonus multipliers ---
// Returns object like { fireRate: 1.15, maxSpeed: 1.0, turnRate: 1.1, repair: 1.0 }
export function getCrewBonuses(state) {
  var bonuses = { fireRate: 1, maxSpeed: 1, turnRate: 1, repair: 1 };

  for (var s = 0; s < STATIONS.length; s++) {
    var station = STATIONS[s];
    var officerId = state.assigned[station];
    if (!officerId) continue;
    var officer = findOfficer(state, officerId);
    if (!officer) continue;

    var def = STATION_BONUSES[station];
    // matching specialty = full bonus; mismatched = half bonus
    var mult = (officer.specialty === station) ? 1.0 : 0.5;
    var bonus = def.perRank * officer.rank * mult;
    bonuses[def.stat] += bonus;
  }

  return bonuses;
}

// --- get station definitions for UI ---
export function getStations() {
  return STATIONS;
}

// --- get bonus description for an officer at a station ---
export function getBonusLabel(officer, station) {
  var def = STATION_BONUSES[station];
  if (!def) return "";
  var mult = (officer.specialty === station) ? 1.0 : 0.5;
  var pct = Math.round(def.perRank * officer.rank * mult * 100);
  return def.label.replace("{pct}", pct);
}

// --- get station color ---
export function getStationColor(station) {
  var colors = {
    weapons: "#ffaa22",
    engine: "#22aaff",
    helm: "#cc66ff",
    medical: "#44dd66"
  };
  return colors[station] || "#8899aa";
}

// --- helper: find officer in roster by id ---
function findOfficer(state, id) {
  for (var i = 0; i < state.roster.length; i++) {
    if (state.roster[i].id === id) return state.roster[i];
  }
  return null;
}
