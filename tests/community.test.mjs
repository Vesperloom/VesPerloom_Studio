import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  first,
  encode,
  decode,
  inputs,
  fromPlate,
  weekly,
  remixHref,
} from '../seed-lab/recipe.mjs';
import { projectUrl, publicDemoUrl } from '../community/urls.mjs';
import { section, files } from '../community/readme-links.mjs';
const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const links = JSON.parse(read('community/links.json'));
test('public seed codes round-trip boundary seeds, frames, drift and sky flags', () => {
  for (const seed of [0, 41928, 4294967295])
    for (const aspect of ['3:2', '1:1', '16:9', '4:5'])
      for (const flags of [0, 5, 7]) {
        const r = { ...first, seed, aspect, flags, drift: 100, steps: 48 };
        assert.deepEqual(decode(encode(r)), r);
        assert.equal(inputs(r).tags.ringed, !!(flags & 1));
      }
});
test('seed parser rejects unversioned, oversized and invalid recipes', () => {
  for (const x of [
    'VL2.dunes.copper.3x2.1.24.0.1',
    'VL1.unknown.copper.3x2.1.24.0.1',
    'VL1.dunes.copper.3x2.4294967296.24.0.5',
    'VL1.dunes.copper.3x2.0.0.0.0',
    'VL1.dunes.copper.3x2.0.24.101.0',
    'VL1.dunes.copper.3x2.0.24.0.8',
    'x'.repeat(300),
    null,
  ])
    assert.throws(() => decode(x));
});
test('studio-to-lab transfers only render controls, never prompt, session or output URLs', () => {
  const plates = JSON.parse(read('registry/studies.json'));
  for (const p of plates) {
    const r = fromPlate({ ...p, settings: { ...p.settings, prompt: 'not public' } });
    const { tags, settings } = inputs(r);
    assert.deepEqual(tags, p.tags);
    assert.equal(settings.width, p.settings.width);
    assert.equal(settings.height, p.settings.height);
    assert.equal(decode(encode(r)).seed, p.settings.seed);
    assert.ok(!encode(r).includes('not public'));
  }
  assert.throws(() => fromPlate({ settings: { model: 'sdxl' } }), /native/);
});
test('weekly roots switch on Monday UTC and agree across local time zones', () => {
  const a = weekly(new Date('2026-01-04T23:59:59Z')),
    b = weekly(new Date('2026-01-05T00:00:00Z'));
  assert.equal(a.id, '2025-12-29');
  assert.equal(b.id, '2026-01-05');
  assert.notEqual(a.recipe.seed, b.recipe.seed);
  assert.deepEqual(b, weekly(new Date('2026-01-11T09:00:00-06:00')));
  assert.deepEqual(decode(encode(b.recipe)), b.recipe);
});
test('star and public remix targets are opt-in, cleaned, and validated', () => {
  assert.equal(projectUrl(''), null);
  assert.equal(publicDemoUrl(null), null);
  assert.equal(
    projectUrl('https://github.com/example/test.git'),
    'https://github.com/example/test',
  );
  for (const x of [
    'https://github.com.evil.example/x/y',
    'https://github.com/a/b/stargazers',
    'https://github.com/a/b?token=a',
  ])
    assert.throws(() => projectUrl(x));
  for (const x of [
    'file:///tmp/lab',
    'http://localhost/',
    'https://demo.example/?token=private',
    'https://admin:secret@demo.example/',
  ])
    assert.throws(() => publicDemoUrl(x));
  const url = new URL(remixHref('https://demo.example/project/?private=x#old', first));
  assert.equal(url.search, '');
  assert.equal(url.pathname, '/project/');
  assert.deepEqual(decode(new URLSearchParams(url.hash.slice(1)).get('r')), first);
});
test('every localized README has the configured Telegram channel and current launch links', () => {
  assert.equal(links.telegram, 'https://t.me/vesperloom7');
  for (const f of files) {
    const text = read(f);
    assert.ok(text.includes(section(f, links)), f);
    assert.ok(text.indexOf(links.telegram) < text.indexOf('\n# Vesperloom'));
  }
  assert.ok(read('.github/ISSUE_TEMPLATE/config.yml').includes(links.telegram));
});
