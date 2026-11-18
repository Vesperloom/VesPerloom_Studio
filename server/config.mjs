import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
export const root = fileURLToPath(new URL('../', import.meta.url));
export const home = path.resolve(process.env.VESPER_HOME || path.join(root, '.vesperloom'));
export const web = path.join(root, 'app', 'dist');
// Studio releases and replay compatibility are versioned independently.
export const releaseVersion = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
).version;
export const engineVersion = '0.1.0';
export const python =
  process.env.VESPER_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
export const limits = Object.freeze({
  pending: 8,
  stored: 64,
  remembered: 128,
  timeout: 20 * 60_000,
  prompt: 600,
});
