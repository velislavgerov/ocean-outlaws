import seedrandom from 'seedrandom';
import { uniform } from 'three/tsl';

export default class WindSystem {
  constructor(mapSeed = 'ocean42') {
    this._rng = seedrandom(`${mapSeed}_wind`);
    this.trueWindSpeed = 6;
    this.trueWindAngle = 45;
    this._targetSpeed = 6;
    this._targetAngle = 45;
    this._gustPhase = 'idle';
    this._gustTimer = 0;
    this._nextGust = 8 + this._rng() * 12;

    this.uWindSpeed = uniform(this.trueWindSpeed);
    this.uWindAngle = uniform((this.trueWindAngle * Math.PI) / 180);

    globalThis.experience.ticker.register(7, 'wind.update', (dt) => this.update(dt));

    const folder = globalThis.experience.debug.addFolder('Wind');
    folder.addBinding(this, 'trueWindSpeed', { min: 0, max: 30, label: 'Speed (m/s)' });
    folder.addBinding(this, 'trueWindAngle', { min: 0, max: 360, label: 'Angle (deg)' });
  }

  update(dt) {
    const angleDiff = this._targetAngle - this.trueWindAngle;
    this.trueWindAngle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), 0.3 * dt);

    this._gustTimer += dt;
    switch (this._gustPhase) {
      case 'idle':
        if (this._gustTimer >= this._nextGust) {
          this._gustPhase = 'building';
          this._gustTimer = 0;
          this._targetSpeed = this.trueWindSpeed + 2 + this._rng() * 5;
          this._nextGust = 8 + this._rng() * 12;
          this._targetAngle = this.trueWindAngle + (this._rng() - 0.5) * 20;
        }
        break;
      case 'building':
        this.trueWindSpeed = Math.min(this._targetSpeed, this.trueWindSpeed + 4 * dt);
        if (this.trueWindSpeed >= this._targetSpeed - 0.1) {
          this._gustPhase = 'peak';
          this._gustTimer = 0;
        }
        break;
      case 'peak':
        if (this._gustTimer > 1.5 + this._rng() * 2) {
          this._gustPhase = 'fading';
          this._targetSpeed = Math.max(2, this.trueWindSpeed - 2 - this._rng() * 3);
        }
        break;
      case 'fading':
        this.trueWindSpeed = Math.max(this._targetSpeed, this.trueWindSpeed - 2 * dt);
        if (this.trueWindSpeed <= this._targetSpeed + 0.1) {
          this._gustPhase = 'idle';
          this._gustTimer = 0;
        }
        break;
      default:
        break;
    }

    this.uWindSpeed.value = this.trueWindSpeed;
    this.uWindAngle.value = (this.trueWindAngle * Math.PI) / 180;
  }

  getWindAt(x, z) {
    const localVar = 0.4 * Math.sin(x * 0.012 + z * 0.008);
    const speed = this.trueWindSpeed + localVar;
    const rad = (this.trueWindAngle * Math.PI) / 180;
    return { x: speed * Math.cos(rad), y: 0, z: speed * Math.sin(rad) };
  }
}
