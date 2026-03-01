// lobbyScreen.js — multiplayer lobby UI: main menu button, create/join room, player list, ready state
import { getClassOrder, getAllClasses } from "./shipClass.js";
import { isMobile } from "./mobile.js";
import { T, FONT, FONT_UI, FONT_MONO, PARCHMENT_BG } from "./theme.js";

var overlay = null;
var mainMenuBtn = null;
var lobbyPanel = null;
var joinPanel = null;
var playerListEl = null;
var roomCodeDisplay = null;
var startBtn = null;
var readyBtn = null;
var backBtn = null;
var joinInput = null;
var joinBtn = null;
var joinBackBtn = null;
var statusLabel = null;
var classSelector = null;

var usernameInput = null;

var onCreateRoom = null;
var onJoinRoom = null;
var onReady = null;
var onStartGame = null;
var onClassChange = null;
var onUsernameChange = null;
var onBack = null;

var BTN = [
  "font-family:" + FONT, "font-size:14px", "padding:10px 24px",
  "border-radius:6px", "cursor:pointer", "pointer-events:auto",
  "user-select:none", "text-align:center", "min-height:44px",
  "text-shadow:0 1px 2px rgba(0,0,0,0.4)"
].join(";");

// Ghost button base — transparent bg, gold-dim border
var GHOST_BTN = [
  "font-family:" + FONT, "font-size:14px", "padding:10px 24px",
  "border-radius:4px", "cursor:pointer", "pointer-events:auto",
  "user-select:none", "text-align:center", "min-height:44px",
  "background:none", "border:1px solid var(--oo-gold-dim)",
  "text-shadow:0 1px 2px rgba(0,0,0,0.4)",
  "transition:border-color 0.15s,color 0.15s"
].join(";");

// --- create the main menu multiplayer button (injected into ship select screen) ---
export function createMultiplayerButton(parentEl, callback) {
  mainMenuBtn = document.createElement("button");
  mainMenuBtn.textContent = "MULTIPLAYER";
  mainMenuBtn.style.cssText = [
    BTN, "margin-top:16px",
    "background:rgba(45, 34, 20, 0.8)",
    "color:" + T.blueBright,
    "border:1px solid " + T.blueBright,
    "min-width:200px",
    "min-height:44px"
  ].join(";");
  // touch-friendly highlight
  mainMenuBtn.addEventListener("touchstart", function () {
    mainMenuBtn.style.background = "rgba(60, 45, 28, 0.9)";
  });
  mainMenuBtn.addEventListener("touchend", function () {
    mainMenuBtn.style.background = "rgba(45, 34, 20, 0.8)";
  });
  mainMenuBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    if (callback) callback();
  });
  parentEl.appendChild(mainMenuBtn);
}

// --- create lobby overlay ---
export function createLobbyScreen() {
  overlay = document.createElement("div");
  overlay.style.cssText = [
    "position:fixed", "top:0", "left:0", "width:100%", "height:100%",
    "display:none", "flex-direction:column", "align-items:center",
    "justify-content:center", "background:var(--oo-bg-scrim)",
    "z-index:250", "font-family:" + FONT, "user-select:none"
  ].join(";");

  // === Initial choice: Create or Join ===
  joinPanel = document.createElement("div");
  joinPanel.style.cssText = [
    "display:flex", "flex-direction:column", "align-items:center",
    "gap:16px",
    "padding:32px",
    "background:" + T.bg,
    "border:1px solid var(--oo-gold-dim)",
    "border-radius:8px",
    "box-shadow:0 0 40px rgba(8,12,18,0.8),inset 0 1px 0 rgba(200,152,42,0.15)",
    "width:90%", "max-width:480px",
    "animation:oo-rise 0.5s var(--oo-ease-spring) both"
  ].join(";");

  var title = document.createElement("div");
  title.textContent = "MULTIPLAYER";
  title.style.cssText = [
    "font-family:" + FONT, "font-size:28px", "font-weight:bold",
    "color:" + T.gold, "margin-bottom:8px",
    "letter-spacing:0.15em",
    "text-shadow:0 0 12px rgba(212,164,74,0.4),0 2px 4px rgba(0,0,0,0.5)"
  ].join(";");
  joinPanel.appendChild(title);

  // Username input
  var nameLabel = document.createElement("div");
  nameLabel.textContent = "YOUR NAME";
  nameLabel.style.cssText = [
    "font-family:" + FONT_UI, "font-size:12px", "color:" + T.textDim,
    "letter-spacing:0.08em"
  ].join(";");
  joinPanel.appendChild(nameLabel);

  usernameInput = document.createElement("input");
  usernameInput.type = "text";
  usernameInput.placeholder = "Enter name...";
  usernameInput.maxLength = 20;
  usernameInput.style.cssText = [
    "font-family:" + FONT_UI, "font-size:14px", "padding:8px 12px",
    "background:rgba(15, 21, 32, 0.9)", "color:" + T.goldBright,
    "border:1px solid var(--oo-gold-dim)", "border-radius:4px",
    "width:200px", "text-align:center",
    "pointer-events:auto", "outline:none", "margin-bottom:8px",
    "transition:border-color 0.15s"
  ].join(";");
  usernameInput.addEventListener("focus", function () {
    usernameInput.style.borderColor = T.borderGold;
  });
  usernameInput.addEventListener("blur", function () {
    usernameInput.style.borderColor = "var(--oo-gold-dim)";
    if (onUsernameChange && usernameInput.value.trim()) {
      onUsernameChange(usernameInput.value.trim());
    }
  });
  joinPanel.appendChild(usernameInput);

  var createBtn = document.createElement("button");
  createBtn.textContent = "CREATE ROOM";
  createBtn.style.cssText = [
    GHOST_BTN, "color:" + T.greenBright,
    "border-color:" + T.greenBright,
    "min-width:220px"
  ].join(";");
  createBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    commitUsername();
    if (onCreateRoom) onCreateRoom();
  });
  joinPanel.appendChild(createBtn);

  // Join row
  var joinRow = document.createElement("div");
  joinRow.style.cssText = "display:flex;gap:8px;align-items:center;";
  joinInput = document.createElement("input");
  joinInput.type = "text";
  joinInput.placeholder = "OCEAN-XXXX";
  joinInput.maxLength = 10;
  joinInput.style.cssText = [
    "font-family:" + FONT_MONO, "font-size:14px", "padding:8px 12px",
    "background:rgba(15, 21, 32, 0.9)", "color:" + T.gold,
    "border:1px solid var(--oo-gold-dim)", "border-radius:4px",
    "width:160px", "text-align:center", "text-transform:uppercase",
    "pointer-events:auto", "outline:none",
    "letter-spacing:0.08em",
    "transition:border-color 0.15s"
  ].join(";");
  joinInput.addEventListener("focus", function () {
    joinInput.style.borderColor = T.borderGold;
  });
  joinInput.addEventListener("blur", function () {
    joinInput.style.borderColor = "var(--oo-gold-dim)";
  });
  joinRow.appendChild(joinInput);

  joinBtn = document.createElement("button");
  joinBtn.textContent = "JOIN";
  joinBtn.style.cssText = [
    GHOST_BTN, "color:" + T.gold,
    "padding:8px 20px"
  ].join(";");
  joinBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    commitUsername();
    var code = joinInput.value.trim();
    if (code && onJoinRoom) onJoinRoom(code);
  });
  joinRow.appendChild(joinBtn);
  joinPanel.appendChild(joinRow);

  joinBackBtn = document.createElement("button");
  joinBackBtn.textContent = "BACK";
  joinBackBtn.style.cssText = [
    GHOST_BTN, "color:" + T.textDim,
    "margin-top:8px", "font-size:12px",
    "padding:6px 20px", "min-height:36px"
  ].join(";");
  joinBackBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    if (onBack) onBack();
  });
  joinPanel.appendChild(joinBackBtn);

  overlay.appendChild(joinPanel);

  // === Lobby (shown after creating/joining room) — "The Crew Manifest" ===
  lobbyPanel = document.createElement("div");
  lobbyPanel.style.cssText = [
    "display:none", "flex-direction:column", "align-items:center",
    "gap:12px", "padding:28px 24px",
    "background:" + T.bg,
    "border:1px solid var(--oo-gold-dim)",
    "border-radius:8px",
    "box-shadow:0 0 40px rgba(8,12,18,0.8),inset 0 1px 0 rgba(200,152,42,0.15)",
    "width:90%", "max-width:480px",
    "animation:oo-rise 0.5s var(--oo-ease-spring) both"
  ].join(";");

  // "THE CREW MANIFEST" heading
  var lobbyTitle = document.createElement("div");
  lobbyTitle.textContent = "THE CREW MANIFEST";
  lobbyTitle.style.cssText = [
    "font-family:" + FONT, "font-size:18px", "font-weight:bold",
    "color:" + T.textDim, "letter-spacing:0.2em",
    "text-transform:uppercase"
  ].join(";");
  lobbyPanel.appendChild(lobbyTitle);

  // Room code — prominent, Cinzel, gold
  roomCodeDisplay = document.createElement("div");
  roomCodeDisplay.style.cssText = [
    "font-family:" + FONT, "font-size:28px", "font-weight:bold",
    "color:" + T.gold,
    "letter-spacing:0.15em",
    "padding:8px 20px",
    "background:rgba(15, 21, 32, 0.8)",
    "border:1px solid var(--oo-gold-dim)",
    "border-radius:6px", "cursor:pointer",
    "text-shadow:0 0 8px rgba(200,152,42,0.25)",
    "transition:color 0.2s"
  ].join(";");
  roomCodeDisplay.title = "Click to copy";
  roomCodeDisplay.addEventListener("click", function () {
    if (roomCodeDisplay.textContent && navigator.clipboard) {
      navigator.clipboard.writeText(roomCodeDisplay.textContent);
      roomCodeDisplay.style.color = T.greenBright;
      setTimeout(function () { roomCodeDisplay.style.color = T.gold; }, 1000);
    }
  });
  lobbyPanel.appendChild(roomCodeDisplay);

  statusLabel = document.createElement("div");
  statusLabel.style.cssText = [
    "font-family:" + FONT_UI, "font-size:12px", "color:" + T.textDim,
    "letter-spacing:0.04em"
  ].join(";");
  statusLabel.textContent = "Share this code with friends";
  lobbyPanel.appendChild(statusLabel);

  // Ship class selector — compact ghost strip
  var classLabel = document.createElement("div");
  classLabel.textContent = "SHIP CLASS";
  classLabel.style.cssText = [
    "font-family:" + FONT_UI, "font-size:11px", "color:" + T.textDim,
    "letter-spacing:0.1em", "margin-top:8px"
  ].join(";");
  lobbyPanel.appendChild(classLabel);

  classSelector = document.createElement("div");
  classSelector.style.cssText = "display:flex;gap:6px;flex-wrap:wrap;justify-content:center;";
  var order = getClassOrder();
  var classes = getAllClasses();
  for (var i = 0; i < order.length; i++) {
    (function (key) {
      var cls = classes[key];
      var btn = document.createElement("button");
      btn.textContent = cls.name;
      btn.dataset.classKey = key;
      btn.style.cssText = [
        "font-family:" + FONT_UI, "font-size:12px", "padding:5px 10px",
        "background:none", "color:" + T.textDim,
        "border:1px solid var(--oo-gold-dim)", "border-radius:4px",
        "cursor:pointer", "pointer-events:auto",
        "transition:border-color 0.15s,color 0.15s"
      ].join(";");
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        selectClassButton(key);
        if (onClassChange) onClassChange(key);
      });
      classSelector.appendChild(btn);
    })(order[i]);
  }
  lobbyPanel.appendChild(classSelector);

  // Section divider
  var divider = document.createElement("div");
  divider.style.cssText = [
    "width:100%", "height:1px",
    "background:var(--oo-gold-dim)",
    "opacity:0.4", "margin:8px 0 4px"
  ].join(";");
  lobbyPanel.appendChild(divider);

  // Player list label
  var listLabel = document.createElement("div");
  listLabel.textContent = "CREW";
  listLabel.style.cssText = [
    "font-family:" + FONT_UI, "font-size:11px", "color:" + T.textDim,
    "letter-spacing:0.1em", "align-self:flex-start"
  ].join(";");
  lobbyPanel.appendChild(listLabel);

  playerListEl = document.createElement("div");
  playerListEl.style.cssText = [
    "width:100%", "min-height:60px", "max-height:200px",
    "overflow-y:auto", "display:flex", "flex-direction:column", "gap:4px"
  ].join(";");
  lobbyPanel.appendChild(playerListEl);

  // Action buttons row
  var btnRow = document.createElement("div");
  btnRow.style.cssText = "display:flex;gap:12px;margin-top:8px;width:100%;justify-content:center;";

  readyBtn = document.createElement("button");
  readyBtn.textContent = "READY";
  readyBtn.style.cssText = [
    GHOST_BTN, "color:" + T.greenBright,
    "border-color:" + T.greenBright,
    "flex:1"
  ].join(";");
  readyBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    if (onReady) onReady();
  });
  btnRow.appendChild(readyBtn);

  startBtn = document.createElement("button");
  startBtn.textContent = "START GAME";
  startBtn.style.cssText = [
    GHOST_BTN, "color:" + T.gold,
    "display:none", "flex:1"
  ].join(";");
  startBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    if (onStartGame) onStartGame();
  });
  btnRow.appendChild(startBtn);

  lobbyPanel.appendChild(btnRow);

  // Leave room button — below, smaller
  backBtn = document.createElement("button");
  backBtn.textContent = "LEAVE ROOM";
  backBtn.style.cssText = [
    GHOST_BTN, "color:" + T.redBright,
    "border-color:" + T.redBright,
    "font-size:11px", "padding:6px 16px", "min-height:36px",
    "margin-top:4px"
  ].join(";");
  backBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    if (onBack) onBack();
  });
  lobbyPanel.appendChild(backBtn);

  overlay.appendChild(lobbyPanel);

  document.body.appendChild(overlay);
}

// --- highlight selected class button (active = gold border + gold text) ---
function selectClassButton(key) {
  if (!classSelector) return;
  var btns = classSelector.querySelectorAll("button");
  for (var i = 0; i < btns.length; i++) {
    if (btns[i].dataset.classKey === key) {
      btns[i].style.borderColor = T.gold;
      btns[i].style.color = T.gold;
    } else {
      btns[i].style.borderColor = "var(--oo-gold-dim)";
      btns[i].style.color = T.textDim;
    }
  }
}

// --- commit username from input ---
function commitUsername() {
  if (usernameInput && usernameInput.value.trim() && onUsernameChange) {
    onUsernameChange(usernameInput.value.trim());
  }
}

// --- show initial create/join choice ---
export function showLobbyChoice(currentUsername) {
  if (!overlay) return;
  overlay.style.display = "flex";
  joinPanel.style.display = "flex";
  lobbyPanel.style.display = "none";
  if (joinInput) joinInput.value = "";
  if (usernameInput && currentUsername) usernameInput.value = currentUsername;
}

// --- show lobby with room code ---
export function showLobby(roomCode, isHost) {
  if (!overlay) return;
  overlay.style.display = "flex";
  joinPanel.style.display = "none";
  lobbyPanel.style.display = "flex";
  if (roomCodeDisplay) roomCodeDisplay.textContent = roomCode;
  if (startBtn) startBtn.style.display = isHost ? "inline-block" : "none";
  if (statusLabel) {
    statusLabel.textContent = isHost ? "Share this code with friends" : "Waiting for host to start...";
  }
}

// --- hide lobby ---
export function hideLobbyScreen() {
  if (overlay) overlay.style.display = "none";
}

// --- update player list ---
export function updatePlayerList(players, localPlayerId) {
  if (!playerListEl) return;
  playerListEl.innerHTML = "";

  var pids = Object.keys(players);
  for (var i = 0; i < pids.length; i++) {
    var pid = pids[i];
    var p = players[pid];

    var row = document.createElement("div");
    row.style.cssText = [
      "display:flex", "align-items:center", "gap:10px",
      "min-height:40px", "padding:4px 8px",
      "background:rgba(15, 21, 32, 0.6)",
      "border:1px solid var(--oo-gold-dim)",
      "border-radius:4px"
    ].join(";");

    // Avatar circle
    var avatar = document.createElement("div");
    avatar.style.cssText = [
      "width:36px", "height:36px", "border-radius:50%",
      "background:" + T.bgLight,
      "border:1px solid var(--oo-gold-dim)",
      "flex-shrink:0", "display:flex",
      "align-items:center", "justify-content:center",
      "font-family:" + FONT_UI, "font-size:14px",
      "color:" + T.textDim, "text-transform:uppercase"
    ].join(";");
    avatar.textContent = (p.username || "?").charAt(0);
    row.appendChild(avatar);

    // Name + class column
    var infoCol = document.createElement("div");
    infoCol.style.cssText = "display:flex;flex-direction:column;gap:2px;flex:1;min-width:0;";

    var nameSpan = document.createElement("div");
    nameSpan.textContent = p.username + (pid === localPlayerId ? " (you)" : "");
    nameSpan.style.cssText = [
      "font-family:" + FONT_UI, "font-size:14px",
      "color:" + (pid === localPlayerId ? T.blueBright : T.text),
      "white-space:nowrap", "overflow:hidden", "text-overflow:ellipsis"
    ].join(";");
    infoCol.appendChild(nameSpan);

    var allClasses = getAllClasses();
    var classCfg = allClasses[p.shipClass];
    var classNameText = classCfg ? classCfg.name : p.shipClass;

    var classSpan = document.createElement("div");
    classSpan.textContent = classNameText;
    classSpan.style.cssText = [
      "font-family:" + FONT_UI, "font-size:12px",
      "color:" + T.textDim
    ].join(";");
    infoCol.appendChild(classSpan);

    row.appendChild(infoCol);

    // Ready / Host badge — small pill
    var badgeEl = document.createElement("div");
    if (p.isHost) {
      badgeEl.textContent = "HOST";
      badgeEl.style.cssText = [
        "font-family:" + FONT_UI, "font-size:11px",
        "padding:2px 8px", "border-radius:20px",
        "background:rgba(200,152,42,0.15)",
        "border:1px solid " + T.gold,
        "color:" + T.gold,
        "white-space:nowrap"
      ].join(";");
    } else {
      var isReady = p.ready;
      badgeEl.textContent = isReady ? "READY" : "NOT READY";
      badgeEl.style.cssText = [
        "font-family:" + FONT_UI, "font-size:11px",
        "padding:2px 8px", "border-radius:20px",
        "background:" + (isReady ? "rgba(77,175,122,0.15)" : "rgba(60,40,40,0.3)"),
        "border:1px solid " + (isReady ? T.greenBright : T.border),
        "color:" + (isReady ? T.greenBright : T.textDim),
        "white-space:nowrap"
      ].join(";");
    }
    row.appendChild(badgeEl);

    playerListEl.appendChild(row);
  }
}

// --- update ready button text ---
export function updateReadyButton(isReady) {
  if (!readyBtn) return;
  readyBtn.textContent = isReady ? "NOT READY" : "READY";
  readyBtn.style.color = isReady ? T.redBright : T.greenBright;
  readyBtn.style.borderColor = isReady ? T.redBright : T.greenBright;
}

// --- update start button state ---
export function updateStartButton(canStart) {
  if (!startBtn) return;
  startBtn.style.opacity = canStart ? "1" : "0.4";
  startBtn.style.pointerEvents = canStart ? "auto" : "none";
}

// --- set callbacks ---
export function setLobbyCallbacks(callbacks) {
  if (callbacks.onCreate) onCreateRoom = callbacks.onCreate;
  if (callbacks.onJoin) onJoinRoom = callbacks.onJoin;
  if (callbacks.onReady) onReady = callbacks.onReady;
  if (callbacks.onStart) onStartGame = callbacks.onStart;
  if (callbacks.onClassChange) onClassChange = callbacks.onClassChange;
  if (callbacks.onUsernameChange) onUsernameChange = callbacks.onUsernameChange;
  if (callbacks.onBack) onBack = callbacks.onBack;
}
