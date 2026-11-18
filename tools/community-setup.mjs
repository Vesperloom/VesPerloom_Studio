/** Local opt-in setup, never commits, publishes, stars or posts on anyone's behalf. */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { projectUrl, publicDemoUrl } from '../community/urls.mjs';
import { files, section } from '../community/readme-links.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const file = path.join(root, 'community/links.json');
const { values } = parseArgs({ options: { repo: { type: 'string' }, demo: { type: 'string' } } });
const old = JSON.parse(await readFile(file, 'utf8'));
const links = {
  telegram: old.telegram,
  repository: projectUrl(values.repo ?? old.repository),
  demo: publicDemoUrl(values.demo ?? old.demo),
};
const updates = await Promise.all(
  files.map(async (name) => {
    const dest = path.join(root, name),
      text = await readFile(dest, 'utf8'),
      pattern = /<!-- vesper-community:start -->[\s\S]*?<!-- vesper-community:end -->/;
    if (!pattern.test(text)) throw Error(`Missing community block: ${name}`);
    return [dest, text.replace(pattern, () => section(name, links))];
  }),
);
for (const [dest, text] of updates) await writeFile(dest, text);
await writeFile(file, JSON.stringify(links, null, 2) + '\n');
console.log(
  'Updated community links and all four README editions. Rebuild the studio/demo, review changes, then commit when ready.',
);
