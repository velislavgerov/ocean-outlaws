// sharedUniforms.js — global uniforms for shader consumption
// Updated by ticker/weather/camera each frame. Ready for TSL shader use.

var sharedUniforms = {
  timeElapsed: { value: 0 },
  timeDelta: { value: 0 },
  windDirectionX: { value: 0 },
  windDirectionZ: { value: 0 },
  windStrength: { value: 0 },
  cameraPosX: { value: 0 },
  cameraPosZ: { value: 0 },
  dayNightPhase: { value: 0 },
  weatherDim: { value: 1.0 },
  fogDensity: { value: 0.006 }
};

export function getSharedUniforms() {
  return sharedUniforms;
}

export function updateTimeUniforms(dt, elapsed) {
  sharedUniforms.timeElapsed.value = elapsed;
  sharedUniforms.timeDelta.value = dt;
}

export function updateWindUniforms(dirX, dirZ, strength) {
  sharedUniforms.windDirectionX.value = dirX;
  sharedUniforms.windDirectionZ.value = dirZ;
  sharedUniforms.windStrength.value = strength;
}

export function updateCameraUniforms(posX, posZ) {
  sharedUniforms.cameraPosX.value = posX;
  sharedUniforms.cameraPosZ.value = posZ;
}

export function updateDayNightUniforms(phase) {
  sharedUniforms.dayNightPhase.value = phase;
}

export function updateWeatherUniforms(dim, fogDensity) {
  sharedUniforms.weatherDim.value = dim;
  sharedUniforms.fogDensity.value = fogDensity;
}
