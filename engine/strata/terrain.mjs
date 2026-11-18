import { clamp, lerp, mix, random } from './random.mjs';
const tau = Math.PI * 2;
function makeSurface(c, tag, { n, fbm }, seed, time = 0) {
  const phi = random(seed ^ 124956).uniform() * 30;
  const freq = 0.86 + 0.22 * c.frequency,
    amp = 1 + 0.36 * c.height;
  if (tag.family === 'dunes')
    return (x, z) => {
      const bend =
        1.85 * Math.sin(x * 0.27 + z * 0.095 + phi) +
        0.8 * Math.sin(0.42 * x - 0.19 * z + phi) +
        1.15 * (n(x * 0.23 + phi, z * 0.19) - 0.5);
      const phase =
        (x * (0.63 + 0.15 * c.azimuth) + z * (0.91 - 0.13 * c.spacing)) * freq + bend + phi;
      const f = phase / tau - Math.floor(phase / tau);
      const crest = 0.71 + 0.055 * c.flow;
      let curve = f < crest ? f / crest : (1 - f) / (1 - crest);
      curve = curve * curve * (3 - 2 * curve);
      return (
        amp *
        (curve * (1.7 + 0.19 * c.valley + 1.35 * n(x * 0.155 + phi, z * 0.14)) +
          0.44 * Math.sin(x * 0.49 + z * 0.21 + phi) +
          0.65 * n(x * 0.32, z * 0.29) +
          0.039 * (fbm(x * 1.3, z * 1.3) - 0.5))
      );
    };
  if (tag.family === 'alpine')
    return (x, z) => {
      const warp = n(x * 0.18 + phi, z * 0.17);
      const ridge =
        1 - Math.abs(2 * fbm(x * 0.46 * freq + warp * 1.9 + phi, z * 0.34 * freq + 2 * warp) - 1);
      const mass = fbm(x * 0.12 + phi, z * 0.11);
      return (
        amp *
        (ridge ** 3 * (1.1 + mass ** 2 * 10) +
          mass * 2 +
          1.2 * n(x * 0.15, z * 0.17) +
          0.33 * n(x * 1.65, z * 1.6))
      );
    };
  if (tag.family === 'tidal')
    return (x, z) => {
      const warp = n(x * 0.19 + phi, z * 0.32) * 2.2;
      return (
        amp *
        (0.17 * Math.sin(z * 2.3 + x * 0.45 + warp + phi - time * 1.8) +
          0.1 * Math.sin(z * 3.6 - x * 0.54 + 2 * warp + time * 1.1) +
          0.34 * n(x * 0.36 + phi, z * 0.55) +
          0.085 * n(x * 1.8, z * 2.4))
      );
    };
  return (x, z) => {
    const b = fbm(x * 0.21 * freq + phi, z * 0.17 * freq);
    const ridge = 1 - Math.abs(2 * n(x * 0.41 + phi, z * 0.38 + b) - 1);
    return (
      amp *
      (Math.pow(b, 2) * (4.2 + 0.5 * c.valley) +
        0.6 * ridge ** 3 +
        0.46 * n(x * 0.82, z * 0.81) +
        0.13 * n(x * 2.8, z * 2.75))
    );
  };
}
/** Front-to-back heightfield projection with a per-column occlusion buffer.
 * The shader estimates surface normals in world space, then lays screen-space
 * film grain over each visible depth span. Far samples need less detail.
 */
export function drawTerrain(buf, w, h, c, p, tag, nf, seed, camera) {
  const { fbm, n } = nf,
    at = makeSurface(c, tag, nf, seed, camera?.time || 0),
    family = tag.family;
  const ox = camera?.x || 0,
    oz = camera?.z || 0,
    yaw = camera?.yaw || 0,
    lift = camera?.lift || 0;
  const horizon = (family === 'tidal' ? 0.475 : 0.472) + c.horizon * 0.06;
  const eye =
    family === 'tidal'
      ? 1.13 + 0.22 * c.sea_level
      : family === 'alpine'
        ? 6.4 + 1 * c.height
        : 4.45 + 0.54 * c.height;
  const focal = h * 1.03,
    floor = h * horizon;
  // Atmospheric escarpments at optical infinity set a crisp silhouette.
  const off = random(seed ^ 4533).uniform() * 80;
  for (let layer = 0; layer < 3; layer++) {
    for (let x = 0; x < w; x++) {
      const u = x / h + yaw + ox * 0.006,
        k = 0.65 + 0.45 * layer;
      const f = fbm(u * k * 1.85 + off + 19 * layer, 8.13 + layer);
      const crest = 1 - Math.abs(2 * n(u * k * 2.7 + off + layer, 3.42) - 1);
      const ridgeNoise = fbm(u * 9 + off, layer * 6.73) - 0.47;
      const rise =
        (family === 'alpine' ? 0.25 : family === 'tidal' ? 0.105 : 0.155) *
        (1 - 0.19 * layer) *
        (f * 0.7 + crest ** 2 * 0.42 + ridgeNoise * 0.17);
      const ht = Math.floor(h * (horizon + 0.013 * layer - rise + 0.0025 * n(u * 88, layer)));
      const end = Math.min(h, Math.ceil(floor + h * 0.075));
      for (let y = Math.max(0, ht); y < end; y++) {
        const i = 4 * (y * w + x),
          depth = (y - ht) / h;
        const facet = fbm(u * 11 + depth * 15 + off, depth * 16 + layer);
        const light = clamp(0.77 - 0.13 * layer + 0.13 * f + 0.3 * depth + 0.24 * (facet - 0.5));
        const grit = (n(x * 0.36, y * 0.27) - 0.5) * 3;
        for (let j = 0; j < 3; j++) buf[i + j] = lerp(p.mid[j], p.haze[j], light) + grit;
      }
    }
  }
  const ceiling = new Int32Array(w).fill(h);
  for (let z = 0.72; z < 145; z += 0.01 + z * 0.0038) {
    const project = focal / z,
      worldPixel = z / focal,
      eps = 0.025 + z * 0.0009;
    const wz = z + oz;
    const fog = 1 - Math.exp(-z * (0.019 + 0.004 * c.haze));
    for (let x = 0; x < w; x++) {
      const wx = (x - w * 0.5) * worldPixel + ox + z * yaw;
      const height = at(wx, wz);
      const top = clamp(Math.round(floor + (eye + lift - height) * project), 0, h),
        bottom = ceiling[x];
      if (top >= bottom) continue;
      ceiling[x] = top;
      const nx = (height - at(wx + eps, wz)) / eps,
        nz = (height - at(wx, wz + eps)) / eps;
      const inv = 1 / Math.sqrt(1 + nx * nx + nz * nz);
      const lambert = (-0.66 * nx + 0.43 + 0.62 * nz) * inv;
      const grit = fbm(wx * (4 + 0.6 * c.erosion) + off, wz * 4.3);
      let t = clamp(0.12 + 0.91 * lambert + 0.055 * c.sunlight + 0.13 * (grit - 0.5));
      // A narrow terminator separates the leeward slip face from direct light.
      if (family === 'dunes') t = clamp(t * 0.94 + 0.1 * Math.tanh((lambert - 0.27) * 8));
      if (family === 'alpine') {
        const snow = clamp((height - 2.75 - 0.65 * c.plateau) * 0.63 + (grit - 0.5) * 2);
        t = clamp(t * 0.8 + snow * 0.31);
      }
      if (family === 'tidal') {
        const highlight = Math.max(0, (-0.42 * nx + 0.61 + 0.67 * nz) * inv);
        t = clamp(0.07 + 0.39 * t + 0.7 * highlight ** 10 + 0.1 * (grit - 0.5));
      }
      const a = t < 0.53 ? p.shade : p.mid,
        b = t < 0.53 ? p.mid : p.light,
        ratio = t < 0.53 ? t / 0.53 : (t - 0.53) / 0.47;
      const stripe = Math.sin(wz * 38 + wx * 10 + 4 * Math.sin(wx * 1.4 + wz * 0.7) + grit * 3);
      const scratch = (grit - 0.5) * 13 + stripe * (3.2 + 1.3 * c.contours) * Math.exp(-z * 0.085);
      const red = lerp(lerp(a[0], b[0], ratio) + scratch, p.haze[0], fog),
        green = lerp(lerp(a[1], b[1], ratio) + scratch, p.haze[1], fog),
        blue = lerp(lerp(a[2], b[2], ratio) + scratch, p.haze[2], fog);
      for (let y = top; y < bottom; y++) {
        const i = 4 * (x + y * w);
        const grain = ((mix((x + w * y) ^ seed) >>> 8) / 16777216 - 0.5) * (5.5 + 1.2 * c.grain);
        buf[i] = clamp(red + grain, 0, 255);
        buf[i + 1] = clamp(green + grain, 0, 255);
        buf[i + 2] = clamp(blue + grain, 0, 255);
      }
    }
  }
}
