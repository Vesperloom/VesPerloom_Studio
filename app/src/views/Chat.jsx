import React, { useEffect, useRef } from 'react';
import {
  MessageSquare,
  ArrowUp,
  ArrowUpRight,
  ArrowDownToLine,
  Aperture,
  Clapperboard,
  Cpu,
  Globe2,
  SlidersHorizontal,
  Square,
  RotateCcw,
  Eraser,
  LockKeyhole,
  Copy,
} from 'lucide-react';
import { PageHead } from '../components/Shell.jsx';
import { Code, IconButton } from '../components/Common.jsx';
import { ReplyText } from '../components/ReplyText.jsx';
const starters = [
  [
    '01',
    'Write a scene',
    'Write one concise English image prompt for cobalt dunes under two moons.',
  ],
  ['02', 'Plan a shot', 'Describe a camera move across a quiet alpine landscape in two sentences.'],
  ['03', 'Find a palette', 'Suggest three color palettes for a landscape at dusk.'],
];
function Turn({ t, last, busy, retry, handoff, tell }) {
  return (
    <article className="turn">
      <div className="speaker">
        <i className="avatar human">Y</i>
        <b>You</b>
      </div>
      <div className="message mine" dir="auto">
        {t.user}
      </div>
      <div className="speaker">
        <i className="avatar">
          <img src="/brand/mark.svg" alt="" />
        </i>
        <b>Vesperloom</b>
        <small>{t.model}</small>
        {t.state === 'writing' && <span className="writing">writing…</span>}
      </div>
      {t.reply ? (
        <div className="message assistant" dir="auto">
          <ReplyText text={t.reply} tell={tell} />
        </div>
      ) : t.state === 'writing' ? (
        <div className="ponder">
          <i />
          <i />
          <i />
          <span>Preparing response</span>
        </div>
      ) : null}
      {t.error && (
        <p className="turn-error" role="status">
          {t.error}
        </p>
      )}
      {t.reason === 'length' && (
        <p className="turn-error">
          Output limit reached. Ask for a continuation or raise the reply budget.
        </p>
      )}
      {t.state !== 'writing' && (
        <div className="message-actions">
          {t.reply.trim() && (
            <>
              <button onClick={() => handoff(t.reply, 'studio')}>
                <Aperture size={13} /> To image
              </button>
              <button onClick={() => handoff(t.reply, 'motion')}>
                <Clapperboard size={13} /> To video
              </button>
              <IconButton
                label="Copy reply"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(t.reply);
                    tell('Reply copied.');
                  } catch {
                    tell('Select the reply to copy its text.');
                  }
                }}
              >
                <Copy size={13} />
              </IconButton>
            </>
          )}
          {last && (
            <button disabled={busy} onClick={() => retry(true)}>
              <RotateCcw size={12} /> Retry
            </button>
          )}
        </div>
      )}
    </article>
  );
}
function exportChat(turns) {
  const data = JSON.stringify(
    {
      schema: 'vesperloom.conversation/v1',
      turns: turns.map(({ user, reply, model, state }) => ({ user, reply, model, state })),
    },
    null,
    2,
  );
  const u = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = u;
  a.download = 'vesperloom-conversation.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 4000);
}
export function Chat({ c, models, handoff, tell, refresh }) {
  const scroll = useRef(null),
    follow = useRef(true),
    field = useRef(null);
  const m = models.find((x) => x.id === c.engine) || models[0];
  useEffect(() => {
    if (scroll.current && follow.current) scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [c.turns]);
  const start = (text) => {
    c.setDraft(text);
    field.current?.focus();
  };
  return (
    <>
      <PageHead
        index="03"
        eyebrow="Language workspace"
        title="Studio chat"
        sub="Develop an idea in conversation, then take it straight to a canvas or shot."
        action={
          <button
            className="secondary"
            disabled={c.busy || !c.turns.length}
            onClick={() => exportChat(c.turns)}
          >
            <ArrowDownToLine size={14} /> Export chat
          </button>
        }
      />
      <div className="desk-layout chat-layout">
        <section className="panel thread">
          <header className="panel-head">
            <h2>
              <MessageSquare size={17} /> Conversation
            </h2>
            <button
              className="text-btn"
              disabled={c.busy || !c.turns.length}
              onClick={() => {
                if (window.confirm('Clear this conversation from this tab?')) c.clear();
              }}
            >
              <Eraser size={14} /> Clear
            </button>
          </header>
          <div
            className="thread-body"
            ref={scroll}
            onScroll={(e) => {
              const s = e.currentTarget;
              follow.current = s.scrollHeight - s.clientHeight - s.scrollTop < 90;
            }}
          >
            {!c.turns.length ? (
              <div className="chat-intro">
                <div className="thread-emblem">
                  <img src="/brand/mark.svg" alt="" />
                </div>
                <span className="eyebrow">CREATIVE DESK / NEW THREAD</span>
                <h2>What are we making?</h2>
                <p>
                  Draft a prompt, storyboard a shot, or ask a question. Your reply can become the
                  starting point for the next studio.
                </p>
                <div className="starter-list">
                  {starters.map(([n, title, text]) => (
                    <button key={n} onClick={() => start(text)}>
                      <small>{n}</small>
                      <span>{title}</span>
                      <ArrowUpRight size={13} />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              c.turns.map((t, i) => (
                <Turn
                  key={t.id}
                  t={t}
                  last={i === c.turns.length - 1}
                  busy={c.busy}
                  retry={c.send}
                  {...{ handoff, tell }}
                />
              ))
            )}
          </div>
          <form
            className="composer"
            onSubmit={(e) => {
              e.preventDefault();
              follow.current = true;
              c.send();
            }}
          >
            <textarea
              aria-label="Message"
              placeholder={
                m?.ready
                  ? 'Message the studio…'
                  : 'Draft a message while your engine is being set up…'
              }
              maxLength={4000}
              ref={field}
              value={c.draft}
              onChange={(e) => c.setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  if (!c.busy && m?.ready) {
                    follow.current = true;
                    c.send();
                  }
                }
              }}
            />
            <div className="compose-bar">
              <small>
                <span className={'dot ' + (m?.ready ? '' : 'off')} />
                {m?.name || 'No engine'}
              </small>
              {c.busy ? (
                <button type="button" className="send-btn" onClick={c.stop}>
                  <Square size={12} fill="currentColor" /> Stop reply
                </button>
              ) : (
                <button className="send-btn" disabled={!m?.ready || !c.draft.trim()}>
                  <ArrowUp size={15} /> Send
                </button>
              )}
            </div>
          </form>
          <footer className="chat-foot">
            <span>Enter to send · Shift+Enter for a new line</span>
            <span>{c.draft.length} / 4000</span>
          </footer>
        </section>
        <aside className="desk-aside">
          <section className="panel desk-card">
            <header className="panel-head">
              <h2>
                <SlidersHorizontal size={16} /> Session controls
              </h2>
            </header>
            <div className="desk-controls">
              <label>
                Chat engine
                <select
                  value={c.engine}
                  disabled={c.busy}
                  onChange={(e) => c.setEngine(e.target.value)}
                >
                  {models.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                      {x.ready ? '' : ' · setup'}
                    </option>
                  ))}
                </select>
              </label>
              <div className={'status-card ' + (!m?.local ? 'remote' : '')}>
                {m?.local ? <Cpu size={17} /> : <Globe2 size={17} />}
                <div>
                  <b>{m?.local ? 'Local CPU inference' : 'Connected provider'}</b>
                  <p>
                    {m?.local
                      ? 'No message leaves this server.'
                      : `Sending a message shares the included conversation with ${m?.host}.`}
                  </p>
                </div>
              </div>
              {!m?.ready && (
                <div className="setup-hint">
                  <strong>Server setup required</strong>
                  <p>Run on your VPS, then refresh the engine list.</p>
                  <Code>{m?.setup || 'npm run chat:setup'}</Code>
                  <button className="text-btn accent" onClick={refresh}>
                    <RotateCcw size={12} /> Refresh engines
                  </button>
                </div>
              )}
              <label>
                Reply budget
                <select
                  disabled={c.busy}
                  value={c.budget}
                  onChange={(e) => c.setBudget(Number(e.target.value))}
                >
                  <option value="96">Brief · 96 tokens</option>
                  <option value="192">Balanced · 192 tokens</option>
                  <option value="384">Extended · 384 tokens</option>
                </select>
              </label>
            </div>
          </section>
          <section className="panel direction-card">
            <span className="eyebrow">WORKFLOW / 01—03</span>
            <h3>From words to worlds</h3>
            <div className="workflow-line">
              <MessageSquare />
              <i />
              <Aperture />
              <i />
              <Clapperboard />
            </div>
            <p>
              Send any reply to Image studio or Video studio. You can edit the prompt before
              anything renders.
            </p>
          </section>
          <div className="private-note">
            <LockKeyhole size={14} />
            <p>Conversation stays in tab memory and clears on reload. Export to keep a copy.</p>
          </div>
        </aside>
      </div>
    </>
  );
}
