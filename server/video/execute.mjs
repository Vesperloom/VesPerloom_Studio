import { Worker } from 'node:worker_threads';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
import { python, home } from '../config.mjs';
import { anyProfile } from '../../registry/modalities.mjs';
import { installed, modelDir } from '../../registry/index.mjs';
import { InputError } from '../runtime/options.mjs';
const encoder = new URL('../../engine/motion/encode-worker.mjs', import.meta.url),
  wan = fileURLToPath(new URL('../../engine/adapters/wan_worker.py', import.meta.url));
function decodeWan(settings, work, base, signal, onProgress) {
  const p = anyProfile('wan-t2v');
  if (!installed(p, base)) throw new InputError('Install the Wan snapshot before rendering.', 409);
  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    for (const k of ['HF_TOKEN', 'VESPER_TOKEN', 'VESPER_CHAT_API_KEY']) delete env[k];
    const c = spawn(python, ['-u', wan], { env, stdio: ['pipe', 'pipe', 'pipe'] });
    let tail = '',
      failed;
    const stop = () => c.kill('SIGKILL');
    signal.addEventListener('abort', stop, { once: true });
    if (signal.aborted) stop();
    const lines = createInterface({ input: c.stdout });
    lines.on('line', (l) => {
      try {
        const m = JSON.parse(l);
        if (Number.isFinite(m.progress))
          onProgress(Math.min(0.9, m.progress), String(m.phase).slice(0, 80));
      } catch {}
    });
    c.on('error', (e) => {
      failed = e;
    });
    c.stderr.on('data', (x) => {
      tail = (tail + x.toString()).slice(-1200);
    });
    c.stdin.on('error', () => {});
    c.stdin.end(
      JSON.stringify({
        settings,
        directory: modelDir(p, base),
        output: path.join(work, 'frames.rgb'),
      }),
    );
    c.on('close', (code) => {
      lines.close();
      signal.removeEventListener('abort', stop);
      if (signal.aborted) reject(signal.reason);
      else if (failed || code !== 0)
        reject(failed || Error(tail.trim().split('\n').at(-1) || 'Video diffusion failed.'));
      else resolve();
    });
  });
}
export async function renderVideo(
  settings,
  work,
  { base = home, signal = new AbortController().signal, onProgress = () => {} } = {},
) {
  signal.throwIfAborted();
  const external = settings.model === 'wan-t2v';
  if (external) await decodeWan(settings, work, base, signal, onProgress);
  signal.throwIfAborted();
  try {
    return await new Promise((resolve, reject) => {
      const w = new Worker(encoder, { workerData: { settings, work }, execArgv: [] });
      let done, err;
      const stop = () => void w.terminate();
      signal.addEventListener('abort', stop, { once: true });
      if (signal.aborted) stop();
      w.on('message', (m) => {
        if (m.done) done = m;
        else onProgress(external ? 0.91 + m.progress * 0.08 : m.progress * 0.98, m.phase);
      });
      w.on('error', (e) => {
        err = e;
      });
      w.on('exit', (code) => {
        signal.removeEventListener('abort', stop);
        if (signal.aborted) reject(signal.reason);
        else if (err || code || !done) reject(err || Error('Video encoder stopped unexpectedly.'));
        else resolve(done);
      });
    });
  } finally {
    if (external) await fs.rm(path.join(work, 'frames.rgb'), { force: true });
  }
}
