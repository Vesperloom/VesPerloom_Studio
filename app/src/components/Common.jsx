import React, { useEffect, useRef, useState } from 'react';
import { X, Check, Copy, AlertCircle, LoaderCircle, KeyRound } from 'lucide-react';
import { privateMedia, request } from '../api.js';
export function useMediaUrl(url) {
  const [src, setSrc] = useState('');
  const priv = privateMedia(url);
  useEffect(() => {
    if (!priv || !url) return;
    let active = true,
      href;
    const ctrl = new AbortController();
    setSrc('');
    request(url, { signal: ctrl.signal })
      .then((r) => r.blob())
      .then((b) => {
        if (active) {
          href = URL.createObjectURL(b);
          setSrc(href);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
      ctrl.abort();
      if (href) URL.revokeObjectURL(href);
    };
  }, [url, priv]);
  return (priv ? src : url) || undefined;
}
export function Picture({ url, alt = '', ...props }) {
  const src = useMediaUrl(url);
  return <img src={src} alt={alt} {...props} />;
}
export function IconButton({ label, children, ...props }) {
  return (
    <button type="button" className="icon-btn" title={label} aria-label={label} {...props}>
      {children}
    </button>
  );
}
export function Modal({ title, kicker, children, onClose, wide = false }) {
  const panel = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    const node = panel.current;
    node.focus();
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(e) {
      if (e.key === 'Escape') close.current();
      if (e.key === 'Tab') {
        const els = [
          ...node.querySelectorAll(
            'button:not([disabled]),a[href],input,select,textarea,[tabindex="0"]',
          ),
        ];
        if (!els.length) {
          e.preventDefault();
          return;
        }
        const first = els[0],
          last = els.at(-1);
        if (e.shiftKey && (document.activeElement === first || document.activeElement === node)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = old;
      previous?.focus?.();
    };
  }, []);
  return (
    <div
      className="scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={'dialog ' + (wide ? 'wide' : '')}
        tabIndex={-1}
        ref={panel}
      >
        <header>
          <div>
            {kicker && <div className="eyebrow">{kicker}</div>}
            <h2>{title}</h2>
          </div>
          <IconButton label="Close dialog" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </header>
        {children}
      </section>
    </div>
  );
}
export function Code({ children }) {
  const [state, setState] = useState('');
  async function copy() {
    try {
      await navigator.clipboard.writeText(children);
      setState('copied');
    } catch {
      setState('Select the command to copy it.');
    }
    setTimeout(() => setState(''), 2000);
  }
  return (
    <div className="code-line">
      <code>{children}</code>
      <button
        type="button"
        title={state || 'Copy command'}
        aria-label={state || 'Copy command'}
        onClick={copy}
      >
        {state === 'copied' ? <Check size={15} /> : <Copy size={15} />}
      </button>
      {state && state !== 'copied' && <small>{state}</small>}
    </div>
  );
}
export function ErrorBox({ children }) {
  return (
    <div role="alert" className="error-box">
      <AlertCircle size={16} />
      <span>{children}</span>
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading">
      <LoaderCircle className="spin" size={20} /> Connecting to the studio…
    </div>
  );
}
export function Login({ error, onSubmit }) {
  const [s, set] = useState('');
  return (
    <div className="login">
      <img src="/brand/mark.svg" width="44" alt="Vesperloom" />
      <h1>Unlock this studio</h1>
      <p>Your server is protected with a studio token. It stays in memory for this session.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(s);
        }}
      >
        <label htmlFor="token">Studio token</label>
        <input
          id="token"
          type="password"
          value={s}
          onChange={(e) => set(e.target.value)}
          required
          autoFocus
        />
        {error && <ErrorBox>{error}</ErrorBox>}
        <button className="primary">
          <KeyRound size={16} /> Unlock studio
        </button>
      </form>
    </div>
  );
}
