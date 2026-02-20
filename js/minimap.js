// minimap.js — radar-style minimap showing player, enemies, pickups, ports

var minimapCanvas = null;
var minimapCtx = null;
var MINIMAP_SIZE = 140;
var MINIMAP_RANGE = 120;

export function createMinimap(parentEl) {
  minimapCanvas = document.createElement("canvas");
  minimapCanvas.width = MINIMAP_SIZE;
  minimapCanvas.height = MINIMAP_SIZE;
  minimapCanvas.style.cssText = [
    "width:" + MINIMAP_SIZE + "px", "height:" + MINIMAP_SIZE + "px",
    "border-radius:50%", "border:2px solid rgba(80,100,130,0.4)",
    "background:rgba(5,10,20,0.7)"
  ].join(";");
  minimapCtx = minimapCanvas.getContext("2d");
  parentEl.appendChild(minimapCanvas);
}

export function updateMinimap(playerX, playerZ, playerHeading, enemies, pickups, ports) {
  if (!minimapCtx) return;
  var ctx = minimapCtx;
  var cx = MINIMAP_SIZE / 2;
  var cy = MINIMAP_SIZE / 2;
  var radius = MINIMAP_SIZE / 2 - 4;

  ctx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

  // background circle
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(5,10,20,0.8)";
  ctx.fill();
  ctx.strokeStyle = "rgba(80,100,130,0.5)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.clip();

  // range rings
  ctx.strokeStyle = "rgba(80,100,130,0.2)";
  ctx.lineWidth = 0.5;
  for (var r = 1; r <= 3; r++) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius * r / 3, 0, Math.PI * 2);
    ctx.stroke();
  }

  // crosshair
  ctx.beginPath();
  ctx.moveTo(cx - 6, cy);
  ctx.lineTo(cx + 6, cy);
  ctx.moveTo(cx, cy - 6);
  ctx.lineTo(cx, cy + 6);
  ctx.strokeStyle = "rgba(80,100,130,0.4)";
  ctx.lineWidth = 1;
  ctx.stroke();

  var scale = radius / MINIMAP_RANGE;

  // ports — blue squares
  if (ports) {
    ctx.fillStyle = "#4488cc";
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
    ctx.fillStyle = "#44dd66";
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
    ctx.fillStyle = "#ff4444";
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

  // player — white triangle
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-playerHeading);
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(0, -5);
  ctx.lineTo(-3, 4);
  ctx.lineTo(3, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // heading indicator
  ctx.fillStyle = "rgba(136,153,170,0.6)";
  ctx.font = "9px monospace";
  ctx.textAlign = "center";
  ctx.fillText("N", cx, 14);

  ctx.restore();
}
