import * as THREE from 'three/webgpu';

const MAX_POINTS = 80;
const WAKE_WIDTH = 2.2;

export default class WakeSystem {
  constructor(scene, boat) {
    this.boat = boat;
    this.points = [];

    const maxPoints = globalThis.experience.quality === 'low' ? 0 : globalThis.experience.quality === 'mid' ? 40 : MAX_POINTS;
    this.maxPoints = maxPoints;
    if (!maxPoints) return;

    const vertexCount = maxPoints * 2;
    this.positions = new Float32Array(vertexCount * 3);
    this.alphas = new Float32Array(vertexCount);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('alpha', new THREE.BufferAttribute(this.alphas, 1).setUsage(THREE.DynamicDrawUsage));

    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });

    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.renderOrder = 1;
    scene.add(this.mesh);

    globalThis.experience.ticker.register(9, 'wake.update', (dt) => this._update(dt));
  }

  _update(dt) {
    const stern = this.boat.physical?.getSternPosition?.();
    if (!stern) return;

    this.points.unshift({ x: stern.x, y: stern.y + 0.05, z: stern.z, age: 0 });
    if (this.points.length > this.maxPoints) this.points.pop();

    for (const p of this.points) p.age += dt;

    const lifetime = 6;
    for (let i = 0; i < this.points.length; i += 1) {
      const p = this.points[i];
      const t = p.age / lifetime;
      const width = WAKE_WIDTH * (1 - t * 0.7);
      const alpha = 1 - t;

      const next = this.points[i + 1] || this.points[i];
      const dx = p.x - next.x;
      const dz = p.z - next.z;
      const len = Math.sqrt(dx * dx + dz * dz) || 1;
      const rx = (-dz / len) * width * 0.5;
      const rz = (dx / len) * width * 0.5;

      const base = i * 6;
      this.positions[base] = p.x + rx;
      this.positions[base + 1] = p.y;
      this.positions[base + 2] = p.z + rz;
      this.positions[base + 3] = p.x - rx;
      this.positions[base + 4] = p.y;
      this.positions[base + 5] = p.z - rz;
      this.alphas[i * 2] = alpha;
      this.alphas[i * 2 + 1] = alpha;
    }

    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.alpha.needsUpdate = true;
    this.mesh.geometry.setDrawRange(0, this.points.length * 2);
  }
}
