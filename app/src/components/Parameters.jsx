import React from 'react';
import {
  SlidersHorizontal,
  Layers3,
  ChevronDown,
  Shuffle,
  Dices,
  Hash,
  ChevronRight,
  CornerDownLeft,
  Sparkles,
  LoaderCircle,
  GitFork,
  X,
} from 'lucide-react';
import { seedNumber } from '../api.js';
import { ErrorBox } from './Common.jsx';
export function Parameters({
  settings: s,
  set,
  models,
  job,
  onGenerate,
  cancel,
  error,
  advanced,
  setAdvanced,
  inspire,
  parent,
  clearParent,
}) {
  const model = models.find((m) => m.id === s.model) || models[0];
  const native = model.kind === 'native';
  const patch = (k, v) => set({ ...s, [k]: v });
  return (
    <section className="panel parameters">
      <header className="panel-head">
        <h2>
          <SlidersHorizontal size={16} />
          Parameters
        </h2>
        <span className="micro">CONFIG</span>
      </header>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onGenerate();
        }}
      >
        <fieldset disabled={!!job}>
          <div className="field">
            <label htmlFor="model">Model</label>
            <div className="model-select">
              <div className="model-glyph">
                <Layers3 size={20} />
              </div>
              <div>
                <b>{model.name}</b>
                <small>{native ? 'Native scene diffusion' : model.publisher}</small>
              </div>
              <ChevronDown size={15} />
              <select
                id="model"
                aria-label="Model"
                value={s.model}
                onChange={(e) => {
                  const m = models.find((x) => x.id === e.target.value);
                  set({ ...s, model: m.id, steps: m.steps, drift: 0 });
                }}
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id} disabled={!m.installed}>
                    {m.name}
                    {!m.installed ? ' — not installed' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <div className="label-row">
              <label htmlFor="prompt">Prompt</label>
              <button type="button" className="text-btn accent small" onClick={inspire}>
                <Shuffle size={12} /> Inspire
              </button>
            </div>
            <div className="prompt-box">
              <textarea
                id="prompt"
                aria-describedby="prompt-count"
                maxLength={600}
                required
                value={s.prompt}
                onChange={(e) => patch('prompt', e.target.value)}
                placeholder="Describe your scene…"
              />
              <span id="prompt-count">{s.prompt.length} / 600</span>
            </div>
          </div>
          <div className="field">
            <label>Aspect ratio</label>
            <div className="ratios" role="group" aria-label="Aspect ratio">
              {['3:2', '1:1', '16:9', '4:5'].map((a) => (
                <button
                  aria-pressed={s.aspect === a}
                  type="button"
                  className={s.aspect === a ? 'chosen' : ''}
                  key={a}
                  onClick={() => patch('aspect', a)}
                >
                  <i className={'ratio-icon r' + a.replace(':', '')} />
                  {a}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label htmlFor="seed">Seed</label>
            <div className="seed-row">
              <span>
                <Hash size={15} />
                <input
                  id="seed"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{1,10}"
                  maxLength={10}
                  value={s.seed}
                  onChange={(e) => patch('seed', e.target.value.replace(/\D/g, ''))}
                  required
                />
              </span>
              <button
                className="dice"
                type="button"
                aria-label="Randomize seed"
                title="Randomize seed"
                onClick={() => patch('seed', seedNumber())}
              >
                <Dices size={17} />
              </button>
            </div>
          </div>
          <button
            type="button"
            className={'advanced-toggle ' + (advanced ? 'open' : '')}
            aria-expanded={advanced}
            onClick={() => setAdvanced(!advanced)}
          >
            <SlidersHorizontal size={13} />
            Advanced settings
            <ChevronRight size={14} />
          </button>
          {advanced && (
            <div className="advanced-fields">
              <label htmlFor="steps">
                Denoising steps <b>{s.steps}</b>
              </label>
              <input
                id="steps"
                type="range"
                min="1"
                max={model.maxSteps}
                value={s.steps}
                onChange={(e) => patch('steps', +e.target.value)}
              />
              {native && (
                <>
                  <label htmlFor="drift">
                    Seed drift <b>{s.drift}%</b>
                  </label>
                  <input
                    id="drift"
                    type="range"
                    min="0"
                    max="100"
                    value={s.drift}
                    onChange={(e) => patch('drift', +e.target.value)}
                  />
                  <p>Explore nearby compositions without changing the root seed.</p>
                </>
              )}
              {parent && (
                <div className="branch-tag">
                  <GitFork size={12} />
                  From {parent.slice(0, 8)}
                  <button type="button" onClick={clearParent} aria-label="Clear parent">
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>
          )}
        </fieldset>
        {error && <ErrorBox>{error}</ErrorBox>}
        <div className="generate-box">
          {job ? (
            <>
              <button type="button" className="primary busy" onClick={cancel}>
                <LoaderCircle size={16} className="spin" />
                Cancel render
              </button>
              <small aria-live="polite">
                {job.phase} · {Math.round(job.progress * 100)}%
              </small>
            </>
          ) : (
            <>
              <button className="primary" type="submit" disabled={!s.prompt.trim()}>
                <Sparkles size={17} />
                Generate image
                <span className="enter-key">
                  <CornerDownLeft size={12} />
                </span>
              </button>
              <small>
                <i className="dot" />
                {native ? 'CPU inference' : 'External inference'}
                <span>·</span>Runs on your server
              </small>
            </>
          )}
        </div>
      </form>
    </section>
  );
}
