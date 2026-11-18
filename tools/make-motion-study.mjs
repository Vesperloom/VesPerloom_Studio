/** Produce the reference shot from the same motion engine used by the web queue. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { root } from '../server/config.mjs';
import { videoSettings } from '../server/video/settings.mjs';
import { renderVideo } from '../server/video/execute.mjs';
import { videoRecipe } from '../server/video/store.mjs';
const folder = path.join(root, 'app/public/reels/meridian');
await fs.mkdir(folder, { recursive: true });
const s = videoSettings({
  model: 'strata-motion',
  prompt:
    'An immense ringed planet above sweeping copper desert dunes, with amber light and a plum dusk sky.',
  seed: 41928,
  frame: 'wide',
  camera: 'glide',
  duration: 3,
  steps: 24,
  strength: 85,
});
const t = performance.now(),
  result = await renderVideo(s, folder);
const r = await videoRecipe(folder, s, result, Math.round(performance.now() - t), 'study-01');
await fs.writeFile(path.join(folder, 'recipe.json'), JSON.stringify(r, null, 2) + '\n');
await fs.writeFile(
  path.join(root, 'registry/motion-study.json'),
  JSON.stringify(
    {
      id: 'reel-01',
      kind: 'study',
      title: 'Meridian Crossing',
      url: '/reels/meridian/clip.mp4',
      review: '/reels/meridian/review.webm',
      poster: '/reels/meridian/poster.png',
      strip: '/reels/meridian/strip.png',
      recipeUrl: '/reels/meridian/recipe.json',
      ...r,
    },
    null,
    2,
  ) + '\n',
);
console.log(r.output);
