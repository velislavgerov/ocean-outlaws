// health.js — HP bars above ships (HTML overlay positioned via 3D→screen projection)
import * as THREE from "three";

var bars = [];
var container = null;
var tempVec = new THREE.Vector3();

export function initHealthBars() {
  container = document.createElement("div");
  container.style.cssText = [
    "position: fixed",
    "top: 0",
    "left: 0",
    "width: 100%",
    "height: 100%",
    "pointer-events: none",
    "z-index: 5"
  ].join(";");
  document.body.appendChild(container);
}

function createBar(color) {
  var wrapper = document.createElement("div");
  wrapper.style.cssText = [
    "position: absolute",
    "width: 40px",
    "height: 5px",
    "background: rgba(0,0,0,0.5)",
    "border-radius: 3px",
    "overflow: hidden",
    "transform: translate(-50%, -100%)"
  ].join(";");

  var fill = document.createElement("div");
  fill.style.cssText = [
    "width: 100%",
    "height: 100%",
    "background: " + color,
    "border-radius: 3px",
    "transition: width 0.15s"
  ].join(";");

  wrapper.appendChild(fill);
  container.appendChild(wrapper);

  return { wrapper: wrapper, fill: fill };
}

export function updateHealthBars(camera, enemies, ship, playerHp, playerMaxHp) {
  if (!container) return;

  // collect all entities that need bars
  var needed = [];

  // player bar (only show when damaged)
  if (playerHp < playerMaxHp) {
    needed.push({
      x: ship.mesh.position.x,
      y: ship.mesh.position.y + 2.5,
      z: ship.mesh.position.z,
      ratio: playerHp / playerMaxHp,
      color: "#44aa66"
    });
  }

  // enemy bars
  for (var i = 0; i < enemies.length; i++) {
    var e = enemies[i];
    if (!e.alive && !e.sinking) continue;
    if (e.sinking) continue;
    needed.push({
      x: e.mesh.position.x,
      y: e.mesh.position.y + 2.0,
      z: e.mesh.position.z,
      ratio: e.hp / e.maxHp,
      color: "#cc4444"
    });
  }

  // ensure we have enough bar DOM elements
  while (bars.length < needed.length) {
    bars.push(createBar("#cc4444"));
  }

  // update visible bars
  var halfW = window.innerWidth / 2;
  var halfH = window.innerHeight / 2;

  for (var i = 0; i < bars.length; i++) {
    if (i >= needed.length) {
      bars[i].wrapper.style.display = "none";
      continue;
    }

    var n = needed[i];
    tempVec.set(n.x, n.y, n.z);
    tempVec.project(camera);

    // behind camera check
    if (tempVec.z > 1) {
      bars[i].wrapper.style.display = "none";
      continue;
    }

    var sx = (tempVec.x * halfW) + halfW;
    var sy = -(tempVec.y * halfH) + halfH;

    // off-screen check
    if (sx < -50 || sx > window.innerWidth + 50 || sy < -50 || sy > window.innerHeight + 50) {
      bars[i].wrapper.style.display = "none";
      continue;
    }

    bars[i].wrapper.style.display = "block";
    bars[i].wrapper.style.left = sx + "px";
    bars[i].wrapper.style.top = sy + "px";
    bars[i].fill.style.width = (n.ratio * 100) + "%";
    bars[i].fill.style.background = n.color;
  }
}
