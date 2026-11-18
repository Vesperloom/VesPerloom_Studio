import fs from 'node:fs';
import { installed, profiles } from './index.mjs';
const dir = new URL('./media/', import.meta.url);
export const mediaProfiles = ['qwen-small', 'qwen-7b', 'wan-t2v'].map((id) =>
  Object.freeze(JSON.parse(fs.readFileSync(new URL(id + '.json', dir), 'utf8'))),
);
export function anyProfile(id) {
  const result = [...profiles, ...mediaProfiles].find((x) => x.id === id);
  if (!result) throw Error('Unknown model ID. Use loom list to see supported profiles.');
  return result;
}
export const mediaCatalog = (base) =>
  mediaProfiles.map(({ files, ...p }) => ({
    ...p,
    fileCount: files.length,
    installed: installed(anyProfile(p.id), base),
  }));
