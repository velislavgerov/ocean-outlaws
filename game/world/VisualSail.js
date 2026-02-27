import * as THREE from 'three/webgpu';
import { Fn, uniform, float, vec3, sin, smoothstep, mix, uv, time } from 'three/tsl';

export default class VisualSail {
  constructor(physicalBoat, parentGroup) {
    this.physical = physicalBoat;
    this.uEfficiency = uniform(1.0);
    this.uLuffing = uniform(0.0);

    this._buildMesh(parentGroup);
    globalThis.experience.ticker.register(14, 'visualSail.update', () => this._update());
  }

  _buildMesh(parent) {
    const geo = new THREE.PlaneGeometry(4, 12, 4, 12);

    const colourNode = Fn(() => {
      const vuv = uv();
      const htell = smoothstep(float(0.03), float(0.055), sin(vuv.x.mul(float(Math.PI * 4))).abs());
      const vtell = smoothstep(float(0.04), float(0.065), sin(vuv.y.mul(float(Math.PI * 3))).abs());
      const isTelltale = htell.mul(vtell);

      const greenAttached = vec3(float(0.1), float(0.9), float(0.3));
      const redStalled = vec3(float(0.9), float(0.2), float(0.1));
      const telltaleCol = mix(redStalled, greenAttached, this.uEfficiency);

      const flutterAmt = this.uLuffing.mul(
        sin(time.mul(float(14)).add(vuv.y.mul(float(25))).add(vuv.x.mul(float(-8)))).mul(float(0.08)).abs()
      );
      const leadEdgeMask = smoothstep(float(0.3), float(0), vuv.x);
      const flutter = flutterAmt.mul(leadEdgeMask);

      const canvasCol = vec3(float(0.97), float(0.95), float(0.88));
      const belly = smoothstep(float(0.2), float(0.8), vuv.x).mul(float(0.08));
      const sailBase = canvasCol.sub(vec3(belly, belly, belly));

      return mix(sailBase, telltaleCol, isTelltale).add(vec3(flutter, flutter, flutter)).toVec4();
    });

    const mat = new THREE.MeshStandardNodeMaterial({ side: THREE.DoubleSide, transparent: true, opacity: 0.93 });
    mat.colorNode = colourNode();

    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.set(0.1, 6, 0);
    if (parent) parent.add(this.mesh);
  }

  _update() {
    this.uEfficiency.value = this.physical.sailEfficiency ?? 1.0;
    this.uLuffing.value = this.physical.luffing ? 1.0 : 0.0;

    const awa = this.physical.apparentWindAngle ?? 90;
    const trimSign = awa > 0 ? -1 : 1;
    this.mesh.rotation.y = trimSign * this.physical.sailTrim * Math.PI / 180;
  }
}
