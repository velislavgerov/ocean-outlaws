import * as THREE from 'three/webgpu';
import { Fn, uniform, float, vec3, sin, sqrt, mix, smoothstep, positionLocal, positionWorld, time } from 'three/tsl';
import { WAVE_CONFIG } from './WaveMath.js';

export default class OceanSurface {
  constructor(scene, windSystem, quality) {
    this.scene = scene;
    this.windSystem = windSystem;
    this.quality = quality;

    this.waveUniforms = WAVE_CONFIG.map((w) => ({
      amplitude: uniform(w.amplitude),
      wavelength: uniform(w.wavelength),
      speedFactor: uniform(w.speedFactor),
      dirX: uniform(w.dirX),
      dirZ: uniform(w.dirZ)
    }));

    this.uDeepColour = uniform(new THREE.Color(0x004466));
    this.uShallowColour = uniform(new THREE.Color(0x0077aa));
    this.uFoamColour = uniform(new THREE.Color(0xeef8ff));
    this.uFoamThreshold = uniform(0.65);

    this._buildMesh(quality);
    this._registerUpdate();
    this._attachTweakpane();
  }

  _buildMesh(quality) {
    const meshSize = 800;
    const segments = quality === 'low' ? 64 : quality === 'mid' ? 128 : 256;
    const geo = new THREE.PlaneGeometry(meshSize, meshSize, segments, segments);
    geo.rotateX(-Math.PI / 2);

    const displacementNode = Fn(() => {
      const tile = float(200);
      const px = positionLocal.x.mod(tile);
      const pz = positionLocal.z.mod(tile);
      let dy = float(0).toVar();

      for (const wu of this.waveUniforms) {
        const len = sqrt(wu.dirX.mul(wu.dirX).add(wu.dirZ.mul(wu.dirZ)));
        const dx = wu.dirX.div(len);
        const dz = wu.dirZ.div(len);
        const k = float(2 * Math.PI).div(wu.wavelength);
        const c = sqrt(float(9.81).div(k)).mul(wu.speedFactor);
        const phase = k.mul(dx.mul(px).add(dz.mul(pz))).sub(c.mul(time));
        dy.assign(dy.add(wu.amplitude.mul(sin(phase))));
      }

      return positionLocal.add(vec3(float(0), dy, float(0)));
    });

    const colourNode = Fn(() => {
      const tile = float(200);
      const px = positionWorld.x.mod(tile);
      const pz = positionWorld.z.mod(tile);
      let dy = float(0).toVar();
      let maxAmp = float(0).toVar();

      for (const wu of this.waveUniforms) {
        const len = sqrt(wu.dirX.mul(wu.dirX).add(wu.dirZ.mul(wu.dirZ)));
        const dx = wu.dirX.div(len);
        const dz = wu.dirZ.div(len);
        const k = float(2 * Math.PI).div(wu.wavelength);
        const c = sqrt(float(9.81).div(k)).mul(wu.speedFactor);
        const phase = k.mul(dx.mul(px).add(dz.mul(pz))).sub(c.mul(time));
        dy.assign(dy.add(wu.amplitude.mul(sin(phase))));
        maxAmp.assign(maxAmp.add(wu.amplitude));
      }

      const normHeight = dy.div(maxAmp).add(float(1)).mul(float(0.5));
      const baseColour = mix(this.uDeepColour, this.uShallowColour, normHeight.mul(float(0.6)));
      const foamNoise = sin(time.mul(float(2)).add(px.mul(float(0.3)))).mul(float(0.5)).add(float(0.5));
      const foamMask = smoothstep(
        this.uFoamThreshold,
        this.uFoamThreshold.add(float(0.15)),
        normHeight.mul(foamNoise.mul(float(0.3)).add(float(0.85)))
      );
      const whitecapMask = smoothstep(float(10), float(20), this.windSystem.uWindSpeed).mul(foamNoise.mul(float(0.4)));
      const foamFactor = foamMask.add(whitecapMask).clamp(float(0), float(1));
      return mix(baseColour, this.uFoamColour, foamFactor).toVec4();
    });

    const mat = new THREE.MeshStandardNodeMaterial({ metalness: 0.05, roughness: 0.08 });
    mat.positionNode = displacementNode();
    mat.colorNode = colourNode();

    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = quality !== 'low';
    this.scene.add(this.mesh);
  }

  _registerUpdate() {
    globalThis.experience.ticker.register(10, 'ocean.update', () => {
      const cam = globalThis.experience.camera;
      this.mesh.position.x = Math.floor(cam.position.x / 50) * 50;
      this.mesh.position.z = Math.floor(cam.position.z / 50) * 50;
    });
  }

  _attachTweakpane() {
    const folder = globalThis.experience.debug.addFolder('Ocean');
    folder.addBinding(this.waveUniforms[0], 'amplitude', { min: 0, max: 3, label: 'Wave A amp' });
    folder.addBinding(this.waveUniforms[0], 'wavelength', { min: 2, max: 60, label: 'Wave A λ' });
    folder.addBinding(this.uFoamThreshold, 'value', { min: 0, max: 1, label: 'Foam threshold' });
  }
}
