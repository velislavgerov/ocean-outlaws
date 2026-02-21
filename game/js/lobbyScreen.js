// lobbyScreen.js — multiplayer lobby UI: main menu button, create/join room, player list, ready state
import { getClassOrder, getAllClasses } from "./shipClass.js";
import { isMobile } from "./mobile.js";

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

var onCreateRoom = null;
var onJoinRoom = null;
var onReady = null;
var onStartGame = null;
var onClassChange = null;
var onBack = null;

var C = {
  bg: "rgba(5,10,20,0.92)",
  panel: "rgba(15,25,45,0.9)",
  border: "rgba(80,100,130,0.4)",
  borderActive: "rgba(80,100,130,0.6)",
  text: "#8899aa",
  textDim: "#556677",
  green: "#44dd66",
  yellow: "#ffcc44",
  red: "#cc4444",
  blue: "#44aaff",
  cyan: "#2288cc"
};

var BTN = [
  "font-family:monospace", "font-size:14px", "padding:10px 24px",
  "border-radius:6px", "cursor:pointer", "pointer-events:auto",
  "user-select:none", "text-align:center", "min-height:44px"
].join(";");

// --- create the main menu multiplayer button (injected into ship select screen) ---
export function createMultiplayerButton(parentEl, callback) {
  mainMenuBtn = document.createElement("button");
  mainMenuBtn.textContent = "MULTIPLAYER";
  mainMenuBtn.style.cssText = [
    BTN, "margin-top:16px",
    "background:rgba(20,40,80,0.8)",
    "color:" + C.blue,
    "border:1px solid " + C.blue,
    "min-width:200px",
    "min-height:44px"
  ].join(";");
  // touch-friendly highlight
  mainMenuBtn.addEventListener("touchstart", function () {
    mainMenuBtn.style.background = "rgba(30,60,120,0.9)";
  });
  mainMenuBtn.addEventListener("touchend", function () {
    mainMenuBtn.style.background = "rgba(20,40,80,0.8)";
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
    "justify-content:center", "background:" + C.bg,
    "z-index:250", "font-family:monospace", "user-select:none"
  ].join(";");

  // === Initial choice: Create or Join ===
  joinPanel = document.createElement("div");
  joinPanel.style.cssText = [
    "display:flex", "flex-direction:column", "align-items:center",
    "gap:16px"
  ].join(";");

  var title = document.createElement("div");
  title.textContent = "MULTIPLAYER";
  title.style.cssText = "font-size:28px;font-weight:bold;color:" + C.text + ";margin-bottom:16px;";
  joinPanel.appendChild(title);

  var createBtn = document.createElement("button");
  createBtn.textContent = "CREATE ROOM";
  createBtn.style.cssText = [
    BTN, "background:rgba(20,50,40,0.8)", "color:" + C.green,
    "border:1px solid " + C.green, "min-width:220px"
  ].join(";");
  createBtn.addEventListener("click", function (e) {
    e.stopPropagation();
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
    "font-family:monospace", "font-size:16px", "padding:8px 12px",
    "background:rgba(20,30,50,0.9)", "color:" + C.yellow,
    "border:1px solid " + C.border, "border-radius:4px",
    "width:160px", "text-align:center", "text-transform:uppercase",
    "pointer-events:auto", "outline:none"
  ].join(";");
  joinInput.addEventListener("focus", function () {
    joinInput.style.borderColor = C.yellow;
  });
  joinInput.addEventListener("blur", function () {
    joinInput.style.borderColor = C.border;
  });
  joinRow.appendChild(joinInput);

  joinBtn = document.createElement("button");
  joinBtn.textContent = "JOIN";
  joinBtn.style.cssText = [
    BTN, "background:rgba(40,40,20,0.8)", "color:" + C.yellow,
    "border:1px solid " + C.yellow, "padding:8px 20px"
  ].join(";");
  joinBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    var code = joinInput.value.trim();
    if (code && onJoinRoom) onJoinRoom(code);
  });
  joinRow.appendChild(joinBtn);
  joinPanel.appendChild(joinRow);

  joinBackBtn = document.createElement("button");
  joinBackBtn.textContent = "BACK";
  joinBackBtn.style.cssText = [
    BTN, "background:rgba(40,30,30,0.7)", "color:" + C.textDim,
    "border:1px solid " + C.border, "margin-top:8px", "font-size:12px",
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
    "gap:12px", "padding:32px", "background:" + C.panel,
    "border:1px solid " + C.border, "border-radius:12px",
    "min-width:280px", "max-width:500px"
  ].join(";");

  var lobbyTitle = document.createElement("div");
  lobbyTitle.textContent = "LOBBY";
  lobbyTitle.style.cssText = "font-size:22px;font-weight:bold;color:" + C.text + ";";
  lobbyPanel.appendChild(lobbyTitle);

  roomCodeDisplay = document.createElement("div");
  roomCodeDisplay.style.cssText = [
    "font-size:28px", "font-weight:bold", "color:" + C.yellow,
    "letter-spacing:4px", "padding:8px 16px",
    "background:rgba(30,30,15,0.6)", "border:1px solid " + C.yellow,
    "border-radius:6px", "cursor:pointer"
  ].join(";");
  roomCodeDisplay.title = "Click to copy";
  roomCodeDisplay.addEventListener("click", function () {
    if (roomCodeDisplay.textContent && navigator.clipboard) {
      navigator.clipboard.writeText(roomCodeDisplay.textContent);
      roomCodeDisplay.style.color = C.green;
      setTimeout(function () { roomCodeDisplay.style.color = C.yellow; }, 1000);
    }
  });
  lobbyPanel.appendChild(roomCodeDisplay);

  statusLabel = document.createElement("div");
  statusLabel.style.cssText = "font-size:12px;color:" + C.textDim + ";";
  statusLabel.textContent = "Share this code with friends";
  lobbyPanel.appendChild(statusLabel);

  // Ship class selector
  var classLabel = document.createElement("div");
  classLabel.textContent = "SHIP CLASS";
  classLabel.style.cssText = "font-size:12px;color:" + C.textDim + ";margin-top:8px;";
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
        "font-family:monospace", "font-size:12px", "padding:6px 12px",
        "background:rgba(20,30,50,0.8)", "color:" + cls.color,
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
  listLabel.style.cssText = "font-size:12px;color:" + C.textDim + ";margin-top:12px;";
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
    BTN, "background:rgba(20,50,30,0.8)", "color:" + C.green,
    "border:1px solid " + C.green
  ].join(";");
  readyBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    if (onReady) onReady();
  });
  btnRow.appendChild(readyBtn);

  startBtn = document.createElement("button");
  startBtn.textContent = "START GAME";
  startBtn.style.cssText = [
    BTN, "background:rgba(40,40,20,0.8)", "color:" + C.yellow,
    "border:1px solid " + C.yellow, "display:none"
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
    BTN, "background:rgba(40,20,20,0.7)", "color:" + C.red,
    "border:1px solid " + C.red, "font-size:11px", "padding:6px 16px"
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
      btns[i].style.background = "rgba(30,50,80,0.9)";
    } else {
      btns[i].style.borderColor = "transparent";
      btns[i].style.background = "rgba(20,30,50,0.8)";
    }
  }
}

// --- show initial create/join choice ---
export function showLobbyChoice() {
  if (!overlay) return;
  overlay.style.display = "flex";
  joinPanel.style.display = "flex";
  lobbyPanel.style.display = "none";
  if (joinInput) joinInput.value = "";
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
      "padding:6px 10px", "background:rgba(20,30,50,0.6)",
      "border:1px solid " + C.border, "border-radius:4px"
    ].join(";");

    var nameSpan = document.createElement("span");
    nameSpan.textContent = (pid === localPlayerId ? "> " : "") + p.username;
    nameSpan.style.cssText = "font-size:13px;color:" + (pid === localPlayerId ? C.blue : C.text) + ";";
    row.appendChild(nameSpan);

    var infoSpan = document.createElement("span");
    var classes = getAllClasses();
    var classCfg = classes[p.shipClass];
    var classColor = classCfg ? classCfg.color : C.text;
    var classLabel = classCfg ? classCfg.name : p.shipClass;
    infoSpan.style.cssText = "font-size:11px;display:flex;gap:8px;align-items:center;";

    var classEl = document.createElement("span");
    classEl.textContent = classLabel;
    classEl.style.color = classColor;
    infoSpan.appendChild(classEl);

    var readyEl = document.createElement("span");
    if (p.isHost) {
      readyEl.textContent = "HOST";
      readyEl.style.color = C.yellow;
    } else {
      readyEl.textContent = p.ready ? "READY" : "NOT READY";
      readyEl.style.color = p.ready ? C.green : C.red;
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
  readyBtn.style.color = isReady ? C.red : C.green;
  readyBtn.style.borderColor = isReady ? C.red : C.green;
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
  if (callbacks.onBack) onBack = callbacks.onBack;
}
