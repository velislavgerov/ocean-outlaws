// multiplayer.js — Supabase Realtime multiplayer: room management, presence, broadcast
// Uses Broadcast for game state sync and Presence for lobby/connection tracking

var SUPABASE_URL = "https://groaodzrfhqmzyyjilpj.supabase.co";
var SUPABASE_ANON_KEY = "sb_publishable_0rYeLFBoFm7IxnPU1IaIAw_JKM70rn3";
var MAX_PLAYERS = 4;
var ROOM_CODE_LENGTH = 4;
var DISCONNECT_TIMEOUT = 5000; // ms before removing disconnected player's ship
var HOST_MIGRATE_DELAY = 2000;

var supabase = null;
var channel = null;
var mpState = null;

// --- generate short room code ---
function generateRoomCode() {
  var chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  var code = "OCEAN-";
  for (var i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// --- generate unique player id ---
function generatePlayerId() {
  return "p_" + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

// --- generate random username ---
function generateUsername() {
  var adjectives = ["Swift", "Bold", "Iron", "Storm", "Dark", "Red", "Ghost", "Steel"];
  var nouns = ["Captain", "Admiral", "Corsair", "Pirate", "Sailor", "Buccaneer"];
  return adjectives[Math.floor(Math.random() * adjectives.length)] +
    nouns[Math.floor(Math.random() * nouns.length)] +
    Math.floor(Math.random() * 100);
}

// --- load/save username from localStorage ---
var USERNAME_KEY = "ocean_outlaws_username";

function loadUsername() {
  try {
    var saved = localStorage.getItem(USERNAME_KEY);
    if (saved && saved.trim().length > 0) return saved.trim();
  } catch (e) { /* ignore */ }
  var name = generateUsername();
  saveUsername(name);
  return name;
}

function saveUsername(name) {
  try { localStorage.setItem(USERNAME_KEY, name); } catch (e) { /* ignore */ }
}

// --- set username ---
export function setUsername(state, name) {
  var trimmed = (name || "").trim();
  if (trimmed.length === 0) return;
  state.username = trimmed;
  saveUsername(trimmed);
  if (state.players[state.playerId]) {
    state.players[state.playerId].username = trimmed;
  }
  if (state.onPlayersChanged) state.onPlayersChanged(state.players);
}

// --- create multiplayer state ---
export function createMultiplayerState() {
  mpState = {
    active: false,
    isHost: false,
    roomCode: null,
    playerId: generatePlayerId(),
    username: loadUsername(),
    players: {},        // { playerId: { username, shipClass, ready, joinOrder, lastSeen } }
    joinOrder: [],      // ordered player ids by join time
    hostId: null,
    gameStarted: false,
    terrainSeed: 0,
    // callbacks
    onPlayersChanged: null,
    onGameStart: null,
    onBroadcast: null,
    onDisconnect: null,
    onHostMigrated: null,
    // disconnect tracking
    disconnectTimers: {}
  };
  return mpState;
}

// --- initialize Supabase client ---
export function initSupabase(url, key) {
  if (url) SUPABASE_URL = url;
  if (key) SUPABASE_ANON_KEY = key;
  // Dynamic import from CDN — the import map provides @supabase/supabase-js
  // Since we load via import map, try to use it; fall back to mock for dev
  try {
    if (typeof window !== "undefined" && window.__supabaseClient) {
      supabase = window.__supabaseClient;
    }
  } catch (e) {
    console.warn("[MP] Supabase client not available:", e);
  }
}

// --- lazy load supabase ---
async function ensureSupabase() {
  if (supabase) return supabase;
  try {
    var mod = await import("@supabase/supabase-js");
    supabase = mod.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return supabase;
  } catch (e) {
    console.warn("[MP] Could not load Supabase, using mock mode:", e);
    return null;
  }
}

// --- create room (host) ---
export async function createRoom(state, shipClass) {
  var client = await ensureSupabase();
  state.roomCode = generateRoomCode();
  state.isHost = true;
  state.active = true;
  state.hostId = state.playerId;
  state.terrainSeed = Math.floor(Math.random() * 999999);

  if (client) {
    channel = client.channel("game:" + state.roomCode, {
      config: { broadcast: { self: false } }
    });
    setupChannelListeners(state, channel);
    await channel.subscribe(async function (status) {
      if (status === "SUBSCRIBED") {
        await channel.track({
          userId: state.playerId,
          username: state.username,
          shipClass: shipClass || "cruiser",
          ready: false,
          joinOrder: 0,
          isHost: true
        });
      }
    });
  }

  // Add self to players
  state.players[state.playerId] = {
    username: state.username,
    shipClass: shipClass || "cruiser",
    ready: false,
    joinOrder: 0,
    isHost: true,
    lastSeen: Date.now()
  };
  state.joinOrder = [state.playerId];

  return state.roomCode;
}

// --- join room ---
export async function joinRoom(state, roomCode, shipClass) {
  var client = await ensureSupabase();
  state.roomCode = roomCode.toUpperCase();
  state.isHost = false;
  state.active = true;

  if (client) {
    channel = client.channel("game:" + state.roomCode, {
      config: { broadcast: { self: false } }
    });
    setupChannelListeners(state, channel);
    await channel.subscribe(async function (status) {
      if (status === "SUBSCRIBED") {
        await channel.track({
          userId: state.playerId,
          username: state.username,
          shipClass: shipClass || "cruiser",
          ready: false,
          joinOrder: -1,
          isHost: false
        });
      }
    });
  }

  // Add self to players (others will appear via presence)
  state.players[state.playerId] = {
    username: state.username,
    shipClass: shipClass || "cruiser",
    ready: false,
    joinOrder: -1,
    isHost: false,
    lastSeen: Date.now()
  };

  return state.roomCode;
}

// --- setup channel event listeners ---
function setupChannelListeners(state, ch) {
  // Presence sync
  ch.on("presence", { event: "sync" }, function () {
    var presenceState = ch.presenceState();
    syncPresence(state, presenceState);
  });

  ch.on("presence", { event: "join" }, function (payload) {
    var key = payload.key;
    var newPresences = payload.newPresences;
    for (var i = 0; i < newPresences.length; i++) {
      var p = newPresences[i];
      if (p.userId === state.playerId) continue;
      state.players[p.userId] = {
        username: p.username,
        shipClass: p.shipClass,
        ready: p.ready,
        joinOrder: p.joinOrder,
        isHost: p.isHost,
        lastSeen: Date.now()
      };
      if (state.joinOrder.indexOf(p.userId) === -1) {
        state.joinOrder.push(p.userId);
      }
      // Clear disconnect timer if rejoining
      if (state.disconnectTimers[p.userId]) {
        clearTimeout(state.disconnectTimers[p.userId]);
        delete state.disconnectTimers[p.userId];
      }
    }
    if (state.onPlayersChanged) state.onPlayersChanged(state.players);
  });

  ch.on("presence", { event: "leave" }, function (payload) {
    var leftPresences = payload.leftPresences;
    for (var i = 0; i < leftPresences.length; i++) {
      var p = leftPresences[i];
      if (p.userId === state.playerId) continue;
      handlePlayerDisconnect(state, p.userId);
    }
  });

  // Broadcast messages
  ch.on("broadcast", { event: "game_event" }, function (payload) {
    var msg = payload.payload;
    if (msg && msg.senderId === state.playerId) return; // skip own messages
    if (state.onBroadcast) state.onBroadcast(msg);
  });
}

// --- sync presence state ---
function syncPresence(state, presenceState) {
  var keys = Object.keys(presenceState);
  for (var i = 0; i < keys.length; i++) {
    var presences = presenceState[keys[i]];
    for (var j = 0; j < presences.length; j++) {
      var p = presences[j];
      if (p.userId === state.playerId) continue;
      state.players[p.userId] = {
        username: p.username,
        shipClass: p.shipClass,
        ready: p.ready || false,
        joinOrder: p.joinOrder || 0,
        isHost: p.isHost || false,
        lastSeen: Date.now()
      };
      if (state.joinOrder.indexOf(p.userId) === -1) {
        state.joinOrder.push(p.userId);
      }
    }
  }
  // Identify host
  for (var pid in state.players) {
    if (state.players[pid].isHost) {
      state.hostId = pid;
      break;
    }
  }
  if (state.onPlayersChanged) state.onPlayersChanged(state.players);
}

// --- handle player disconnect ---
function handlePlayerDisconnect(state, playerId) {
  // Set a timeout before removing player
  state.disconnectTimers[playerId] = setTimeout(function () {
    delete state.players[playerId];
    var idx = state.joinOrder.indexOf(playerId);
    if (idx !== -1) state.joinOrder.splice(idx, 1);
    delete state.disconnectTimers[playerId];

    // Host migration if the disconnected player was host
    if (playerId === state.hostId) {
      migrateHost(state);
    }
    if (state.onPlayersChanged) state.onPlayersChanged(state.players);
    if (state.onDisconnect) state.onDisconnect(playerId);
  }, DISCONNECT_TIMEOUT);
}

// --- host migration ---
function migrateHost(state) {
  // Pick the next player by join order
  for (var i = 0; i < state.joinOrder.length; i++) {
    var pid = state.joinOrder[i];
    if (state.players[pid]) {
      state.hostId = pid;
      if (pid === state.playerId) {
        state.isHost = true;
        // Update presence to reflect new host status
        if (channel) {
          channel.track({
            userId: state.playerId,
            username: state.username,
            shipClass: state.players[state.playerId].shipClass,
            ready: true,
            joinOrder: state.players[state.playerId].joinOrder,
            isHost: true
          });
        }
        console.log("[MP] Host migrated to this client");
      }
      state.players[pid].isHost = true;
      if (state.onHostMigrated) state.onHostMigrated(pid);
      break;
    }
  }
}

// --- set ready state ---
export async function setReady(state, ready) {
  state.players[state.playerId].ready = ready;
  if (channel) {
    await channel.track({
      userId: state.playerId,
      username: state.username,
      shipClass: state.players[state.playerId].shipClass,
      ready: ready,
      joinOrder: state.players[state.playerId].joinOrder,
      isHost: state.isHost
    });
  }
  if (state.onPlayersChanged) state.onPlayersChanged(state.players);
}

// --- set ship class ---
export async function setShipClass(state, shipClass) {
  state.players[state.playerId].shipClass = shipClass;
  if (channel) {
    await channel.track({
      userId: state.playerId,
      username: state.username,
      shipClass: shipClass,
      ready: state.players[state.playerId].ready,
      joinOrder: state.players[state.playerId].joinOrder,
      isHost: state.isHost
    });
  }
  if (state.onPlayersChanged) state.onPlayersChanged(state.players);
}

// --- check if all players are ready ---
export function allPlayersReady(state) {
  var pids = Object.keys(state.players);
  if (pids.length < 1) return false;
  for (var i = 0; i < pids.length; i++) {
    var p = state.players[pids[i]];
    if (!p.ready && pids[i] !== state.playerId) return false;
  }
  return true;
}

// --- start game (host only) ---
export function startGame(state) {
  if (!state.isHost) return false;
  var pids = Object.keys(state.players);
  // check all non-host players are ready
  for (var i = 0; i < pids.length; i++) {
    if (pids[i] !== state.playerId && !state.players[pids[i]].ready) return false;
  }
  state.gameStarted = true;
  state.terrainSeed = Math.floor(Math.random() * 999999);
  // Broadcast game start
  broadcast(state, {
    type: "game_start",
    terrainSeed: state.terrainSeed,
    hostId: state.playerId,
    players: state.players
  });
  return true;
}

// --- broadcast a message to all players ---
export function broadcast(state, data) {
  if (!state.active) return;
  data.senderId = state.playerId;
  data.timestamp = Date.now();
  if (channel) {
    channel.send({
      type: "broadcast",
      event: "game_event",
      payload: data
    });
  }
}

// --- get player count ---
export function getPlayerCount(state) {
  return Object.keys(state.players).length;
}

// --- get room is full ---
export function isRoomFull(state) {
  return getPlayerCount(state) >= MAX_PLAYERS;
}

// --- get other player ids ---
export function getOtherPlayerIds(state) {
  var ids = [];
  for (var pid in state.players) {
    if (pid !== state.playerId) ids.push(pid);
  }
  return ids;
}

// --- leave room ---
export async function leaveRoom(state) {
  if (channel) {
    await channel.untrack();
    await channel.unsubscribe();
    channel = null;
  }
  state.active = false;
  state.roomCode = null;
  state.players = {};
  state.joinOrder = [];
  state.hostId = null;
  state.gameStarted = false;
  // Clear disconnect timers
  for (var pid in state.disconnectTimers) {
    clearTimeout(state.disconnectTimers[pid]);
  }
  state.disconnectTimers = {};
}

// --- check if multiplayer is active ---
export function isMultiplayerActive(state) {
  return state && state.active;
}

// --- get player color by index (for rendering remote ships) ---
var PLAYER_COLORS = [0x44aaff, 0xff6644, 0x44dd66, 0xffcc44];
export function getPlayerColor(index) {
  return PLAYER_COLORS[index % PLAYER_COLORS.length];
}
