import * as THREE from 'three/webgpu';
import PhysicalSailboat from '../physics/PhysicalSailboat.js';
import VisualSailboat from './VisualSailboat.js';
import VisualSail from './VisualSail.js';

export class LocalBoat {
  constructor() {
    const exp = globalThis.experience;
    this.physical = new PhysicalSailboat({
      rapier: exp.physics.R,
      world: exp.physics.world,
      quality: exp.quality
    });

    const gltfAsset = {
      scene: this._fallbackBoatMesh()
    };

    this.visual = new VisualSailboat(this.physical, gltfAsset);
    this.sail = new VisualSail(this.physical, this.visual.group);

    exp.ticker.register(8, 'camera.followBoat', () => {
      const p = this.physical.body.translation();
      exp.camera.position.lerp(new THREE.Vector3(p.x, p.y + 10, p.z + 20), 0.1);
      exp.camera.lookAt(p.x, p.y + 1.5, p.z);
    });
  }

  _fallbackBoatMesh() {
    const group = new THREE.Group();

    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(3, 1.2, 9),
      new THREE.MeshStandardNodeMaterial({ color: 0x8a5a35 })
    );
    hull.name = 'Hull';
    group.add(hull);

    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.12, 12),
      new THREE.MeshStandardNodeMaterial({ color: 0xdddddd })
    );
    mast.position.set(0, 6, 0.5);
    mast.name = 'Mast';
    group.add(mast);

    const boom = new THREE.Group();
    boom.name = 'Boom';
    const boomBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.08, 4),
      new THREE.MeshStandardNodeMaterial({ color: 0xcccccc })
    );
    boomBar.position.z = -2;
    boom.add(boomBar);
    boom.position.set(0, 3.2, 0.3);
    group.add(boom);

    const rudder = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.7, 0.8),
      new THREE.MeshStandardNodeMaterial({ color: 0x444444 })
    );
    rudder.position.set(0, -0.2, 4.6);
    rudder.name = 'Rudder';
    group.add(rudder);

    return group;
  }
}
