import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { setTimeout as wait } from 'node:timers/promises';
import { createStudio } from '../server/api/app.mjs';
import { RenderStore } from '../server/runtime/store.mjs';
async function server(t, token = '') {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'loom-api-'));
  const { server, queue, store } = await createStudio({ base, token });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const host = 'http://127.0.0.1:' + server.address().port;
  const req = (url, opts = {}) => fetch(host + url, opts);
  t.after(async () => {
    queue.shutdown();
    await new Promise((r) => server.close(r));
    await fs.rm(base, { recursive: true, force: true });
  });
  return { base, req, queue, store };
}
const post = (body) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});
test('real HTTP render produces a PNG, capsule, thumbnail and restart-safe gallery record', async (t) => {
  const { base, req } = await server(t);
  const response = await req(
    '/api/jobs',
    post({ prompt: 'cobalt peaks', seed: 42, parent: 'study-02' }),
  );
  assert.equal(response.status, 202);
  const { id } = await response.json();
  let j;
  for (let k = 0; k < 150; k++) {
    j = await (await req('/api/jobs/' + id)).json();
    if (['done', 'failed'].includes(j.status)) break;
    await wait(50);
  }
  assert.equal(j.status, 'done', j.error);
  assert.equal(j.result.parent, 'study-02');
  const c = await (await req(j.result.capsuleUrl)).json();
  assert.equal(c.settings.seed, 42);
  const img = await req(j.result.image);
  assert.equal(img.headers.get('content-type'), 'image/png');
  assert.equal(Buffer.from(await img.arrayBuffer()).readUInt32BE(0), 0x89504e47);
  assert.equal((await req(j.result.thumb)).status, 200);
  const again = new RenderStore(base);
  await again.open();
  assert.equal(again.list()[0].id, id);
  assert.equal((await (await req('/api/gallery')).json())[0].id, id);
});
test('model inventory distinguishes bundled from opt-in profiles', async (t) => {
  const { req } = await server(t);
  const rows = await (await req('/api/models')).json();
  assert.equal(rows.length, 5);
  assert.deepEqual(
    rows.filter((r) => r.installed).map((r) => r.id),
    ['strata-1'],
  );
  assert.equal((await req('/api/jobs', post({ model: 'sdxl', prompt: 'ice' }))).status, 409);
});
test('API rejects malformed prompts, unknown parents and non-JSON writes', async (t) => {
  const { req } = await server(t);
  for (const obj of [
    null,
    { prompt: ' ' },
    { prompt: 'ice', seed: 1.5 },
    { prompt: 'a', parent: 'not-a-render' },
  ])
    assert.equal((await req('/api/jobs', post(obj))).status, 400);
  assert.equal((await req('/api/jobs', { method: 'POST', body: 'x' })).status, 415);
  assert.equal(
    (
      await req('/api/jobs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{',
      })
    ).status,
    400,
  );
  assert.equal((await req('/api/unknown')).status, 404);
});
test('bearer token protects API and output routes, while health remains available', async (t) => {
  const { req } = await server(t, 'test-token');
  assert.equal((await (await req('/api/health')).json()).authRequired, true);
  for (const url of ['/api/gallery', '/api/models', '/api/renders/example/image.png'])
    assert.equal((await req(url)).status, 401);
  assert.equal(
    (await req('/api/models', { headers: { Authorization: 'Bearer test-token' } })).status,
    200,
  );
});
test('running native job can be cancelled before gallery commit', async (t) => {
  const { req } = await server(t);
  const { id } = await (await req('/api/jobs', post({ prompt: 'tidal ocean', seed: 1 }))).json();
  assert.equal((await req('/api/jobs/' + id, { method: 'DELETE' })).status, 200);
  let job;
  for (let i = 0; i < 60; i++) {
    job = await (await req('/api/jobs/' + id)).json();
    if (job.status === 'cancelled') break;
    await wait(20);
  }
  assert.equal(job.status, 'cancelled');
  assert.deepEqual(await (await req('/api/gallery')).json(), []);
});

test('oversized JSON requests are rejected before creating a job', async (t) => {
  const { req, queue } = await server(t);
  assert.equal((await req('/api/jobs', post({ prompt: 'a'.repeat(9000) }))).status, 413);
  assert.equal(queue.jobs.size, 0);
});
