import { useEffect, useRef, useState } from 'react';
import { request } from '../api.js';
function context(turns) {
  const history = turns
    .slice(-8)
    .filter((t) => t.reply.trim() && t.state === 'done')
    .map((t) => [
      { role: 'user', content: t.user },
      { role: 'assistant', content: t.reply.slice(0, 4000) },
    ]);
  return history;
}
export function useConversation() {
  const [turns, setTurns] = useState([]),
    [draft, setDraft] = useState(''),
    [engine, setEngine] = useState('qwen-small'),
    [busy, setBusy] = useState(false),
    [budget, setBudget] = useState(192);
  const active = useRef(null);
  useEffect(() => () => active.current?.abort(), []);
  async function send(retry = false) {
    if (active.current) return;
    const last = turns.at(-1),
      question = retry ? last?.user : draft.trim();
    if (!question || question.length > 4000) return;
    const prev = retry ? turns.slice(0, -1) : turns;
    const from = context(prev);
    let total = question.length + from.flat().reduce((n, m) => n + m.content.length, 0);
    while (total > 14000 && from.length) {
      total -= from.shift().reduce((n, m) => n + m.content.length, 0);
    }
    const messages = [...from.flat(), { role: 'user', content: question }];
    const ctl = new AbortController(),
      id = crypto.randomUUID();
    active.current = ctl;
    setBusy(true);
    setDraft('');
    setTurns([...prev, { id, user: question, reply: '', state: 'writing', model: engine }]);
    const change = (fn) => setTurns((all) => all.map((t) => (t.id === id ? fn(t) : t)));
    try {
      const r = await request('/api/chat', {
        method: 'POST',
        signal: ctl.signal,
        body: JSON.stringify({ model: engine, messages, maxTokens: budget }),
      });
      const reader = r.body.getReader(),
        decoder = new TextDecoder();
      let buf = '',
        ended = false;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf('\n')) !== -1) {
          const line = buf.slice(0, idx);
          buf = buf.slice(idx + 1);
          if (!line) continue;
          const m = JSON.parse(line);
          if (m.type === 'error') throw Error(m.message);
          if (m.type === 'delta') change((t) => ({ ...t, reply: t.reply + m.text }));
          if (m.type === 'end') {
            ended = true;
            change((t) => ({ ...t, state: 'done', reason: m.reason }));
          }
        }
      }
      if (!ended) throw Error('Connection ended before the reply finished.');
    } catch (e) {
      change((t) => ({
        ...t,
        state: ctl.signal.aborted ? 'stopped' : 'error',
        error: ctl.signal.aborted ? 'Reply stopped.' : e.message,
      }));
    } finally {
      ctl.abort();
      active.current = null;
      setBusy(false);
    }
  }
  return {
    turns,
    draft,
    setDraft,
    engine,
    setEngine,
    budget,
    setBudget,
    busy,
    send,
    stop: () => active.current?.abort(),
    clear: () => {
      if (!active.current) {
        setDraft('');
        setTurns([]);
      }
    },
  };
}
