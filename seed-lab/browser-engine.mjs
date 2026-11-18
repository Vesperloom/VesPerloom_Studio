import metadata from '../engine/strata/weights/checkpoint.json';
import conditionWeights from '../engine/strata/weights/condition.f32';
import hiddenWeights from '../engine/strata/weights/hidden.f32';
import epsilonWeights from '../engine/strata/weights/epsilon.f32';
import { renderPixels } from '../engine/strata/pixels.mjs';
import { inputs } from './recipe.mjs';
const blobs = [conditionWeights, hiddenWeights, epsilonWeights];
let cached;
function checkpoint() {
  if (cached) return cached;
  const layers = metadata.layers.map(({ shape: [input, output] }, i) => {
    const raw = atob(blobs[i]);
    const bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0));
    if (bytes.length !== 4 * (input * output + output)) throw Error('Damaged embedded checkpoint.');
    const view = new DataView(bytes.buffer),
      values = new Float32Array(bytes.length / 4);
    for (let j = 0; j < values.length; j++) values[j] = view.getFloat32(j * 4, true);
    return { input, output, values };
  });
  return (cached = { layers, metadata });
}
export function paint(recipe) {
  const { settings, tags } = inputs(recipe);
  const pixels = renderPixels(settings, tags, checkpoint());
  return { width: settings.width, height: settings.height, buffer: pixels.buffer };
}
