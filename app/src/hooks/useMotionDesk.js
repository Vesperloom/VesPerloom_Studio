import { useState, useEffect, useRef } from 'react';
import { api } from '../api.js';
const key = 'vesper-motion-job';
function remember(id) {
  try {
    if (id) sessionStorage.setItem(key, id);
    else sessionStorage.removeItem(key);
  } catch {}
}
export function useMotionDesk(tell) {
  const [clips, setClips] = useState([]),
    [study, setStudy] = useState(null),
    [clip, setClip] = useState(null),
    [draft, setDraft] = useState(null),
    [parent, setParent] = useState(null),
    [job, setJob] = useState(null),
    [error, setError] = useState(''),
    [starting, setStarting] = useState(false);
  const submitting = useRef(false);
  async function load() {
    const [s, list] = await Promise.all([api('/api/motion-study'), api('/api/clips')]);
    setStudy(s);
    setClips(list);
    const first = list[0] || s;
    setClip(first);
    setDraft(first.settings);
    setParent(first.parent);
    try {
      const id = sessionStorage.getItem(key);
      if (id) setJob(await api('/api/jobs/' + id));
    } catch {
      remember(null);
    }
  }
  const jobId = job?.id;
  useEffect(() => {
    if (!jobId) return;
    let live = true,
      timer;
    let fails = 0;
    const poll = async () => {
      try {
        const j = await api('/api/jobs/' + jobId);
        if (!live) return;
        fails = 0;
        if (j.status === 'done') {
          setClip(j.result);
          setClips((old) => [j.result, ...old.filter((x) => x.id !== j.result.id)].slice(0, 16));
          setJob(null);
          remember(null);
          tell('Clip saved to the shot shelf.');
          return;
        }
        if (['cancelled', 'failed'].includes(j.status)) {
          setJob(null);
          remember(null);
          if (j.status === 'failed') setError(j.error || 'Clip failed.');
          else tell('Clip cancelled.');
          return;
        }
        setJob(j);
      } catch (e) {
        if (!live) return;
        if (e.status === 404 || ++fails > 3) {
          setJob(null);
          if (e.status === 404) remember(null);
          setError(e.message + ' Reload to reconnect.');
          return;
        }
      }
      if (live) timer = setTimeout(poll, 420);
    };
    poll();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [jobId, tell]);
  async function create() {
    if (submitting.current || job) return;
    setError('');
    if (
      !draft?.prompt.trim() ||
      draft.seed === '' ||
      !Number.isInteger(Number(draft.seed)) ||
      +draft.seed < 0 ||
      +draft.seed >= 2 ** 32
    ) {
      setError('Supply a prompt and a seed from 0 to 4294967295.');
      return;
    }
    submitting.current = true;
    setStarting(true);
    try {
      const j = await api('/api/video/jobs', {
        method: 'POST',
        body: JSON.stringify({ ...draft, seed: Number(draft.seed), parent }),
      });
      remember(j.id);
      setJob(j);
    } catch (e) {
      setError(e.message);
    } finally {
      submitting.current = false;
      setStarting(false);
    }
  }
  async function cancel() {
    try {
      await api('/api/jobs/' + job.id, { method: 'DELETE' });
    } catch (e) {
      if (e.status !== 409) setError(e.message);
    }
  }
  function pick(c) {
    if (job || starting) return;
    setClip(c);
    setDraft(c.settings);
    setParent(c.parent);
    setError('');
  }
  function prepare(text, plate) {
    if (job || starting) {
      tell('Finish or cancel the current clip first.');
      return false;
    }
    const native = plate?.settings.model === 'strata-1';
    setDraft((d) => ({
      ...study.settings,
      ...(plate
        ? {
            seed: plate.settings.seed,
            frame:
              plate.settings.aspect === '1:1'
                ? 'square'
                : plate.settings.aspect === '4:5'
                  ? 'tall'
                  : 'wide',
            ...(native ? { drift: plate.settings.drift, steps: plate.settings.steps } : {}),
          }
        : { seed: d.seed }),
      prompt: text,
    }));
    setParent(plate?.id || null);
    setError('');
    return true;
  }
  return {
    load,
    study,
    clips,
    clip,
    draft,
    setDraft,
    parent,
    clearParent: () => setParent(null),
    job,
    error,
    starting,
    create,
    cancel,
    pick,
    prepare,
  };
}
