import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const base = new URL('./weights/', import.meta.url);
const metadata = JSON.parse(readFileSync(new URL('checkpoint.json', base), 'utf8'));
export const fingerprint = createHash('sha256').update(JSON.stringify(metadata)).digest('hex');
let cached;
export function loadCheckpoint() {
  if (cached) return cached;
  const layers = metadata.layers.map(({ file, shape: [input, output], sha256 }) => {
    const bytes = readFileSync(new URL(file, base));
    if (
      bytes.length !== 4 * (input * output + output) ||
      createHash('sha256').update(bytes).digest('hex') !== sha256
    )
      throw Error(`Invalid checkpoint shard: ${file}`);
    const values = new Float32Array(bytes.length / 4);
    for (let i = 0; i < values.length; i++) values[i] = bytes.readFloatLE(i * 4);
    return { input, output, values };
  });
  return (cached = { layers, metadata });
}
export { predict } from './neural.mjs';
