import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { root } from '../server/config.mjs';
const cmd = promisify(execFile);
const run = (...args) => cmd(process.execPath, [path.join(root, 'bin/loom.mjs'), ...args]);
test('CLI run and replay round-trip the real native model', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'loom-cli-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const f = path.join(dir, 'plate.png'),
    g = path.join(dir, 'again.png');
  await run('run', 'strata-1', '--prompt', 'glacial peaks', '--seed', '0', '--out', f);
  await run('replay', f + '.capsule.json', '--out', g);
  assert.deepEqual(await fs.readFile(f), await fs.readFile(g));
  const c = JSON.parse(await fs.readFile(f + '.capsule.json'));
  c.output.pixelSha256 = '0'.repeat(64);
  await fs.writeFile(f + '.capsule.json', JSON.stringify(c));
  await assert.rejects(run('replay', f + '.capsule.json', '--out', g), /differs/);
});
test('CLI rejects unknown models without starting inference', async () => {
  await assert.rejects(run('run', 'typo', '--prompt', 'hello'), /Unknown model/);
});
