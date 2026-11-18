import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { RenderStore } from '../server/runtime/store.mjs';
import { limits } from '../server/config.mjs';
test('recovery removes uncommitted work and retains only the latest records', async (t) => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'loom-store-'));
  t.after(() => fs.rm(base, { recursive: true, force: true }));
  const store = new RenderStore(base);
  await fs.mkdir(path.join(store.dir, '.work-interrupted'), { recursive: true });
  let first;
  for (let i = 0; i < limits.stored + 1; i++) {
    const id = randomUUID();
    if (!first) first = id;
    const dir = path.join(store.dir, id);
    await fs.mkdir(dir);
    await fs.writeFile(
      path.join(dir, 'record.json'),
      JSON.stringify({ id, createdAt: new Date(1000 * i).toISOString() }),
    );
  }
  await store.open();
  assert.equal(store.list().length, limits.stored);
  assert.ok(!store.records.has(first));
  assert.equal((await fs.readdir(store.dir)).length, limits.stored);
});
