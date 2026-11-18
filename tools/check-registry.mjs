/** Optional network check: metadata only. Never fetches a model weight. */
import assert from 'node:assert/strict';
import { profiles } from '../registry/index.mjs';
import { mediaProfiles } from '../registry/modalities.mjs';
for (const p of [...profiles, ...mediaProfiles].filter((p) => p.kind === 'external')) {
  const url = `https://huggingface.co/api/models/${p.repo}/tree/${p.revision}?recursive=true`;
  const r = await fetch(url);
  if (!r.ok) throw Error(`Hub metadata ${r.status}: ${p.id}`);
  const entries = new Map(
    (await r.json()).filter((f) => f.type === 'file').map((f) => [f.path, f]),
  );
  for (const f of p.files) {
    const actual = entries.get(f.path);
    assert.ok(actual, `Missing ${f.path}`);
    assert.equal(actual.size, f.size, f.path);
    if (f.sha256) assert.equal(actual.lfs?.oid, f.sha256, f.path);
    else assert.equal(actual.oid, f.gitBlob || f.gitLfsPointerBlob, f.path);
  }
  console.log(
    `OK ${p.id}: ${p.files.length} component identities match ${p.revision.slice(0, 12)}`,
  );
}
