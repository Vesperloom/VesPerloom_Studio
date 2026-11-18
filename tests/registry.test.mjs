import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { profiles, installed, modelDir } from '../registry/index.mjs';
import { install, verifyProfile, checkFile } from '../registry/installer.mjs';
test('external inventories pin revisions, sizes and immutable digests for safe file types', () => {
  for (const p of profiles.filter((p) => p.kind === 'external')) {
    assert.match(p.revision, /^[a-f0-9]{40}$/);
    assert.equal(
      p.files.reduce((n, f) => n + f.size, 0),
      p.bytes,
    );
    assert.equal(new Set(p.files.map((f) => f.path)).size, p.files.length);
    for (const f of p.files) {
      assert.ok(!f.path.split('/').includes('..'));
      assert.match(f.path, /\.(json|safetensors|txt|model)$/);
      assert.match(
        f.sha256 || f.gitBlob || f.gitLfsPointerBlob,
        f.sha256 ? /^[0-9a-f]{64}$/ : /^[0-9a-f]{40}$/,
      );
    }
  }
});
async function fixture(t) {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'loom-reg-'));
  t.after(() => fs.rm(base, { recursive: true, force: true }));
  const source = path.join(base, 'source');
  await fs.mkdir(source);
  const blob = Buffer.from('test weights'),
    config = Buffer.from('{}');
  const files = [
    {
      path: 'model_index.json',
      size: 2,
      gitBlob: createHash('sha1').update('blob 2\0{}').digest('hex'),
    },
    {
      path: 'weights.safetensors',
      size: blob.length,
      sha256: createHash('sha256').update(blob).digest('hex'),
    },
  ];
  await fs.writeFile(path.join(source, files[0].path), config);
  await fs.writeFile(path.join(source, files[1].path), blob);
  const p = { id: 'fixture', kind: 'external', revision: 'fixture', files };
  return { base, source, blob, p, log: () => {} };
}
test('offline import verifies both Git blobs and large-file digests before commit', async (t) => {
  const f = await fixture(t);
  assert.equal(installed(f.p, f.base), false);
  await install(f.p, f);
  assert.equal(installed(f.p, f.base), true);
  await verifyProfile(f.p, f.base);
  await fs.writeFile(
    path.join(modelDir(f.p, f.base), 'weights.safetensors'),
    Buffer.alloc(f.blob.length),
  );
  await assert.rejects(verifyProfile(f.p, f.base), /damaged/);
});
test('failed import never becomes ready and completed staged files are reusable', async (t) => {
  const f = await fixture(t);
  await fs.writeFile(path.join(f.source, 'weights.safetensors'), 'wrong');
  await assert.rejects(install(f.p, f), /mismatch/);
  assert.equal(installed(f.p, f.base), false);
  await fs.unlink(path.join(f.source, 'model_index.json'));
  await fs.writeFile(path.join(f.source, 'weights.safetensors'), f.blob);
  await install(f.p, f);
  assert.equal(installed(f.p, f.base), true);
});
test('native install and verify need neither tensor runtime nor network', async () => {
  const m = profiles[0];
  await install(m, { log: () => {} });
  await verifyProfile(m);
  assert.equal(installed(m), true);
});

test('gated snapshots verify an LFS pointer blob without relying on masked digests', async (t) => {
  const f = await fixture(t);
  const digest = createHash('sha256').update(f.blob).digest('hex');
  const text = `version https://git-lfs.github.com/spec/v1\noid sha256:${digest}\nsize ${f.blob.length}\n`;
  const entry = {
    size: f.blob.length,
    gitLfsPointerBlob: createHash('sha1')
      .update(`blob ${Buffer.byteLength(text)}\0`)
      .update(text)
      .digest('hex'),
  };
  const file = path.join(f.source, 'weights.safetensors');
  assert.equal(await checkFile(file, entry), true);
  await fs.writeFile(file, Buffer.alloc(f.blob.length));
  assert.equal(await checkFile(file, entry), false);
});
