/** A deliberately inspectable English prompt router, not a language model. */
const lex = {
  dunes: ['dune', 'dunes', 'sand', 'desert', 'sahara', 'sandy', 'mesa'],
  alpine: [
    'alpine',
    'glacier',
    'glacial',
    'peak',
    'peaks',
    'ice',
    'mountain',
    'mountains',
    'ridge',
    'snow',
    'glaciers',
    'alps',
  ],
  tidal: [
    'tidal',
    'tide',
    'tides',
    'ocean',
    'sea',
    'waves',
    'water',
    'surf',
    'coast',
    'coastal',
    'lake',
  ],
  orbital: ['orbital', 'orbit', 'lunar', 'crater', 'craters', 'ringed', 'basalt', 'alien', 'rings'],
};
const tints = {
  copper: ['copper', 'rust', 'amber', 'terracotta', 'peach', 'warm'],
  fjord: ['mint', 'glacial', 'cyan', 'teal', 'green', 'turquoise', 'emerald'],
  iris: ['violet', 'lavender', 'purple', 'iris', 'lilac', 'amethyst'],
  ochre: ['ochre', 'gold', 'mustard', 'golden', 'aureate', 'sulfur'],
  cobalt: ['cobalt', 'blue', 'arctic', 'indigo', 'azure', 'sapphire'],
};
function vote(dict, words, fallback) {
  let best = 0,
    out = fallback;
  for (const [name, terms] of Object.entries(dict)) {
    const s = terms.reduce((a, x) => a + Number(words.has(x)), 0);
    if (s > best) {
      out = name;
      best = s;
    }
  }
  return out;
}
export function condition(prompt) {
  const words = new Set(prompt.toLowerCase().match(/[a-z]+/g) ?? []);
  const family = vote(lex, words, 'dunes');
  const palette = vote(
    tints,
    words,
    { dunes: 'copper', alpine: 'fjord', tidal: 'iris', orbital: 'ochre' }[family],
  );
  return {
    family,
    palette,
    ringed: words.has('ringed') || words.has('rings') || family === 'orbital',
    starry: words.has('stars') || words.has('starry') || family === 'orbital',
    largeBody: words.has('immense') || words.has('giant') || words.has('massive'),
  };
}
