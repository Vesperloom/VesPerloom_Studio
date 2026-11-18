/** Default: an explicit, offline wire-protocol fixture for chat. With
 * VESPER_CHAT_TEST_HOME: a real installed GGUF snapshot. No model downloads here. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { createStudio } from '../server/api/app.mjs';
import { root } from '../server/config.mjs';
import { changeKey } from '../server/accounts/keys.mjs';
const base = await fs.mkdtemp(path.join(os.tmpdir(), 'vesper-desks-')),
  real = process.env.VESPER_CHAT_TEST_HOME,
  capture = process.env.VESPER_CAPTURE_DESKS === '1';
const key = await changeKey(base, 'add', 'field-studio');
const upstream = http.createServer(async (req, res) => {
  for await (const _ of req) {
  }
  res.writeHead(200, { 'Content-Type': 'text/event-stream' });
  res.write('data: {"choices":[{"delta":{"content":"Cobalt mountains"}}]}\n\n');
  setTimeout(
    () =>
      res.end(
        'data: {"choices":[{"delta":{"content":" under a moonlit sky."},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n',
      ),
    100,
  );
});
if (real) {
  await fs.mkdir(path.join(base, 'models'));
  await fs.symlink(
    path.join(real, 'models/qwen-small'),
    path.join(base, 'models/qwen-small'),
    'dir',
  );
}
await new Promise((r) => upstream.listen(0, '127.0.0.1', r));
const config = {
  url: `http://127.0.0.1:${upstream.address().port}/v1/chat/completions`,
  host: 'loopback fixture',
  model: 'fixture-model',
};
const { server, shutdown } = await createStudio({ base, provider: real ? null : config });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 1,
  });
  page.setDefaultTimeout(35000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(origin + '/#chat');
  await page.getByLabel('Studio token').fill(key);
  await page.getByRole('button', { name: 'Unlock studio' }).click();
  await page.getByRole('heading', { name: 'Studio chat' }).waitFor();
  assert.equal(
    await page.getByLabel('Chat engine').inputValue(),
    real ? 'qwen-small' : 'connected',
  );
  await page.getByLabel('Reply budget').selectOption('96');
  await page
    .getByLabel('Message', { exact: true })
    .fill(
      'Write one short English image prompt. Describe cobalt mountain peaks and a moonlit lake.',
    );
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await page.getByRole('button', { name: 'To image', exact: true }).waitFor();
  const reply = await page.locator('.message.assistant').innerText();
  assert.ok(reply.length > 10);
  console.log(real ? 'GGUF CPU answer:' : 'Wire fixture:', reply.slice(0, 160));
  if (capture && real) {
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(root, 'docs/media/chat.jpg'), quality: 89 });
  }
  await page.getByRole('button', { name: 'To image', exact: true }).click();
  const prompt = page.getByLabel('Prompt', { exact: true });
  const copied = await prompt.inputValue();
  assert.ok(copied.length > 10 && copied.length <= 600);
  await page.getByLabel('Seed', { exact: true }).fill('2026');
  await page.getByRole('button', { name: 'Generate image' }).click();
  await page.waitForFunction(() =>
    document.querySelector('.plate-id')?.textContent.startsWith('GENERATED'),
  );
  await page.getByRole('button', { name: 'Send plate to Video studio' }).click();
  await page.getByRole('heading', { name: 'Video studio' }).waitFor();
  assert.equal(await page.getByLabel('Scene prompt').inputValue(), copied);
  await page.getByLabel('Duration').selectOption('2');
  await page.getByLabel('Camera path').selectOption('arc');
  await page.getByRole('button', { name: 'Render clip' }).click();
  await page.waitForFunction(
    () => document.querySelector('.monitor .micro')?.textContent === 'SAVED SHOT',
  );
  const video = page.locator('.monitor video');
  await page.waitForFunction(() => {
    const v = document.querySelector('.monitor video');
    return v?.src.startsWith('blob:') && v.readyState >= 1;
  });
  await page.getByRole('button', { name: 'Play clip', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.monitor video').currentTime > 0.2);
  await page.getByRole('button', { name: 'Pause playback' }).click();
  await page.getByRole('button', { name: 'Seek to sample 5' }).click();
  assert.ok((await video.evaluate((v) => v.currentTime)) > 1.5);
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download MP4' }).click();
  const f = await dl;
  assert.match(f.suggestedFilename(), /\.mp4$/);
  const hdr = { Authorization: 'Bearer ' + key };
  const clips = await (await fetch(origin + '/api/clips', { headers: hdr })).json();
  const images = await (await fetch(origin + '/api/gallery', { headers: hdr })).json();
  assert.equal(clips.length, 1);
  assert.equal(clips[0].parent, images[0].id);
  assert.equal(clips[0].settings.seed, 2026);
  assert.equal(clips[0].settings.frames, 24);
  assert.equal((await fs.stat(await f.path())).size, clips[0].output.bytes);
  await page.getByRole('button', { name: /Meridian Crossing/ }).click();
  await page.waitForFunction(() => document.querySelector('.monitor video')?.readyState >= 2);
  if (capture && real) {
    await page.mouse.move(1, 1);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(root, 'docs/media/motion.jpg'), quality: 89 });
  }
  await page.getByLabel('Video engine').selectOption('wan-t2v');
  await page.getByText('Wan snapshot not installed', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Render clip' }).isEnabled(), false);
  await page.getByLabel('Video engine').selectOption('strata-motion');
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('button', { name: 'Studio chat', exact: true }).click();
  assert.equal(await page.locator('.message.assistant').innerText(), reply);
  await page.getByRole('button', { name: 'To video', exact: true }).click();
  assert.ok((await page.getByLabel('Scene prompt').inputValue()).length > 10);
  assert.deepEqual(errors, []);
  console.log(
    'PASS: named workspace, streamed chat → generated image → rendered private video, playback, seek, MP4 download, lineage, model setup and mobile handoff.',
  );
} finally {
  await browser?.close();
  shutdown();
  await new Promise((r) => server.close(r));
  upstream.closeAllConnections();
  await new Promise((r) => upstream.close(r));
  await fs.rm(base, { recursive: true, force: true });
}
