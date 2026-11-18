import React from 'react';
import {
  Aperture,
  MessageSquare,
  Clapperboard,
  Images,
  Layers3,
  TerminalSquare,
  BookOpen,
  ChevronRight,
  Menu,
  X,
  Cpu,
  Orbit,
  PanelLeft,
  Send,
  FlaskConical,
  Star,
  ArrowUpRight,
} from 'lucide-react';
import community from '../../../community/links.json';
import manifest from '../../../package.json';
const nav = [
  ['studio', 'Image studio', Aperture],
  ['motion', 'Video studio', Clapperboard],
  ['chat', 'Studio chat', MessageSquare],
  ['gallery', 'Gallery', Images],
  ['models', 'Model library', Layers3],
];
const resources = [
  ['terminal', 'CLI reference', TerminalSquare],
  ['guide', 'Field guide', BookOpen],
];
export const labels = Object.fromEntries([...nav, ...resources].map(([id, label]) => [id, label]));
export function Shell({ view, go, online, drawer, setDrawer, workspace, children }) {
  const menu = (items) =>
    items.map(([id, label, Icon]) => (
      <button
        key={id}
        aria-label={label}
        title={label}
        className={'nav-item ' + (view === id ? 'selected' : '')}
        aria-current={view === id ? 'page' : undefined}
        onClick={() => go(id)}
      >
        <Icon size={17} strokeWidth={1.65} />
        <span>{label}</span>
        {view === id && <i />}
      </button>
    ));
  return (
    <div className="shell">
      {drawer && (
        <button
          className="nav-scrim"
          aria-label="Close navigation"
          onClick={() => setDrawer(false)}
        />
      )}
      <aside className={'sidebar ' + (drawer ? 'open' : '')}>
        <div className="brand-row">
          <a className="brand" href="#studio" onClick={() => go('studio')}>
            <img src="/brand/mark.svg" width="32" height="32" alt="" />
            <span>Vesperloom</span>
          </a>
          <button
            className="mobile-close"
            aria-label="Close navigation"
            onClick={() => setDrawer(false)}
          >
            <X size={18} />
          </button>
        </div>
        <nav aria-label="Workspace">
          <div className="nav-caption">Workspace</div>
          {menu(nav)}
          <div className="nav-caption second">Resources</div>
          {menu(resources)}
          <div className="nav-caption second">Community</div>
          <a
            href="/seed-lab.html"
            target="_blank"
            rel="noopener noreferrer"
            className="nav-item nav-external"
            aria-label="Open Seed Lab"
            title="Open Seed Lab"
          >
            <FlaskConical size={17} />
            <span>Seed Lab</span>
            <ArrowUpRight className="external-arrow" size={12} />
          </a>
          <a
            href={community.telegram}
            target="_blank"
            rel="noopener noreferrer"
            className="nav-item nav-external channel-link"
            aria-label="Telegram channel"
            title="Telegram · @vesperloom7"
          >
            <Send size={17} />
            <span>Telegram channel</span>
            <ArrowUpRight className="external-arrow" size={12} />
          </a>
          {community.repository && (
            <a
              href={community.repository}
              target="_blank"
              rel="noopener noreferrer"
              className="nav-item nav-external"
              aria-label="Star on GitHub"
              title="Open the repository on GitHub"
            >
              <Star size={17} />
              <span>Star on GitHub</span>
              <ArrowUpRight className="external-arrow" size={12} />
            </a>
          )}
        </nav>
        <div className="side-bottom">
          <div className="runtime-box">
            <div className="runtime-icon">
              <Cpu size={18} />
            </div>
            <div>
              <strong>Local runtime</strong>
              <small>
                <i className={'dot ' + (online ? '' : 'off')} />{' '}
                {online ? 'Engine connected' : 'Connecting'}
              </small>
            </div>
          </div>
          <div className="edition">
            <span>VESPERLOOM</span>
            <span>v{manifest.version}</span>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              onClick={() => setDrawer(true)}
              className="menu-btn"
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
            <PanelLeft size={15} className="desk-only" />
            <span className="bc-space">Workspace</span>
            <ChevronRight size={12} />
            <b>{labels[view]}</b>
          </div>
          <div className="top-right">
            <span className="online">
              <i className={'dot ' + (online ? '' : 'off')} />
              {online ? 'System online' : 'Connecting'}
            </span>
            <i className="rule" />
            <span className="local-label">
              <Orbit size={14} /> {workspace || 'Local instance'}
            </span>
          </div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
export function PageHead({ index, eyebrow, title, sub, action }) {
  return (
    <div className="page-head">
      <div>
        <div className="eyebrow">
          <span className="index-line" />
          {eyebrow} <span className="eyebrow-slash">/</span> {index}
        </div>
        <h1>{title}</h1>
        <p>{sub}</p>
      </div>
      {action}
    </div>
  );
}
