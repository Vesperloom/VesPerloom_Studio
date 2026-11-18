import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { root } from '../server/config.mjs';
import { anyProfile } from '../registry/modalities.mjs';
import { install } from '../registry/installer.mjs';
if (process.platform !== 'linux' || process.arch !== 'x64')
  throw Error(
    'The one-command CPU runtime targets glibc Linux x86-64 VPSs. On other hosts use the server-configured chat endpoint; see docs/MULTIMODAL.md.',
  );
const cwd = path.join(root, 'runtimes/chat-linux-x64');
execFileSync('npm', ['ci', '--omit=optional', '--ignore-scripts', '--no-audit', '--no-fund'], {
  cwd,
  stdio: 'inherit',
});
execFileSync(process.execPath, ['check.mjs'], { cwd, stdio: 'inherit' });
await install(anyProfile('qwen-small'));
console.log('Local chat is ready. Reload the studio model list.');
