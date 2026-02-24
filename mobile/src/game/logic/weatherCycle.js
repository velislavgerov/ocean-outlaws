var PRESETS = {
  calm: { label: 'CALM', dimFactor: 1, wind: 0.4 },
  rough: { label: 'ROUGH', dimFactor: 0.78, wind: 1.2 },
  storm: { label: 'STORM', dimFactor: 0.58, wind: 2.1 }
};

var ORDER = ['calm', 'rough', 'storm'];

export function createEnvironmentState() {
  return {
    timeOfDay: 0.25,
    dayLengthSec: 420,
    weatherKey: 'calm'
  };
}

export function tickEnvironment(env, dt) {
  env.timeOfDay += dt / env.dayLengthSec;
  if (env.timeOfDay >= 1) {
    env.timeOfDay -= 1;
  }
}

export function cycleWeather(env) {
  var idx = ORDER.indexOf(env.weatherKey);
  env.weatherKey = ORDER[(idx + 1) % ORDER.length];
}

export function getWeatherPreset(env) {
  return PRESETS[env.weatherKey] || PRESETS.calm;
}

export function getTimeLabel(env) {
  var h = Math.floor(env.timeOfDay * 24);
  var m = Math.floor((env.timeOfDay * 24 - h) * 60);
  var mm = m < 10 ? '0' + m : String(m);
  return h + ':' + mm;
}
