import { randomInt } from 'node:crypto';
import { InputError } from '../runtime/options.mjs';
const dims = {
  native: { wide: [512, 288], square: [384, 384], tall: [288, 512] },
  hd: { wide: [1280, 720], square: [720, 720], tall: [720, 1280] },
  wan: { wide: [832, 480], square: [512, 512], tall: [480, 832] },
};
export function videoSettings(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data))
    throw new InputError('Expected a video settings object.');
  const { model = 'strata-motion', prompt, frame = 'wide', seed = randomInt(2 ** 32) } = data;
  const native = model === 'strata-motion';
  if (!native && model !== 'wan-t2v') throw new InputError('Unknown video engine.');
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.trim().length > 600)
    throw new InputError('Video prompt must be 1–600 characters.');
  if (
    !['wide', 'square', 'tall'].includes(frame) ||
    !Number.isInteger(seed) ||
    seed < 0 ||
    seed >= 2 ** 32
  )
    throw new InputError('Invalid frame or seed.');
  const {
    duration = 3,
    camera = native ? 'glide' : 'model',
    strength = native ? 65 : 0,
    steps = native ? 24 : 30,
    drift = 0,
  } = data;
  if (
    !Number.isInteger(steps) ||
    steps < 1 ||
    steps > (native ? 48 : 50) ||
    !Number.isInteger(drift) ||
    drift < 0 ||
    drift > 100 ||
    (!native && drift !== 0)
  )
    throw new InputError('Invalid scene sampling settings.');
  if (
    ![2, 3, 4].includes(duration) ||
    !Number.isInteger(strength) ||
    strength < 0 ||
    strength > 100 ||
    !(native ? ['glide', 'dolly', 'arc'].includes(camera) : camera === 'model' && strength === 0)
  )
    throw new InputError('Unsupported clip length or camera controls.');
  const { size = native ? 'preview' : 'model', fps = native ? 12 : 16 } = data;
  if (
    !(native
      ? ['preview', 'hd'].includes(size) && [12, 24].includes(fps)
      : size === 'model' && fps === 16)
  )
    throw new InputError('Unsupported resolution or frame rate.');
  const [width, height] = dims[native ? (size === 'hd' ? 'hd' : 'native') : 'wan'][frame],
    frames = native ? duration * fps : duration * fps + 1;
  return {
    modality: 'video',
    model,
    prompt: prompt.trim(),
    seed,
    frame,
    camera,
    strength,
    drift,
    steps,
    duration,
    size,
    width,
    height,
    fps,
    frames,
  };
}
