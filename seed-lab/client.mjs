import { first, colors, checked, decode, encode, weekly, remixHref } from './recipe.mjs';
import { postcard, titleFor } from './postcard.mjs';
const $ = (id) => document.getElementById(id);
const publicBase = __PUBLIC_DEMO__;
const hues = {
  copper: '#c88366',
  fjord: '#81b8a1',
  iris: '#a18ac9',
  ochre: '#c3a260',
  cobalt: '#7296bb',
};
const announce = (text) => {
  $('feedback').textContent = text;
};
let selected = { ...first },
  drawn = null,
  seq = 0,
  busy = false,
  worker = null,
  workerURL = null;
function fromText(s) {
  const v = s.trim();
  if (v.startsWith('VL1.')) return decode(v);
  let u;
  try {
    u = new URL(v);
  } catch {
    throw Error('Paste a VL1 code or a complete remix link.');
  }
  return decode(new URLSearchParams(u.hash.slice(1)).get('r'));
}
function sync() {
  $('family').value = selected.family;
  $('aspect').value = selected.aspect;
  $('seed').value = selected.seed;
  $('drift').value = selected.drift;
  $('drift-value').textContent = selected.drift + '%';
  for (const b of $('palette').children)
    b.setAttribute('aria-pressed', String(b.dataset.tint === selected.palette));
}
function choose(value) {
  try {
    selected = { ...checked(value) };
    sync();
    seq++;
    $('copy').disabled = true;
    $('postcard').disabled = true;
    $('send').hidden = true;
    $('manual-copy').hidden = true;
    $('render-status').textContent = 'SAMPLING…';
    start();
  } catch (e) {
    announce(e.message);
  }
}
function receive(m) {
  busy = false;
  if (m.id !== seq) {
    start();
    return;
  }
  if (m.error) {
    $('render-status').textContent = 'RENDER FAILED';
    announce(m.error);
    return;
  }
  const canvas = $('art');
  canvas.width = m.width;
  canvas.height = m.height;
  canvas
    .getContext('2d')
    .putImageData(new ImageData(new Uint8ClampedArray(m.buffer), m.width, m.height), 0, 0);
  canvas.parentElement.classList.toggle(
    'contain',
    selected.aspect === '1:1' || selected.aspect === '4:5',
  );
  drawn = { ...selected };
  const code = encode(drawn);
  canvas.dataset.code = code;
  $('plate-info').textContent = `SEED ${drawn.seed}  ·  ${m.width} × ${m.height}`;
  $('plate-name').textContent = titleFor(drawn);
  $('plate-family').textContent =
    drawn.family.toUpperCase() + ' SERIES   /   ' + drawn.palette.toUpperCase();
  $('render-status').textContent = 'RENDER COMPLETE';
  $('copy').disabled = false;
  $('postcard').disabled = false;
  if (publicBase) {
    const u = new URL('https://t.me/share/url');
    u.searchParams.set('url', remixHref(publicBase, drawn));
    u.searchParams.set('text', 'My Strata-1 landscape. Open it in Seed Lab and change the drift.');
    $('send').href = u.href;
    $('send').hidden = false;
  }
}
function start() {
  if (busy) return;
  busy = true;
  const id = seq,
    r = { ...selected };
  if (worker) {
    worker.postMessage({ id, recipe: r });
    return;
  }
  setTimeout(() => {
    try {
      receive({ ...globalThis.VLKernel.paint(r), id });
    } catch (e) {
      receive({ id, error: e.message });
    }
  }, 16);
}
// The exact same embedded kernel also works where Blob workers are blocked.
try {
  const source =
    $('vl-kernel').textContent +
    '\nself.onmessage=({data})=>{try{const r=VLKernel.paint(data.recipe);self.postMessage({...r,id:data.id},[r.buffer]);}catch(e){self.postMessage({id:data.id,error:e.message});}};';
  workerURL = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  worker = new Worker(workerURL);
  worker.onmessage = (e) => receive(e.data);
  worker.onerror = (e) => {
    e.preventDefault();
    worker.terminate();
    worker = null;
    URL.revokeObjectURL(workerURL);
    workerURL = null;
    busy = false;
    start();
  };
} catch {
  worker = null;
}
window.addEventListener('pagehide', (e) => {
  if (!e.persisted) {
    worker?.terminate();
    if (workerURL) URL.revokeObjectURL(workerURL);
  }
});
for (const name of colors) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'swatch';
  b.dataset.tint = name;
  b.setAttribute('aria-label', name + ' palette');
  b.style.setProperty('--color', hues[name]);
  const sw = document.createElement('i');
  b.append(sw, document.createTextNode(name));
  b.onclick = () => choose({ ...selected, palette: name });
  $('palette').appendChild(b);
}
$('family').onchange = (e) => choose({ ...selected, family: e.target.value });
$('aspect').onchange = (e) => choose({ ...selected, aspect: e.target.value });
$('seed').onchange = (e) => {
  if (!/^\d{1,10}$/.test(e.target.value) || Number(e.target.value) > 4294967295) {
    announce('Choose a whole-number seed from 0 to 4294967295.');
    sync();
    return;
  }
  choose({ ...selected, seed: Number(e.target.value) });
};
$('random').onclick = () =>
  choose({ ...selected, seed: crypto.getRandomValues(new Uint32Array(1))[0] });
$('drift').oninput = (e) => choose({ ...selected, drift: +e.target.value });
$('import-form').onsubmit = (e) => {
  e.preventDefault();
  try {
    choose(fromText($('code').value));
    announce('Seed loaded. Change the palette or drift to make a variation.');
  } catch (err) {
    announce(err.message);
  }
};
function weekLabel() {
  const w = weekly();
  $('week-id').textContent = 'WEEK OF ' + w.id + '  ·  UTC';
  return w;
}
weekLabel();
$('weekly').onclick = () => {
  const w = weekLabel();
  choose(w.recipe);
  announce('Weekly seed loaded · ' + w.id);
};
if (publicBase) {
  $('copy').textContent = 'Copy remix link';
  $('share-info').textContent =
    'A public demo link containing only scene controls. No prompt or private studio address.';
}
$('copy').onclick = async () => {
  if (!drawn) return;
  const value = publicBase ? remixHref(publicBase, drawn) : encode(drawn);
  try {
    await navigator.clipboard.writeText(value);
    announce(
      publicBase
        ? 'Remix link copied. Anyone with the link can try your settings.'
        : 'Seed code copied. Paste it into “Load a seed code” on any copy of this lab.',
    );
  } catch {
    const el = $('manual-copy');
    el.hidden = false;
    el.value = value;
    el.focus();
    el.select();
    announce('Select and copy the highlighted value.');
  }
};
$('postcard').onclick = async () => {
  if (!drawn) return;
  const current = { ...drawn };
  const image = postcard($('art'), current);
  image.toBlob((blob) => {
    if (!blob) {
      announce('Could not encode the postcard.');
      return;
    }
    const url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.download = `vesperloom-${current.family}-${current.seed}-d${current.drift}.png`;
    a.href = url;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 6000);
    announce('Postcard saved with your seed code and the channel address.');
  }, 'image/png');
};
function restore() {
  let r = first;
  if (location.hash) {
    try {
      r = decode(new URLSearchParams(location.hash.slice(1)).get('r'));
    } catch {
      announce('This seed link is not valid. Showing the starter plate instead.');
    }
  }
  choose(r);
}
window.addEventListener('hashchange', restore);
restore();
