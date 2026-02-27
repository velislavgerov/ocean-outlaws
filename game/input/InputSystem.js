import EventEmitter from '../core/EventEmitter.js';

export default class InputSystem extends EventEmitter {
  constructor() {
    super();
    this.state = {
      trimIn: false,
      trimOut: false,
      steerLeft: false,
      steerRight: false,
      tackPressed: false
    };

    this._keysDown = new Set();
    window.addEventListener('keydown', (e) => this._onKey(e, true));
    window.addEventListener('keyup', (e) => this._onKey(e, false));

    globalThis.experience.ticker.register(1, 'inputs.read', () => this._readState());
  }

  _onKey(e, down) {
    if (e.repeat) return;
    this._keysDown[down ? 'add' : 'delete'](e.code);

    if (down && (e.code === 'Space' || e.code === 'KeyT')) {
      this.state.tackPressed = true;
    }
  }

  _readState() {
    this.state.trimIn = this._keysDown.has('KeyW') || this._keysDown.has('ArrowUp');
    this.state.trimOut = this._keysDown.has('KeyS') || this._keysDown.has('ArrowDown');
    this.state.steerLeft = this._keysDown.has('KeyA') || this._keysDown.has('ArrowLeft');
    this.state.steerRight = this._keysDown.has('KeyD') || this._keysDown.has('ArrowRight');
  }
}
