import EventEmitter from './EventEmitter.js';

export default class Sizes extends EventEmitter {
  constructor() {
    super();
    this._update();
    window.addEventListener('resize', () => {
      this._update();
      this.trigger('resize');
    });
  }

  _update() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.pixelRatio = Math.min(window.devicePixelRatio, 2);
    this.aspect = this.width / this.height;
  }
}
