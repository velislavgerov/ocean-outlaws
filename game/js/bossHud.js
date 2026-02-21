// bossHud.js — boss HP bar at top of screen, segmented by phases
var container = null;
var nameLabel = null;
var barBg = null;
var barFill = null;
var phaseMarkers = [];
var phaseLabel = null;
var lootBanner = null;
var lootTimer = 0;

export function createBossHud() {
  container = document.createElement("div");
  container.style.cssText = [
    "position: fixed",
    "top: 20px",
    "left: 50%",
    "transform: translateX(-50%)",
    "display: none",
    "flex-direction: column",
    "align-items: center",
    "pointer-events: none",
    "font-family: monospace",
    "z-index: 15",
    "user-select: none"
  ].join(";");

  // boss name
  nameLabel = document.createElement("div");
  nameLabel.style.cssText = [
    "font-size: 18px",
    "font-weight: bold",
    "color: #cc4444",
    "text-shadow: 0 0 10px rgba(200,60,60,0.5)",
    "margin-bottom: 6px"
  ].join(";");
  nameLabel.textContent = "BOSS";
  container.appendChild(nameLabel);

  // bar background
  barBg = document.createElement("div");
  barBg.style.cssText = [
    "width: 400px",
    "max-width: 80vw",
    "height: 16px",
    "background: rgba(20, 10, 10, 0.8)",
    "border: 1px solid rgba(200, 60, 60, 0.5)",
    "border-radius: 4px",
    "overflow: hidden",
    "position: relative"
  ].join(";");

  // bar fill
  barFill = document.createElement("div");
  barFill.style.cssText = [
    "width: 100%",
    "height: 100%",
    "background: linear-gradient(90deg, #cc2222, #cc4444)",
    "border-radius: 3px",
    "transition: width 0.15s"
  ].join(";");
  barBg.appendChild(barFill);
  container.appendChild(barBg);

  // phase label
  phaseLabel = document.createElement("div");
  phaseLabel.style.cssText = [
    "font-size: 12px",
    "color: #aa6666",
    "margin-top: 4px"
  ].join(";");
  phaseLabel.textContent = "";
  container.appendChild(phaseLabel);

  document.body.appendChild(container);

  // loot banner (reuse for boss loot)
  lootBanner = document.createElement("div");
  lootBanner.style.cssText = [
    "position: fixed",
    "top: 15%",
    "left: 50%",
    "transform: translateX(-50%)",
    "font-family: monospace",
    "font-size: 24px",
    "font-weight: bold",
    "color: #ffcc44",
    "text-shadow: 0 0 15px rgba(255,200,60,0.5)",
    "pointer-events: none",
    "user-select: none",
    "z-index: 20",
    "opacity: 0",
    "transition: opacity 0.3s"
  ].join(";");
  document.body.appendChild(lootBanner);
}

export function showBossHud(bossName) {
  if (!container) return;
  nameLabel.textContent = bossName;
  container.style.display = "flex";
  // clear old phase markers
  for (var i = 0; i < phaseMarkers.length; i++) {
    barBg.removeChild(phaseMarkers[i]);
  }
  phaseMarkers = [];
}

export function hideBossHud() {
  if (!container) return;
  container.style.display = "none";
}

export function updateBossHud(boss, dt) {
  if (!container || !boss) return;

  var hpPct = Math.max(0, boss.hp / boss.maxHp) * 100;
  barFill.style.width = hpPct + "%";

  // color based on HP
  if (hpPct > 50) {
    barFill.style.background = "linear-gradient(90deg, #cc2222, #cc4444)";
  } else if (hpPct > 25) {
    barFill.style.background = "linear-gradient(90deg, #cc6622, #ccaa22)";
  } else {
    barFill.style.background = "linear-gradient(90deg, #cc2266, #ff4488)";
  }

  // phase markers (add once)
  if (phaseMarkers.length === 0 && boss.def && boss.def.phases) {
    for (var i = 1; i < boss.def.phases.length; i++) {
      var threshold = boss.def.phases[i].threshold;
      var marker = document.createElement("div");
      marker.style.cssText = [
        "position: absolute",
        "top: 0",
        "width: 2px",
        "height: 100%",
        "background: rgba(255,255,255,0.4)",
        "left: " + (threshold * 100) + "%"
      ].join(";");
      barBg.appendChild(marker);
      phaseMarkers.push(marker);
    }
  }

  // phase text
  var phaseNames = ["Phase 1", "Phase 2", "Phase 3"];
  var phaseIdx = boss.phase || 0;
  phaseLabel.textContent = phaseNames[phaseIdx] || ("Phase " + (phaseIdx + 1));

  // HP numbers
  nameLabel.textContent = boss.def.name + "  " + boss.hp + " / " + boss.maxHp;

  // update loot banner
  if (lootTimer > 0) {
    lootTimer -= dt;
    if (lootTimer <= 0.5) {
      lootBanner.style.opacity = String(Math.max(0, lootTimer / 0.5));
    }
    if (lootTimer <= 0) {
      lootBanner.style.opacity = "0";
    }
  }
}

export function showLootBanner(text) {
  if (!lootBanner) return;
  lootBanner.textContent = "BOSS LOOT: " + text;
  lootBanner.style.opacity = "1";
  lootTimer = 4;
}
