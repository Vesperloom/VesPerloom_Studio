/** Small, bounded WebM review proxy, not a general-purpose muxer. One silent VP8
 * track, one cluster (<5 s), all keyframes and an explicit duration/seek index. */
import fs from 'node:fs/promises';
import makeWebp from '@jsquash/webp/codec/enc/webp_enc.js';
import { defaultOptions } from '@jsquash/webp/meta.js';
const tag = (s) => Buffer.from(s, 'hex'),
  cat = (items) => Buffer.concat(items);
function uint(n, width) {
  const b = Buffer.alloc(width || Math.max(1, Math.ceil(Math.log2(n + 1) / 8)));
  b.writeUIntBE(n, 0, b.length);
  return b;
}
function el(id, payload) {
  const b = Array.isArray(payload)
    ? cat(payload)
    : Buffer.isBuffer(payload)
      ? payload
      : Buffer.from(payload);
  let w = 1;
  while (b.length >= 2 ** (7 * w) - 1) w++;
  const size = uint(b.length, w);
  size[0] |= 1 << (8 - w);
  return cat([tag(id), size, b]);
}
const num = (id, n, w) => el(id, uint(n, w));
function float(v) {
  const b = Buffer.alloc(8);
  b.writeDoubleBE(v);
  return b;
}
export function muxVp8(packets, width, height, fps) {
  const header = el('1a45dfa3', [
    num('4286', 1),
    num('42f7', 1),
    num('42f2', 4),
    num('42f3', 8),
    el('4282', 'webm'),
    num('4287', 2),
    num('4285', 2),
  ]);
  const info = el('1549a966', [
    num('2ad7b1', 1000000),
    el('4d80', 'Vesperloom'),
    el('5741', 'Vesperloom'),
    el('4489', float((packets.length * 1000) / fps)),
  ]);
  const tracks = el('1654ae6b', [
    el('ae', [
      num('d7', 1),
      num('73c5', 1),
      num('83', 1),
      num('9c', 0),
      el('86', 'V_VP8'),
      num('23e383', Math.round(1e9 / fps)),
      el('e0', [num('b0', width), num('ba', height)]),
    ]),
  ]);
  const blocks = [num('e7', 0)],
    offsets = [];
  let offset = blocks[0].length;
  for (const [i, packet] of packets.entries()) {
    const tick = Math.round((i * 1000) / fps),
      h = Buffer.from([0x81, 0, 0, 0x80]);
    h.writeInt16BE(tick, 1);
    offsets.push([tick, offset]);
    const block = el('a3', [h, packet]);
    blocks.push(block);
    offset += block.length;
  }
  const cluster = el('1f43b675', blocks);
  const seek = (target, pos) => el('4dbb', [el('53ab', tag(target)), num('53ac', pos, 4)]);
  const head = (i, t, c) =>
    el('114d9b74', [seek('1549a966', i), seek('1654ae6b', t), seek('1c53bb6b', c)]);
  const p = head(0, 0, 0).length,
    cp = p + info.length + tracks.length;
  const cues = el(
    '1c53bb6b',
    offsets.map(([ts, rel]) =>
      el('bb', [num('b3', ts), el('b7', [num('f7', 1), num('f1', cp), num('f0', rel)])]),
    ),
  );
  return cat([
    header,
    el('18538067', [head(p, p + info.length, cp + cluster.length), info, tracks, cluster, cues]),
  ]);
}
function vp8(buf) {
  const b = Buffer.from(buf);
  for (let i = 12; i + 8 <= b.length; ) {
    const size = b.readUInt32LE(i + 4);
    if (i + 8 + size > b.length) break;
    if (b.toString('ascii', i, i + 4) === 'VP8 ') return b.subarray(i + 8, i + 8 + size);
    i += 8 + size + (size % 2);
  }
  throw Error('Expected a lossy VP8 frame from the proxy encoder.');
}
export async function reviewProxy(s) {
  const wasmBinary = await fs.readFile(
    new URL(import.meta.resolve('@jsquash/webp/codec/enc/webp_enc.wasm')),
  );
  const codec = await makeWebp({ wasmBinary });
  const scale = Math.min(1, 480 / Math.max(s.width, s.height)),
    w = Math.max(2, Math.round((s.width * scale) / 2) * 2),
    h = Math.max(2, Math.round((s.height * scale) / 2) * 2);
  const proxy = new Uint8ClampedArray(w * h * 4),
    packets = [];
  return {
    add(pixels) {
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const a =
              (Math.floor(((y + 0.5) * s.height) / h) * s.width +
                Math.floor(((x + 0.5) * s.width) / w)) *
              4,
            b = (y * w + x) * 4;
          proxy[b] = pixels[a];
          proxy[b + 1] = pixels[a + 1];
          proxy[b + 2] = pixels[a + 2];
          proxy[b + 3] = 255;
        }
      const frame = codec.encode(proxy, w, h, { ...defaultOptions, quality: 74, method: 2 });
      if (!frame) throw Error('VP8 encoding failed.');
      packets.push(vp8(frame));
    },
    finish: () => muxVp8(packets, w, h, s.fps),
  };
}
