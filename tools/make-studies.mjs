/** Rebuild every shipped study using the actual native renderer; no stock art. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { root } from '../server/config.mjs';
import { render } from '../engine/strata/index.mjs';
import { normalize } from '../server/runtime/options.mjs';
import { capture, thumbnail } from '../server/runtime/capsule.mjs';
const recipes = [
  [
    'Copper Meridian',
    'An immense ringed planet above sweeping copper desert dunes, with amber light and a plum dusk sky.',
    41928,
  ],
  ['Glacial Echo', 'Glacial peaks rise beneath a pale mint moon, in a quiet alpine sky.', 371907],
  [
    'Amethyst Tide',
    'A massive lilac moon over a violet tidal sea, under a scattering of stars.',
    692104,
  ],
  [
    'Ochre Orbit',
    'A distant ringed giant above golden orbital craters and weathered basalt.',
    174032,
  ],
];
const records = [];
for (const [i, [title, prompt, seed]] of recipes.entries()) {
  const id = 'study-0' + (i + 1),
    settings = normalize({ prompt, seed, aspect: '3:2' });
  const { png, tags } = render(settings);
  const { capsule, image } = capture(png, settings, { tags });
  const folder = path.join(root, 'app/public/studies');
  await fs.mkdir(folder, { recursive: true });
  const ref = '/studies/' + id;
  await fs.writeFile(path.join(folder, id + '.png'), png);
  await fs.writeFile(path.join(folder, id + '-thumb.png'), thumbnail(image));
  await fs.writeFile(path.join(folder, id + '.json'), JSON.stringify(capsule, null, 2) + '\n');
  records.push({
    id,
    title,
    kind: 'study',
    image: ref + '.png',
    thumb: ref + '-thumb.png',
    capsuleUrl: ref + '.json',
    ...capsule,
  });
  console.log(`${id}  ${title}  ${capsule.output.pixelSha256.slice(0, 12)}`);
}
await fs.writeFile(
  path.join(root, 'registry/studies.json'),
  JSON.stringify(records, null, 2) + '\n',
);
