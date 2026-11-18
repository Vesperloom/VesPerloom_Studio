import { nativeFrames } from '../engine/strata/frames.mjs';
import { mix } from '../engine/strata/random.mjs';
export const families = ['dunes', 'alpine', 'tidal', 'orbital'];
export const colors = ['copper', 'fjord', 'iris', 'ochre', 'cobalt'];
export const aspects = Object.keys(nativeFrames);
export const first = {
  family: 'dunes',
  palette: 'copper',
  aspect: '3:2',
  seed: 41928,
  steps: 24,
  drift: 0,
  flags: 5,
};
const int = (n, a, b) => Number.isInteger(n) && n >= a && n <= b;
export function checked(r) {
  if (
    !r ||
    !families.includes(r.family) ||
    !colors.includes(r.palette) ||
    !aspects.includes(r.aspect) ||
    !int(r.seed, 0, 4294967295) ||
    !int(r.steps, 1, 48) ||
    !int(r.drift, 0, 100) ||
    !int(r.flags, 0, 7)
  )
    throw Error('Invalid Seed Lab recipe.');
  return r;
}
/** Wire format VL1 intentionally cannot contain text, tokens, render IDs, or server addresses. */
export function encode(r) {
  checked(r);
  return [
    'VL1',
    r.family,
    r.palette,
    r.aspect.replace(':', 'x'),
    r.seed,
    r.steps,
    r.drift,
    r.flags,
  ].join('.');
}
export function decode(code) {
  if (typeof code !== 'string' || code.length > 85) throw Error('Invalid seed code.');
  const p = code.trim().split('.');
  if (p.length !== 8 || p[0] !== 'VL1' || !p.slice(4).every((s) => /^(0|[1-9][0-9]{0,9})$/.test(s)))
    throw Error('Expected a VL1 seed code.');
  return checked({
    family: p[1],
    palette: p[2],
    aspect: p[3].replace('x', ':'),
    seed: +p[4],
    steps: +p[5],
    drift: +p[6],
    flags: +p[7],
  });
}
export function fromPlate({ settings: s, tags: t }) {
  if (s.model !== 'strata-1') throw Error('Only native Strata-1 plates have portable seed codes.');
  return checked({
    family: t.family,
    palette: t.palette,
    aspect: s.aspect,
    seed: s.seed,
    steps: s.steps,
    drift: s.drift,
    flags: +t.ringed + 2 * +t.starry + 4 * +t.largeBody,
  });
}
export function inputs(r) {
  checked(r);
  const [width, height] = nativeFrames[r.aspect];
  return {
    settings: { width, height, seed: r.seed, drift: r.drift, steps: r.steps },
    tags: {
      family: r.family,
      palette: r.palette,
      ringed: !!(r.flags & 1),
      starry: !!(r.flags & 2),
      largeBody: !!(r.flags & 4),
    },
  };
}
/** Monday UTC boundary. The Monday date is the challenge ID, even across ISO years. */
export function weekly(date = new Date()) {
  const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  const id = monday.toISOString().slice(0, 10);
  const seed = mix(Math.floor(monday.getTime() / 86400000) ^ 0x6a09e667);
  return {
    id,
    recipe: {
      ...first,
      seed,
      family: families[seed % 4],
      palette: colors[(seed >>> 3) % 5],
      flags: 4 | ((seed >>> 7) & 3),
    },
  };
}
export function remixHref(base, r) {
  const u = new URL(base);
  u.search = '';
  u.hash = 'r=' + encode(r);
  return u.href;
}
