// hud.js — speed indicator, compass, ammo counter, fuel gauge, parts count, wave info, overlays

var container = null;
var speedBar = null;
var speedLabel = null;
var compassLabel = null;
var ammoLabel = null;
var fuelBarBg = null;
var fuelBar = null;
var fuelLabel = null;
var partsLabel = null;
var hpBarBg = null;
var hpBar = null;
var hpLabel = null;
var waveLabel = null;

// overlay elements
var banner = null;
var bannerTimer = 0;
var overlay = null;
var overlayTitle = null;
var overlaySubtext = null;
var overlayBtn = null;
var onRestartCallback = null;

export function createHUD() {
  container = document.createElement("div");
  container.style.cssText = [
    "position: fixed",
    "bottom: 20px",
    "left: 20px",
    "pointer-events: none",
    "font-family: monospace",
    "color: #8899aa",
    "font-size: 13px",
    "user-select: none",
    "z-index: 10"
  ].join(";");

  // speed bar background
  var barBg = document.createElement("div");
  barBg.style.cssText = [
    "width: 120px",
    "height: 8px",
    "background: rgba(20, 30, 50, 0.7)",
    "border: 1px solid rgba(80, 100, 130, 0.4)",
    "border-radius: 4px",
    "overflow: hidden",
    "margin-bottom: 6px"
  ].join(";");

  speedBar = document.createElement("div");
  speedBar.style.cssText = [
    "width: 0%",
    "height: 100%",
    "background: #4477aa",
    "border-radius: 3px",
    "transition: width 0.1s"
  ].join(";");
  barBg.appendChild(speedBar);
  container.appendChild(barBg);

  // speed text
  speedLabel = document.createElement("div");
  speedLabel.textContent = "0 kn";
  speedLabel.style.marginBottom = "4px";
  container.appendChild(speedLabel);

  // compass heading
  compassLabel = document.createElement("div");
  compassLabel.textContent = "N";
  compassLabel.style.fontSize = "12px";
  compassLabel.style.color = "#667788";
  container.appendChild(compassLabel);

  // ammo counter
  ammoLabel = document.createElement("div");
  ammoLabel.textContent = "AMMO: --";
  ammoLabel.style.marginTop = "8px";
  ammoLabel.style.fontSize = "13px";
  ammoLabel.style.color = "#8899aa";
  container.appendChild(ammoLabel);

  // fuel gauge
  fuelLabel = document.createElement("div");
  fuelLabel.textContent = "FUEL";
  fuelLabel.style.marginTop = "8px";
  fuelLabel.style.fontSize = "12px";
  fuelLabel.style.color = "#667788";
  container.appendChild(fuelLabel);

  fuelBarBg = document.createElement("div");
  fuelBarBg.style.cssText = [
    "width: 120px",
    "height: 8px",
    "background: rgba(20, 30, 50, 0.7)",
    "border: 1px solid rgba(80, 100, 130, 0.4)",
    "border-radius: 4px",
    "overflow: hidden",
    "margin-top: 3px"
  ].join(";");

  fuelBar = document.createElement("div");
  fuelBar.style.cssText = [
    "width: 100%",
    "height: 100%",
    "background: #2288cc",
    "border-radius: 3px",
    "transition: width 0.2s"
  ].join(";");
  fuelBarBg.appendChild(fuelBar);
  container.appendChild(fuelBarBg);

  // parts count
  partsLabel = document.createElement("div");
  partsLabel.textContent = "PARTS: 0";
  partsLabel.style.marginTop = "6px";
  partsLabel.style.fontSize = "13px";
  partsLabel.style.color = "#8899aa";
  container.appendChild(partsLabel);

  // player HP bar
  hpLabel = document.createElement("div");
  hpLabel.textContent = "HP";
  hpLabel.style.marginTop = "8px";
  hpLabel.style.fontSize = "12px";
  hpLabel.style.color = "#667788";
  container.appendChild(hpLabel);

  hpBarBg = document.createElement("div");
  hpBarBg.style.cssText = [
    "width: 120px",
    "height: 8px",
    "background: rgba(20, 30, 50, 0.7)",
    "border: 1px solid rgba(80, 100, 130, 0.4)",
    "border-radius: 4px",
    "overflow: hidden",
    "margin-top: 3px"
  ].join(";");

  hpBar = document.createElement("div");
  hpBar.style.cssText = [
    "width: 100%",
    "height: 100%",
    "background: #44aa66",
    "border-radius: 3px",
    "transition: width 0.2s"
  ].join(";");
  hpBarBg.appendChild(hpBar);
  container.appendChild(hpBarBg);

  // wave indicator
  waveLabel = document.createElement("div");
  waveLabel.textContent = "WAVE 1";
  waveLabel.style.marginTop = "10px";
  waveLabel.style.fontSize = "14px";
  waveLabel.style.color = "#8899aa";
  waveLabel.style.fontWeight = "bold";
  container.appendChild(waveLabel);

  document.body.appendChild(container);

  // --- wave announcement banner (centered, fades out) ---
  banner = document.createElement("div");
  banner.style.cssText = [
    "position: fixed",
    "top: 25%",
    "left: 50%",
    "transform: translate(-50%, -50%)",
    "font-family: monospace",
    "font-size: 32px",
    "font-weight: bold",
    "color: #ffcc44",
    "text-shadow: 0 0 20px rgba(255,200,60,0.6)",
    "pointer-events: none",
    "user-select: none",
    "z-index: 20",
    "opacity: 0",
    "transition: opacity 0.3s"
  ].join(";");
  banner.textContent = "";
  document.body.appendChild(banner);

  // --- game over / victory overlay ---
  overlay = document.createElement("div");
  overlay.style.cssText = [
    "position: fixed",
    "top: 0",
    "left: 0",
    "width: 100%",
    "height: 100%",
    "display: none",
    "flex-direction: column",
    "align-items: center",
    "justify-content: center",
    "background: rgba(5, 5, 15, 0.85)",
    "z-index: 100",
    "font-family: monospace",
    "user-select: none"
  ].join(";");

  overlayTitle = document.createElement("div");
  overlayTitle.style.cssText = [
    "font-size: 48px",
    "font-weight: bold",
    "color: #cc4444",
    "margin-bottom: 16px"
  ].join(";");
  overlay.appendChild(overlayTitle);

  overlaySubtext = document.createElement("div");
  overlaySubtext.style.cssText = [
    "font-size: 20px",
    "color: #8899aa",
    "margin-bottom: 32px"
  ].join(";");
  overlay.appendChild(overlaySubtext);

  overlayBtn = document.createElement("button");
  overlayBtn.textContent = "RESTART";
  overlayBtn.style.cssText = [
    "font-family: monospace",
    "font-size: 18px",
    "padding: 12px 36px",
    "background: rgba(40, 60, 90, 0.8)",
    "color: #8899aa",
    "border: 1px solid rgba(80, 100, 130, 0.5)",
    "border-radius: 6px",
    "cursor: pointer",
    "pointer-events: auto"
  ].join(";");
  overlayBtn.addEventListener("click", function () {
    hideOverlay();
    if (onRestartCallback) onRestartCallback();
  });
  overlay.appendChild(overlayBtn);

  document.body.appendChild(overlay);
}

// --- set restart callback ---
export function setRestartCallback(cb) {
  onRestartCallback = cb;
}

// --- show wave announcement banner ---
export function showBanner(text, duration) {
  if (!banner) return;
  banner.textContent = text;
  banner.style.opacity = "1";
  bannerTimer = duration || 3;
}

// --- update banner fade ---
function updateBanner(dt) {
  if (bannerTimer <= 0) return;
  bannerTimer -= dt;
  if (bannerTimer <= 0.5) {
    banner.style.opacity = String(Math.max(0, bannerTimer / 0.5));
  }
  if (bannerTimer <= 0) {
    banner.style.opacity = "0";
  }
}

// --- show game over overlay ---
export function showGameOver(waveReached) {
  if (!overlay) return;
  overlayTitle.textContent = "GAME OVER";
  overlayTitle.style.color = "#cc4444";
  overlaySubtext.textContent = "You reached Wave " + waveReached;
  overlay.style.display = "flex";
}

// --- show victory overlay ---
export function showVictory(waveReached) {
  if (!overlay) return;
  overlayTitle.textContent = "VICTORY";
  overlayTitle.style.color = "#44dd66";
  overlaySubtext.textContent = "All " + waveReached + " waves survived!";
  overlay.style.display = "flex";
}

// --- hide overlay ---
export function hideOverlay() {
  if (!overlay) return;
  overlay.style.display = "none";
}

export function updateHUD(speedRatio, displaySpeed, heading, ammo, maxAmmo, hp, maxHp, fuel, maxFuel, parts, wave, waveState, dt) {
  if (!container) return;

  var pct = Math.min(1, speedRatio) * 100;
  speedBar.style.width = pct + "%";
  speedLabel.textContent = displaySpeed.toFixed(1) + " kn";

  // heading to compass direction
  var deg = ((heading * 180 / Math.PI) % 360 + 360) % 360;
  var dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  var idx = Math.round(deg / 45) % 8;
  compassLabel.textContent = dirs[idx] + " " + Math.round(deg) + "\u00B0";

  // ammo counter
  if (ammo !== undefined) {
    ammoLabel.textContent = "AMMO: " + ammo + " / " + maxAmmo;
    ammoLabel.style.color = ammo <= 5 ? "#cc6644" : ammo === 0 ? "#cc2222" : "#8899aa";
  }

  // fuel gauge
  if (fuel !== undefined && fuelBar) {
    var fuelPct = Math.max(0, fuel / maxFuel) * 100;
    fuelBar.style.width = fuelPct + "%";
    fuelBar.style.background = fuelPct > 30 ? "#2288cc" : fuelPct > 15 ? "#cc8822" : "#cc4444";
    fuelLabel.textContent = "FUEL: " + Math.round(fuel) + "%";
    fuelLabel.style.color = fuelPct > 15 ? "#667788" : "#cc4444";
  }

  // parts count
  if (parts !== undefined && partsLabel) {
    partsLabel.textContent = "PARTS: " + parts;
    partsLabel.style.color = parts > 0 ? "#44dd66" : "#8899aa";
  }

  // player HP
  if (hp !== undefined && hpBar) {
    var hpPct = Math.max(0, hp / maxHp) * 100;
    hpBar.style.width = hpPct + "%";
    hpBar.style.background = hpPct > 50 ? "#44aa66" : hpPct > 25 ? "#aaaa44" : "#cc4444";
    hpLabel.textContent = "HP: " + hp + " / " + maxHp;
    hpLabel.style.color = hpPct > 25 ? "#667788" : "#cc4444";
  }

  // wave indicator
  if (wave !== undefined && waveLabel) {
    if (waveState === "SPAWNING" || waveState === "ACTIVE") {
      waveLabel.textContent = "WAVE " + wave;
      waveLabel.style.color = "#8899aa";
    } else if (waveState === "WAITING") {
      waveLabel.textContent = "REPAIRING...";
      waveLabel.style.color = "#44dd66";
    } else if (waveState === "WAVE_COMPLETE") {
      waveLabel.textContent = "WAVE " + wave + " CLEAR";
      waveLabel.style.color = "#44dd66";
    } else {
      waveLabel.textContent = "WAVE " + wave;
      waveLabel.style.color = "#8899aa";
    }
  }

  // update banner
  updateBanner(dt || 0.016);
}
