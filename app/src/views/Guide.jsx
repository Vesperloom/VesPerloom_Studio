import React from 'react';
import { ArrowUpRight, GitFork, Layers3, Fingerprint, Box, Braces } from 'lucide-react';
import { PageHead } from '../components/Shell.jsx';
import { Code } from '../components/Common.jsx';
export function Guide({ terminal = false, go, load }) {
  return terminal ? (
    <>
      <PageHead
        eyebrow="Developer tools"
        index="06"
        title="CLI reference"
        sub="Copy these commands into a terminal on your server, from the repository root."
      />
      <div className="guide-grid">
        {[
          [
            '01',
            'Inspect the runtime',
            'Check the native checkpoint and optional Python environment.',
            'npm run loom -- doctor',
          ],
          [
            '02',
            'List available engines',
            'Read the registry and see which model snapshots are installed.',
            'npm run loom -- list',
          ],
          [
            '03',
            'Render a local plate',
            'Write a PNG and a capsule next to it. No server process is required.',
            'npm run loom -- run strata-1 --prompt "Copper dunes at dusk" --seed 42 --out plate.png',
          ],
          [
            '04',
            'Verify a replay',
            'Rebuild a plate and compare its decoded pixel fingerprint.',
            'npm run loom -- replay plate.png.capsule.json --out replay.png',
          ],
          [
            '05',
            'Install an external model',
            'Read the upstream license first. Downloads a pinned multi-gigabyte snapshot.',
            'npm run loom -- pull sd15',
          ],
          [
            '06',
            'Verify model integrity',
            'Check hashes against the registry, not just filenames and sizes.',
            'npm run loom -- verify sd15',
          ],
          [
            '07',
            'Enable local chat',
            'Install the optional Linux x64 runtime and a small verified GGUF model.',
            'npm run chat:setup',
          ],
          [
            '08',
            'Make a motion study',
            'Export a real H.264 clip with a reproducible scene and camera trajectory.',
            'npm run loom -- video strata-motion --prompt "Tidal sea at dusk" --camera arc --duration 3 --out shot.mp4',
          ],
        ].map(([n, h, p, cmd]) => (
          <article className="guide-card panel" key={n}>
            <span className="eyebrow">COMMAND / {n}</span>
            <h2>{h}</h2>
            <p>{p}</p>
            <Code>{cmd}</Code>
          </article>
        ))}
      </div>
    </>
  ) : (
    <>
      <PageHead
        eyebrow="Reference manual"
        index="07"
        title="Field guide"
        sub="A working guide to the studio, from the first prompt to a verified replay."
      />
      <div className="guide-grid">
        {[
          [
            Layers3,
            'Native scene diffusion',
            'Strata-1 maps English scene and color words to four landscape families. A trained denoiser samples 20 composition parameters; an analytic renderer turns them into pixels. Try dunes, alpine peaks, a tidal sea or orbital craters.',
          ],
          [
            GitFork,
            'Seed drift',
            'Use the fork icon below a canvas to retain its root seed, record its parent and open Advanced settings. Drift rotates the initial noise vector toward a second seeded vector while the material noise stays fixed.',
          ],
          [
            Fingerprint,
            'Replay capsules',
            'Export a capsule from the canvas download menu. It records the exact settings, model identity and pixel hash. Load one to edit its settings, or use the CLI replay command to verify a reconstruction.',
          ],
          [
            Box,
            'External engines',
            'The model library lists supported, pinned Diffusers layouts. Install a matching tensor runtime and use the CLI to pull or import weights. GPU memory and license terms differ by model.',
          ],
          [
            Box,
            'Video engines',
            'Strata Motion samples one learned landscape and moves a camera through it. Wan is a separate optional text-to-video diffusion model for general action. Both export silent H.264 MP4.',
          ],
          [
            Layers3,
            'Creative chat',
            'Choose a local GGUF engine or an operator-configured compatible provider. Stream a reply, stop it or send the text to either visual studio. Conversation history lives in tab memory.',
          ],
        ].map(([Icon, h, p], i) => (
          <article className="guide-card panel" key={h}>
            <div className="guide-icon">
              <Icon size={20} />
            </div>
            <span className="eyebrow">FIELD NOTE / 0{i + 1}</span>
            <h2>{h}</h2>
            <p>{p}</p>
            {i === 2 && (
              <button className="text-btn accent" onClick={load}>
                Load a capsule <ArrowUpRight size={13} />
              </button>
            )}
            {i === 3 && (
              <button className="text-btn accent" onClick={() => go('models')}>
                View model library <ArrowUpRight size={13} />
              </button>
            )}
          </article>
        ))}
      </div>
      <div className="api-note panel">
        <Braces size={20} />
        <div>
          <h3>HTTP interface</h3>
          <p>
            Submit JSON to <code>POST /api/jobs</code>, poll <code>GET /api/jobs/:id</code>, and
            cancel with <code>DELETE /api/jobs/:id</code>. The complete contract is in{' '}
            <code>docs/API.md</code>.
          </p>
        </div>
      </div>
    </>
  );
}
