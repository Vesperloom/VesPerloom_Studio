import test from 'node:test';
import assert from 'node:assert/strict';
import { normalize, dimensions, frames } from '../server/runtime/options.mjs';
import { profiles } from '../registry/index.mjs';
const base = { prompt: ' Amber dunes ', seed: 0 };
test('normalization preserves seed zero, trims space and derives dimensions', () => {
  assert.deepEqual(normalize({ ...base, width: 1, height: 1 }), {
    prompt: 'Amber dunes',
    model: 'strata-1',
    aspect: '3:2',
    seed: 0,
    steps: 24,
    drift: 0,
    width: 960,
    height: 640,
  });
});
test('invalid or unbounded settings never reach a worker', () => {
  for (const patch of [
    { prompt: '' },
    { prompt: 'x'.repeat(601) },
    { prompt: 12 },
    { seed: -1 },
    { seed: 0.4 },
    { seed: 2 ** 32 },
    { aspect: '9:0' },
    { steps: 0 },
    { steps: 99 },
    { model: 'unknown' },
    { drift: -1 },
    { drift: 101 },
    { drift: '2' },
    { model: 'sd15', drift: 1 },
  ])
    assert.throws(() => normalize({ ...base, ...patch }));
  for (const x of [null, [], 3]) assert.throws(() => normalize(x));
});
test('external profiles have architecture-appropriate defaults and integral latent shapes', () => {
  for (const m of profiles)
    for (const a of frames) {
      const [w, h] = dimensions(m, a);
      const [x, y] = a.split(':').map(Number);
      assert.equal(w * y, h * x);
      assert.equal(w % 8, 0);
      assert.equal(h % 8, 0);
      assert.equal(normalize({ ...base, model: m.id, aspect: a }).steps, m.steps);
    }
  assert.throws(() => normalize({ ...base, model: 'sdxl-turbo', steps: 5 }));
});
test('omitting the seed assigns a valid uint32', () => {
  const o = normalize({ prompt: 'sea' });
  assert.ok(Number.isInteger(o.seed) && o.seed >= 0 && o.seed < 2 ** 32);
});
