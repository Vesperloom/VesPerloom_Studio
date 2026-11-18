import { createHash } from 'node:crypto';
import pngjs from 'pngjs';
import { fingerprint } from '../../engine/strata/checkpoint.mjs';
import { profile, manifestHash } from '../../registry/index.mjs';
import { engineVersion } from '../config.mjs';
import { normalize, InputError } from './options.mjs';
export const schema = 'vesperloom.capsule/v1';
const sha = (b) => createHash('sha256').update(b).digest('hex');
export const identity = (m) => ({
  id: m.id,
  revision: m.revision || '1.0.0',
  fingerprint: m.kind === 'native' ? fingerprint : manifestHash(m),
});
export function capture(png, settings, { tags, parent = null, elapsedMs = 0 } = {}) {
  const image = pngjs.PNG.sync.read(png);
  if (image.width !== settings.width || image.height !== settings.height)
    throw Error('Worker returned unexpected dimensions.');
  return {
    capsule: {
      schema,
      engineVersion,
      model: identity(profile(settings.model)),
      settings,
      tags,
      parent,
      elapsedMs,
      output: {
        width: image.width,
        height: image.height,
        pixelSha256: sha(image.data),
        pngSha256: sha(png),
      },
    },
    image,
  };
}
export function readCapsule(input) {
  if (input?.schema !== schema || input.engineVersion !== engineVersion)
    throw new InputError('Unsupported replay capsule or renderer version.');
  // Replay is stricter than a new render: never synthesize a missing seed or default.
  const required = ['prompt', 'model', 'aspect', 'seed', 'steps', 'drift', 'width', 'height'];
  if (!input.settings || required.some((key) => !Object.hasOwn(input.settings, key)))
    throw new InputError('Incomplete replay settings.');
  const settings = normalize(input.settings);
  if (
    settings.width !== input.settings.width ||
    settings.height !== input.settings.height ||
    settings.width !== input.output?.width ||
    settings.height !== input.output?.height
  )
    throw new InputError('Capsule dimensions do not match its model and frame.');
  const id = identity(profile(settings.model));
  if (
    input.model?.id !== id.id ||
    input.model?.fingerprint !== id.fingerprint ||
    input.model?.revision !== id.revision
  )
    throw new InputError('Capsule model identity does not match this registry.');
  if (!/^[a-f0-9]{64}$/.test(input.output?.pixelSha256))
    throw new InputError('Invalid capsule pixel digest.');
  return settings;
}
export function thumbnail(image) {
  const width = Math.min(384, image.width),
    height = Math.max(1, Math.round((image.height * width) / image.width));
  const out = new pngjs.PNG({ width, height });
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i =
        4 *
        (Math.floor((y * image.height) / height) * image.width +
          Math.floor((x * image.width) / width));
      const j = 4 * (y * width + x);
      for (let k = 0; k < 4; k++) out.data[j + k] = image.data[i + k];
    }
  return pngjs.PNG.sync.write(out, { colorType: 2 });
}
