import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { loadCheckpoint, predict } from '../engine/strata/checkpoint.mjs';
import { sampleScene } from '../engine/strata/diffusion.mjs';
import { condition } from '../engine/strata/conditioning.mjs';
import { render } from '../engine/strata/index.mjs';
import { capture, readCapsule } from '../server/runtime/capsule.mjs';
import { normalize } from '../server/runtime/options.mjs';
const opts = { ...normalize({ prompt: 'copper desert dunes', seed: 31 }), width: 128, height: 80 };
test('checkpoint shards decode to real finite denoiser outputs', () => {
  const { layers, metadata: m } = loadCheckpoint();
  assert.equal(m.parameters, 14612);
  assert.equal(
    layers.reduce((n, l) => n + l.values.length, 0),
    m.parameters,
  );
  const output = predict(Array(34).fill(0.3), layers);
  assert.equal(output.length, 20);
  assert.ok(output.every(Number.isFinite));
  assert.ok(output.some((x) => Math.abs(x) > 0.01));
});
test('prompt router has independently selectable terrain and color', () => {
  const a = condition('A cobalt sea with stars');
  assert.equal(a.family, 'tidal');
  assert.equal(a.palette, 'cobalt');
  assert.equal(a.starry, true);
  assert.equal(condition('unknown words').family, 'dunes');
  assert.equal(condition('mountains, alpine peaks').family, 'alpine');
});
test('DDIM has bounded scene codes; changing drift, family or steps changes the sample', () => {
  const a = sampleScene(opts, 'dunes');
  assert.equal(Object.keys(a).length, 20);
  assert.ok(Object.values(a).every((v) => Number.isFinite(v) && Math.abs(v) <= 1));
  assert.deepEqual(a, sampleScene(opts, 'dunes'));
  for (const b of [
    sampleScene({ ...opts, drift: 15 }, 'dunes'),
    sampleScene(opts, 'tidal'),
    sampleScene({ ...opts, steps: 8 }, 'dunes'),
  ])
    assert.notDeepEqual(a, b);
});
test('native renderer is deterministic and different seeds change pixels', () => {
  const a = render(opts);
  assert.deepEqual(a.png, render(opts).png);
  assert.notDeepEqual(a.png, render({ ...opts, seed: 32 }).png);
  const { capsule, image } = capture(a.png, opts, { tags: a.tags });
  assert.equal(image.width, 128);
  assert.equal(image.data.length, 128 * 80 * 4);
  assert.equal(capsule.output.pixelSha256.length, 64);
});
test('every shipped reference plate matches its capsule and full decoded pixel hash', () => {
  const rows = JSON.parse(fs.readFileSync(new URL('../registry/studies.json', import.meta.url)));
  assert.equal(rows.length, 4);
  for (const r of rows) {
    const bytes = fs.readFileSync(new URL('../app/public' + r.image, import.meta.url));
    assert.deepEqual(readCapsule(r), r.settings);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), r.output.pngSha256);
    assert.deepEqual(capture(bytes, r.settings).capsule.output, r.output);
  }
});
test('capsules reject an unrelated renderer or a different set of weights', () => {
  const c = JSON.parse(
    fs.readFileSync(new URL('../app/public/studies/study-01.json', import.meta.url)),
  );
  assert.throws(() => readCapsule({ ...c, engineVersion: '99.0' }), /version/);
  assert.throws(
    () => readCapsule({ ...c, model: { ...c.model, fingerprint: 'different' } }),
    /identity/,
  );
});

test('replay rejects a missing seed or inconsistent frame rather than filling in defaults', () => {
  const c = JSON.parse(
    fs.readFileSync(new URL('../app/public/studies/study-01.json', import.meta.url)),
  );
  const { seed, ...withoutSeed } = c.settings;
  assert.throws(() => readCapsule({ ...c, settings: withoutSeed }), /Incomplete/);
  assert.throws(() => readCapsule({ ...c, output: { ...c.output, height: 1 } }), /dimensions/);
});
