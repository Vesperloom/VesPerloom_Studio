import React, { useState } from 'react';
import { ArrowUpRight, Images, Upload, Search } from 'lucide-react';
import { PageHead } from '../components/Shell.jsx';
import { Picture } from '../components/Common.jsx';
export function Gallery({ renders, studies, select, go, importCapsule }) {
  const [filter, setFilter] = useState('All plates'),
    [q, search] = useState('');
  const items = (
    filter === 'My renders' ? renders : filter === 'Studies' ? studies : [...renders, ...studies]
  ).filter((r) =>
    (r.title + ' ' + r.settings.prompt + ' ' + r.settings.seed)
      .toLowerCase()
      .includes(q.toLowerCase()),
  );
  return (
    <>
      <PageHead
        index="04"
        eyebrow="Image archive"
        title="Gallery"
        sub="An index of your renders and the original Strata studies."
        action={
          <button className="secondary" onClick={importCapsule}>
            <Upload size={15} />
            Load capsule
          </button>
        }
      />
      <div className="gallery-tools">
        <div className="tabs">
          {['All plates', 'My renders', 'Studies'].map((x) => (
            <button key={x} className={x === filter ? 'current' : ''} onClick={() => setFilter(x)}>
              {x}
            </button>
          ))}
        </div>
        <label className="search">
          <Search size={14} />
          <input
            aria-label="Search gallery"
            value={q}
            onChange={(e) => search(e.target.value)}
            placeholder="Search plates…"
          />
        </label>
      </div>
      <div className="gallery-grid">
        {items.map((it) => (
          <button key={it.id} className="gallery-card" onClick={() => select(it)}>
            <div>
              <Picture url={it.thumb} alt={it.settings.prompt} />
              <span>{it.kind}</span>
            </div>
            <section>
              <div className="eyebrow">
                {it.tags.family} / {it.tags.palette}
              </div>
              <h3>{it.title}</h3>
              <footer>
                <span>SEED {it.settings.seed}</span>
                <ArrowUpRight size={15} />
              </footer>
            </section>
          </button>
        ))}
      </div>
      {!items.length && (
        <div className="empty">
          <Images size={28} />
          <h2>{q ? 'No matching plates' : 'No renders yet'}</h2>
          <p>
            {q
              ? 'Try another title, prompt or seed.'
              : 'Generate an image in the studio to add your first plate.'}
          </p>
          <button className="secondary" onClick={() => (q ? search('') : go('studio'))}>
            {q ? 'Clear search' : 'Open studio'}
            <ArrowUpRight size={14} />
          </button>
        </div>
      )}
    </>
  );
}
