/** Exercise the exact downloadable artifact from file://, with all networking disabled. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import pngjs from 'pngjs';
import { root } from '../server/config.mjs';
import { encode, fromPlate, weekly } from '../seed-lab/recipe.mjs';
const studies = JSON.parse(await fs.readFile(path.join(root, 'registry/studies.json'), 'utf8'));
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ offline: true, viewport: { width: 1150, height: 860 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  const errors = [],
    remote = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    if (/^https?:/.test(r.url())) remote.push(r.url());
  });
  const url = pathToFileURL(path.join(root, 'app/public/seed-lab.html')).href;
  const waitFor = (code) =>
    page.waitForFunction((c) => document.querySelector('#art').dataset.code === c, code);
  for (const study of studies) {
    const code = encode(fromPlate(study));
    await page.goto(url + '#r=' + code);
    await waitFor(code);
    const digest = await page.locator('#art').evaluate(async (c) => {
      const bytes = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      const d = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
      return [...d].map((n) => n.toString(16).padStart(2, '0')).join('');
    });
    assert.equal(digest, study.output.pixelSha256, study.title);
  }
  assert.equal(
    await page.locator('header .channel').getAttribute('href'),
    'https://t.me/vesperloom7',
  );
  await page.locator('#weekly').click();
  const w = weekly();
  await waitFor(encode(w.recipe));
  await page.locator('#drift').fill('65');
  await waitFor(encode({ ...w.recipe, drift: 65 }));
  await page.locator('summary').click();
  const code = encode(fromPlate(studies[0]));
  await page.locator('#code').fill(code);
  await page.getByRole('button', { name: 'Load composition' }).click();
  await waitFor(code);
  await page.locator('summary').click();
  const downloaded = page.waitForEvent('download');
  await page.locator('#postcard').click();
  const card = await downloaded;
  const data = pngjs.PNG.sync.read(await fs.readFile(await card.path()));
  assert.equal(data.width, 1200);
  assert.equal(data.height, 630);
  assert.ok(card.suggestedFilename().endsWith('.png'));
  if (process.env.VESPER_CAPTURE_LAUNCH === '1') {
    await card.saveAs(path.join(root, 'docs/media/seed-lab-social.png'));
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: path.join(root, 'docs/media/seed-lab.jpg'),
      type: 'jpeg',
      quality: 88,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.body.scrollWidth <= innerWidth));
  assert.deepEqual(remote, []);
  assert.deepEqual(errors, []);
  // Some sandboxed file viewers disallow Blob workers. Run the same kernel on a deferred main thread.
  const fallback = await ctx.newPage();
  await fallback.addInitScript(() => {
    window.Worker = function () {
      throw Error('Worker unavailable');
    };
  });
  await fallback.goto(url);
  await fallback.waitForFunction(() => document.querySelector('#art')?.dataset.code);
  assert.equal(await fallback.locator('#art').getAttribute('data-code'), code);
  console.log(
    'PASS: offline HTML, 4 browser/Node golden pixel matches, weekly seed, drift, seed code import, 1200×630 postcard, Telegram link, mobile layout and worker fallback.',
  );
} finally {
  await browser.close();
}
