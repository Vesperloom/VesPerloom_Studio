/** Optional browser integration test: isolated loopback server and temporary data. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { chromium } from 'playwright';
import { createStudio } from '../server/api/app.mjs';
import { root } from '../server/config.mjs';
const base = await fs.mkdtemp(path.join(os.tmpdir(), 'vesper-browser-'));
const token = 'temporary-browser-test';
const { server, queue } = await createStudio({ base, token });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  page.setDefaultTimeout(12000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.getByLabel('Studio token').fill(token);
  await page.getByRole('button', { name: 'Unlock studio' }).click();
  await page.getByRole('heading', { name: 'Image studio' }).waitFor();
  await page.locator('.hero-art').evaluate((img) => img.decode());
  assert.equal(
    await page.getByRole('link', { name: 'Telegram channel', exact: true }).getAttribute('href'),
    'https://t.me/vesperloom7',
  );
  const labLink = page.getByRole('link', { name: 'Remix this plate in Seed Lab' });
  const demoPath = await labLink.getAttribute('href');
  assert.match(demoPath, /^\/seed-lab\.html#r=VL1\./);
  const demo = await browser.newPage();
  await demo.goto(`http://127.0.0.1:${server.address().port}` + demoPath);
  await demo.waitForFunction(() => document.querySelector('#art')?.dataset.code);
  assert.equal(await demo.locator('#art').getAttribute('data-code'), demoPath.split('#r=')[1]);
  await demo.close();
  await page.getByRole('button', { name: 'Explore seed drift' }).click();
  await page.getByLabel('Prompt', { exact: true }).fill('A cobalt sea beneath an immense moon.');
  await page.getByLabel('Seed', { exact: true }).fill('7');
  await page.getByRole('button', { name: '1:1', exact: true }).click();
  await page.getByRole('button', { name: 'Generate image' }).click();
  await page.waitForFunction(() =>
    document.querySelector('.plate-id')?.textContent.startsWith('GENERATED'),
  );
  await page.waitForFunction(() => {
    const i = document.querySelector('.hero-art');
    return i?.src.startsWith('blob:') && i.complete && i.naturalWidth === 768;
  });
  const rows = await (
    await fetch(`http://127.0.0.1:${server.address().port}/api/gallery`, {
      headers: { Authorization: 'Bearer ' + token },
    })
  ).json();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].settings.seed, 7);
  assert.equal(rows[0].settings.drift, 17);
  assert.equal(rows[0].parent, 'study-01');
  await page.getByRole('button', { name: 'Export image or replay capsule' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /Replay capsule Seed/ }).click();
  assert.match((await download).suggestedFilename(), /\.capsule\.json$/);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Gallery', exact: true }).click();
  await page.getByRole('button', { name: 'My renders' }).click();
  assert.equal(await page.locator('.gallery-card').count(), 1);
  await page.getByLabel('Search gallery').fill('nonmatching');
  await page.getByRole('heading', { name: 'No matching plates' }).waitFor();
  await page
    .locator('input[type=file]')
    .setInputFiles(path.join(root, 'app/public/studies/study-03.json'));
  await page.getByRole('heading', { name: 'Image studio' }).waitFor();
  assert.equal(await page.getByLabel('Seed', { exact: true }).inputValue(), '692104');
  await page.getByRole('button', { name: 'Model library', exact: true }).click();
  assert.equal(await page.locator('.model-card').count(), 5);
  await page.getByRole('button', { name: 'Model details' }).nth(1).click();
  await page.getByRole('dialog').waitFor();
  assert.match(await page.getByRole('dialog').innerText(), /pull sd15/);
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  assert.ok(await page.getByRole('link', { name: 'Telegram channel', exact: true }).isVisible());
  await page.getByRole('button', { name: 'Image studio', exact: true }).click();
  await page.getByRole('heading', { name: 'Image studio' }).waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.reload();
  await page.getByLabel('Studio token').waitFor();
  assert.deepEqual(errors, []);
  console.log(
    'PASS: login, branch, generate, private PNG, capsule export/import, gallery, registry and mobile navigation.',
  );
} finally {
  await browser?.close();
  queue.shutdown();
  await new Promise((r) => server.close(r));
  await fs.rm(base, { recursive: true, force: true });
}
