/** Seeded, independent random streams. No renderer depends on Math.random(). */
export function mix(a) {
  a = Math.imul(a ^ (a >>> 16), 0x85ebca6b);
  a = Math.imul(a ^ (a >>> 13), 0xc2b2ae35);
  return (a ^ (a >>> 16)) >>> 0;
}
export function random(seed) {
  let s = seed >>> 0;
  const uniform = () => {
    s = (s + 0x9e3779b9) >>> 0;
    return (mix(s) + 0.5) / 4294967296;
  };
  const normal = () => Math.sqrt(-2 * Math.log(uniform())) * Math.cos(2 * Math.PI * uniform());
  return { uniform, normal };
}
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export function noiseField(seed) {
  const rng = random(seed);
  const map = Float32Array.from({ length: 256 * 256 }, rng.uniform);
  const n = (x, y) => {
    const ix = Math.floor(x),
      iy = Math.floor(y);
    let a = x - ix,
      b = y - iy;
    a = a * a * (3 - 2 * a);
    b = b * b * (3 - 2 * b);
    const l = ix & 255,
      r = (ix + 1) & 255,
      u = (iy & 255) << 8,
      d = ((iy + 1) & 255) << 8;
    return lerp(lerp(map[u | l], map[u | r], a), lerp(map[d | l], map[d | r], a), b);
  };
  const fbm = (x, y) =>
    0.54 * n(x, y) +
    0.27 * n(1.43 * x - 1.55 * y, 1.55 * x + 1.43 * y) +
    0.13 * n(4.11 * x, 4.11 * y) +
    0.06 * n(8.49 * x, 8.49 * y);
  return { n, fbm };
}
