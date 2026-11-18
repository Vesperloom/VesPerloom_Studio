import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, BookOpen, CheckCircle2, X } from 'lucide-react';
import { api, setToken } from './api.js';
import { Shell, PageHead, labels } from './components/Shell.jsx';
import { Loading, Login, ErrorBox } from './components/Common.jsx';
import { Canvas, StudyStrip } from './components/Canvas.jsx';
import { DriftCard } from './components/DriftCard.jsx';
import { Parameters } from './components/Parameters.jsx';
import { Gallery } from './views/Gallery.jsx';
import { Library } from './views/Library.jsx';
import { Guide } from './views/Guide.jsx';
import { Chat } from './views/Chat.jsx';
import { Motion } from './views/Motion.jsx';
import { useConversation } from './hooks/useConversation.js';
import { useMotionDesk } from './hooks/useMotionDesk.js';
const page = () =>
  Object.hasOwn(labels, location.hash.slice(1)) ? location.hash.slice(1) : 'studio';
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
function savedJob(value) {
  try {
    if (value === null) sessionStorage.removeItem('vesper-job');
    else if (value) sessionStorage.setItem('vesper-job', value);
    else return sessionStorage.getItem('vesper-job');
  } catch {}
  return null;
}
export default function App() {
  const [view, setView] = useState(page),
    [drawer, setDrawer] = useState(false),
    [ready, setReady] = useState(false),
    [locked, setLocked] = useState(false),
    [bootError, setBootError] = useState('');
  const [models, setModels] = useState([]),
    [studies, setStudies] = useState([]),
    [renders, setRenders] = useState([]),
    [item, setItem] = useState(null),
    [settings, setSettings] = useState(null),
    [parent, setParent] = useState(null);
  const [job, setJob] = useState(null),
    [error, setError] = useState(''),
    [notice, tell] = useState(''),
    [advanced, setAdvanced] = useState(false);
  const [caps, setCaps] = useState(null);
  const conversation = useConversation(),
    desk = useMotionDesk(tell);
  const file = useRef(null),
    counter = useRef(0),
    submitting = useRef(false);
  const go = useCallback((id) => {
    location.hash = id;
    setView(id);
    setDrawer(false);
    window.scrollTo(0, 0);
  }, []);
  useEffect(() => {
    const change = () => {
      setView(page());
      setDrawer(false);
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  useEffect(() => {
    document.title = `${labels[view]} — Vesperloom`;
  }, [view]);
  const boot = useCallback(async () => {
    try {
      setBootError('');
      const [m, s, r, cap] = await Promise.all([
        api('/api/models'),
        api('/api/studies'),
        api('/api/gallery'),
        api('/api/capabilities'),
        desk.load(),
      ]);
      setModels(m);
      setCaps(cap);
      conversation.setEngine(cap.chat.find((x) => x.ready)?.id || cap.chat[0]?.id || 'qwen-small');
      setStudies(s);
      setRenders(r);
      const first = r[0] || s[0];
      setItem(first);
      setSettings(first.settings);
      setLocked(false);
      setReady(true);
      const id = savedJob();
      if (id) {
        try {
          setJob(await api('/api/jobs/' + id));
        } catch {
          savedJob(null);
        }
      }
    } catch (e) {
      if (e.status === 401) {
        setLocked(true);
        setBootError('');
      } else setBootError(e.message);
    }
  }, []);
  useEffect(() => {
    void boot();
  }, [boot]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => tell(''), 3800);
    return () => clearTimeout(t);
  }, [notice]);
  const adopt = (r) => {
    setItem(r);
    setSettings({ ...r.settings });
    setParent(null);
    setError('');
  };
  const pick = (r) => {
    if (job) {
      tell('Finish or cancel the current render first.');
      return;
    }
    adopt(r);
    go('studio');
  };
  const jobId = job?.id;
  useEffect(() => {
    if (!jobId) return;
    let live = true;
    (async () => {
      let retries = 0;
      while (live) {
        try {
          const j = await api('/api/jobs/' + jobId);
          if (!live) return;
          retries = 0;
          if (j.status === 'done') {
            adopt(j.result);
            setRenders((old) =>
              [j.result, ...old.filter((x) => x.id !== j.result.id)].slice(0, 64),
            );
            setJob(null);
            savedJob(null);
            tell('Plate saved to your gallery.');
            return;
          }
          if (j.status === 'cancelled' || j.status === 'failed') {
            setJob(null);
            savedJob(null);
            if (j.status === 'failed') setError(j.error || 'Render failed.');
            else tell('Render cancelled.');
            return;
          }
          setJob(j);
        } catch (e) {
          if (!live) return;
          if (e.status === 404 || ++retries > 3) {
            setError(e.message + ' Reload to reconnect.');
            setJob(null);
            if (e.status === 404) savedJob(null);
            return;
          }
        }
        await delay(400);
      }
    })();
    return () => {
      live = false;
    };
  }, [jobId]);
  async function generate() {
    if (submitting.current || job || !settings) return;
    setError('');
    const seed = Number(settings.seed);
    if (settings.seed === '' || !Number.isInteger(seed) || seed < 0 || seed > 4294967295) {
      setError('Choose a seed from 0 to 4294967295.');
      return;
    }
    if (!settings.prompt.trim()) {
      setError('Add a prompt first.');
      return;
    }
    submitting.current = true;
    try {
      const j = await api('/api/jobs', {
        method: 'POST',
        body: JSON.stringify({ ...settings, seed, parent }),
      });
      savedJob(j.id);
      setJob(j);
    } catch (e) {
      setError(e.message);
    } finally {
      submitting.current = false;
    }
  }
  useEffect(() => {
    const key = (e) => {
      if (
        view === 'studio' &&
        (e.metaKey || e.ctrlKey) &&
        e.key === 'Enter' &&
        !document.querySelector('[role="dialog"]')
      ) {
        e.preventDefault();
        void generate();
      }
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  });
  async function cancel() {
    if (!job) return;
    try {
      await api('/api/jobs/' + job.id, { method: 'DELETE' });
    } catch (e) {
      if (e.status !== 409) setError(e.message);
    }
  }
  function fork() {
    if (job) return;
    setSettings({
      ...item.settings,
      drift: item.settings.model === 'strata-1' ? (item.settings.drift + 17) % 101 : 0,
    });
    setParent(item.id);
    setAdvanced(true);
    tell('Branch prepared. Generate to save a child plate.');
  }
  async function loadCapsule(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      if (job) throw Error('Finish the current render before importing a capsule.');
      if (f.size > 16384) throw Error('Capsule exceeds the size limit.');
      const c = JSON.parse(await f.text());
      const m = models.find((x) => x.id === c.settings?.model);
      if (
        c.schema !== 'vesperloom.capsule/v1' ||
        c.engineVersion !== '0.1.0' ||
        !m ||
        c.model?.id !== m.id ||
        typeof c.settings.prompt !== 'string' ||
        !c.settings.prompt.trim() ||
        c.settings.prompt.length > 600 ||
        !Number.isInteger(c.settings.steps) ||
        c.settings.steps < 1 ||
        c.settings.steps > m.maxSteps ||
        !Number.isInteger(c.settings.drift) ||
        c.settings.drift < 0 ||
        c.settings.drift > 100 ||
        (m.kind !== 'native' && c.settings.drift !== 0) ||
        c.settings.seed < 0 ||
        c.settings.seed > 4294967295 ||
        !Number.isInteger(c.settings.seed) ||
        !['3:2', '1:1', '16:9', '4:5'].includes(c.settings.aspect)
      )
        throw Error('Unrecognized Vesperloom capsule.');
      if (!m.installed) throw Error(`${m.name} is not installed.`);
      setSettings({ ...c.settings });
      setParent(null);
      setAdvanced(true);
      setError('');
      go('studio');
      tell('Capsule settings loaded. Use CLI replay for digest verification.');
    } catch (e) {
      tell(e.message);
    }
  }
  function useModel(m) {
    if (job) {
      tell('A render is already in progress.');
      return;
    }
    setSettings({ ...settings, model: m.id, steps: m.steps, drift: 0 });
    setParent(null);
    go('studio');
  }
  async function refresh() {
    try {
      setCaps(await api('/api/capabilities'));
      tell('Engine inventory refreshed.');
    } catch (e) {
      tell(e.message);
    }
  }
  function handoff(reply, dest) {
    const full = reply.trim();
    const text =
      full.length > 600
        ? full
            .slice(0, 600)
            .replace(/\s+\S*$/, '')
            .trim() || full.slice(0, 600)
        : full;
    if (dest === 'studio') {
      if (job) {
        tell('Finish or cancel the current image first.');
        return;
      }
      setSettings({ ...settings, prompt: text });
      setParent(null);
      setError('');
    } else if (!desk.prepare(text, null)) return;
    go(dest);
    tell(
      full.length > 600
        ? 'First 600 characters or less copied. Edit the scene prompt before rendering.'
        : 'Prompt copied. Review it before rendering.',
    );
  }
  function animate() {
    if (desk.prepare(item.settings.prompt, item)) {
      go('motion');
      tell(
        item.settings.model === 'strata-1'
          ? 'Scene seed and sampling settings carried into the shot.'
          : 'Prompt and seed copied; this is not image-conditioned video.',
      );
    }
  }
  if (locked)
    return (
      <Login
        error={bootError}
        onSubmit={async (t) => {
          setToken(t);
          try {
            await api('/api/models');
            await boot();
          } catch {
            setBootError('That token did not unlock the studio.');
          }
        }}
      />
    );
  return (
    <Shell {...{ view, go, drawer, setDrawer }} online={ready} workspace={caps?.workspace}>
      <input
        type="file"
        className="hidden-input"
        accept=".json,application/json"
        onChange={loadCapsule}
        ref={file}
      />
      {!ready ? (
        bootError ? (
          <div className="empty">
            <ErrorBox>{bootError}</ErrorBox>
            <button className="secondary" onClick={boot}>
              Retry connection
            </button>
          </div>
        ) : (
          <Loading />
        )
      ) : view === 'studio' ? (
        <>
          <PageHead
            index="01"
            eyebrow="Generation workspace"
            title="Image studio"
            sub="A local workbench for generative image-making."
            action={
              <button className="secondary guide-shortcut" onClick={() => go('guide')}>
                <BookOpen size={14} />
                Studio guide
                <ArrowUpRight size={13} />
              </button>
            }
          />
          <div className="studio-layout">
            <div className="canvas-column">
              <Canvas item={item} job={job} onFork={fork} onError={tell} onMotion={animate} />
              <StudyStrip
                studies={studies}
                selected={item.id}
                onPick={pick}
                onGallery={() => go('gallery')}
              />
            </div>
            <div className="parameter-column">
              <Parameters
                settings={settings}
                set={setSettings}
                {...{ models, job, cancel, error, advanced, setAdvanced, parent }}
                onGenerate={generate}
                clearParent={() => setParent(null)}
                inspire={() => {
                  counter.current = (counter.current + 1) % studies.length;
                  setSettings({ ...settings, prompt: studies[counter.current].settings.prompt });
                }}
              />
              {item.settings.model === 'strata-1' && <DriftCard disabled={!!job} onClick={fork} />}
            </div>
          </div>
          <footer className="studio-foot">
            <span>
              <i className="dot" />
              LOCAL-FIRST IMAGE SYNTHESIS
            </span>
            <span>
              VESPERLOOM <i>/</i> STUDIO 01
            </span>
          </footer>
        </>
      ) : view === 'chat' ? (
        <Chat c={conversation} models={caps.chat} {...{ handoff, tell, refresh }} />
      ) : view === 'motion' ? (
        <Motion desk={desk} models={caps.video} {...{ tell, refresh }} />
      ) : view === 'gallery' ? (
        <Gallery
          {...{ studies, renders, go }}
          select={pick}
          importCapsule={() => file.current.click()}
        />
      ) : view === 'models' ? (
        <Library models={models} useModel={useModel} caps={caps} go={go} />
      ) : (
        <Guide terminal={view === 'terminal'} go={go} load={() => file.current.click()} />
      )}
      {notice && (
        <div role="status" className="toast">
          <CheckCircle2 size={16} />
          {notice}
          <button aria-label="Dismiss notification" onClick={() => tell('')}>
            <X size={13} />
          </button>
        </div>
      )}
    </Shell>
  );
}
