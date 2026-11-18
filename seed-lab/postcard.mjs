import { encode } from './recipe.mjs';
export const names = { dunes: 'Meridian', alpine: 'Ridge', tidal: 'Tide', orbital: 'Orbit' };
const cap = (s) => s[0].toUpperCase() + s.slice(1);
export const titleFor = (r) => `${cap(r.palette)} ${names[r.family]}`;
/** A deliberately branded export, separate from the studio's unmarked original PNG. */
export function postcard(source, recipe) {
  const out = document.createElement('canvas');
  out.width = 1200;
  out.height = 630;
  const c = out.getContext('2d');
  c.fillStyle = '#161a1a';
  c.fillRect(0, 0, 1200, 630);
  const x = 450,
    w = 750,
    h = 572,
    scale = Math.max(w / source.width, h / source.height);
  c.save();
  c.beginPath();
  c.rect(x, 0, w, h);
  c.clip();
  c.drawImage(
    source,
    x + (w - source.width * scale) * 0.5,
    (h - source.height * scale) * 0.36,
    source.width * scale,
    source.height * scale,
  );
  c.restore();
  c.fillStyle = '#c5f58f';
  c.fillRect(40, 45, 23, 3);
  c.font = '500 14px monospace';
  c.fillText('VESPERLOOM  /  SEED LAB', 78, 52);
  c.font = '600 61px Manrope, sans-serif';
  c.fillStyle = '#f3f3e9';
  c.fillText(cap(recipe.palette), 36, 198);
  c.fillText(names[recipe.family], 36, 270);
  c.fillStyle = '#9eaea1';
  c.font = '14px monospace';
  c.fillText('A REMIXABLE LANDSCAPE', 40, 333);
  c.fillStyle = '#424b43';
  c.fillRect(41, 389, 362, 1);
  c.fillStyle = '#bdc8bd';
  c.font = '15px monospace';
  c.fillText('ROOT  /  ' + recipe.seed, 41, 433);
  c.fillText('DRIFT /  ' + recipe.drift + '%', 41, 464);
  c.fillStyle = '#c5f58f';
  c.font = '600 21px Manrope, sans-serif';
  c.fillText('Make this seed your own.', 40, 535);
  c.fillStyle = '#252c24';
  c.fillRect(0, 572, 1200, 58);
  c.font = '18px monospace';
  c.fillStyle = '#c9d8bf';
  c.fillText(encode(recipe), 40, 608);
  c.font = '17px monospace';
  c.textAlign = 'right';
  c.fillText('t.me/vesperloom7', 1160, 608);
  return out;
}
