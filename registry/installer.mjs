import fs from 'node:fs/promises';
import path from 'node:path';
import { createReadStream, createWriteStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { modelDir, manifestHash, installed } from './index.mjs';
import { home } from '../server/config.mjs';
export async function checkFile(file, entry) {
  try {
    const s = await fs.lstat(file);
    if (!s.isFile() || s.size !== entry.size) return false;
    const hash = createHash(entry.gitBlob ? 'sha1' : 'sha256');
    if (entry.gitBlob) hash.update(`blob ${entry.size}\0`);
    for await (const chunk of createReadStream(file)) hash.update(chunk);
    const digest = hash.digest('hex');
    // Gated Hubs may hide the raw LFS digest but publish the Git pointer blob ID.
    // Reconstruct the canonical pointer from the bytes we actually received.
    // Access to the file itself still requires upstream authorization.
    if (entry.gitLfsPointerBlob) {
      const pointer = Buffer.from(
        `version https://git-lfs.github.com/spec/v1\noid sha256:${digest}\nsize ${entry.size}\n`,
      );
      return (
        createHash('sha1').update(`blob ${pointer.length}\0`).update(pointer).digest('hex') ===
        entry.gitLfsPointerBlob
      );
    }
    return digest === (entry.sha256 || entry.gitBlob);
  } catch (e) {
    if (e.code === 'ENOENT') return false;
    throw e;
  }
}
export async function verifyProfile(p, base = home) {
  if (p.kind === 'native') {
    const { loadCheckpoint } = await import('../engine/strata/checkpoint.mjs');
    loadCheckpoint();
    return;
  }
  for (const entry of p.files)
    if (!(await checkFile(path.join(modelDir(p, base), entry.path), entry)))
      throw Error(`Missing or damaged: ${entry.path}`);
  if (!installed(p, base)) throw Error('Missing or outdated installation receipt.');
}
/** Fixed, versioned inventories. Never downloads Python or pickled checkpoints. */
export async function install(p, { base = home, source, log = console.log } = {}) {
  if (p.kind === 'native') {
    log('Strata-1 ships with Vesperloom.');
    return;
  }
  const final = modelDir(p, base),
    stage = final + '.staging',
    guard = final + '.lock';
  await fs.mkdir(path.dirname(final), { recursive: true });
  try {
    await fs.mkdir(guard);
  } catch (e) {
    if (e.code === 'EEXIST')
      throw Error(
        `Install lock exists: ${guard}. If no installer is active, remove this empty directory and retry.`,
      );
    throw e;
  }
  try {
    if (installed(p, base)) {
      log('Already installed. Use loom verify for a full integrity check.');
      return;
    }
    await fs.mkdir(stage, { recursive: true });
    for (const [i, entry] of p.files.entries()) {
      const dest = path.join(stage, entry.path);
      log(`[${i + 1}/${p.files.length}] ${entry.path}`);
      if (await checkFile(dest, entry)) continue;
      await fs.mkdir(path.dirname(dest), { recursive: true });
      const part = dest + '.partial';
      if (source) await fs.copyFile(path.join(source, entry.path), part);
      else {
        const headers = process.env.HF_TOKEN
          ? { Authorization: `Bearer ${process.env.HF_TOKEN}` }
          : {};
        const response = await fetch(
          `https://huggingface.co/${p.repo}/resolve/${p.revision}/${entry.path}`,
          { headers },
        );
        if (!response.ok || !response.body)
          throw Error(
            `Hub returned ${response.status} for ${entry.path}. Check disk, network, model terms and HF_TOKEN.`,
          );
        await pipeline(Readable.fromWeb(response.body), createWriteStream(part));
      }
      if (!(await checkFile(part, entry))) {
        await fs.rm(part, { force: true });
        throw Error(`Digest mismatch: ${entry.path}. No install was committed.`);
      }
      await fs.rename(part, dest);
    }
    await fs.writeFile(
      path.join(stage, 'vesper-receipt.json'),
      JSON.stringify(
        { revision: p.revision, manifest: manifestHash(p), installedAt: new Date().toISOString() },
        null,
        2,
      ),
    );
    // Do not replace a live model tree. A damaged older install must be removed explicitly.
    try {
      await fs.rename(stage, final);
    } catch (e) {
      if (e.code === 'EEXIST' || e.code === 'ENOTEMPTY')
        throw Error('An older installation exists. Remove it with loom remove, then retry.');
      throw e;
    }
    log(`Installed ${p.name} at ${final}`);
  } finally {
    await fs.rm(guard, { recursive: true, force: true });
  }
}
