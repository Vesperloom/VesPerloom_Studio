import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { InputError } from '../runtime/options.mjs';
import { authorized } from '../api/http.mjs';
const digest = (t) => createHash('sha256').update(t).digest();
const nameOk = (s) => typeof s === 'string' && /^[a-z][a-z0-9-]{0,30}$/.test(s);
export async function readKeys(base) {
  try {
    const d = JSON.parse(await fs.readFile(path.join(base, 'accounts.json'), 'utf8'));
    if (
      d.schema !== 'vesperloom.accounts/v1' ||
      !Array.isArray(d.accounts) ||
      d.accounts.length > 64 ||
      d.accounts.some((a) => !nameOk(a.id) || !/^[0-9a-f]{64}$/.test(a.hash)) ||
      new Set(d.accounts.map((a) => a.id)).size !== d.accounts.length
    )
      throw Error('Invalid workspace key store.');
    return d.accounts;
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
}
export async function keyring(base, legacyToken) {
  const list = await readKeys(base);
  return {
    named: list !== null,
    required: list !== null || !!legacyToken,
    owner(header = '') {
      if (list === null) {
        if (authorized(legacyToken, header)) return '_shared';
      } else if (header.startsWith('Bearer ')) {
        const h = digest(header.slice(7));
        for (const a of list) if (timingSafeEqual(h, Buffer.from(a.hash, 'hex'))) return a.id;
      }
      throw new InputError('A valid workspace token is required.', 401);
    },
  };
}
export async function changeKey(base, action, id) {
  if (!nameOk(id) || !['add', 'rotate', 'revoke'].includes(action))
    throw Error(
      'Use add, rotate or revoke with a lowercase workspace ID (letters, digits, hyphens).',
    );
  await fs.mkdir(base, { recursive: true });
  const lock = path.join(base, 'accounts.lock');
  await fs.mkdir(lock);
  const tmp = path.join(base, '.keys-' + randomUUID());
  try {
    const accounts = (await readKeys(base)) || [];
    const found = accounts.find((a) => a.id === id);
    if (action === 'add' && (found || accounts.length >= 64))
      throw Error('Workspace exists or capacity reached.');
    if (action !== 'add' && !found) throw Error('Unknown workspace.');
    if (action === 'add') {
      try {
        await fs.stat(path.join(base, 'workspaces', id));
        throw Error(
          'This ID still owns archived files. Choose a different ID or move that archive while the server is stopped.',
        );
      } catch (e) {
        if (e.code !== 'ENOENT') throw e;
      }
    }
    const key = action === 'revoke' ? null : 'vl_' + randomBytes(32).toString('base64url');
    const updated = accounts.filter((a) => a.id !== id);
    if (key) updated.push({ id, hash: digest(key).toString('hex') });
    await fs.writeFile(
      tmp,
      JSON.stringify({ schema: 'vesperloom.accounts/v1', accounts: updated }, null, 2) + '\n',
      { mode: 0o600, flag: 'wx' },
    );
    await fs.rename(tmp, path.join(base, 'accounts.json'));
    return key;
  } finally {
    await fs.rm(tmp, { force: true });
    await fs.rmdir(lock);
  }
}
