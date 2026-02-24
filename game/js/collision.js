// collision.js — shared slide-along collision, stuck detection, and nudge-to-water utilities
import { collideWithTerrain, findWaterPosition } from "./terrain.js";

// --- slide a moving entity along terrain surfaces ---
// Returns { collided, newX, newZ, slideHeading, slideSpeed }
export function slideCollision(terrain, posX, posZ, prevX, prevZ, heading, speed, dt) {
  if (!terrain) return { collided: false, newX: posX, newZ: posZ, slideHeading: heading, slideSpeed: speed };

  var col = collideWithTerrain(terrain, posX, posZ, prevX, prevZ);
  if (!col.collided) return { collided: false, newX: posX, newZ: posZ, slideHeading: heading, slideSpeed: speed };

  var nx = col.newX;
  var nz = col.newZ;
  var normalX = col.normalX || 0;
  var normalZ = col.normalZ || 0;

  var slideHeading = heading;
  var slideSpeed = speed * 0.7; // 30% speed reduction on collision

  if (normalX !== 0 || normalZ !== 0) {
    // project velocity onto surface tangent (perpendicular to collision normal)
    var velX = Math.sin(heading) * speed;
    var velZ = Math.cos(heading) * speed;
    var dot = velX * normalX + velZ * normalZ;
    var tangX = velX - dot * normalX;
    var tangZ = velZ - dot * normalZ;
    var tangLen = Math.sqrt(tangX * tangX + tangZ * tangZ);

    if (tangLen > 0.01) {
      slideHeading = Math.atan2(tangX, tangZ);
      slideSpeed = tangLen * 0.7; // retain slide speed minus 30%
    }

    // push outward from collision normal by a small margin to prevent re-penetration
    nx += normalX * 0.1;
    nz += normalZ * 0.1;
  } else {
    // no normal available — fall back to displacement-based slide
    var dispX = nx - prevX;
    var dispZ = nz - prevZ;
    var dispLen = Math.sqrt(dispX * dispX + dispZ * dispZ);
    if (dispLen > 0.001) {
      slideHeading = Math.atan2(dispX, dispZ);
    }
  }

  return { collided: true, newX: nx, newZ: nz, slideHeading: slideHeading, slideSpeed: slideSpeed };
}

// --- stuck state tracker ---
export function createStuckDetector() {
  return {
    accum: 0,        // accumulated distance traveled in window
    window: 3.0,     // rolling window in seconds
    elapsed: 0,      // time accumulated
    lastX: null,
    lastZ: null
  };
}

// Update stuck tracker each frame. Call before checking isStuck.
export function updateStuck(detector, posX, posZ, dt) {
  if (detector.lastX !== null) {
    var dx = posX - detector.lastX;
    var dz = posZ - detector.lastZ;
    detector.accum += Math.sqrt(dx * dx + dz * dz);
  }
  detector.lastX = posX;
  detector.lastZ = posZ;
  detector.elapsed += dt;

  if (detector.elapsed >= detector.window) {
    // slide window: keep only the most recent half window worth
    detector.accum *= 0.5;
    detector.elapsed = detector.window * 0.5;
  }
}

// Returns true if the entity has barely moved in the stuck window.
// Only meaningful when entity has non-zero speed or nav target.
export function isStuck(detector) {
  if (detector.elapsed < detector.window) return false;
  return detector.accum < 2.0;
}

// --- nudge entity to nearest open water when stuck ---
// Returns { x, z } of safe position
export function nudgeToOpenWater(terrain, posX, posZ) {
  return findWaterPosition(terrain, posX, posZ, 5, 25);
}
