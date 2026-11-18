import React, { useState } from 'react';
import {
  Scan,
  Clapperboard,
  FlaskConical,
  Maximize,
  Download,
  Braces,
  GitFork,
  Layers3,
  ArrowUpRight,
  Frame,
  LoaderCircle,
  ArrowDownToLine,
  Check,
} from 'lucide-react';
import { Picture, IconButton, Modal } from './Common.jsx';
import { download } from '../api.js';
import { fromPlate, encode } from '../../../seed-lab/recipe.mjs';
export function Canvas({ item, job, onFork, onError, onMotion }) {
  const [dialog, show] = useState('');
  const s = item.settings;
  const study = item.kind === 'study';
  const num = study ? item.id.slice(-2) : item.id.slice(0, 4).toUpperCase();
  async function save(type) {
    try {
      await download(
        type === 'png' ? item.image : item.capsuleUrl,
        `vesperloom-${item.id}.${type === 'png' ? 'png' : 'capsule.json'}`,
      );
    } catch (e) {
      onError(e.message);
    }
  }
  return (
    <>
      <section className="canvas panel">
        <header className="panel-head">
          <h2>
            <Scan size={17} />
            Render canvas
          </h2>
          <div className="canvas-tools">
            <span className="micro">
              {study ? 'STUDY' : 'RENDER'} / {num}
            </span>
            <i className="rule" />
            <IconButton label="Expand image" onClick={() => show('image')}>
              <Maximize size={15} />
            </IconButton>
          </div>
        </header>
        <button className="artboard" title="Inspect full image" onClick={() => show('image')}>
          <Picture
            url={item.image}
            alt={s.prompt}
            className={'hero-art ' + (s.aspect === '4:5' || s.aspect === '1:1' ? 'contain' : '')}
          />
          <div className="art-shade" />
          <span className="plate-id">
            <i />
            {study ? 'REFERENCE PLATE' : 'GENERATED PLATE'} <b>№ {num}</b>
          </span>
          <div className="art-caption">
            <small>
              {item.tags.family.toUpperCase()} SERIES <i /> {item.tags.palette.toUpperCase()}
            </small>
            <strong>{item.title}</strong>
          </div>
          <span className="crosshair">+</span>
        </button>
        <footer className="canvas-footer">
          <div className="output-meta">
            <span className="model-chip">
              <Layers3 size={12} />
              <button
                className="to-motion"
                onClick={onMotion}
                aria-label="Send plate to Video studio"
                title="Open the motion desk with this scene"
              >
                <Clapperboard size={14} />
                <span>To video</span>
              </button>
              {s.model === 'strata-1' ? 'Strata-1' : s.model}
            </span>
            <span className="resolution">
              {s.width} × {s.height}
            </span>
          </div>
          <div className="output-actions">
            {s.model === 'strata-1' && (
              <a
                className="lab-remix"
                href={'/seed-lab.html#r=' + encode(fromPlate(item))}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Remix this plate in Seed Lab"
                title="Remix in your browser without sharing the prompt"
              >
                <FlaskConical size={14} />
                <span>Remix</span>
              </a>
            )}
            <IconButton label="Fork this seed" onClick={onFork}>
              <GitFork size={16} />
            </IconButton>
            <IconButton label="Export image or replay capsule" onClick={() => show('export')}>
              <Download size={16} />
            </IconButton>
          </div>
        </footer>
        {job && (
          <div className="work-indicator" role="status">
            <LoaderCircle size={13} className="spin" />
            {job.phase}
            <span>{Math.round(job.progress * 100)}%</span>
          </div>
        )}
      </section>
      {dialog === 'image' && (
        <Modal title={item.title} kicker="Image inspector" wide onClose={() => show('')}>
          <Picture url={item.image} alt={s.prompt} className="inspected-image" />
          <div className="inspector-meta">
            <span>
              {s.width} × {s.height} · seed {s.seed}
            </span>
            <button className="text-btn" onClick={() => save('png')}>
              <Download size={14} /> Save PNG
            </button>
          </div>
        </Modal>
      )}
      {dialog === 'export' && (
        <Modal title="Export this plate" kicker="Output / archive" onClose={() => show('')}>
          <p className="dialog-copy">
            Save the full-resolution image, or take its exact render settings and pixel fingerprint
            with you.
          </p>
          <button className="export-row" onClick={() => save('png')}>
            <Frame />
            <span>
              <b>Original PNG</b>
              <small>
                {s.width} × {s.height} · lossless image
              </small>
            </span>
            <ArrowDownToLine size={17} />
          </button>
          <button className="export-row" onClick={() => save('json')}>
            <Braces />
            <span>
              <b>Replay capsule</b>
              <small>Seed, model identity, settings and SHA-256</small>
            </span>
            <ArrowDownToLine size={17} />
          </button>
        </Modal>
      )}
    </>
  );
}
export function StudyStrip({ studies, selected, onPick, onGallery }) {
  return (
    <section className="studies">
      <header className="shelf-head">
        <div>
          <h2>Scene studies</h2>
          <span className="count-tag">{String(studies.length).padStart(2, '0')}</span>
        </div>
        <button className="text-btn" onClick={onGallery}>
          View gallery <ArrowUpRight size={13} />
        </button>
      </header>
      <div className="study-grid">
        {studies.map((item, i) => (
          <button
            className={'study ' + (item.id === selected ? 'active' : '')}
            key={item.id}
            onClick={() => onPick(item)}
            aria-pressed={item.id === selected}
          >
            <div className="study-picture">
              <Picture url={item.thumb} alt="" />
              <span>0{i + 1}</span>
              {item.id === selected && (
                <i>
                  <Check size={10} strokeWidth={3} />
                </i>
              )}
            </div>
            <b>{item.title}</b>
            <small>{item.tags.family} study</small>
          </button>
        ))}
      </div>
    </section>
  );
}
