import React, { useState } from 'react';
import { Layers3, Box, Cpu, HardDrive, ArrowUpRight, Check, Package } from 'lucide-react';
import { PageHead } from '../components/Shell.jsx';
import { Code, Modal } from '../components/Common.jsx';
const descriptions = {
  'strata-1':
    'A compact diffusion prior for atmospheric landscapes. Original Vesperloom weights, sampled entirely on your CPU.',
  sd15: 'A general text-to-image latent diffusion pipeline with a CLIP text encoder and a U-Net denoiser.',
  sdxl: 'A dual-encoder latent diffusion model for higher-resolution composition and detail.',
  'sdxl-turbo': 'A distilled SDXL pipeline designed for one to four denoising steps.',
  'flux-schnell':
    'A rectified-flow transformer with T5 and CLIP conditioning, tuned for short sampling schedules.',
};
const size = (m) =>
  m.kind === 'native' ? `${(m.bytes / 1024).toFixed(1)} KiB` : `${(m.bytes / 1e9).toFixed(2)} GB`;
export function Library({ models, useModel, caps, go }) {
  const [detail, set] = useState(null);
  return (
    <>
      <PageHead
        eyebrow="Engine registry"
        index="05"
        title="Model library"
        sub="Explore image checkpoints, language engines and motion pipelines."
      />
      <div className="registry-summary">
        <div>
          <span className="dot" />
          <b>{models.filter((m) => m.installed).length}</b> installed
        </div>
        <span className="rule" />
        <div>
          <Layers3 size={15} />
          <b>{models.length}</b> image profiles
        </div>
      </div>
      <div className="model-grid">
        {models.map((m) => (
          <article className="model-card panel" key={m.id}>
            <div className="model-card-top">
              <span className={'library-glyph ' + (m.kind === 'native' ? 'native' : '')}>
                {m.kind === 'native' ? <Layers3 /> : <Box />}
              </span>
              <span className={'badge ' + (m.installed ? 'ready' : '')}>
                {m.installed ? <Check size={11} /> : <Package size={11} />}{' '}
                {m.installed ? 'Installed' : 'Registry'}
              </span>
            </div>
            <div className="eyebrow">{m.publisher}</div>
            <h2>{m.name}</h2>
            <p>{descriptions[m.id]}</p>
            <div className="model-spec">
              <span>
                <HardDrive size={13} />
                {size(m)}
              </span>
              <span>
                <Cpu size={13} />
                {m.vram}
              </span>
            </div>
            <button className="model-link" onClick={() => set(m)}>
              Model details <ArrowUpRight size={14} />
            </button>
          </article>
        ))}
      </div>
      <header className="shelf-head media-head">
        <div>
          <h2>Language & motion</h2>
        </div>
        <span className="micro">ADDITIONAL ENGINES</span>
      </header>
      <div className="model-grid">
        {[
          ...caps.chat.map((m) => ({
            ...m,
            target: 'chat',
            label: m.local ? 'CPU · GGUF' : 'Compatible provider',
            status: m.ready ? 'Available' : 'Setup required',
          })),
          ...caps.video.map((m) => ({
            ...m,
            target: 'motion',
            label: m.kind === 'native' ? 'CPU · scene + camera' : 'GPU · temporal diffusion',
            status: m.installed ? 'Snapshot available' : 'Setup required',
          })),
        ].map((m) => (
          <article className="panel direction-card" key={m.id}>
            <span className="eyebrow">{m.label}</span>
            <h3>{m.name}</h3>
            <p>
              {m.status}
              {m.bytes ? ` · ${size(m)}` : ''}
            </p>
            <button className="text-btn accent" onClick={() => go(m.target)}>
              Open {m.target === 'chat' ? 'chat' : 'video studio'} <ArrowUpRight size={13} />
            </button>
          </article>
        ))}
      </div>
      {detail && (
        <Modal title={detail.name} kicker="Registry / model card" onClose={() => set(null)}>
          <p className="dialog-copy">{descriptions[detail.id]}</p>
          <dl className="spec-list">
            <div>
              <dt>Architecture</dt>
              <dd>{detail.architecture}</dd>
            </div>
            <div>
              <dt>Weight inventory</dt>
              <dd>
                {size(detail)} · {detail.fileCount} files
              </dd>
            </div>
            <div>
              <dt>License</dt>
              <dd>{detail.license}</dd>
            </div>
            <div>
              <dt>Revision</dt>
              <dd>{detail.revision?.slice(0, 12) || '1.0.0'}</dd>
            </div>
          </dl>
          {detail.kind !== 'native' && (
            <>
              <p className="dialog-copy">
                Review upstream terms and install the optional Python tensor runtime first.
                Downloads run from your server terminal, never from the browser.
              </p>
              <Code>{`npm run loom -- pull ${detail.id}`}</Code>
              <a
                className="inline-link"
                target="_blank"
                rel="noreferrer"
                href={'https://huggingface.co/' + detail.repo}
              >
                Upstream model card <ArrowUpRight size={13} />
              </a>
            </>
          )}
          {detail.installed && (
            <button
              className="primary"
              onClick={() => {
                useModel(detail);
                set(null);
              }}
            >
              Use in studio <ArrowUpRight size={15} />
            </button>
          )}
        </Modal>
      )}
    </>
  );
}
