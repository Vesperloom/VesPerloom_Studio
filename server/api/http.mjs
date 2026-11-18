import fs from 'node:fs/promises';
import path from 'node:path';
import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { createHash, timingSafeEqual } from 'node:crypto';
import { InputError } from '../runtime/options.mjs';
const hash = (s) => createHash('sha256').update(s).digest();
export const authorized = (token, header = '') =>
  !token || (header.startsWith('Bearer ') && timingSafeEqual(hash(token), hash(header.slice(7))));
export function json(res, status, value) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(value));
}
export async function body(req, maxBytes = 8192) {
  if (req.headers['content-type']?.split(';')[0] !== 'application/json')
    throw new InputError('Use application/json.', 415);
  if (Number(req.headers['content-length'] || 0) > maxBytes)
    throw new InputError('Request body is too large.', 413);
  const chunks = [];
  let size = 0;
  for await (const b of req) {
    size += b.length;
    if (size > maxBytes) throw new InputError('Request body is too large.', 413);
    chunks.push(b);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new InputError('Invalid JSON.');
  }
}
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};
export async function file(req, res, f, privateFile = false) {
  let s;
  try {
    s = await fs.stat(f);
  } catch {
    throw new InputError('File not found.', 404);
  }
  if (!s.isFile()) throw new InputError('File not found.', 404);
  let start = 0,
    end = s.size - 1,
    status = 200;
  const isVideo = ['.mp4', '.webm'].includes(path.extname(f));
  if (isVideo && req.headers.range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    if (m && (m[1] || m[2])) {
      if (!m[1]) {
        start = Math.max(0, s.size - Number(m[2]));
      } else {
        start = Number(m[1]);
        end = m[2] ? Math.min(end, Number(m[2])) : end;
      }
    } else start = s.size;
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start > end ||
      start >= s.size
    ) {
      res.writeHead(416, { 'Content-Range': 'bytes */' + s.size });
      res.end();
      return;
    }
    status = 206;
  }
  res.writeHead(status, {
    ...(isVideo ? { 'Accept-Ranges': 'bytes' } : {}),
    ...(status === 206 ? { 'Content-Range': `bytes ${start}-${end}/${s.size}` } : {}),
    'Content-Type': types[path.extname(f)] || 'application/octet-stream',
    'Content-Length': status === 206 ? end - start + 1 : s.size,
    'Cache-Control': privateFile
      ? 'private, no-store'
      : f.includes(`${path.sep}assets${path.sep}`)
        ? 'public, max-age=31536000, immutable'
        : 'no-cache',
  });
  if (req.method === 'HEAD') return res.end();
  await pipeline(createReadStream(f, status === 206 ? { start, end } : undefined), res);
}
