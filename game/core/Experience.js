import * as THREE from 'three/webgpu';
import Time from './Time.js';
import Sizes from './Sizes.js';
import Ticker from './Ticker.js';
import Debug from '../debug/Debug.js';
import PhysicsWorld from '../physics/PhysicsWorld.js';
import Resources from './Resources.js';

export default class Experience {
  constructor(canvas) {
    if (Experience._instance) return Experience._instance;
    Experience._instance = this;
    globalThis.experience = this;

    this.canvas = canvas;
    this.quality = this._detectQuality();

    this.time = new Time();
    this.sizes = new Sizes();
    this.ticker = new Ticker();
    this.debug = new Debug();

    this.renderer = new THREE.WebGPURenderer({ canvas, antialias: true });
    this.renderer.setSize(this.sizes.width, this.sizes.height);
    this.renderer.setPixelRatio(this.sizes.pixelRatio);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, this.sizes.aspect, 0.1, 3000);
    this.camera.position.set(0, 12, 25);
    this.camera.lookAt(0, 0, 0);

    this.sizes.on('resize.experience', () => {
      this.camera.aspect = this.sizes.aspect;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(this.sizes.width, this.sizes.height);
      this.renderer.setPixelRatio(this.sizes.pixelRatio);
    });

    this.resources = new Resources();
    this.physics = new PhysicsWorld(this.quality);
    this.physicsReady = this.physics.init();
    this.physicsReady.then(() => this._buildWorld());

    this.time.on('tick.experience', () => {
      this.ticker.tick(this.time.delta, this.time.elapsed);
    });

    this.ticker.register(998, 'renderer', () => {
      this.renderer.renderAsync(this.scene, this.camera);
    });
  }

  _detectQuality() {
    const param = new URLSearchParams(location.search).get('quality');
    if (param) return param;
    const envDefault = import.meta.env.VITE_DEFAULT_QUALITY;
    if (envDefault) return envDefault;
    const isMobile = /Mobi|Android|iPhone|iPad/.test(navigator.userAgent);
    if (isMobile) return 'low';
    const cores = navigator.hardwareConcurrency || 4;
    return cores >= 8 ? 'high' : 'mid';
  }

  async _buildWorld() {
    const { default: WindSystem } = await import('../world/WindSystem.js');
    const { default: OceanSurface } = await import('../world/OceanSurface.js');
    const { default: EffectManager } = await import('../fx/EffectManager.js');
    const { default: AudioSystem } = await import('../audio/AudioSystem.js');
    const { default: SailingInstruments } = await import('../ui/SailingInstruments.js');
    const { default: WakeSystem } = await import('../world/WakeSystem.js');
    const { default: InputSystem } = await import('../input/InputSystem.js');
    const { LocalBoat } = await import('../world/LocalBoat.js');

    this.wind = new WindSystem(import.meta.env.VITE_MAP_SEED || 'ocean42');
    this.ocean = new OceanSurface(this.scene, this.wind, this.quality);
    this.effects = new EffectManager(this.scene, this.quality);
    this.inputs = new InputSystem().state;
    this.audio = new AudioSystem();
    this.hud = new SailingInstruments();
    this.localBoat = new LocalBoat();
    this.wake = new WakeSystem(this.scene, this.localBoat);

    this.debug.trigger('ready');
  }
}
