import EventEmitter from '../core/EventEmitter.js';
import * as THREE from 'three/webgpu';

const POOL_SIZES = {
  low: { splash: 0, foam: 0, explosion: 0 },
  mid: { splash: 15, foam: 100, explosion: 20 },
  high: { splash: 30, foam: 300, explosion: 50 }
};

export default class EffectManager extends EventEmitter {
  constructor(scene, quality) {
    super();
    const sizes = POOL_SIZES[quality] || POOL_SIZES.mid;
    this._pools = {};

    if (sizes.splash > 0) this._pools.splash = this._makePool(scene, 'splash', sizes.splash);
    if (sizes.foam > 0) this._pools.foam = this._makePool(scene, 'foam', sizes.foam);
    if (sizes.explosion > 0) this._pools.explosion = this._makePool(scene, 'explosion', sizes.explosion);

    this.on('splash', ([{ pos, vel }]) => this._emit('splash', pos, vel));
    this.on('explosion', ([{ pos }]) => this._emit('explosion', pos, { x: 0, y: 5, z: 0 }));
    this.on('luffing', () => {});

    globalThis.experience.ticker.register(11, 'effects.update', (dt) => this._updatePools(dt));
  }

  _makePool(scene, type, count) {
    const configs = {
      splash: { geo: new THREE.SphereGeometry(0.08, 4, 4), color: 0xaaddff },
      foam: { geo: new THREE.SphereGeometry(0.15, 4, 4), color: 0xeef8ff },
      explosion: { geo: new THREE.SphereGeometry(0.4, 5, 5), color: 0xff6600 }
    };
    const cfg = configs[type];
    const mat = new THREE.MeshStandardNodeMaterial({ color: cfg.color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const mesh = new THREE.InstancedMesh(cfg.geo, mat, count);
    mesh.count = 0;
    mesh.renderOrder = 2;
    scene.add(mesh);

    return {
      mesh,
      particles: Array.from({ length: count }, () => ({ active: false, pos: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 }, life: 0, maxLife: 0 })),
      dummy: new THREE.Object3D()
    };
  }

  _emit(type, pos, vel) {
    const pool = this._pools[type];
    if (!pool) return;
    const p = pool.particles.find((particle) => !particle.active);
    if (!p) return;

    const scatter = type === 'explosion' ? 3 : 0.5;
    p.active = true;
    p.pos = { ...pos };
    p.vel = { x: vel.x + (Math.random() - 0.5) * scatter, y: vel.y + Math.random() * (type === 'explosion' ? 4 : 1.5), z: vel.z + (Math.random() - 0.5) * scatter };
    p.maxLife = type === 'explosion' ? 1.5 : 0.8;
    p.life = p.maxLife;
  }

  _updatePools(dt) {
    const g = 9.81;
    for (const pool of Object.values(this._pools)) {
      let active = 0;
      for (const p of pool.particles) {
        if (!p.active) continue;
        p.life -= dt;
        if (p.life <= 0) { p.active = false; continue; }

        p.vel.y -= g * dt * 0.8;
        p.pos.x += p.vel.x * dt;
        p.pos.y += p.vel.y * dt;
        p.pos.z += p.vel.z * dt;

        pool.dummy.position.set(p.pos.x, p.pos.y, p.pos.z);
        const s = p.life / p.maxLife;
        pool.dummy.scale.setScalar(s);
        pool.dummy.updateMatrix();
        pool.mesh.setMatrixAt(active, pool.dummy.matrix);
        active += 1;
      }
      pool.mesh.count = active;
      pool.mesh.instanceMatrix.needsUpdate = true;
    }
  }
}
