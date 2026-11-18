import { nativeFrames } from '../../engine/strata/frames.mjs';
import { randomInt } from 'node:crypto';
import { profile } from '../../registry/index.mjs';
import { limits } from '../config.mjs';
export class InputError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
export const frames = ['3:2', '1:1', '16:9', '4:5'];

export function dimensions(m, aspect) {
  if (m.kind === 'native') return nativeFrames[aspect];
  const base = m.base;
  return {
    '3:2': [base * 1.125, base * 0.75],
    '1:1': [base, base],
    '16:9': [base, (base * 9) / 16],
    '4:5': [base * 0.75, base * 0.9375],
  }[aspect];
}
export function normalize(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    throw new InputError('Expected a settings object.');
  const {
    prompt,
    model = 'strata-1',
    aspect = '3:2',
    seed = randomInt(0, 2 ** 32),
    drift = 0,
  } = raw;
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.trim().length > limits.prompt)
    throw new InputError('Prompt must contain 1–600 characters.');
  let m;
  try {
    m = profile(model);
  } catch {
    throw new InputError('Unknown model.');
  }
  const steps = raw.steps ?? m.steps;
  if (!frames.includes(aspect)) throw new InputError('Unsupported aspect ratio.');
  if (!Number.isInteger(seed) || seed < 0 || seed > 4294967295)
    throw new InputError('Seed must be an unsigned 32-bit integer.');
  if (!Number.isInteger(steps) || steps < 1 || steps > m.maxSteps)
    throw new InputError(`Steps must be in 1–${m.maxSteps}.`);
  if (!Number.isInteger(drift) || drift < 0 || drift > 100 || (m.kind !== 'native' && drift !== 0))
    throw new InputError('Drift is 0–100 and is only supported by Strata-1.');
  const [width, height] = dimensions(m, aspect);
  return { prompt: prompt.trim(), model, aspect, seed, steps, drift, width, height };
}
