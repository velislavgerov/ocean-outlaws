// minimap.js — compass-rose style minimap with parchment/nautical aesthetic
import { isMobile } from "./mobile.js";
import { T, FONT } from "./theme.js";

var minimapCanvas = null;
var minimapCtx = null;
var MINIMAP_SIZE = isMobile() ? 100 : 110;
var MINIMAP_RANGE = 120;

export function createMinimap(parentEl) {
  minimapCanvas = document.createElement("canvas");
  minimapCanvas.width = MINIMAP_SIZE;
  minimapCanvas.height = MINIMAP_SIZE;
  minimapCanvas.style.cssText = [
    "width:" + MINIMAP_SIZE + "px", "height:" + MINIMAP_SIZE + "px",
    "border-radius:50%", "border:2px solid " + T.borderGold,
    "background:rgba(30,22,14,0.8)",
    "box-shadow:0 0 12px rgba(0,0,0,0.5),inset 0 0 8px rgba(0,0,0,0.3)"
  ].join(";");
  minimapCtx = minimapCanvas.getContext("2d");
  parentEl.appendChild(minimapCanvas);
}

export function updateMinimap(playerX, playerZ, playerHeading, enemies, pickups, ports, remotePlayers) {
  if (!minimapCtx) return;
  var ctx = minimapCtx;
  var cx = MINIMAP_SIZE / 2;
  var cy = MINIMAP_SIZE / 2;
  var radius = MINIMAP_SIZE / 2 - 4;

  ctx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

  // background circle — aged parchment tint
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  var bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  bgGrad.addColorStop(0, "rgba(50,38,24,0.9)");
  bgGrad.addColorStop(1, "rgba(35,26,16,0.95)");
  ctx.fillStyle = bgGrad;
  ctx.fill();
  ctx.strokeStyle = "rgba(139,109,68,0.5)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.clip();

  // range rings — warm brown
  ctx.strokeStyle = "rgba(139,109,68,0.2)";
  ctx.lineWidth = 0.5;
  for (var r = 1; r <= 3; r++) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius * r / 3, 0, Math.PI * 2);
    ctx.stroke();
  }

  // compass rose lines (N/S/E/W)
  ctx.strokeStyle = "rgba(139,109,68,0.25)";
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy - radius);
  ctx.lineTo(cx, cy + radius);
  ctx.moveTo(cx - radius, cy);
  ctx.lineTo(cx + radius, cy);
  ctx.stroke();

  // diagonal lines for compass rose
  ctx.strokeStyle = "rgba(139,109,68,0.12)";
  ctx.beginPath();
  var d = radius * 0.7;
  ctx.moveTo(cx - d, cy - d);
  ctx.lineTo(cx + d, cy + d);
  ctx.moveTo(cx + d, cy - d);
  ctx.lineTo(cx - d, cy + d);
  ctx.stroke();

  // crosshair (small center marker)
  ctx.beginPath();
  ctx.moveTo(cx - 4, cy);
  ctx.lineTo(cx + 4, cy);
  ctx.moveTo(cx, cy - 4);
  ctx.lineTo(cx, cy + 4);
  ctx.strokeStyle = "rgba(212,164,74,0.4)";
  ctx.lineWidth = 1;
  ctx.stroke();

  var scale = radius / MINIMAP_RANGE;

  // ports — golden squares
  if (ports) {
    ctx.fillStyle = T.gold;
    for (var pi = 0; pi < ports.length; pi++) {
      var p = ports[pi];
      var pdx = (p.x - playerX) * scale;
      var pdz = (p.z - playerZ) * scale;
      if (pdx * pdx + pdz * pdz < radius * radius) {
        ctx.fillRect(cx + pdx - 2, cy + pdz - 2, 4, 4);
      }
    }
  }

  // pickups — green dots
  if (pickups) {
    ctx.fillStyle = T.greenBright;
    for (var ki = 0; ki < pickups.length; ki++) {
      var pk = pickups[ki];
      if (!pk.mesh) continue;
      var kdx = (pk.mesh.position.x - playerX) * scale;
      var kdz = (pk.mesh.position.z - playerZ) * scale;
      if (kdx * kdx + kdz * kdz < radius * radius) {
        ctx.beginPath();
        ctx.arc(cx + kdx, cy + kdz, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // enemies — red dots
  if (enemies) {
    ctx.fillStyle = T.redBright;
    for (var ei = 0; ei < enemies.length; ei++) {
      var e = enemies[ei];
      if (!e.alive) continue;
      var edx = (e.posX - playerX) * scale;
      var edz = (e.posZ - playerZ) * scale;
      if (edx * edx + edz * edz < radius * radius) {
        ctx.beginPath();
        ctx.arc(cx + edx, cy + edz, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // remote players — warm colored triangles
  if (remotePlayers) {
    var mpColors = [T.blueBright, T.greenBright, "#cc8833", T.purple];
    for (var ri = 0; ri < remotePlayers.length; ri++) {
      var rp = remotePlayers[ri];
      var rdx = (rp.posX - playerX) * scale;
      var rdz = (rp.posZ - playerZ) * scale;
      if (rdx * rdx + rdz * rdz < radius * radius) {
        ctx.save();
        ctx.translate(cx + rdx, cy + rdz);
        ctx.rotate(-rp.heading);
        ctx.fillStyle = mpColors[ri % mpColors.length];
        ctx.beginPath();
        ctx.moveTo(0, -4);
        ctx.lineTo(-2.5, 3);
        ctx.lineTo(2.5, 3);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
  }

  // player — cream/gold triangle
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-playerHeading);
  ctx.fillStyle = T.cream;
  ctx.beginPath();
  ctx.moveTo(0, -5);
  ctx.lineTo(-3, 4);
  ctx.lineTo(3, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // compass directions — N/S/E/W labels
  ctx.fillStyle = "rgba(212,164,74,0.6)";
  ctx.font = "bold 9px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("N", cx, 10);
  ctx.fillText("S", cx, MINIMAP_SIZE - 8);
  ctx.fillText("E", MINIMAP_SIZE - 8, cy);
  ctx.fillText("W", 9, cy);

  ctx.restore();
}
