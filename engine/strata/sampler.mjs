import { predict } from './neural.mjs';
import { random, mix, clamp } from './random.mjs';
function schedule(t) {
  const a = Math.cos((((t + 0.008) / 1.008) * Math.PI) / 2);
  return [a, Math.sqrt(Math.max(0, 1 - a * a))];
}
/** Deterministic DDIM in scene-code space. Drift moves on a seeded noise arc. */
export function sampleWithCheckpoint({ seed, drift = 0, steps }, family, { layers, metadata }) {
  const r = random(seed),
    branch = random(mix(seed ^ 0x6a09e667));
  const angle = (drift * Math.PI) / 200;
  let z = Array.from(
    { length: 20 },
    () => r.normal() * Math.cos(angle) + branch.normal() * Math.sin(angle),
  );
  const cond = metadata.families.map((f) => +(f === family));
  // Avoid a nearly singular first x0 estimate at cos(pi/2).
  for (let i = 0; i < steps; i++) {
    const t = 0.965 * (1 - i / steps),
      next = 0.965 * (1 - (i + 1) / steps);
    const [a, s] = schedule(t),
      [an, sn] = i === steps - 1 ? [1, 0] : schedule(next);
    const phase = [1, 2, 4, 8].map((k) => t * 2 * Math.PI * k);
    const e = predict(
      [...z, ...cond, ...phase.map(Math.sin), ...phase.map(Math.cos), a, s],
      layers,
    );
    z = z.map((v, j) => an * clamp((v - s * e[j]) / a, -3, 3) + sn * e[j]);
  }
  return Object.fromEntries(metadata.features.map((f, i) => [f, Math.tanh(z[i] * 0.8)]));
}
