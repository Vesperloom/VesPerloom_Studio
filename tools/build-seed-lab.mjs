/** Build the portable, offline demo. No user data or remote checkpoint is read. */
import { build } from 'esbuild';
import { readFile, writeFile, mkdir, copyFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { projectUrl, publicDemoUrl } from '../community/urls.mjs';
import { loadCheckpoint } from '../engine/strata/checkpoint.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const get = (p, enc = 'utf8') => readFile(path.join(root, p), enc);
const pages = process.argv.includes('--pages');
const config = JSON.parse(await get('community/links.json'));
const repo = projectUrl(process.env.VESPER_REPOSITORY_URL || config.repository),
  demo = publicDemoUrl(process.env.VESPER_DEMO_URL || config.demo);
const escape = (s) =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
loadCheckpoint(); // Fail the build if the shipped shard bytes don't match their recorded digests.
const bundle = async (entry, opts = {}) =>
  (
    await build({
      absWorkingDir: root,
      entryPoints: [entry],
      bundle: true,
      write: false,
      format: 'iife',
      target: 'es2020',
      platform: 'browser',
      minify: true,
      legalComments: 'none',
      ...opts,
    })
  ).outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const [kernel, client, template, css, font, logo, license, fontLicense] = await Promise.all([
  bundle('seed-lab/browser-engine.mjs', { globalName: 'VLKernel', loader: { '.f32': 'base64' } }),
  bundle('seed-lab/client.mjs', { define: { __PUBLIC_DEMO__: JSON.stringify(demo) } }),
  get('seed-lab/template.html'),
  get('seed-lab/design.css'),
  get('node_modules/@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2', 'base64'),
  get('app/public/brand/mark.svg'),
  get('LICENSE'),
  get('app/public/licenses/manrope.txt'),
]);
const social = demo
  ? `<meta property="og:url" content="${escape(demo)}"><meta property="og:image" content="${escape(new URL('social-preview.png', demo.endsWith('/') ? demo : demo.includes('.html') ? demo : demo + '/').href)}">`
  : '';
const values = {
  '<!--STAR-->': repo
    ? `<a href="${escape(repo)}" target="_blank" rel="noopener noreferrer">☆ Star on GitHub</a>`
    : '',
  '<!--SOCIAL-->': social,
  '<!--LOGO-->': logo,
  '<!--LOGO_DATA-->': Buffer.from(logo).toString('base64'),
  '/*STYLE*/': css.replace('FONT_DATA', font),
  '/*KERNEL*/': kernel,
  '/*CLIENT*/': client,
};
let html = template;
for (const [marker, value] of Object.entries(values)) html = html.replace(marker, () => value);
// Include the original license texts in the one-file distribution.
html = html.replace(
  '</body>',
  () => `<script type="text/plain" id="license-notices">${license}\n${fontLicense}</script></body>`,
);
if (pages) {
  if (!repo || !demo)
    throw Error(
      'The Pages build needs the actual repository and public demo URLs. Configure them or use the supplied Pages workflow.',
    );
  const out = path.join(root, '.output/pages');
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  await writeFile(path.join(out, 'index.html'), html);
  await writeFile(path.join(out, '.nojekyll'), '');
  await copyFile(
    path.join(root, 'docs/media/seed-lab-social.png'),
    path.join(out, 'social-preview.png'),
  );
  console.log(`Static Pages artifact: ${out}`);
} else {
  await writeFile(path.join(root, 'app/public/seed-lab.html'), html);
  console.log(
    `Seed Lab: ${(Buffer.byteLength(html) / 1024).toFixed(1)} KiB · one self-contained HTML file`,
  );
}
