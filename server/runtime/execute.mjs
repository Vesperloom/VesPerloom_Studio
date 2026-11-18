import { Worker } from 'node:worker_threads';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { profile, installed, modelDir } from '../../registry/index.mjs';
import { home, python } from '../config.mjs';
import { InputError } from './options.mjs';
const native = new URL('../../engine/adapters/native-worker.mjs', import.meta.url);
const bridge = fileURLToPath(new URL('../../engine/adapters/diffusers_worker.py', import.meta.url));
export async function execute(
  options,
  output,
  { signal, onProgress = () => {}, base = home } = {},
) {
  const p = profile(options.model);
  signal?.throwIfAborted();
  if (!installed(p, base))
    throw new InputError(`${p.name} is not installed. Run: npm run loom -- pull ${p.id}`, 409);
  if (p.kind === 'native')
    return new Promise((resolve, reject) => {
      const w = new Worker(native, { workerData: { options, output }, execArgv: [] });
      let tags, failed;
      const stop = () => {
        void w.terminate();
      };
      signal?.addEventListener('abort', stop, { once: true });
      w.on('message', (m) => {
        if (m.done) tags = m.tags;
        else onProgress(m.progress, m.phase);
      });
      w.on('error', (e) => {
        failed = e;
      });
      w.on('exit', (code) => {
        signal?.removeEventListener('abort', stop);
        if (signal?.aborted) reject(signal.reason);
        else if (failed || code !== 0 || !tags)
          reject(failed || Error('Native worker stopped unexpectedly.'));
        else resolve(tags);
      });
    });
  return new Promise((resolve, reject) => {
    const env = { ...process.env, HF_HUB_OFFLINE: '1', TRANSFORMERS_OFFLINE: '1' };
    delete env.VESPER_CHAT_API_KEY;
    delete env.HF_TOKEN;
    delete env.VESPER_TOKEN;
    const child = spawn(python, ['-u', bridge], { stdio: ['pipe', 'pipe', 'pipe'], env });
    let tail = '',
      spawnError;
    const stop = () => child.kill('SIGKILL');
    signal?.addEventListener('abort', stop, { once: true });
    const lines = createInterface({ input: child.stdout });
    lines.on('line', (line) => {
      try {
        const m = JSON.parse(line);
        if (Number.isFinite(m.progress)) onProgress(m.progress, String(m.phase).slice(0, 80));
      } catch {
        /* libraries may emit non-protocol logs */
      }
    });
    child.stderr.on('data', (b) => {
      tail = (tail + b.toString()).slice(-1500);
    });
    child.on('error', (e) => {
      spawnError = e;
    });
    child.stdin.on('error', () => {}); // A failed Python startup can close stdin before the request is flushed.
    child.stdin.end(
      JSON.stringify({
        options,
        profile: { architecture: p.architecture, variant: p.variant, guidance: p.guidance },
        directory: modelDir(p, base),
        output,
      }),
    );
    child.on('close', (code) => {
      signal?.removeEventListener('abort', stop);
      lines.close();
      if (signal?.aborted) reject(signal.reason);
      else if (code !== 0 || spawnError)
        reject(
          Error(
            spawnError?.message || tail.trim().split('\n').at(-1) || 'Diffusers worker failed.',
          ),
        );
      else resolve({ family: p.architecture, palette: 'model-defined' });
    });
  });
}
