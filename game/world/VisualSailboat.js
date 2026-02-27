import * as THREE from 'three/webgpu';

export default class VisualSailboat {
  constructor(physicalBoat, gltfAsset) {
    this.physical = physicalBoat;

    this.group = gltfAsset.scene.clone();
    globalThis.experience.scene.add(this.group);

    this.hullMesh = this.group.getObjectByName('Hull');
    this.mast = this.group.getObjectByName('Mast');
    this.boom = this.group.getObjectByName('Boom');
    this.rudderMesh = this.group.getObjectByName('Rudder');

    const light = new THREE.DirectionalLight(0xffffff, 1.2);
    light.position.set(40, 80, 20);
    globalThis.experience.scene.add(light);
    globalThis.experience.scene.add(new THREE.AmbientLight(0xaabbcc, 0.45));

    globalThis.experience.ticker.register(14, 'visualBoat.sync', () => this._sync());
  }

  _sync() {
    const t = this.physical.body.translation();
    const r = this.physical.body.rotation();

    this.group.position.set(t.x, t.y, t.z);
    this.group.quaternion.set(r.x, r.y, r.z, r.w);

    if (this.boom) {
      const awa = this.physical.apparentWindAngle;
      const trimSign = awa > 0 ? -1 : 1;
      this.boom.rotation.y = trimSign * this.physical.sailTrim * Math.PI / 180;
    }

    if (this.rudderMesh) {
      this.rudderMesh.rotation.y = this.physical.rudderAngle * Math.PI / 180;
    }
  }
}
