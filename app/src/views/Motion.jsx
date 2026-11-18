import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpRight,
  Braces,
  Check,
  Clapperboard,
  Expand,
  Film,
  Fingerprint,
  Play,
  Pause,
  SlidersHorizontal,
  Square,
  Shuffle,
  RotateCcw,
  LoaderCircle,
} from 'lucide-react';
import { PageHead } from '../components/Shell.jsx';
import { Picture, useMediaUrl, IconButton, Code, ErrorBox } from '../components/Common.jsx';
import { download, seedNumber } from '../api.js';
const tc = (t, fps) =>
  `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t) % 60).padStart(2, '0')}:${String(Math.floor((t % 1) * fps + 1e-5)).padStart(2, '0')}`;
function Player({ clip, tell }) {
  const vid = useRef(null);
  const [playing, play] = useState(false),
    [time, setTime] = useState(0),
    [bad, setBad] = useState(false);
  const [proxy, setProxy] = useState(
    () =>
      !!clip.review &&
      !document.createElement('video').canPlayType('video/mp4; codecs="avc1.42E01E"'),
  );
  const src = useMediaUrl(proxy ? clip.review : clip.url),
    poster = useMediaUrl(clip.poster),
    s = clip.settings,
    dur = clip.output.seconds;
  async function toggle() {
    try {
      if (!vid.current) return;
      if (playing) vid.current.pause();
      else await vid.current.play();
    } catch {
      tell('Playback is unavailable in this browser. Download the MP4 below.');
    }
  }
  function seek(t) {
    const v = vid.current;
    if (v?.readyState >= 1) {
      v.currentTime = Math.min(dur - 0.001, Math.max(0, t));
      setTime(v.currentTime);
    }
  }
  async function save(which) {
    try {
      await download(
        which === 'mp4' ? clip.url : clip.recipeUrl,
        `vesperloom-${clip.id}.${which === 'mp4' ? 'mp4' : 'motion.json'}`,
      );
    } catch (e) {
      tell(e.message);
    }
  }
  return (
    <section className="panel monitor">
      <header className="panel-head">
        <h2>
          <Film size={17} /> Shot monitor
        </h2>
        <span className="micro">
          <i className="rec-dot" />
          {clip.kind === 'study' ? 'REFERENCE REEL' : 'SAVED SHOT'}
        </span>
      </header>
      <div className="monitor-stage">
        <video
          ref={vid}
          src={src}
          poster={poster}
          playsInline
          disableRemotePlayback
          disablePictureInPicture
          controlsList="noremoteplayback"
          preload="metadata"
          muted
          aria-label={clip.title}
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          onPlay={() => play(true)}
          onPause={() => play(false)}
          onEnded={() => play(false)}
          onError={() => {
            if (!proxy && clip.review) setProxy(true);
            else setBad(true);
          }}
          onClick={toggle}
        />
        <span className="frame-mark lt" />
        <span className="frame-mark rt" />
        <span className="frame-mark lb" />
        <span className="frame-mark rb" />
        {!playing && !bad && (
          <button className="big-play" aria-label="Play clip" onClick={toggle}>
            <Play size={23} fill="currentColor" />
          </button>
        )}
        {!playing && (
          <div className="shot-caption">
            <span>
              {s.model === 'strata-motion' ? 'STRATA MOTION' : 'WAN DIFFUSION'} <i />{' '}
              {s.camera.toUpperCase()}
            </span>
            <strong>{clip.title}</strong>
          </div>
        )}
        {bad && <span className="player-error">Playback unavailable · use Download MP4</span>}
      </div>
      <div className="transport">
        <IconButton label={playing ? 'Pause playback' : 'Play playback'} onClick={toggle}>
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </IconButton>
        <span className="timecode">{tc(time, s.fps)}</span>
        <input
          type="range"
          aria-label="Scrub clip"
          min="0"
          max={dur}
          step={1 / s.fps}
          value={Math.min(time, dur)}
          onChange={(e) => seek(+e.target.value)}
        />
        <span className="timecode total">{tc(dur, s.fps)}</span>
        <IconButton
          label="Fullscreen playback"
          onClick={async () => {
            try {
              if (vid.current?.requestFullscreen) {
                vid.current.controls = true;
                await vid.current.requestFullscreen();
                document.addEventListener(
                  'fullscreenchange',
                  () => {
                    if (vid.current) vid.current.controls = false;
                  },
                  { once: true },
                );
              } else tell('Fullscreen is not available in this browser.');
            } catch {
              tell('Fullscreen is unavailable.');
            }
          }}
        >
          <Expand size={14} />
        </IconButton>
      </div>
      <div className="filmstrip">
        <Picture url={clip.strip} alt="Five sampled frames from the current clip" />
        {Array.from({ length: 5 }, (_, i) => (
          <button
            key={i}
            title={`Seek to frame ${Math.round(((s.frames - 1) * i) / 4) + 1}`}
            aria-label={`Seek to sample ${i + 1}`}
            onClick={() => seek(Math.round(((s.frames - 1) * i) / 4) / s.fps)}
          >
            <span>{String(Math.round(((s.frames - 1) * i) / 4) + 1).padStart(2, '0')}</span>
          </button>
        ))}
      </div>
      <footer className="clip-toolbar">
        <span className="clip-spec">
          H.264 <i /> {s.width}×{s.height} <i /> {s.fps} FPS
        </span>
        <div>
          <IconButton label="Download motion recipe" onClick={() => save('recipe')}>
            <Braces size={16} />
          </IconButton>
          <button className="secondary" onClick={() => save('mp4')}>
            <ArrowDownToLine size={14} /> Download MP4
          </button>
        </div>
      </footer>
    </section>
  );
}
function Seg({ label, value, set, items }) {
  return (
    <fieldset className="segments">
      <legend>{label}</legend>
      <div>
        {items.map(([v, name]) => (
          <button
            type="button"
            aria-pressed={value === v}
            className={value === v ? 'picked' : ''}
            key={v}
            onClick={() => set(v)}
          >
            {name}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
export function Motion({ desk: d, models, tell, refresh }) {
  const { draft: s, clip, job } = d;
  if (!s || !clip) return null;
  const set = (k, v) => d.setDraft((old) => ({ ...old, [k]: v })),
    native = s.model === 'strata-motion',
    eng = models.find((x) => x.id === s.model),
    busy = !!job || d.starting;
  const model = (id) => {
    if (id === 'strata-motion')
      d.setDraft((old) => ({
        ...old,
        model: id,
        steps: 24,
        drift: 0,
        camera: 'glide',
        strength: 65,
        size: 'preview',
        fps: 12,
      }));
    else
      d.setDraft((old) => ({
        ...old,
        model: id,
        steps: 30,
        drift: 0,
        camera: 'model',
        strength: 0,
        size: 'model',
        fps: 16,
      }));
  };
  return (
    <>
      <PageHead
        index="02"
        eyebrow="Moving image workspace"
        title="Video studio"
        sub="Direct a scene, set its motion and export a finished shot."
        action={
          <span className="desk-pill">
            <Clapperboard size={13} /> MOTION DESK
          </span>
        }
      />
      <div className="desk-layout motion-layout">
        <div className="monitor-col">
          <Player key={clip.id} clip={clip} tell={tell} />
          {job && (
            <div className="clip-progress" role="status">
              <LoaderCircle size={15} className="spin" />
              <b>{job.phase}</b>
              <progress max="1" value={job.progress} />
              <span>{Math.round(job.progress * 100)}%</span>
            </div>
          )}
          <section className="shot-shelf">
            <header className="shelf-head">
              <div>
                <h2>Shot shelf</h2>
                <span className="count-tag">{String(d.clips.length + 1).padStart(2, '0')}</span>
              </div>
              <span className="micro">LATEST 16 + STUDY</span>
            </header>
            <div className="reel-list">
              {[...d.clips, d.study].map((r) => (
                <button
                  key={r.id}
                  disabled={busy}
                  className={'reel ' + (r.id === clip.id ? 'selected' : '')}
                  onClick={() => d.pick(r)}
                >
                  <Picture url={r.poster} alt="" />
                  <span>
                    <b>{r.title}</b>
                    <small>
                      {r.kind === 'study' ? 'REFERENCE' : r.settings.model} ·{' '}
                      {r.output.seconds.toFixed(1)} s
                    </small>
                  </span>
                  {r.id === clip.id ? <Check size={14} /> : <ArrowUpRight size={13} />}
                </button>
              ))}
            </div>
          </section>
        </div>
        <aside className="desk-aside">
          <section className="panel desk-card motion-card">
            <header className="panel-head">
              <h2>
                <SlidersHorizontal size={16} /> Shot settings
              </h2>
              <span className="micro">DIRECTOR</span>
            </header>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                d.create();
              }}
            >
              <fieldset className="desk-controls" disabled={busy}>
                <label>
                  Video engine
                  <select value={s.model} onChange={(e) => model(e.target.value)}>
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                        {m.installed ? '' : ' · setup'}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="engine-note">
                  <i className={'dot ' + (eng?.installed ? '' : 'off')} />
                  <p>
                    {native
                      ? 'CPU · Camera animation of a learned Strata landscape.'
                      : 'Temporal diffusion · General text-to-video. Requires a separate tensor runtime and suitable hardware.'}
                  </p>
                </div>
                <label>
                  Scene prompt
                  <textarea
                    rows="3"
                    value={s.prompt}
                    maxLength="600"
                    onChange={(e) => set('prompt', e.target.value)}
                    required
                  />
                </label>
                {d.parent && (
                  <span className="lineage-note">
                    <Fingerprint size={12} /> Source plate · {d.parent.slice(0, 12)}{' '}
                    <button
                      type="button"
                      className="text-btn"
                      onClick={d.clearParent}
                      aria-label="Detach source plate"
                    >
                      Detach
                    </button>
                  </span>
                )}
                <Seg
                  label="Frame"
                  value={s.frame}
                  set={(v) => set('frame', v)}
                  items={[
                    ['wide', 'Wide'],
                    ['square', 'Square'],
                    ['tall', 'Portrait'],
                  ]}
                />
                <div className="desk-pair">
                  <label>
                    Duration
                    <select value={s.duration} onChange={(e) => set('duration', +e.target.value)}>
                      {[2, 3, 4].map((n) => (
                        <option key={n} value={n}>
                          {n} seconds
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {native ? 'Camera path' : 'Sampling steps'}
                    {native ? (
                      <select value={s.camera} onChange={(e) => set('camera', e.target.value)}>
                        <option value="glide">Lateral glide</option>
                        <option value="dolly">Dolly forward</option>
                        <option value="arc">Orbital arc</option>
                      </select>
                    ) : (
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={s.steps}
                        onChange={(e) => set('steps', +e.target.value)}
                      />
                    )}
                  </label>
                </div>
                {native && (
                  <label className="slider-label">
                    <span>
                      Travel intensity <output>{s.strength}%</output>
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={s.strength}
                      onChange={(e) => set('strength', +e.target.value)}
                    />
                  </label>
                )}
                <details className="clip-details">
                  <summary>Output & seed</summary>
                  <div>
                    {native && (
                      <div className="desk-pair">
                        <label>
                          Resolution
                          <select value={s.size} onChange={(e) => set('size', e.target.value)}>
                            <option value="preview">Draft</option>
                            <option value="hd">HD</option>
                          </select>
                        </label>
                        <label>
                          Frame rate
                          <select value={s.fps} onChange={(e) => set('fps', +e.target.value)}>
                            <option value="12">12 fps</option>
                            <option value="24">24 fps</option>
                          </select>
                        </label>
                      </div>
                    )}
                    <label>
                      Motion seed
                      <span className="seed-set">
                        <input
                          type="number"
                          min="0"
                          max="4294967295"
                          value={s.seed}
                          onChange={(e) => set('seed', e.target.value)}
                        />
                        <IconButton
                          label="Random motion seed"
                          onClick={() => set('seed', seedNumber())}
                        >
                          <Shuffle size={14} />
                        </IconButton>
                      </span>
                    </label>
                  </div>
                </details>
              </fieldset>
              {!eng?.installed && (
                <div className="setup-hint motion-setup">
                  <strong>Wan snapshot not installed</strong>
                  <p>Set up the GPU environment first; this download is 28.93 GB.</p>
                  <Code>npm run loom -- pull wan-t2v</Code>
                  <button type="button" className="text-btn accent" onClick={refresh}>
                    <RotateCcw size={12} /> Refresh engines
                  </button>
                </div>
              )}
              {d.error && <ErrorBox>{d.error}</ErrorBox>}
              <div className="render-clip-box">
                {job ? (
                  <button
                    type="button"
                    className="secondary"
                    onClick={d.cancel}
                    disabled={job.status === 'cancelling'}
                  >
                    <Square size={13} /> Cancel clip
                  </button>
                ) : (
                  <button
                    className="primary"
                    disabled={busy || !eng?.installed || !s.prompt.trim()}
                  >
                    <Clapperboard size={16} />
                    {d.starting ? 'Submitting…' : 'Render clip'}
                    <ArrowUpRight size={14} />
                  </button>
                )}
                <small>
                  Silent MP4 · {native ? s.duration * s.fps : s.duration * 16 + 1} frames ·{' '}
                  {native ? s.fps : 16} fps
                </small>
              </div>
            </form>
          </section>
        </aside>
      </div>
    </>
  );
}
