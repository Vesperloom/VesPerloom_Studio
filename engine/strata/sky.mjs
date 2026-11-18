import { clamp, lerp, mix, random } from './random.mjs';
/** Atmospheric gradient, spherical albedo, partial ring occlusion and fine dust. */
export function drawSky(buf, w, h, c, p, tag, nf, seed, camera) {
  const { n, fbm } = nf;
  const aspect = w / h;
  const cx = w * (0.57 + 0.21 * c.body_x) - h * (camera?.yaw || 0),
    cy = h * (0.29 + 0.095 * c.body_y);
  const radius =
    h *
    ((tag.largeBody ? 0.178 : 0.111) +
      0.047 * c.body_size +
      (tag.family === 'orbital' ? 0.023 : 0));
  const phase = random(mix(seed ^ 0xedaf)).uniform() * 140 + (camera?.sky || 0);
  const rot = -0.34 + 0.14 * c.azimuth,
    cs = Math.cos(rot),
    sn = Math.sin(rot);
  for (let y = 0; y < h; y++) {
    const v = y / h;
    for (let x = 0; x < w; x++) {
      const u = x / w,
        dx = (x - cx) / radius,
        dy = (y - cy) / radius,
        dist = dx * dx + dy * dy;
      const mist = fbm(u * 3 * aspect + phase, v * 10 + 11) - 0.5;
      const cloud =
        clamp((fbm(u * 2.9 * aspect + phase, v * 24 + mist * 1.35) - 0.47) * 1.8) *
        (0.16 + 0.07 * c.veil);
      let f = clamp(0.06 + v * 1.55 + 0.11 * mist + 0.105 * Math.exp(-0.71 * dist));
      let r = lerp(p.sky[0], p.rim[0], f),
        g = lerp(p.sky[1], p.rim[1], f),
        b = lerp(p.sky[2], p.rim[2], f);
      const rx = dx * cs + dy * sn,
        ry = -dx * sn + dy * cs;
      const ring = Math.sqrt(rx * rx + ry * ry * 16);
      if (dist < 1) {
        const z = Math.sqrt(1 - dist),
          lon = Math.atan2(dx, z),
          lat = Math.asin(clamp(dy, -1, 1));
        const plate = fbm(lon * 4.2 + phase + 2 * n(lon * 2, lat * 3), lat * 5.5 + phase);
        const detail = fbm(lon * 27 + phase, lat * 27 + 2 * plate);
        const band =
          Math.sin(lat * 18 + plate * 2 + lon * 1.7) +
          0.45 * Math.cos(lat * 56 + lon * 5 + detail * 4);
        const albedo = tag.ringed
          ? band * 0.069 + (plate - 0.5) * 0.27
          : (plate - 0.48) * 0.48 + (detail - 0.5) * 0.18 + (n(lon * 78, lat * 78) - 0.5) * 0.055;
        let light = clamp(
          0.34 + (-0.54 * dx - 0.36 * dy + 0.82 * z) * 0.67 + albedo * (1 + 0.25 * c.body_detail),
        );
        const opacity = clamp((1 - Math.sqrt(dist)) * radius) * (0.95 - 0.06 * c.haze);
        r = lerp(r, lerp(p.body[0], p.glow[0], light), opacity);
        g = lerp(g, lerp(p.body[1], p.glow[1], light), opacity);
        b = lerp(b, lerp(p.body[2], p.glow[2], light), opacity);
      }
      if (tag.ringed && ring > 1.17 && ring < 1.98 && (ry >= 0 || dist > 1)) {
        const str =
          (0.53 +
            0.1 * Math.sin(ring * 91) +
            0.085 * Math.cos(ring * 46) +
            0.16 * Math.sin(ring * 12)) *
          (ring > 1.68 && ring < 1.72 ? 0.18 : 1) *
          (rx > 0.3 && ry < 0 ? 0.72 : 1);
        const o = clamp(Math.min((ring - 1.17) * 12, (1.98 - ring) * 12)) * str;
        r = lerp(r, p.glow[0], o);
        g = lerp(g, p.glow[1], o);
        b = lerp(b, p.glow[2], o);
      }
      const grain = ((mix((x + y * w) ^ seed) >>> 8) / 16777216 - 0.5) * (5.7 + 1.6 * c.grain);
      const i = (y * w + x) * 4;
      buf[i] = lerp(r, p.glow[0], cloud) + grain;
      buf[i + 1] = lerp(g, p.glow[1], cloud) + grain;
      buf[i + 2] = lerp(b, p.glow[2], cloud) + grain;
      buf[i + 3] = 255;
    }
  }
  const rng = random(seed ^ 0xdad1);
  const count = ((tag.starry ? 210 : 55) * w * h) / 600000;
  for (let k = 0; k < count; k++) {
    const x = Math.floor(rng.uniform() * w),
      y = Math.floor(rng.uniform() * h * 0.43),
      a = (0.16 + 0.5 * rng.uniform()) * (1 - y / (0.57 * h));
    if ((x - cx) ** 2 + (y - cy) ** 2 < radius ** 2) continue;
    const i = 4 * (x + y * w);
    for (let j = 0; j < 3; j++) buf[i + j] = lerp(buf[i + j], p.glow[j], a);
  }
}
