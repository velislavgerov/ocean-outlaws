import EventEmitter from './EventEmitter.js';

export default class Time extends EventEmitter {
  constructor() {
    super();
    this.start = performance.now();
    this.current = this.start;
    this.elapsed = 0;
    this.delta = 1 / 60;

    window.requestAnimationFrame(() => this._tick());
  }

  _tick() {
    const now = performance.now();
    this.delta = Math.min((now - this.current) / 1000, 1 / 20);
    this.elapsed = (now - this.start) / 1000;
    this.current = now;

    this.trigger('tick');
    window.requestAnimationFrame(() => this._tick());
  }
}
