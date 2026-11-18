/** Opt-in, real GGUF integration test. Install qwen-small in VESPER_HOME first.
 * Uses only its model folder; all output paths are a temporary test workspace. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { setTimeout as wait } from 'node:timers/promises';
import { createStudio } from '../server/api/app.mjs';
import { home } from '../server/config.mjs';
const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vesper-gguf-check-'));
let app;
try {
  await fs.mkdir(path.join(dir, 'models'));
  await fs.symlink(
    path.join(home, 'models/qwen-small'),
    path.join(dir, 'models/qwen-small'),
    'dir',
  );
  app = await createStudio({ base: dir, provider: null });
  assert.ok(
    app.chat.models().find((x) => x.id === 'qwen-small')?.ready,
    'Install the real CPU runtime and qwen-small via npm run chat:setup first.',
  );
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${app.server.address().port}/api/chat`;
  const post = (messages, maxTokens = 48, signal) =>
    fetch(url, {
      method: 'POST',
      signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages, maxTokens, model: 'qwen-small' }),
    });
  const messages = [
    { role: 'user', content: 'Remember the project name: Copper Meridian.' },
    { role: 'assistant', content: 'The project name is Copper Meridian.' },
    { role: 'user', content: 'What is the project name? Reply with just the name.' },
  ];
  const first = await post(messages);
  assert.equal(first.status, 200);
  const events = (await first.text())
    .trim()
    .split('\n')
    .map((x) => JSON.parse(x));
  assert.equal(events.at(-1).type, 'end');
  assert.equal(events.find((m) => m.type === 'ready').contextTurns, 3);
  const text = events
    .filter((m) => m.type === 'delta')
    .map((m) => m.text)
    .join('');
  assert.ok(text.trim().length > 0);
  console.log('Real multi-turn output:', text);
  const ctl = new AbortController();
  const r = await post(
    [{ role: 'user', content: 'Describe a landscape in detail in three long paragraphs.' }],
    384,
    ctl.signal,
  );
  const reader = r.body.getReader(),
    dec = new TextDecoder();
  let buf = '';
  while (!buf.includes('"type":"delta"')) {
    const item = await reader.read();
    assert.equal(item.done, false);
    buf += dec.decode(item.value);
  }
  const busy = await post(messages, 32);
  assert.equal(busy.status, 429);
  ctl.abort();
  await reader.cancel().catch(() => {});
  for (let i = 0; i < 150 && app.chat.active; i++) await wait(30);
  assert.equal(app.chat.active, null);
  const next = await post([{ role: 'user', content: 'Say hello in one word.' }], 12);
  assert.equal(next.status, 200);
  assert.match(await next.text(), /"type":"end"/);
  console.log(
    'PASS: real GGUF token stream, history, busy limit, browser disconnect stops worker, next turn succeeds.',
  );
} finally {
  if (app) {
    app.shutdown();
    await new Promise((r) => app.server.close(r));
  }
  await fs.rm(dir, { recursive: true, force: true });
}
