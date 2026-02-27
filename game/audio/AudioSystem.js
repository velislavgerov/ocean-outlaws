import { Howl, Howler } from 'howler';

export default class AudioSystem {
  constructor() {
    Howler.volume(0.7);

    this.sounds = {
      windLow: new Howl({ src: ['/audio/wind_low.mp3'], loop: true, volume: 0 }),
      windHigh: new Howl({ src: ['/audio/wind_high.mp3'], loop: true, volume: 0 }),
      waves: new Howl({ src: ['/audio/ocean.mp3'], loop: true, volume: 0.25 }),
      sailCreak: new Howl({ src: ['/audio/creak.mp3'], loop: true, volume: 0 }),
      sailFlap: new Howl({ src: ['/audio/flap.mp3'], loop: true, volume: 0 }),
      splash: new Howl({ src: ['/audio/splash.mp3'], volume: 0.6 }),
      cannon: new Howl({ src: ['/audio/cannon.mp3'], volume: 0.9 })
    };

    for (const sound of Object.values(this.sounds)) {
      if (sound._loop) sound.play();
    }

    globalThis.experience.ticker.register(12, 'audio.update', () => this._update());

    globalThis.experience.effects?.on('splash.audio', () => {
      this.sounds.splash.rate(0.85 + Math.random() * 0.3).play();
    });
  }

  _update() {
    const boat = globalThis.experience.localBoat?.physical;
    const wind = globalThis.experience.wind;
    if (!boat || !wind) return;

    const wNorm = Math.min(wind.trueWindSpeed / 28, 1);
    const hNorm = Math.min(Math.abs(boat.heelAngle) / 40, 1);

    this.sounds.windLow.volume(0.15 + wNorm * 0.45);
    this.sounds.windLow.rate(0.7 + wNorm * 0.4);
    this.sounds.windHigh.volume(Math.max(0, wNorm * 2 - 1) * 0.35);
    this.sounds.windHigh.rate(0.9 + wNorm * 0.3);

    this.sounds.sailCreak.volume(hNorm * 0.25);
    this.sounds.sailCreak.rate(0.8 + hNorm * 0.35);

    this.sounds.sailFlap.volume(boat.luffing ? 0.4 + wNorm * 0.3 : 0);
    this.sounds.sailFlap.rate(0.9 + wNorm * 0.25);
  }
}
