import { videoSettings } from './settings.mjs';
import { identity } from '../runtime/capsule.mjs';
import { anyProfile } from '../../registry/modalities.mjs';
import { InputError } from '../runtime/options.mjs';
export const motionIdentity = (s) =>
  identity(anyProfile(s.model === 'strata-motion' ? 'strata-1' : s.model));
export function readMotionRecipe(r) {
  if (r?.schema !== 'vesperloom.motion/v1' || r.renderer !== '1.0.0' || !r.settings)
    throw new InputError('Unsupported motion recipe or renderer.');
  const s = videoSettings(r.settings);
  if (Object.entries(s).some(([k, v]) => !Object.hasOwn(r.settings, k) || r.settings[k] !== v))
    throw new InputError(
      'Motion parameters are missing or inconsistent with the registered engine.',
    );
  const id = motionIdentity(s);
  if (Object.entries(id).some(([k, v]) => r.model?.[k] !== v))
    throw new InputError('Motion model identity mismatch.');
  const o = r.output;
  if (
    o?.container !== 'mp4' ||
    o.codec !== 'h264' ||
    !['width', 'height', 'frames', 'fps'].every((k) => s[k] === o[k]) ||
    o.seconds !== s.frames / s.fps ||
    !Number.isSafeInteger(o.bytes) ||
    o.bytes <= 0 ||
    ![o.sha256, o.pixelStreamSha256].every((h) => typeof h === 'string' && /^[a-f0-9]{64}$/.test(h))
  )
    throw new InputError('Invalid motion output metadata.');
  return s;
}
