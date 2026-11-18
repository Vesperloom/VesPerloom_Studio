#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';
import { spawnSync } from 'node:child_process';
import { profiles, catalog, modelDir } from '../registry/index.mjs';
import { install, verifyProfile } from '../registry/installer.mjs';
import { normalize } from '../server/runtime/options.mjs';
import { capture, readCapsule } from '../server/runtime/capsule.mjs';
import { execute } from '../server/runtime/execute.mjs';
import { home, python, limits, releaseVersion } from '../server/config.mjs';
import { mediaCatalog, anyProfile } from '../registry/modalities.mjs';
import { chatModels } from '../server/chat/service.mjs';
import { videoCommand } from './video.mjs';
import { chatCommand } from './chat.mjs';
const help = `Vesperloom / image, video and language studio\n\n  npm run loom -- <command> [options]\n\n  list                         Model inventory and installation status\n  inspect <id>                 Pinned revision, license and file digests\n  doctor                       Host and optional tensor-runtime diagnostics\n  pull <id>                    Fetch and verify a curated model snapshot\n  import <id> <directory>      Verify and copy a compatible offline snapshot\n  verify <id>                  Re-hash all installed components\n  remove <id>                  Remove an external installation (stop server first)\n  run <id> --prompt TEXT       Render PNG + portable capsule\n  replay <capsule.json>        Render and verify the original pixel digest\n\n  chat <id> --prompt TEXT      Stream a local GGUF reply (no server required)\n                               --max-tokens 8..384; omit --prompt for an interactive terminal\n  video <id> --prompt TEXT     Render silent H.264 MP4 + recipe\n  replay-video <recipe.json>   Verify the source RGBA frame sequence\n  Video flags: --frame wide|square|tall --duration 2|3|4\n               --camera glide|dolly|arc --strength 0..100 --size preview|hd --fps 12|24 (native)\n\n  Render flags: --out FILE.png --seed 0..4294967295 --aspect 3:2|1:1|16:9|4:5\n                --steps N --drift 0..100 (native only)\n  The native model is bundled. External weights are never fetched on startup.`;
async function renderFile(settings, out, expected = null, parent = null) {
  const dest = path.resolve(out);
  if (path.extname(dest).toLowerCase() !== '.png') throw Error('--out must end in .png');
  const folder = path.dirname(dest);
  await fs.mkdir(folder, { recursive: true });
  const temp = path.join(folder, '.loom-' + randomUUID() + '.png'),
    ctl = new AbortController();
  const stop = () => ctl.abort(Error('Interrupted'));
  const timeout = setTimeout(() => ctl.abort(Error('Render deadline exceeded.')), limits.timeout);
  timeout.unref();
  process.once('SIGINT', stop);
  try {
    const start = performance.now();
    const tags = await execute(settings, temp, { signal: ctl.signal });
    const png = await fs.readFile(temp);
    const { capsule } = capture(png, settings, {
      tags,
      parent,
      elapsedMs: Math.round(performance.now() - start),
    });
    if (expected && expected !== capsule.output.pixelSha256)
      throw Error(
        'Replay digest differs; original output was not overwritten. Numerical GPU kernels may vary across hosts.',
      );
    await fs.rename(temp, dest);
    await fs.writeFile(dest + '.capsule.json', JSON.stringify(capsule, null, 2) + '\n');
    console.log(`${dest}\n${dest}.capsule.json\npixels  ${capsule.output.pixelSha256}`);
  } finally {
    clearTimeout(timeout);
    process.removeListener('SIGINT', stop);
    await fs.rm(temp, { force: true });
  }
}
async function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) return console.log(help);
  if (process.argv.includes('--version')) return console.log(releaseVersion);
  const {
    values: v,
    positionals: [cmd, id, source],
  } = parseArgs({
    allowPositionals: true,
    options: Object.fromEntries(
      [
        'prompt',
        'out',
        'seed',
        'aspect',
        'steps',
        'drift',
        'frame',
        'duration',
        'camera',
        'strength',
        'size',
        'fps',
        'max-tokens',
      ].map((k) => [k, { type: 'string' }]),
    ),
  });
  if (!cmd || cmd === 'help') return console.log(help);
  if (cmd === 'list')
    return console.table(
      [
        ...catalog(),
        {
          id: 'strata-motion',
          name: 'Strata Motion (shares Strata-1)',
          kind: 'native',
          installed: true,
          bytes: 58448,
        },
        ...mediaCatalog(home),
      ].map(({ id, name, kind, installed, bytes }) => ({
        id,
        name,
        engine: kind,
        installed,
        weights:
          kind === 'native' ? `${(bytes / 1024).toFixed(1)} KiB` : `${(bytes / 1e9).toFixed(2)} GB`,
      })),
    );
  if (cmd === 'doctor') {
    console.log(
      `Node ${process.version} · ${os.platform()} ${os.arch()} · ${os.availableParallelism()} logical CPUs\nData: ${home}`,
    );
    await verifyProfile(profiles[0]);
    console.log('Native checkpoint: verified · Strata-1 images and Strata Motion video');
    for (const m of chatModels(home, null))
      console.log(`Chat ${m.id}: ${m.ready ? 'installed / runtime present' : 'setup required'}`);
    const r = spawnSync(
      python,
      [
        '-c',
        `import torch, diffusers, transformers; from diffusers import StableDiffusionPipeline, StableDiffusionXLPipeline, FluxPipeline, WanPipeline; print('Torch',torch.__version__,'· Diffusers',diffusers.__version__,'· CUDA',torch.cuda.is_available())`,
      ],
      { encoding: 'utf8', timeout: 40000 },
    );
    console.log(
      r.status === 0
        ? r.stdout.trim()
        : 'Optional Diffusers runtime: unavailable (not needed for Strata-1). See docs/EXTERNAL-MODELS.md.',
    );
    return;
  }
  if (cmd === 'replay') {
    if (!id) throw Error('Provide a capsule JSON file.');
    const c = JSON.parse(await fs.readFile(id, 'utf8'));
    return renderFile(readCapsule(c), v.out || 'replay.png', c.output.pixelSha256, c.parent);
  }
  if (cmd === 'chat') return chatCommand(id || 'qwen-small', v);
  if (cmd === 'video' || cmd === 'replay-video') return videoCommand(cmd, id, v);
  if (id === 'strata-motion' && cmd === 'inspect')
    return console.log(
      JSON.stringify(
        {
          id,
          name: 'Strata Motion',
          modality: 'video',
          checkpoint: 'strata-1',
          cameras: ['dolly', 'glide', 'arc'],
          duration: [2, 3, 4],
          fps: [12, 24],
        },
        null,
        2,
      ),
    );
  const p = anyProfile(id === 'strata-motion' ? 'strata-1' : id);
  if (cmd === 'inspect') return console.log(JSON.stringify(p, null, 2));
  if (cmd === 'pull' || cmd === 'import') {
    if (cmd === 'import' && !source) throw Error('Provide the source directory.');
    return install(p, { source: cmd === 'import' ? path.resolve(source) : undefined });
  }
  if (cmd === 'verify') {
    await verifyProfile(p);
    return console.log(`${p.id}: verified`);
  }
  if (cmd === 'remove') {
    if (p.kind === 'native') throw Error('The bundled engine cannot be removed.');
    await fs.rm(modelDir(p), { recursive: true, force: true });
    console.log(`Removed ${id}.`);
    return;
  }
  if (cmd === 'run')
    return renderFile(
      normalize({
        model: id,
        prompt: v.prompt,
        aspect: v.aspect,
        seed: v.seed === undefined ? undefined : Number(v.seed),
        steps: v.steps === undefined ? undefined : Number(v.steps),
        drift: v.drift === undefined ? 0 : Number(v.drift),
      }),
      v.out || 'image.png',
    );
  throw Error('Unknown command. Use loom help.');
}
main().catch((e) => {
  console.error(`Vesperloom: ${e.message}`);
  process.exitCode = 1;
});
