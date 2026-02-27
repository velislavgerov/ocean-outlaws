import { getSailCoefficients, getOptimalTrim, getTrimEfficiency } from './SailPolar.js';
import { getWaveHeightCPU } from '../world/WaveMath.js';

export default class PhysicalSailboat {
  constructor({ rapier, world, quality = 'mid' }) {
    this.R = rapier;
    this.world = world;
    this.quality = quality;

    const bodyDesc = rapier.RigidBodyDesc.dynamic().setTranslation(0, 3, 0).setLinearDamping(0.7).setAngularDamping(0.8);
    this.body = world.createRigidBody(bodyDesc);

    world.createCollider(rapier.ColliderDesc.cuboid(1.5, 0.6, 4.5).setMass(3500), this.body);
    world.createCollider(
      rapier.ColliderDesc.cuboid(0.2, 0.8, 0.5).setMass(1500).setTranslationWrtParent({ x: 0, y: -1.4, z: 0 }),
      this.body
    );

    this.probes = quality === 'low'
      ? [{ lx: 0, ly: -0.3, lz: 0 }]
      : [
          { lx: 0, ly: -0.3, lz: -4.2 },
          { lx: 0, ly: -0.3, lz: 4.2 },
          { lx: -1.4, ly: -0.3, lz: 0 },
          { lx: 1.4, ly: -0.3, lz: 0 },
          { lx: 0, ly: -0.3, lz: 0 }
        ];

    this.sailArea = 48;
    this.mastHeight = 13;
    this.rudderArea = 0.8;
    this.maxRudderAngle = 25;
    this.buoyancyDensity = 1025;
    this.buoyancyVolFrac = 0.08;
    this.keelLiftCoeff = 0.8;

    this.sailTrim = 45;
    this.rudderAngle = 0;
    this.tacking = false;

    this.apparentWindAngle = 90;
    this.apparentWindSpeed = 0;
    this.sailEfficiency = 1;
    this.leewayAngle = 0;
    this.speedSOG = 0;
    this.heelAngle = 0;
    this.luffing = false;
    this.gybeWarning = false;

    const ticker = globalThis.experience.ticker;
    ticker.register(2, 'boat.prePhysics', (dt) => this._prePhysics(dt));
    ticker.register(5, 'boat.postPhysics', (dt, elapsed) => this._postPhysics(dt, elapsed));
  }

  _prePhysics() {
    const inputs = globalThis.experience.inputs;
    if (!inputs) return;

    if (inputs.trimIn) this.sailTrim = Math.max(2, this.sailTrim - 1.5);
    if (inputs.trimOut) this.sailTrim = Math.min(90, this.sailTrim + 1.5);

    const targetRudder = (inputs.steerLeft ? -1 : 0) + (inputs.steerRight ? 1 : 0);
    this.rudderAngle = targetRudder * this.maxRudderAngle;

    if (inputs.tackPressed && !this.tacking) {
      this._initiateTack();
      inputs.tackPressed = false;
    }
  }

  _postPhysics(delta, elapsed) {
    const vel = this.body.linvel();
    this.speedSOG = Math.sqrt(vel.x * vel.x + vel.z * vel.z);
    this._computeHeelAngle();
    this._applyBuoyancy(elapsed);
    this._computeApparentWind();
    this._applyAerodynamicForces();
    this._applyHydrodynamicDrag();
    this._applyKeelLift();
    this._applyRudder();
  }

  _applyBuoyancy(elapsed) {
    const pos = this.body.translation();
    const quat = this.body.rotation();
    const vel = this.body.linvel();

    for (const probe of this.probes) {
      const world = _localToWorld(probe, pos, quat);
      const waveH = getWaveHeightCPU(world.x, world.z, elapsed);
      const depth = waveH - world.y;

      if (depth > 0) {
        const force = depth * 9.81 * this.buoyancyDensity * this.buoyancyVolFrac;
        this.body.addForceAtPoint({ x: 0, y: force, z: 0 }, world, true);
      }

      if (!probe._wasSubmerged && depth > 0.05) {
        globalThis.experience.effects?.trigger('splash', [{ pos: world, vel }]);
      }
      probe._wasSubmerged = depth > 0;
    }
  }

  _computeApparentWind() {
    const vel = this.body.linvel();
    const wind = globalThis.experience.wind?.getWindAt(this.body.translation().x, this.body.translation().z) ?? { x: 5, y: 0, z: 0 };

    const vax = wind.x - vel.x;
    const vaz = wind.z - vel.z;
    this.apparentWindSpeed = Math.sqrt(vax * vax + vaz * vaz);

    const fwd = this._fwd();
    const boatHdg = Math.atan2(fwd.x, fwd.z);
    const windHdg = Math.atan2(vax, vaz);
    let awa = (windHdg - boatHdg) * 180 / Math.PI;
    while (awa > 180) awa -= 360;
    while (awa < -180) awa += 360;
    this.apparentWindAngle = awa;
  }

  _applyAerodynamicForces() {
    if (this.apparentWindSpeed < 0.1) return;

    const awa = this.apparentWindAngle;
    const abs = Math.abs(awa);
    this.luffing = abs < 30;
    this.gybeWarning = abs > 160;

    if (this.luffing) {
      globalThis.experience.effects?.trigger('luffing', [{ boat: this }]);
      return;
    }

    const [Cd_drive, Cd_lat, Cd_heel] = getSailCoefficients(awa);
    const optimalTrim = getOptimalTrim(abs);
    this.sailEfficiency = getTrimEfficiency(this.sailTrim, optimalTrim);

    const q = 0.5 * 1.225 * this.apparentWindSpeed * this.apparentWindSpeed;
    const eff = this.sailEfficiency;
    const F_drive = q * this.sailArea * Cd_drive * eff;
    const F_lat = q * this.sailArea * Cd_lat * eff;
    const M_heel = q * this.sailArea * Cd_heel * eff * this.mastHeight;

    const fwd = this._fwd();
    const right = this._right();
    const latSign = awa > 0 ? 1 : -1;

    this.body.addForce({ x: fwd.x * F_drive, y: 0, z: fwd.z * F_drive }, true);
    this.body.addForce({ x: right.x * F_lat * latSign, y: 0, z: right.z * F_lat * latSign }, true);
    this.body.addTorque({ x: -M_heel * latSign * 0.3, y: 0, z: 0 }, true);
  }

  _applyHydrodynamicDrag() {
    const vel = this.body.linvel();
    const fwd = this._fwd();
    const right = this._right();
    const surgeV = vel.x * fwd.x + vel.z * fwd.z;
    const swayV = vel.x * right.x + vel.z * right.z;

    this.body.addForce({ x: fwd.x * (-surgeV * 400), y: 0, z: fwd.z * (-surgeV * 400) }, true);
    this.body.addForce({ x: right.x * (-swayV * 1800), y: 0, z: right.z * (-swayV * 1800) }, true);

    this.leewayAngle = this.speedSOG > 0.1 ? Math.atan2(swayV, surgeV) * 180 / Math.PI : 0;
  }

  _applyKeelLift() {
    const vel = this.body.linvel();
    const right = this._right();
    const swayV = vel.x * right.x + vel.z * right.z;
    const liftMag = 0.5 * 1025 * this.speedSOG * this.speedSOG * 0.45 * this.keelLiftCoeff;
    const opposeForce = Math.min(liftMag, Math.abs(swayV) * 2000);

    this.body.addForce({ x: right.x * -Math.sign(swayV) * opposeForce, y: 0, z: right.z * -Math.sign(swayV) * opposeForce }, true);
  }

  _applyRudder() {
    if (Math.abs(this.rudderAngle) < 0.5 || this.speedSOG < 0.1) return;
    const force = 0.5 * 1025 * this.speedSOG * this.speedSOG * this.rudderArea * 0.8;
    const torque = force * (this.rudderAngle / this.maxRudderAngle) * 0.5;
    this.body.addTorque({ x: 0, y: torque, z: 0 }, true);
  }

  _computeHeelAngle() {
    const r = this.body.rotation();
    this.heelAngle = Math.asin(Math.max(-1, Math.min(1, 2 * (r.w * r.z - r.x * r.y)))) * 180 / Math.PI;
  }

  _initiateTack() {
    this.tacking = true;
    const awa = this.apparentWindAngle;
    const dir = awa > 0 ? -1 : 1;
    this.body.applyTorqueImpulse({ x: 0, y: dir * 800, z: 0 }, true);
    setTimeout(() => { this.tacking = false; }, 3000);
  }

  _fwd() {
    const r = this.body.rotation();
    const x = 2 * (r.x * r.z + r.w * r.y);
    const z = 1 - 2 * (r.x * r.x + r.y * r.y);
    const l = Math.sqrt(x * x + z * z) || 1;
    return { x: x / l, z: z / l };
  }

  _right() {
    const f = this._fwd();
    return { x: f.z, z: -f.x };
  }

  getSternPosition() {
    const pos = this.body.translation();
    const quat = this.body.rotation();
    return _localToWorld({ lx: 0, ly: 0.2, lz: 4.5 }, pos, quat);
  }
}

function _localToWorld({ lx, ly, lz }, pos, quat) {
  const { x: qx, y: qy, z: qz, w: qw } = quat;
  const rx = qw * lx + qy * lz - qz * ly;
  const ry = qw * ly + qz * lx - qx * lz;
  const rz = qw * lz + qx * ly - qy * lx;
  const rw = -qx * lx - qy * ly - qz * lz;
  return {
    x: pos.x + 2 * (rw * -qx + rx * qw + ry * -qz - rz * -qy),
    y: pos.y + 2 * (rw * -qy + ry * qw + rz * -qx - rx * -qz),
    z: pos.z + 2 * (rw * -qz + rz * qw + rx * -qy - ry * -qx)
  };
}
