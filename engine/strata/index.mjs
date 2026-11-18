import pngjs from 'pngjs';
import { condition } from './conditioning.mjs';
import { loadCheckpoint } from './checkpoint.mjs';
import { renderPixels } from './pixels.mjs';
export { fingerprint } from './checkpoint.mjs';
export function render(options, onProgress = () => {}) {
  const tags = condition(options.prompt);
  const pixels = renderPixels(options, tags, loadCheckpoint(), onProgress);
  const image = { width: options.width, height: options.height, data: Buffer.from(pixels.buffer) };
  return {
    png: pngjs.PNG.sync.write(image, { colorType: 2, inputHasAlpha: true, deflateLevel: 6 }),
    tags,
  };
}
