import { useMemo, useState } from 'react';
import { GLOSSARY } from '../data/glossary';
import { useI18n } from '../i18n';

/** Every term, searchable, with its IAST and Devanagari spellings. */
export function GlossaryList() {
  const [q, setQ] = useState('');
  const { terms } = useI18n();
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const sorted = [...GLOSSARY].sort((a, b) => a.term.localeCompare(b.term));
    if (!s) return sorted;
    return sorted.filter((g) => [g.term, g.iast, g.deva, g.def, ...(g.match ?? [])].some((x) => x.toLowerCase().includes(s)));
  }, [q]);
  return (
    <section className="card glossary-page" aria-labelledby="gl-title">
      <div className="card-head">
        <h2 id="gl-title" className="learn-h2">Glossary</h2>
        <label className="gl-search">
          <span className="sr-only">Search the glossary</span>
          <input type="search" placeholder="Search: nakshatra, नवांश, exalted…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>
      <p className="muted" aria-live="polite">{list.length} term{list.length === 1 ? '' : 's'}. The same words are underlined in the readings: hover, tap or focus one to see what it means.</p>
      <dl className="gl-list">
        {list.map((g) => (
          <div key={g.id} id={`term-${g.id}`}>
            <dt>
              <b>{g.term}</b>{' '}
              <span className="muted" lang="sa">{terms === 'devanagari' ? `${g.deva} · ${g.iast}` : `${g.iast} · ${g.deva}`}</span>
            </dt>
            <dd>
              {g.literal && <i>“{g.literal}.” </i>}
              {g.def}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
