import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { home } from '../server/config.mjs';
const dir = new URL('./profiles/', import.meta.url);
export const profiles = ['strata-1', 'sd15', 'sdxl', 'sdxl-turbo', 'flux-schnell'].map((id) =>
  Object.freeze(JSON.parse(fs.readFileSync(new URL(id + '.json', dir), 'utf8'))),
);
export function profile(id) {
  const m = profiles.find((m) => m.id === id);
  if (!m) throw new Error('Unknown model ID. Use loom list to see supported profiles.');
  return m;
}
export const modelDir = (p, base = home) => path.join(base, 'models', p.id);
export const manifestHash = (p) => createHash('sha256').update(JSON.stringify(p)).digest('hex');
export function installed(p, base = home) {
  if (p.kind === 'native') return true;
  try {
    const d = modelDir(p, base),
      receipt = JSON.parse(fs.readFileSync(path.join(d, 'vesper-receipt.json'), 'utf8'));
    return (
      receipt.manifest === manifestHash(p) &&
      p.files.every((f) => fs.statSync(path.join(d, f.path)).size === f.size)
    );
  } catch {
    return false;
  }
}
export function catalog(base = home) {
  return profiles.map(({ files, ...fields }) => ({
    ...fields,
    installed: installed(profile(fields.id), base),
    fileCount: files?.length || 3,
  }));
}
