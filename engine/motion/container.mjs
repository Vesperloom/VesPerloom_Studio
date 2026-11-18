/** The muxer writes wall-clock creation/modification dates. Canonicalize only the
 * date fields of ISO BMFF movie, track and media headers in our own encoder output. */
export function canonicalMp4(bytes) {
  const out = Buffer.from(bytes);
  let count = 0;
  function walk(begin, end) {
    let i = begin;
    while (i < end) {
      if (i + 8 > end) throw Error('Truncated MP4 box.');
      const length = out.readUInt32BE(i),
        type = out.toString('ascii', i + 4, i + 8);
      if (length < 8 || i + length > end) throw Error('Unexpected MP4 box size.');
      if (['moov', 'trak', 'mdia'].includes(type)) walk(i + 8, i + length);
      if (['mvhd', 'tkhd', 'mdhd'].includes(type)) {
        const version = out[i + 8],
          size = version === 0 ? 8 : version === 1 ? 16 : 0;
        if (!size || 12 + size > length) throw Error('Unsupported MP4 time header.');
        out.fill(0, i + 12, i + 12 + size);
        count++;
      }
      i += length;
    }
  }
  walk(0, out.length);
  if (count !== 3) throw Error('Expected one video track.');
  return out;
}
