/** Optional Python/Wan smoke calls this with a throwaway folder containing frames.rgb. */
import { Worker } from 'node:worker_threads';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const work = process.argv[2],
  settings = { model: 'wan-t2v', width: 32, height: 32, frames: 5, fps: 16 };
const raw = await fs.readFile(path.join(work, 'frames.rgb')),
  rgba = Buffer.alloc(5 * 32 * 32 * 4, 255);
for (let i = 0; i < 5 * 32 * 32; i++) raw.copy(rgba, 4 * i, 3 * i, 3 * i + 3);
const event = await new Promise((resolve, reject) => {
  const w = new Worker(new URL('../engine/motion/encode-worker.mjs', import.meta.url), {
    workerData: { settings, work },
  });
  let result;
  w.on('message', (m) => {
    if (m.done) result = m;
  });
  w.once('error', reject);
  w.once('exit', (c) =>
    c === 0 && result ? resolve(result) : reject(Error('Encoding fixture failed.')),
  );
});
assert.equal(event.pixelStreamSha256, createHash('sha256').update(rgba).digest('hex'));
assert.equal((await fs.readFile(path.join(work, 'clip.mp4'))).toString('ascii', 4, 8), 'ftyp');
assert.ok((await fs.stat(path.join(work, 'review.webm'))).size > 250);
console.log('PASS: external frame sequence → H.264 MP4 / VP8 WebM through the actual encoder.');
