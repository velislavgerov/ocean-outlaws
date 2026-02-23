export function createCombatState() {
  return {
    player: {
      x: 0,
      z: 0,
      rot: 0,
      speed: 0
    },
    input: {
      x: 0,
      y: 0,
      boost: false
    },
    enemies: [],
    projectiles: [],
    nextEnemyId: 1,
    nextProjectileId: 1,
    spawnCooldown: 0,
    pendingPlayerDamage: 0,
    killsThisTick: 0
  };
}

export function setInputVector(sim, x, y) {
  sim.input.x = clamp(x, -1, 1);
  sim.input.y = clamp(y, -1, 1);
}

export function setBoost(sim, boostOn) {
  sim.input.boost = !!boostOn;
}

export function spawnEnemy(sim, hpMult) {
  var angle = Math.random() * Math.PI * 2;
  var distance = 8 + Math.random() * 5;
  var hp = Math.round(30 * (hpMult || 1));

  sim.enemies.push({
    id: sim.nextEnemyId++,
    x: Math.cos(angle) * distance,
    z: Math.sin(angle) * distance,
    hp: hp,
    maxHp: hp,
    fireCooldown: 1.2 + Math.random() * 1.4
  });
}

export function firePlayerProjectile(sim, damage, ammoAvailable) {
  if (!ammoAvailable) {
    return false;
  }

  sim.projectiles.push({
    id: sim.nextProjectileId++,
    owner: 'player',
    x: sim.player.x,
    z: sim.player.z,
    vx: Math.sin(sim.player.rot) * 16,
    vz: Math.cos(sim.player.rot) * 16,
    ttl: 1.4,
    damage: damage || 12
  });

  return true;
}

export function stepCombat(sim, dt) {
  sim.killsThisTick = 0;
  sim.pendingPlayerDamage = 0;

  var turnRate = 2.2;
  var accel = 10;
  var maxSpeed = sim.input.boost ? 9.5 : 6.5;

  sim.player.rot += sim.input.x * turnRate * dt;
  sim.player.speed += (-sim.input.y * accel - sim.player.speed * 1.8) * dt;
  sim.player.speed = clamp(sim.player.speed, -maxSpeed * 0.35, maxSpeed);
  sim.player.x += Math.sin(sim.player.rot) * sim.player.speed * dt;
  sim.player.z += Math.cos(sim.player.rot) * sim.player.speed * dt;

  for (var i = sim.enemies.length - 1; i >= 0; i--) {
    var e = sim.enemies[i];
    var dx = sim.player.x - e.x;
    var dz = sim.player.z - e.z;
    var dist = Math.hypot(dx, dz) || 0.001;

    if (dist > 2.8) {
      var speed = 2.2;
      e.x += (dx / dist) * speed * dt;
      e.z += (dz / dist) * speed * dt;
    }

    e.fireCooldown -= dt;
    if (e.fireCooldown <= 0 && dist < 6.8) {
      sim.pendingPlayerDamage += 4;
      e.fireCooldown = 1.4;
    }
  }

  for (var p = sim.projectiles.length - 1; p >= 0; p--) {
    var shot = sim.projectiles[p];
    shot.x += shot.vx * dt;
    shot.z += shot.vz * dt;
    shot.ttl -= dt;

    var hitEnemyIndex = -1;
    for (var j = 0; j < sim.enemies.length; j++) {
      var target = sim.enemies[j];
      var d = Math.hypot(target.x - shot.x, target.z - shot.z);
      if (d < 0.8) {
        hitEnemyIndex = j;
        break;
      }
    }

    if (hitEnemyIndex >= 0) {
      sim.enemies[hitEnemyIndex].hp -= shot.damage;
      sim.projectiles.splice(p, 1);
      continue;
    }

    if (shot.ttl <= 0) {
      sim.projectiles.splice(p, 1);
    }
  }

  for (var k = sim.enemies.length - 1; k >= 0; k--) {
    if (sim.enemies[k].hp <= 0) {
      sim.enemies.splice(k, 1);
      sim.killsThisTick += 1;
    }
  }

  return {
    enemyCount: sim.enemies.length,
    kills: sim.killsThisTick,
    pendingPlayerDamage: sim.pendingPlayerDamage
  };
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
