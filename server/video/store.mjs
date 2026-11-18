import fs from 'node:fs/promises';
import { renameSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { validId } from '../runtime/store.mjs';
import { renderVideo } from './execute.mjs';
import { motionIdentity } from './recipe.mjs';
export async function videoRecipe(
  work,
  settings,
  { tags, pixelStreamSha256 },
  elapsedMs,
  parent = null,
) {
  const mp4 = await fs.readFile(path.join(work, 'clip.mp4'));
  return {
    schema: 'vesperloom.motion/v1',
    renderer: '1.0.0',
    settings,
    model: motionIdentity(settings),
    tags,
    parent,
    elapsedMs,
    output: {
      codec: 'h264',
      container: 'mp4',
      frames: settings.frames,
      fps: settings.fps,
      seconds: settings.frames / settings.fps,
      width: settings.width,
      height: settings.height,
      bytes: mp4.length,
      pixelStreamSha256,
      sha256: createHash('sha256').update(mp4).digest('hex'),
    },
  };
}
export class VideoStore {
  constructor(dir, modelBase) {
    this.dir = path.join(dir, 'clips');
    this.modelBase = modelBase;
    this.records = new Map();
  }
  async open() {
    await fs.mkdir(this.dir, { recursive: true });
    for (const n of await fs.readdir(this.dir)) {
      if (n.startsWith('.work-')) {
        await fs.rm(path.join(this.dir, n), { recursive: true, force: true });
        continue;
      }
      if (!validId(n)) continue;
      try {
        const r = JSON.parse(await fs.readFile(path.join(this.dir, n, 'record.json'), 'utf8'));
        if (r.id === n) this.records.set(n, r);
      } catch {
        console.warn('Skipping incomplete clip record.');
      }
    }
    await this.trim();
  }
  list() {
    return [...this.records.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async trim() {
    for (const r of this.list().slice(16)) {
      await fs.rm(path.join(this.dir, r.id), { recursive: true, force: true });
      this.records.delete(r.id);
    }
  }
  async run(settings, { id, parent, signal, onProgress }) {
    const work = path.join(this.dir, '.work-' + id);
    await fs.mkdir(work);
    const start = performance.now();
    try {
      const result = await renderVideo(settings, work, {
        base: this.modelBase,
        signal,
        onProgress,
      });
      signal.throwIfAborted();
      const recipe = await videoRecipe(
        work,
        settings,
        result,
        Math.round(performance.now() - start),
        parent,
      );
      const route = '/api/clips/' + id;
      const record = {
        id,
        kind: 'clip',
        title: settings.prompt.length > 54 ? settings.prompt.slice(0, 51) + '…' : settings.prompt,
        createdAt: new Date().toISOString(),
        url: route + '/clip.mp4',
        review: route + '/review.webm',
        poster: route + '/poster.png',
        strip: route + '/strip.png',
        recipeUrl: route + '/recipe.json',
        ...recipe,
      };
      await Promise.all([
        fs.writeFile(path.join(work, 'record.json'), JSON.stringify(record)),
        fs.writeFile(path.join(work, 'recipe.json'), JSON.stringify(recipe, null, 2) + '\n'),
      ]);
      signal.throwIfAborted();
      renameSync(work, path.join(this.dir, id));
      this.records.set(id, record);
      await this.trim().catch(() => console.warn('Clip retention cleanup was deferred.'));
      return record;
    } finally {
      await fs.rm(work, { force: true, recursive: true });
    }
  }
}
