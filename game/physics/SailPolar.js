const TABLE = {
  0: [0.0, 0.0, 0.0],
  30: [0.0, 0.0, 0.0],
  45: [0.35, 0.65, 0.55],
  60: [0.55, 0.6, 0.5],
  75: [0.7, 0.5, 0.45],
  90: [0.85, 0.35, 0.35],
  105: [0.9, 0.25, 0.25],
  120: [0.85, 0.15, 0.18],
  150: [0.7, 0.1, 0.12],
  165: [0.55, 0.08, 0.08],
  180: [0.4, 0.05, 0.05]
};

const ANGLES = Object.keys(TABLE).map(Number).sort((a, b) => a - b);

export function getSailCoefficients(awa) {
  const abs = Math.abs(awa);
  if (abs < 30) return [0, 0, 0];

  let lo = ANGLES[0];
  let hi = ANGLES[ANGLES.length - 1];
  for (let i = 0; i < ANGLES.length - 1; i += 1) {
    if (abs >= ANGLES[i] && abs <= ANGLES[i + 1]) {
      lo = ANGLES[i];
      hi = ANGLES[i + 1];
      break;
    }
  }

  const t = (abs - lo) / (hi - lo);
  const vl = TABLE[lo];
  const vh = TABLE[hi];
  return vl.map((v, i) => v + (vh[i] - v) * t);
}

export function getOptimalTrim(awa) {
  const abs = Math.abs(awa);
  return Math.max(5, Math.min(88, (abs - 30) * (83 / 150)));
}

export function getTrimEfficiency(currentTrim, optimalTrim) {
  const deviation = currentTrim - optimalTrim;
  return Math.exp(-(deviation * deviation) / (2 * 12 * 12));
}
