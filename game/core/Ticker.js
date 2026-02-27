export default class Ticker {
  constructor() {
    this._phases = new Map();
    this._sorted = [];
    this._dirty = false;
  }

  register(phase, label, fn) {
    if (!this._phases.has(phase)) this._phases.set(phase, []);
    this._phases.get(phase).push({ label, fn });
    this._dirty = true;
    return () => this.unregister(phase, label);
  }

  unregister(phase, label) {
    const list = this._phases.get(phase);
    if (!list) return;
    const idx = list.findIndex((e) => e.label === label);
    if (idx !== -1) list.splice(idx, 1);
  }

  tick(delta, elapsed) {
    if (this._dirty) {
      this._sorted = [...this._phases.keys()].sort((a, b) => a - b);
      this._dirty = false;
    }
    for (const phase of this._sorted) {
      for (const { fn } of this._phases.get(phase)) {
        fn(delta, elapsed);
      }
    }
  }
}
