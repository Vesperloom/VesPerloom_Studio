import { sampleWithCheckpoint } from './sampler.mjs';
import { noiseField, mix } from './random.mjs';
import { palettes } from './palettes.mjs';
import { drawSky } from './sky.mjs';
import { drawTerrain } from './terrain.mjs';
/** Shared byte-for-byte renderer. Uint8Array follows Node Buffer's byte semantics. */
export function renderPixels(options, tags, checkpoint, onProgress = () => {}) {
  const { width, height, seed } = options;
  const c = sampleWithCheckpoint(options, tags.family, checkpoint);
  onProgress(0.18, 'Sampling scene code');
  const pixels = new Uint8Array(width * height * 4),
    p = palettes[tags.palette],
    nf = noiseField(mix(seed ^ 0x9747));
  drawSky(pixels, width, height, c, p, tags, nf, seed);
  onProgress(0.46, 'Scattering light');
  drawTerrain(pixels, width, height, c, p, tags, nf, seed);
  onProgress(0.88, 'Finishing terrain');
  // A final scene-code chroma adjustment, independent of the display palette.
  finishPixels(pixels, c.chroma);
  return pixels;
}
export function finishPixels(pixels, chroma) {
  const sat = 1 + chroma * 0.14;
  for (let i = 0; i < pixels.length; i += 4) {
    const d = pixels,
      lum = 0.25 * d[i] + 0.6 * d[i + 1] + 0.15 * d[i + 2];
    for (let k = 0; k < 3; k++)
      d[i + k] = Math.min(255, Math.max(0, Math.round(lum + (d[i + k] - lum) * sat)));
  }
  return pixels;
}
