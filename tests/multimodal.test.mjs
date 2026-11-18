import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import pngjs from 'pngjs';
import { changeKey, keyring, readKeys } from '../server/accounts/keys.mjs';
import { createStudio } from '../server/api/app.mjs';
import { providerConfig, providerReply } from '../server/chat/provider.mjs';
import { chatInput } from '../server/chat/messages.mjs';
import { videoSettings } from '../server/video/settings.mjs';
import { VideoStore } from '../server/video/store.mjs';
import { cameraAt } from '../engine/motion/camera.mjs';
import { motionScene } from '../engine/motion/scene.mjs';
import { mediaProfiles, anyProfile } from '../registry/modalities.mjs';
import { JobQueue } from '../server/runtime/queue.mjs';
async function tmp(t) {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'vesper-media-'));
  t.after(() => fs.rm(base, { recursive: true, force: true }));
  return base;
}
const listen = async (s) => {
  await new Promise((r) => s.listen(0, '127.0.0.1', r));
  return 'http://127.0.0.1:' + s.address().port;
};
async function close(s) {
  s.closeAllConnections();
  await new Promise((r) => s.close(r));
}
async function studio(t, base, opts = {}) {
  const app = await createStudio({ base, ...opts });
  const url = await listen(app.server);
  t.after(async () => {
    app.shutdown();
    await close(app.server);
  });
  return (key, route, data, method, headers = {}) =>
    fetch(url + route, {
      method: method || (data ? 'POST' : 'GET'),
      headers: {
        ...(key ? { Authorization: 'Bearer ' + key } : {}),
        ...(data ? { 'content-type': 'application/json' } : {}),
        ...headers,
      },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
}
async function terminal(req, key, id) {
  for (let j = 0; j < 350; j++) {
    const state = await (await req(key, '/api/jobs/' + id)).json();
    if (['done', 'cancelled', 'failed'].includes(state.status)) return state;
    await sleep(75);
  }
  throw Error('Job deadline in test.');
}
test('registered GGUF and Wan inventories have pinned revisions, paths, sizes and digests', () => {
  assert.deepEqual(
    mediaProfiles.map((x) => x.files.length),
    [1, 2, 19],
  );
  for (const p of mediaProfiles) {
    assert.equal(anyProfile(p.id), p);
    assert.match(p.revision, /^[a-f0-9]{40}$/);
    assert.equal(
      p.files.reduce((n, f) => n + f.size, 0),
      p.bytes,
    );
    for (const f of p.files) {
      assert.ok(!f.path.startsWith('/') && !f.path.includes('..'));
      assert.match(f.sha256 || f.gitBlob, /^(?:[a-f0-9]{64}|[a-f0-9]{40})$/);
    }
  }
});
test('video geometry, budgets and temporal lattice are derived, never supplied dimensions', () => {
  const s = videoSettings({
    prompt: 'ice',
    frame: 'tall',
    fps: 24,
    size: 'hd',
    duration: 4,
    width: 99999,
  });
  assert.deepEqual([s.width, s.height, s.frames], [720, 1280, 96]);
  const w = videoSettings({ model: 'wan-t2v', prompt: 'fog', duration: 2 });
  assert.equal(w.frames, 33);
  assert.equal((w.frames - 1) % 4, 0);
  for (const v of [
    { fps: 100 },
    { frame: 'tiny' },
    { duration: 10 },
    { seed: -1 },
    { camera: 'x' },
    { steps: 1000 },
    { model: 'wan-t2v', strength: 42 },
    { model: 'wan-t2v', size: 'hd' },
  ])
    assert.throws(() => videoSettings({ prompt: 'moon', ...v }));
});
test('camera samples the same learned root for every path, then changes the world projection', () => {
  const s = { ...videoSettings({ prompt: 'cobalt sea', seed: 0 }), width: 96, height: 64 };
  const scene = motionScene(s),
    arc = motionScene({ ...s, camera: 'arc' });
  assert.deepEqual(scene.frame(0), arc.frame(0));
  assert.notDeepEqual(scene.frame(0), scene.frame(1));
  assert.notDeepEqual(scene.frame(0.5), arc.frame(0.5));
  assert.equal(cameraAt('dolly', 1, 100).z, 3.6);
  const still = motionScene({ ...s, strength: 0 });
  assert.deepEqual(still.frame(0), still.frame(1));
});
test('workspace key lifecycle, precedence, permissions and fail-closed empty registry', async (t) => {
  const base = await tmp(t);
  assert.equal((await keyring(base, 'shared')).owner('Bearer shared'), '_shared');
  const first = await changeKey(base, 'add', 'mira');
  const raw = await fs.readFile(path.join(base, 'accounts.json'), 'utf8');
  assert.ok(!raw.includes(first));
  if (process.platform !== 'win32')
    assert.equal((await fs.stat(path.join(base, 'accounts.json'))).mode & 0o777, 0o600);
  const ring = await keyring(base, 'shared');
  assert.equal(ring.owner('Bearer ' + first), 'mira');
  assert.throws(() => ring.owner('Bearer shared'));
  const next = await changeKey(base, 'rotate', 'mira');
  assert.notEqual(first, next);
  assert.throws(() => ring.owner('Bearer ' + next));
  await changeKey(base, 'revoke', 'mira');
  assert.deepEqual(await readKeys(base), []);
  const locked = await keyring(base, '');
  assert.ok(locked.required);
  assert.throws(() => locked.owner());
});
test('workspace queue limits two pending/running visual jobs per member', async () => {
  const q = new JobQueue(
    (s, { signal }) =>
      new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason))),
  );
  q.submit({}, null, 'mira');
  q.submit({}, null, 'mira');
  assert.throws(
    () => q.submit({}, null, 'mira'),
    (e) => e.status === 429,
  );
  assert.ok(q.submit({}, null, 'sol').id);
  q.shutdown();
});
test('private clips: end-to-end render, recipe, poster, filmstrip, byte ranges, isolation and restart', async (t) => {
  const base = await tmp(t),
    a = await changeKey(base, 'add', 'mira'),
    b = await changeKey(base, 'add', 'sol'),
    req = await studio(t, base);
  assert.equal((await req('', '/api/capabilities')).status, 401);
  const caps = await (await req(a, '/api/capabilities')).json();
  assert.equal(caps.workspace, 'mira');
  assert.ok(caps.isolated);
  assert.equal(caps.video[0].installed, true);
  const r = await req(a, '/api/video/jobs', {
    prompt: 'cobalt sea under the moon',
    duration: 2,
    seed: 81,
    frame: 'tall',
    parent: 'study-03',
  });
  assert.equal(r.status, 202);
  const { id } = await r.json();
  assert.equal((await req(b, '/api/jobs/' + id)).status, 404);
  const j = await terminal(req, a, id);
  assert.equal(j.status, 'done', j.error);
  const c = j.result;
  assert.equal(c.parent, 'study-03');
  assert.equal((await (await req(b, '/api/clips')).json()).length, 0);
  assert.equal((await req(b, c.url)).status, 404);
  const bytes = Buffer.from(await (await req(a, c.url)).arrayBuffer());
  assert.equal(bytes.toString('ascii', 4, 8), 'ftyp');
  assert.equal(createHash('sha256').update(bytes).digest('hex'), c.output.sha256);
  const range = await req(a, c.url, null, 'GET', { Range: 'bytes=4-13' });
  assert.equal(range.status, 206);
  assert.deepEqual(Buffer.from(await range.arrayBuffer()), bytes.subarray(4, 14));
  const suffix = await req(a, c.url, null, 'GET', { Range: 'bytes=-6' });
  assert.deepEqual(Buffer.from(await suffix.arrayBuffer()), bytes.subarray(-6));
  assert.equal((await req(a, c.url, null, 'GET', { Range: 'bytes=99999999-' })).status, 416);
  assert.equal((await req(a, c.url, null, 'HEAD')).headers.get('accept-ranges'), 'bytes');
  let p = pngjs.PNG.sync.read(Buffer.from(await (await req(a, c.poster)).arrayBuffer()));
  assert.deepEqual([p.width, p.height], [288, 512]);
  p = pngjs.PNG.sync.read(Buffer.from(await (await req(a, c.strip)).arrayBuffer()));
  assert.deepEqual([p.width, p.height], [640, 72]);
  assert.equal((await (await req(a, c.recipeUrl)).json()).output.frames, 24);
  const again = new VideoStore(path.join(base, 'workspaces', 'mira'), base);
  await again.open();
  assert.equal(again.list()[0].id, id);
});
test('uninstalled model paths report setup, and cancelled video never appears as a completed clip', async (t) => {
  const base = await tmp(t),
    req = await studio(t, base);
  assert.equal((await req('', '/api/video/jobs', { model: 'wan-t2v', prompt: 'ice' })).status, 409);
  assert.equal(
    (await req('', '/api/chat', { messages: [{ role: 'user', content: 'Hi' }] })).status,
    409,
  );
  const { id } = await (
    await req('', '/api/video/jobs', { prompt: 'ice', size: 'hd', duration: 4, fps: 24 })
  ).json();
  await req('', '/api/jobs/' + id, null, 'DELETE');
  assert.equal((await terminal(req, '', id)).status, 'cancelled');
  assert.deepEqual(await (await req('', '/api/clips')).json(), []);
  assert.deepEqual(await fs.readdir(path.join(base, 'clips')), []);
});
test('chat inputs enforce history, role, context and token limits', () => {
  const messages = [{ role: 'user', content: 'hi' }];
  assert.equal(chatInput({ messages }).messages[0].content, 'hi');
  for (const v of [
    { messages: [] },
    { messages: [{ role: 'system', content: 'x' }] },
    { messages: [...messages, ...messages] },
    { messages, maxTokens: 0 },
    { messages, model: 'unknown' },
    { messages: [{ role: 'user', content: 'x'.repeat(4001) }] },
  ])
    assert.throws(() => chatInput(v));
  assert.equal(providerConfig({}), null);
  assert.throws(() =>
    providerConfig({ VESPER_CHAT_BASE_URL: 'http://public.invalid', VESPER_CHAT_MODEL: 'test' }),
  );
});
test('chat provider normalizes split SSE events to NDJSON and keeps server configuration out of the UI', async (t) => {
  const base = await tmp(t);
  let captured;
  const remote = http.createServer(async (req, res) => {
    let body = '';
    for await (const x of req) body += x;
    captured = { req: JSON.parse(body), url: req.url, auth: req.headers.authorization };
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.write(': keepalive\r\n\r\nda');
    await sleep(8);
    res.end(
      'ta: {"choices":[{"delta":{"content":"Moon"}}]}\r\n\r\ndata: {"choices":[{"delta":{"content":" light"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n',
    );
  });
  const addr = await listen(remote);
  t.after(() => close(remote));
  const config = providerConfig({
    VESPER_CHAT_BASE_URL: addr + '/v1',
    VESPER_CHAT_MODEL: 'fixture-model',
    VESPER_CHAT_API_KEY: 'fixture-secret',
  });
  const req = await studio(t, base, { provider: config });
  const caps = await (await req('', '/api/capabilities')).json();
  assert.ok(!JSON.stringify(caps).includes('fixture-secret'));
  assert.equal(caps.chat.at(-1).local, false);
  const turns = [
    { role: 'user', content: 'start' },
    { role: 'assistant', content: 'ok' },
    { role: 'user', content: 'end' },
  ];
  const r = await req('', '/api/chat', { model: 'connected', messages: turns });
  assert.match(r.headers.get('content-type'), /ndjson/);
  const events = (await r.text())
    .trim()
    .split('\n')
    .map((x) => JSON.parse(x));
  assert.equal(
    events
      .filter((m) => m.type === 'delta')
      .map((m) => m.text)
      .join(''),
    'Moon light',
  );
  assert.equal(events.at(-1).type, 'end');
  assert.deepEqual(captured.req.messages.slice(1), turns);
  assert.equal(captured.auth, 'Bearer fixture-secret');
  assert.equal(captured.url, '/v1/chat/completions');
});
test('incomplete provider output is an error rather than a fabricated completed answer', async (t) => {
  const remote = http.createServer((_, r) => {
    r.writeHead(200, { 'Content-Type': 'text/event-stream' });
    r.end('data: {"choices":[{"delta":{"content":"unfinished"}}]}\n\n');
  });
  const url = await listen(remote);
  t.after(() => close(remote));
  await assert.rejects(async () => {
    for await (const _ of providerReply(
      { url, model: 'test' },
      chatInput({ messages: [{ role: 'user', content: 'Hi' }] }),
      new AbortController().signal,
    )) {
    }
  }, /before completion/);
});

test('motion recipes require exact identity, seed, frame budget and output geometry', async () => {
  const { readMotionRecipe } = await import('../server/video/recipe.mjs');
  const baseline = JSON.parse(
    await fs.readFile(new URL('../app/public/reels/meridian/recipe.json', import.meta.url), 'utf8'),
  );
  assert.equal(readMotionRecipe(baseline).seed, 41928);
  for (const mod of [
    (r) => delete r.settings.seed,
    (r) => delete r.settings.steps,
    (r) => r.output.width++,
    (r) => (r.output.sha256 = 'x'),
    (r) => (r.model.revision = 'wrong'),
    (r) => (r.model.id = 'other'),
    (r) => (r.settings.fps = 24),
  ]) {
    const c = structuredClone(baseline);
    mod(c);
    assert.throws(() => readMotionRecipe(c));
  }
});
