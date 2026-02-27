import EventEmitter from './EventEmitter.js';
import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

export default class Resources extends EventEmitter {
  constructor() {
    super();
    this.items = {};
    this.toLoad = 0;
    this.loaded = 0;

    const ktx2 = new KTX2Loader().setTranscoderPath('/basis/').detectSupport(globalThis.experience.renderer);
    const draco = new DRACOLoader().setDecoderPath('/draco/');

    this.gltfLoader = new GLTFLoader().setKTX2Loader(ktx2).setDRACOLoader(draco);
    this.textureLoader = new THREE.TextureLoader();
  }

  load(sources) {
    this.toLoad = sources.length;
    for (const src of sources) {
      if (src.type === 'gltf') {
        this.gltfLoader.load(src.path, (gltf) => this._itemLoaded(src.name, gltf));
      } else if (src.type === 'texture') {
        this.textureLoader.load(src.path, (tex) => this._itemLoaded(src.name, tex));
      }
    }
  }

  _itemLoaded(name, item) {
    this.items[name] = item;
    this.loaded += 1;
    this.trigger('progress', [this.loaded / this.toLoad]);
    if (this.loaded === this.toLoad) this.trigger('ready');
  }
}
