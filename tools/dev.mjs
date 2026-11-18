import { spawn } from 'node:child_process';
import { createServer } from 'vite';
import { root } from '../server/config.mjs';
import path from 'node:path';
// API is loopback-only in dev. All browser requests use Vite's same-origin proxy.
const api = spawn(process.execPath, ['--watch', 'server/main.mjs'], {
  stdio: 'inherit',
  cwd: root,
  env: { ...process.env, HOST: '127.0.0.1', PORT: '4174' },
});
const vite = await createServer({ configFile: path.join(root, 'app/vite.config.mjs') });
await vite.listen();
vite.printUrls();
const stop = async () => {
  api.kill();
  await vite.close();
};
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
