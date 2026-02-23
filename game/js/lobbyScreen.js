// lobbyScreen.js — multiplayer lobby UI: main menu button, create/join room, player list, ready state
import { getClassOrder, getAllClasses } from "./shipClass.js";
import { isMobile } from "./mobile.js";
import { T, FONT, PARCHMENT_BG } from "./theme.js";

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
    "justify-content:center", "background:" + T.bgOverlay,
    "z-index:250", "font-family:" + FONT, "user-select:none"
  ].join(";");

  // === Initial choice: Create or Join ===
  joinPanel = document.createElement("div");
  joinPanel.style.cssText = [
    "display:flex", "flex-direction:column", "align-items:center",
    "gap:16px"
  ].join(";");

  var title = document.createElement("div");
  title.textContent = "MULTIPLAYER";
  title.style.cssText = "font-family:" + FONT + ";font-size:28px;font-weight:bold;color:" + T.gold + ";margin-bottom:16px;text-shadow:0 0 12px rgba(212,164,74,0.4),0 2px 4px rgba(0,0,0,0.5);";
  joinPanel.appendChild(title);

  // Username input
  var nameLabel = document.createElement("div");
  nameLabel.textContent = "YOUR NAME";
  nameLabel.style.cssText = "font-family:" + FONT + ";font-size:12px;color:" + T.textDim + ";";
  joinPanel.appendChild(nameLabel);

  usernameInput = document.createElement("input");
  usernameInput.type = "text";
  usernameInput.placeholder = "Enter name...";
  usernameInput.maxLength = 20;
  usernameInput.style.cssText = [
    "font-family:" + FONT, "font-size:16px", "padding:8px 12px",
    "background:rgba(35, 26, 16, 0.9)", "color:" + T.goldBright,
    "border:1px solid " + T.border, "border-radius:4px",
    "width:200px", "text-align:center",
    "pointer-events:auto", "outline:none", "margin-bottom:8px"
  ].join(";");
  usernameInput.addEventListener("focus", function () {
    usernameInput.style.borderColor = T.borderGold;
  });
  usernameInput.addEventListener("blur", function () {
    usernameInput.style.borderColor = T.border;
    if (onUsernameChange && usernameInput.value.trim()) {
      onUsernameChange(usernameInput.value.trim());
    }
  });
  joinPanel.appendChild(usernameInput);

  var createBtn = document.createElement("button");
  createBtn.textContent = "CREATE ROOM";
  createBtn.style.cssText = [
    BTN, "background:rgba(35, 50, 30, 0.8)", "color:" + T.greenBright,
    "border:1px solid " + T.greenBright, "min-width:220px"
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
    "font-family:" + FONT, "font-size:16px", "padding:8px 12px",
    "background:rgba(35, 26, 16, 0.9)", "color:" + T.gold,
    "border:1px solid " + T.border, "border-radius:4px",
    "width:160px", "text-align:center", "text-transform:uppercase",
    "pointer-events:auto", "outline:none"
  ].join(";");
  joinInput.addEventListener("focus", function () {
    joinInput.style.borderColor = T.borderGold;
  });
  joinInput.addEventListener("blur", function () {
    joinInput.style.borderColor = T.border;
  });
  joinRow.appendChild(joinInput);

  joinBtn = document.createElement("button");
  joinBtn.textContent = "JOIN";
  joinBtn.style.cssText = [
    BTN, "background:rgba(50, 40, 22, 0.8)", "color:" + T.gold,
    "border:1px solid " + T.gold, "padding:8px 20px"
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
    BTN, "background:rgba(50, 35, 25, 0.7)", "color:" + T.textDim,
    "border:1px solid " + T.border, "margin-top:8px", "font-size:12px",
    "padding:6px 20px"
  ].join(";");
  joinBackBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    if (onBack) onBack();
  });
  joinPanel.appendChild(joinBackBtn);

  overlay.appendChild(joinPanel);

  // === Lobby (shown after creating/joining room) ===
  lobbyPanel = document.createElement("div");
  lobbyPanel.style.cssText = [
    "display:none", "flex-direction:column", "align-items:center",
    "gap:12px", "padding:32px", "background:" + T.bgLight,
    "border:1px solid " + T.border, "border-radius:12px",
    "min-width:280px", "max-width:500px"
  ].join(";");

  var lobbyTitle = document.createElement("div");
  lobbyTitle.textContent = "LOBBY";
  lobbyTitle.style.cssText = "font-family:" + FONT + ";font-size:22px;font-weight:bold;color:" + T.gold + ";text-shadow:0 0 10px rgba(212,164,74,0.3),0 2px 4px rgba(0,0,0,0.5);";
  lobbyPanel.appendChild(lobbyTitle);

  roomCodeDisplay = document.createElement("div");
  roomCodeDisplay.style.cssText = [
    "font-family:" + FONT, "font-size:28px", "font-weight:bold", "color:" + T.goldBright,
    "letter-spacing:4px", "padding:8px 16px",
    "background:rgba(50, 40, 22, 0.6)", "border:1px solid " + T.borderGold,
    "border-radius:6px", "cursor:pointer",
    "text-shadow:0 0 8px rgba(212,164,74,0.3)"
  ].join(";");
  roomCodeDisplay.title = "Click to copy";
  roomCodeDisplay.addEventListener("click", function () {
    if (roomCodeDisplay.textContent && navigator.clipboard) {
      navigator.clipboard.writeText(roomCodeDisplay.textContent);
      roomCodeDisplay.style.color = T.greenBright;
      setTimeout(function () { roomCodeDisplay.style.color = T.goldBright; }, 1000);
    }
  });
  lobbyPanel.appendChild(roomCodeDisplay);

  statusLabel = document.createElement("div");
  statusLabel.style.cssText = "font-family:" + FONT + ";font-size:12px;color:" + T.textDim + ";";
  statusLabel.textContent = "Share this code with friends";
  lobbyPanel.appendChild(statusLabel);

  // Ship class selector
  var classLabel = document.createElement("div");
  classLabel.textContent = "SHIP CLASS";
  classLabel.style.cssText = "font-family:" + FONT + ";font-size:12px;color:" + T.textDim + ";margin-top:8px;";
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
        "font-family:" + FONT, "font-size:12px", "padding:6px 12px",
        "background:rgba(35, 26, 16, 0.8)", "color:" + cls.color,
        "border:1px solid transparent", "border-radius:4px",
        "cursor:pointer", "pointer-events:auto"
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

  // Player list
  var listLabel = document.createElement("div");
  listLabel.textContent = "PLAYERS";
  listLabel.style.cssText = "font-family:" + FONT + ";font-size:12px;color:" + T.textDim + ";margin-top:12px;";
  lobbyPanel.appendChild(listLabel);

  playerListEl = document.createElement("div");
  playerListEl.style.cssText = [
    "width:100%", "min-height:60px", "max-height:200px",
    "overflow-y:auto", "display:flex", "flex-direction:column", "gap:6px"
  ].join(";");
  lobbyPanel.appendChild(playerListEl);

  // Buttons row
  var btnRow = document.createElement("div");
  btnRow.style.cssText = "display:flex;gap:12px;margin-top:12px;";

  readyBtn = document.createElement("button");
  readyBtn.textContent = "READY";
  readyBtn.style.cssText = [
    BTN, "background:rgba(35, 50, 30, 0.8)", "color:" + T.greenBright,
    "border:1px solid " + T.greenBright
  ].join(";");
  readyBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    if (onReady) onReady();
  });
  btnRow.appendChild(readyBtn);

  startBtn = document.createElement("button");
  startBtn.textContent = "START GAME";
  startBtn.style.cssText = [
    BTN, "background:rgba(50, 40, 22, 0.8)", "color:" + T.gold,
    "border:1px solid " + T.gold, "display:none"
  ].join(";");
  startBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    if (onStartGame) onStartGame();
  });
  btnRow.appendChild(startBtn);

  lobbyPanel.appendChild(btnRow);

  backBtn = document.createElement("button");
  backBtn.textContent = "LEAVE ROOM";
  backBtn.style.cssText = [
    BTN, "background:rgba(50, 28, 22, 0.7)", "color:" + T.redBright,
    "border:1px solid " + T.redBright, "font-size:11px", "padding:6px 16px"
  ].join(";");
  backBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    if (onBack) onBack();
  });
  lobbyPanel.appendChild(backBtn);

  overlay.appendChild(lobbyPanel);

  document.body.appendChild(overlay);
}

// --- highlight selected class button ---
function selectClassButton(key) {
  if (!classSelector) return;
  var btns = classSelector.querySelectorAll("button");
  for (var i = 0; i < btns.length; i++) {
    if (btns[i].dataset.classKey === key) {
      btns[i].style.borderColor = btns[i].style.color;
      btns[i].style.background = "rgba(60, 45, 28, 0.9)";
    } else {
      btns[i].style.borderColor = "transparent";
      btns[i].style.background = "rgba(35, 26, 16, 0.8)";
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
      "display:flex", "justify-content:space-between", "align-items:center",
      "padding:6px 10px", "background:rgba(35, 26, 16, 0.6)",
      "border:1px solid " + T.border, "border-radius:4px",
      "font-family:" + FONT
    ].join(";");

    var nameSpan = document.createElement("span");
    nameSpan.textContent = (pid === localPlayerId ? "> " : "") + p.username;
    nameSpan.style.cssText = "font-size:13px;color:" + (pid === localPlayerId ? T.blueBright : T.text) + ";";
    row.appendChild(nameSpan);

    var infoSpan = document.createElement("span");
    var classes = getAllClasses();
    var classCfg = classes[p.shipClass];
    var classColor = classCfg ? classCfg.color : T.text;
    var classLabel = classCfg ? classCfg.name : p.shipClass;
    infoSpan.style.cssText = "font-size:11px;display:flex;gap:8px;align-items:center;";

    var classEl = document.createElement("span");
    classEl.textContent = classLabel;
    classEl.style.color = classColor;
    infoSpan.appendChild(classEl);

    var readyEl = document.createElement("span");
    if (p.isHost) {
      readyEl.textContent = "HOST";
      readyEl.style.color = T.gold;
    } else {
      readyEl.textContent = p.ready ? "READY" : "NOT READY";
      readyEl.style.color = p.ready ? T.greenBright : T.redBright;
    }
    infoSpan.appendChild(readyEl);

    row.appendChild(infoSpan);
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
