export const WAVE_CONFIG = [
  { amplitude: 0.8, wavelength: 20, speedFactor: 1.0, dirX: 0.87, dirZ: 0.5 },
  { amplitude: 0.4, wavelength: 10, speedFactor: 1.3, dirX: -0.5, dirZ: 0.87 },
  { amplitude: 0.2, wavelength: 5, speedFactor: 0.8, dirX: 0.7, dirZ: -0.7 }
];

export function getWaveHeightCPU(x, z, elapsed) {
  let height = 0;
  for (const w of WAVE_CONFIG) {
    const len = Math.sqrt(w.dirX * w.dirX + w.dirZ * w.dirZ);
    const dx = w.dirX / len;
    const dz = w.dirZ / len;
    const k = (2 * Math.PI) / w.wavelength;
    const c = Math.sqrt(9.81 / k) * w.speedFactor;
    const phase = k * (dx * x + dz * z) - c * elapsed;
    height += w.amplitude * Math.sin(phase);
  }
  return height;
}
