// mobile.js — mobile detection, quality settings, orientation prompt

var _isMobile = false;
var _quality = "high"; // "low", "medium", "high"
var _qualityChangeCallbacks = [];
var _orientationOverlay = null;

// --- detect mobile: small screen + touch capability ---
function detectMobile() {
  var hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  var smallScreen = window.innerWidth <= 1024 || window.innerHeight <= 600;
  return hasTouch && smallScreen;
}

_isMobile = detectMobile();

// auto-set quality on first load
if (_isMobile) {
  _quality = "medium";
}

// re-detect on resize (e.g. desktop user resizes small)
window.addEventListener("resize", function () {
  _isMobile = detectMobile();
});

// --- public API ---
export function isMobile() {
  return _isMobile;
}

export function getQuality() {
  return _quality;
}

export function setQuality(q) {
  if (q !== "low" && q !== "medium" && q !== "high") return;
  _quality = q;
  try { localStorage.setItem("oo_quality", q); } catch (e) { /* ignore */ }
  for (var i = 0; i < _qualityChangeCallbacks.length; i++) {
    _qualityChangeCallbacks[i](q);
  }
}

export function onQualityChange(cb) {
  _qualityChangeCallbacks.push(cb);
}

// load saved quality preference
(function () {
  try {
    var saved = localStorage.getItem("oo_quality");
    if (saved === "low" || saved === "medium" || saved === "high") {
      _quality = saved;
    }
  } catch (e) { /* ignore */ }
})();

// --- quality multipliers for systems ---
export function getQualityConfig() {
  if (_quality === "low") {
    return {
      oceanSegments: 64,
      rainCount: 1000,
      splashCount: 50,
      terrainOctaves: 2,
      pixelRatioCap: 1,
      antialias: false,
      shaderDetail: 0 // 0 = minimal
    };
  }
  if (_quality === "medium") {
    return {
      oceanSegments: 96,
      rainCount: 2000,
      splashCount: 100,
      terrainOctaves: 3,
      pixelRatioCap: 1.5,
      antialias: false,
      shaderDetail: 1 // 1 = reduced
    };
  }
  // high
  return {
    oceanSegments: 128,
    rainCount: 4000,
    splashCount: 200,
    terrainOctaves: 4,
    pixelRatioCap: 2,
    antialias: true,
    shaderDetail: 2 // 2 = full
  };
}

// --- orientation prompt ---
export function createOrientationPrompt() {
  _orientationOverlay = document.createElement("div");
  _orientationOverlay.style.cssText = [
    "position:fixed", "top:0", "left:0", "width:100%", "height:100%",
    "background:rgba(5,5,15,0.95)", "z-index:9999",
    "display:none", "flex-direction:column",
    "align-items:center", "justify-content:center",
    "font-family:monospace", "color:#8899aa", "text-align:center",
    "user-select:none", "pointer-events:auto"
  ].join(";");

  var icon = document.createElement("div");
  icon.textContent = "\u{1F4F1}";
  icon.style.cssText = "font-size:64px;margin-bottom:16px;animation:oo-rotate 2s ease-in-out infinite";
  _orientationOverlay.appendChild(icon);

  var msg = document.createElement("div");
  msg.textContent = "Rotate your device to landscape";
  msg.style.cssText = "font-size:20px;color:#ffcc44;margin-bottom:8px";
  _orientationOverlay.appendChild(msg);

  var hint = document.createElement("div");
  hint.textContent = "This game is best played in landscape orientation";
  hint.style.cssText = "font-size:13px;color:#667788";
  _orientationOverlay.appendChild(hint);

  // add rotate animation via a style element
  var style = document.createElement("style");
  style.textContent = "@keyframes oo-rotate{0%,100%{transform:rotate(0deg)}50%{transform:rotate(90deg)}}";
  document.head.appendChild(style);

  document.body.appendChild(_orientationOverlay);

  // check orientation
  function checkOrientation() {
    if (!_isMobile) {
      _orientationOverlay.style.display = "none";
      return;
    }
    var isPortrait = window.innerHeight > window.innerWidth;
    _orientationOverlay.style.display = isPortrait ? "flex" : "none";
  }

  window.addEventListener("resize", checkOrientation);
  window.addEventListener("orientationchange", checkOrientation);
  checkOrientation();
}
