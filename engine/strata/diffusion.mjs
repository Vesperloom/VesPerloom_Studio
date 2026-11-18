import { loadCheckpoint } from './checkpoint.mjs';
import { sampleWithCheckpoint } from './sampler.mjs';
export const sampleScene = (settings, family) =>
  sampleWithCheckpoint(settings, family, loadCheckpoint());
