import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { home, root, web, releaseVersion } from '../config.mjs';
import { profile, catalog, installed } from '../../registry/index.mjs';
import { anyProfile, mediaCatalog } from '../../registry/modalities.mjs';
import { normalize, InputError } from '../runtime/options.mjs';
import { RenderStore, validId } from '../runtime/store.mjs';
import { JobQueue } from '../runtime/queue.mjs';
import { json, body, file } from './http.mjs';
import { VideoStore } from '../video/store.mjs';
import { videoSettings } from '../video/settings.mjs';
import { ChatService } from '../chat/service.mjs';
import { keyring } from '../accounts/keys.mjs';
export async function createStudio({
  base = home,
  token = process.env.VESPER_TOKEN || '',
  assets = web,
  provider,
} = {}) {
  const [studies, motionStudy] = await Promise.all(
    ['studies', 'motion-study'].map(async (name) =>
      JSON.parse(await fs.readFile(path.join(root, 'registry', name + '.json'), 'utf8')),
    ),
  );
  const keys = await keyring(base, token),
    chat = new ChatService(base, provider),
    spaces = new Map();
  function scope(owner) {
    if (!spaces.has(owner)) {
      const dir = owner === '_shared' ? base : path.join(base, 'workspaces', owner);
      const store = new RenderStore(dir, base),
        videos = new VideoStore(dir, base);
      const opening = Promise.all([store.open(), videos.open()])
        .then(() => ({ store, videos }))
        .catch((e) => {
          spaces.delete(owner);
          throw e;
        });
      spaces.set(owner, opening);
    }
    return spaces.get(owner);
  }
  const legacy = keys.named ? null : await scope('_shared');
  const queue = new JobQueue(async (s, ctx) => {
    const w = await scope(ctx.owner);
    return (s.modality === 'video' ? w.videos : w.store).run(s, ctx);
  });
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    try {
      const url = new URL(req.url, 'http://studio.invalid');
      let pathname;
      try {
        pathname = decodeURIComponent(url.pathname);
      } catch {
        throw new InputError('Invalid URL encoding.');
      }
      const get = req.method === 'GET',
        read = get || req.method === 'HEAD';
      if (pathname === '/api/health' && get)
        return json(res, 200, {
          status: 'ok',
          version: releaseVersion,
          authRequired: keys.required,
        });
      if (pathname.startsWith('/api/')) {
        const owner = keys.owner(req.headers.authorization);
        if (!read && req.headers['sec-fetch-site'] === 'cross-site')
          throw new InputError('Cross-site writes are not allowed.', 403);
        if (pathname === '/api/capabilities' && get)
          return json(res, 200, {
            workspace: owner === '_shared' ? 'Local workspace' : owner,
            isolated: keys.named,
            chat: chat.models(),
            video: [
              {
                id: 'strata-motion',
                name: 'Strata Motion',
                installed: true,
                local: true,
                kind: 'native',
                bytes: 58448,
              },
              ...mediaCatalog(base).filter((p) => p.modality === 'video'),
            ],
          });
        if (pathname === '/api/models' && get) return json(res, 200, catalog(base));
        if (pathname === '/api/studies' && get) return json(res, 200, studies);
        if (pathname === '/api/motion-study' && get) return json(res, 200, motionStudy);
        if (pathname === '/api/chat' && req.method === 'POST')
          return await chat.handle(await body(req, 65536), res);
        const { store, videos } = await scope(owner);
        if (pathname === '/api/gallery' && get) return json(res, 200, store.list());
        if (pathname === '/api/clips' && get) return json(res, 200, videos.list());
        if (['/api/jobs', '/api/video/jobs'].includes(pathname) && req.method === 'POST') {
          const input = await body(req),
            isVideo = pathname.includes('/video/');
          const options = isVideo ? videoSettings(input) : normalize(input),
            parent = input.parent ?? null;
          if (
            parent !== null &&
            !store.records.has(parent) &&
            !studies.some((s) => s.id === parent)
          )
            throw new InputError('Unknown parent render.');
          if (
            options.model !== 'strata-motion' &&
            !installed(isVideo ? anyProfile(options.model) : profile(options.model), base)
          )
            throw new InputError('Model is not installed on this server.', 409);
          return json(res, 202, queue.submit(options, parent, owner));
        }
        const job = /^\/api\/jobs\/([^/]+)$/.exec(pathname);
        if (job && (get || req.method === 'DELETE')) {
          const j = queue.jobs.get(job[1]);
          if (!j || j.owner !== owner) throw new InputError('Unknown job.', 404);
          return json(res, 200, get ? j : queue.cancel(j.id));
        }
        const media = /^\/api\/renders\/([^/]+)\/(image\.png|thumb\.png|capsule\.json)$/.exec(
          pathname,
        );
        if (read && media && validId(media[1]) && store.records.has(media[1]))
          return await file(req, res, path.join(store.dir, media[1], media[2]), true);
        const clip =
          /^\/api\/clips\/([^/]+)\/(clip\.mp4|review\.webm|poster\.png|strip\.png|recipe\.json)$/.exec(
            pathname,
          );
        if (read && clip && validId(clip[1]) && videos.records.has(clip[1]))
          return await file(req, res, path.join(videos.dir, clip[1], clip[2]), true);
        throw new InputError('Unknown API route.', 404);
      }
      if (!read) throw new InputError('Method not allowed.', 405);
      if (
        pathname.includes('\0') ||
        pathname.includes('\\') ||
        pathname.split('/').some((p) => p.startsWith('.'))
      )
        throw new InputError('Invalid asset path.', 404);
      const filename = path.resolve(assets, '.' + (pathname === '/' ? '/index.html' : pathname));
      if (!filename.startsWith(path.resolve(assets) + path.sep))
        throw new InputError('Invalid asset path.', 404);
      return await file(req, res, filename);
    } catch (e) {
      if (res.headersSent || res.destroyed) return;
      if (!e.status) console.error(e.message);
      json(res, e.status || 500, {
        error: e.status ? e.message : 'Studio could not complete the request.',
      });
    }
  });
  server.requestTimeout = 30_000;
  server.headersTimeout = 15_000;
  const shutdown = () => {
    queue.shutdown();
    chat.shutdown();
  };
  server.on('close', shutdown);
  return { server, queue, store: legacy?.store, chat, shutdown, authRequired: keys.required };
}
