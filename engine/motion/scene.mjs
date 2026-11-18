import { loadCheckpoint } from '../strata/checkpoint.mjs';
import { sampleWithCheckpoint } from '../strata/sampler.mjs';
import { noiseField, mix } from '../strata/random.mjs';
import { palettes } from '../strata/palettes.mjs';
import { condition } from '../strata/conditioning.mjs';
import { drawSky } from '../strata/sky.mjs';
import { drawTerrain } from '../strata/terrain.mjs';
import { finishPixels } from '../strata/pixels.mjs';
import { cameraAt } from './camera.mjs';
/** Sample one learned scene code per shot, then project it from each camera position. */
export function motionScene(s) {
  const tags = condition(s.prompt),
    code = sampleWithCheckpoint(s, tags.family, loadCheckpoint()),
    field = noiseField(mix(s.seed ^ 0x9747)),
    p = palettes[tags.palette];
  return {
    tags,
    frame(t) {
      const cam = cameraAt(s.camera, t, s.strength);
      const b = new Uint8Array(s.width * s.height * 4);
      drawSky(b, s.width, s.height, code, p, tags, field, s.seed, cam);
      drawTerrain(b, s.width, s.height, code, p, tags, field, s.seed, cam);
      return finishPixels(b, code.chroma);
    },
  };
}
