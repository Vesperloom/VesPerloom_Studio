import fs from 'node:fs/promises';
import { renameSync } from 'node:fs';
import path from 'node:path';
import { capture, thumbnail } from './capsule.mjs';
import { execute } from './execute.mjs';
import { limits } from '../config.mjs';
export const validId = (s) =>
  typeof s === 'string' &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(s);
export class RenderStore {
  constructor(base, modelBase = base) {
    this.base = modelBase;
    this.dir = path.join(base, 'renders');
    this.records = new Map();
  }
  async open() {
    await fs.mkdir(this.dir, { recursive: true });
    for (const name of await fs.readdir(this.dir)) {
      if (name.startsWith('.work-')) {
        await fs.rm(path.join(this.dir, name), { recursive: true, force: true });
        continue;
      }
      if (!validId(name)) continue;
      try {
        const r = JSON.parse(await fs.readFile(path.join(this.dir, name, 'record.json'), 'utf8'));
        if (r.id === name) this.records.set(name, r);
      } catch {
        console.warn(`Skipping incomplete render ${name}`);
      }
    }
    await this.trim();
  }
  list() {
    return [...this.records.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async trim() {
    for (const old of this.list().slice(limits.stored)) {
      await fs.rm(path.join(this.dir, old.id), { recursive: true, force: true });
      this.records.delete(old.id);
    }
  }
  async run(settings, { id, parent, signal, onProgress }) {
    const work = path.join(this.dir, '.work-' + id),
      out = path.join(work, 'image.png');
    await fs.mkdir(work);
    const start = performance.now();
    try {
      const tags = await execute(settings, out, { base: this.base, signal, onProgress });
      signal.throwIfAborted();
      const png = await fs.readFile(out);
      const { capsule, image } = capture(png, settings, {
        tags,
        parent,
        elapsedMs: Math.round(performance.now() - start),
      });
      const api = `/api/renders/${id}`;
      const title = settings.prompt.replace(/[.!?]+$/, '');
      const r = {
        id,
        kind: 'render',
        title: title.length > 55 ? title.slice(0, 52).trimEnd() + '…' : title,
        createdAt: new Date().toISOString(),
        image: api + '/image.png',
        thumb: api + '/thumb.png',
        capsuleUrl: api + '/capsule.json',
        ...capsule,
      };
      await Promise.all([
        fs.writeFile(path.join(work, 'record.json'), JSON.stringify(r)),
        fs.writeFile(path.join(work, 'capsule.json'), JSON.stringify(capsule, null, 2) + '\n'),
        fs.writeFile(path.join(work, 'thumb.png'), thumbnail(image)),
      ]);
      signal.throwIfAborted();
      renameSync(work, path.join(this.dir, id));
      this.records.set(id, r);
      // One queued writer per store: old-record cleanup cannot undo the new commit.
      await this.trim().catch((e) => console.warn(`Retention cleanup: ${e.message}`));
      return r;
    } finally {
      await fs.rm(work, { recursive: true, force: true });
    }
  }
}
