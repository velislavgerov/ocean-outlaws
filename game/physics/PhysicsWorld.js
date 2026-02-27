import RAPIER from '@dimforge/rapier3d-simd-compat';

export default class PhysicsWorld {
  constructor(quality = 'mid') {
    this.quality = quality;
    this._skip = false;
  }

  async init() {
    await RAPIER.init();
    this.R = RAPIER;
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = 1 / 60;
    this._eventQueue = new RAPIER.EventQueue(true);

    globalThis.experience.ticker.register(4, 'physics.step', () => this.step());
  }

  step() {
    if (this.quality === 'low') {
      this._skip = !this._skip;
      if (this._skip) return;
    }

    this.world.step(this._eventQueue);
    this._eventQueue.drainCollisionEvents((h1, h2, started) => {
      globalThis.experience.effects?.trigger('collision', [{ h1, h2, started }]);
    });
  }

  getDebugBuffers() {
    return this.world.debugRender();
  }
}
