import path from 'node:path';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { root } from '../config.mjs';
import { InputError } from '../runtime/options.mjs';
import { mediaCatalog, anyProfile } from '../../registry/modalities.mjs';
import { modelDir } from '../../registry/index.mjs';
import { chatInput, systemPrompt } from './messages.mjs';
import { providerConfig, providerReply } from './provider.mjs';
const runtime = path.join(root, 'runtimes', 'chat-linux-x64');
export function chatModels(base, provider) {
  const available =
    process.platform === 'linux' &&
    process.arch === 'x64' &&
    existsSync(path.join(runtime, 'node_modules/node-llama-cpp/dist/index.js')) &&
    existsSync(
      path.join(runtime, 'node_modules/@node-llama-cpp/linux-x64/bins/linux-x64/llama-addon.node'),
    );
  const rows = mediaCatalog(base)
    .filter((p) => p.modality === 'chat')
    .map((p) => ({
      id: p.id,
      name: p.name,
      ready: p.installed && available,
      installed: p.installed,
      local: true,
      bytes: p.bytes,
      setup:
        p.id === 'qwen-small'
          ? 'npm run chat:setup'
          : 'npm run chat:setup && npm run loom -- pull qwen-7b',
    }));
  if (provider)
    rows.push({
      id: 'connected',
      name: provider.model,
      host: provider.host,
      ready: true,
      local: false,
    });
  return rows;
}
export function localReply(input, base, signal, emit) {
  return new Promise((resolve, reject) => {
    const p = anyProfile(input.model),
      env = { ...process.env };
    for (const key of ['VESPER_CHAT_API_KEY', 'HF_TOKEN', 'VESPER_TOKEN']) delete env[key];
    const child = spawn(process.execPath, [path.join(runtime, 'worker.mjs')], {
      env,
      stdio: ['pipe', 'ignore', 'pipe', 'ipc'],
    });
    let failure,
      finished = false,
      tail = '';
    const stop = () => child.kill('SIGKILL');
    signal.addEventListener('abort', stop, { once: true });
    if (signal.aborted) stop();
    child.stdin.on('error', () => {});
    child.stdin.end(
      JSON.stringify({
        messages: input.messages,
        maxTokens: input.maxTokens,
        system: systemPrompt,
        modelPath: path.join(modelDir(p, base), p.files[0].path),
      }),
    );
    child.stderr.on('data', (b) => {
      tail = (tail + b.toString()).slice(-600);
    });
    child.on('error', (e) => {
      failure = e;
    });
    child.on('message', (m) => {
      if (m.type === 'error') failure = Error(m.message);
      else if (!failure && !signal.aborted) {
        try {
          if (m.type === 'end') finished = true;
          emit(m);
        } catch (e) {
          failure = e;
          stop();
        }
      }
    });
    child.on('close', (code) => {
      signal.removeEventListener('abort', stop);
      if (signal.aborted) reject(signal.reason);
      else if (failure || code !== 0 || !finished) {
        if (tail)
          console.warn('Local chat worker stopped:', tail.split('\n').filter(Boolean).at(-1));
        reject(
          failure ||
            Error('Local chat runtime stopped. Check available RAM and the runtime installation.'),
        );
      } else resolve();
    });
  });
}
export class ChatService {
  constructor(base, provider = providerConfig()) {
    this.base = base;
    this.provider = provider;
    this.active = null;
  }
  models() {
    return chatModels(this.base, this.provider);
  }
  async handle(raw, res) {
    const input = chatInput(raw),
      model = this.models().find((x) => x.id === input.model);
    if (!model?.ready)
      throw new InputError(
        'Chat engine is not ready. Install the local model with npm run chat:setup, or configure a compatible provider.',
        409,
      );
    if (this.active) throw new InputError('Another reply is in progress. Try again shortly.', 429);
    const ctl = new AbortController();
    this.active = ctl;
    const stop = () => ctl.abort(Error('Chat cancelled.'));
    res.once('close', stop);
    const timer = setTimeout(() => ctl.abort(Error('Chat time limit exceeded.')), 180000);
    timer.unref();
    let count = 0,
      terminal = null;
    const write = (m) => {
      if (!res.destroyed && !res.writableEnded) res.write(JSON.stringify(m) + '\n');
    };
    const emit = (m) => {
      if (m.type === 'end') {
        terminal = m;
        return;
      }
      if (m.type === 'delta') {
        if (typeof m.text !== 'string') return;
        count += m.text.length;
        if (count > 16000) throw Error('Reply exceeded the output limit.');
      }
      write(m);
    };
    try {
      res.writeHead(200, {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'private, no-store',
        'X-Accel-Buffering': 'no',
      });
      write({ type: 'start', model: input.model });
      if (input.model === 'connected') {
        for await (const m of providerReply(this.provider, input, ctl.signal)) emit(m);
      } else await localReply(input, this.base, ctl.signal, emit);
      if (!count) throw Error('The model returned no reply.');
      write(terminal || { type: 'end', reason: 'stop' });
    } catch (e) {
      write({ type: 'error', message: ctl.signal.aborted ? ctl.signal.reason.message : e.message });
    } finally {
      clearTimeout(timer);
      res.removeListener('close', stop);
      ctl.abort();
      this.active = null;
      if (!res.destroyed) res.end();
    }
  }
  shutdown() {
    this.active?.abort(Error('Studio shutting down.'));
  }
}
