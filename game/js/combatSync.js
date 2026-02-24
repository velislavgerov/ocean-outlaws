// combatSync.js — multiplayer combat synchronization: hits, boss, waves, weather, pickups, kill feed
import { broadcast, isMultiplayerActive } from "./multiplayer.js";

// --- send hit event (any player → all) ---
export function sendHitEvent(mpState, targetType, targetId, damage) {
  if (!mpState || !mpState.active) return;
  broadcast(mpState, {
    type: "hit",
    targetType: targetType,
    targetId: targetId,
    damage: damage
  });
}

// --- send enemy death event (host → all) ---
export function sendEnemyDeath(mpState, enemyId, faction) {
  if (!mpState || !mpState.active || !mpState.isHost) return;
  broadcast(mpState, {
    type: "enemy_death",
    enemyId: enemyId,
    faction: faction
  });
}

// --- send boss state (host → all, ~5Hz) ---
var lastBossSend = 0;
export function sendBossState(mpState, boss) {
  if (!mpState || !mpState.active || !mpState.isHost) return;
  if (!boss || !boss.alive) return;
  var now = Date.now();
  if (now - lastBossSend < 200) return;
  lastBossSend = now;
  broadcast(mpState, {
    type: "boss_state",
    bossType: boss.type,
    x: Math.round(boss.posX * 100) / 100,
    z: Math.round(boss.posZ * 100) / 100,
    h: Math.round(boss.heading * 1000) / 1000,
    hp: boss.hp,
    maxHp: boss.maxHp,
    phase: boss.phase,
    alive: boss.alive,
    sinking: boss.sinking
  });
}

// --- send boss spawn (host → all) ---
export function sendBossSpawn(mpState, bossType, posX, posZ) {
  if (!mpState || !mpState.active || !mpState.isHost) return;
  broadcast(mpState, {
    type: "boss_spawn",
    bossType: bossType,
    x: Math.round(posX * 100) / 100,
    z: Math.round(posZ * 100) / 100
  });
}

// --- send boss defeated (host → all) ---
export function sendBossDefeated(mpState, bossType) {
  if (!mpState || !mpState.active || !mpState.isHost) return;
  broadcast(mpState, {
    type: "boss_defeated",
    bossType: bossType
  });
}

// --- send boss attack telegraph (host → all) ---
export function sendBossAttack(mpState, attackType, phase) {
  if (!mpState || !mpState.active || !mpState.isHost) return;
  broadcast(mpState, {
    type: "boss_attack",
    attack: attackType,
    phase: phase
  });
}

// --- send wave event (host → all) ---
export function sendWaveEvent(mpState, eventType, data) {
  if (!mpState || !mpState.active || !mpState.isHost) return;
  var msg = { type: "wave_event", event: eventType };
  if (data) {
    for (var k in data) msg[k] = data[k];
  }
  broadcast(mpState, msg);
}

// --- send weather change (host → all) ---
export function sendWeatherChange(mpState, weatherKey) {
  if (!mpState || !mpState.active || !mpState.isHost) return;
  broadcast(mpState, {
    type: "weather_change",
    weather: weatherKey
  });
}

// --- send pickup claim (any player → host) ---
export function sendPickupClaim(mpState, pickupIndex, pickupType) {
  if (!mpState || !mpState.active) return;
  broadcast(mpState, {
    type: "pickup_claim",
    index: pickupIndex,
    pickupType: pickupType
  });
}

// --- send pickup confirmed (host → all) ---
export function sendPickupConfirmed(mpState, pickupIndex, playerId) {
  if (!mpState || !mpState.active || !mpState.isHost) return;
  broadcast(mpState, {
    type: "pickup_confirmed",
    index: pickupIndex,
    playerId: playerId
  });
}

// --- send kill feed entry (any player → all) ---
export function sendKillFeedEntry(mpState, text, color) {
  if (!mpState || !mpState.active) return;
  broadcast(mpState, {
    type: "kill_feed",
    text: text,
    color: color
  });
}

// --- send game over / victory (host → all) ---
export function sendGameOverEvent(mpState, eventType, wave) {
  if (!mpState || !mpState.active || !mpState.isHost) return;
  broadcast(mpState, {
    type: eventType,
    wave: wave
  });
}

// --- handle incoming combat broadcast messages ---
// Returns an action object describing what to do, or null
export function handleCombatMessage(msg, context) {
  if (!msg || !msg.type) return null;

  if (msg.type === "hit") {
    return {
      action: "apply_hit",
      targetType: msg.targetType,
      targetId: msg.targetId,
      damage: msg.damage,
      senderId: msg.senderId
    };
  }

  if (msg.type === "enemy_death") {
    return {
      action: "enemy_death",
      enemyId: msg.enemyId,
      faction: msg.faction,
      senderId: msg.senderId
    };
  }

  if (msg.type === "boss_state") {
    return {
      action: "update_boss",
      bossType: msg.bossType,
      x: msg.x,
      z: msg.z,
      h: msg.h,
      hp: msg.hp,
      maxHp: msg.maxHp,
      phase: msg.phase,
      alive: msg.alive,
      sinking: msg.sinking
    };
  }

  if (msg.type === "boss_spawn") {
    return {
      action: "spawn_boss",
      bossType: msg.bossType,
      x: msg.x,
      z: msg.z
    };
  }

  if (msg.type === "boss_defeated") {
    return {
      action: "boss_defeated",
      bossType: msg.bossType
    };
  }

  if (msg.type === "boss_attack") {
    return {
      action: "boss_attack",
      attack: msg.attack,
      phase: msg.phase
    };
  }

  if (msg.type === "wave_event") {
    return {
      action: "wave_event",
      event: msg.event,
      wave: msg.wave,
      enemies: msg.enemies,
      faction: msg.faction,
      boss: msg.boss
    };
  }

  if (msg.type === "weather_change") {
    return {
      action: "weather_change",
      weather: msg.weather
    };
  }

  if (msg.type === "pickup_claim") {
    return {
      action: "pickup_claim",
      index: msg.index,
      pickupType: msg.pickupType,
      senderId: msg.senderId
    };
  }

  if (msg.type === "pickup_confirmed") {
    return {
      action: "pickup_confirmed",
      index: msg.index,
      playerId: msg.playerId
    };
  }

  if (msg.type === "kill_feed") {
    return {
      action: "kill_feed",
      text: msg.text,
      color: msg.color,
      senderId: msg.senderId
    };
  }

  if (msg.type === "game_over" || msg.type === "victory") {
    return {
      action: msg.type,
      wave: msg.wave
    };
  }

  return null;
}

// --- apply enemy state from host on non-host clients ---
export function applyEnemyStateFromHost(msg, enemyMgr) {
  if (!msg || !msg.enemies) return;
  var hostEnemies = msg.enemies;
  var locals = enemyMgr.enemies;

  for (var i = 0; i < hostEnemies.length; i++) {
    var he = hostEnemies[i];
    var local = null;
    for (var j = 0; j < locals.length; j++) {
      if (locals[j]._netId === he.id) { local = locals[j]; break; }
    }
    if (!local) {
      if (he.id < locals.length && locals[he.id] && locals[he.id]._netId === undefined) {
        locals[he.id]._netId = he.id;
        local = locals[he.id];
      }
    }
    if (local) {
      local._targetX = he.x;
      local._targetZ = he.z;
      local._targetH = he.h;
      local._netSpeed = he.s || 0;
      local.hp = he.hp;
      local.maxHp = he.maxHp;
      if (!he.alive && local.alive) {
        local.alive = false;
        local.sinking = true;
        local.sinkTimer = 0;
      }
      local._lastNetUpdate = Date.now();
    }
  }
}

// --- dead-reckon non-host enemies between host updates ---
export function deadReckonEnemies(enemyMgr, dt) {
  var enemies = enemyMgr.enemies;
  var lerpSpeed = 6;
  var lerpFactor = 1 - Math.exp(-lerpSpeed * dt);
  for (var i = 0; i < enemies.length; i++) {
    var e = enemies[i];
    if (e._targetX === undefined) continue;
    if (!e.alive) continue;
    e.posX += (e._targetX - e.posX) * lerpFactor;
    e.posZ += (e._targetZ - e.posZ) * lerpFactor;
    var hDiff = e._targetH - e.heading;
    while (hDiff > Math.PI) hDiff -= 2 * Math.PI;
    while (hDiff < -Math.PI) hDiff += 2 * Math.PI;
    e.heading += hDiff * lerpFactor;
    var age = (Date.now() - (e._lastNetUpdate || 0)) / 1000;
    if (age < 0.5 && e._netSpeed > 0) {
      e.posX += Math.sin(e.heading) * e._netSpeed * dt * 0.3;
      e.posZ += Math.cos(e.heading) * e._netSpeed * dt * 0.3;
    }
    e.mesh.position.x = e.posX;
    e.mesh.position.z = e.posZ;
    e.mesh.rotation.y = e.heading;
  }
}

// --- reset combat sync state ---
export function resetCombatSync() {
  lastBossSend = 0;
}
