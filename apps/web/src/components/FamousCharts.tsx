import { useMemo, useState } from 'react';
import {
  COUNTRY_NAMES, FAMOUS_CHARTS, RODDEN_MEANING,
  type FamousChart, type FamousCountry, type RoddenRating,
} from '../data/famousCharts';
import { caseStudyFor } from '../data/caseStudies';
import './famous.css';

interface Props {
  busy: boolean;
  onOpen: (c: FamousChart) => void;
  onClose: () => void;
}

const COUNTRIES: FamousCountry[] = ['IN', 'US', 'GB'];
const RATINGS: RoddenRating[] = ['AA', 'A', 'B', 'C'];
const RATING_CLASS: Record<RoddenRating, string> = { AA: 'chip-good', A: 'chip-good', B: 'chip-mid', C: 'chip-bad' };

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
};

export function FamousCharts({ busy, onOpen, onClose }: Props) {
  const [q, setQ] = useState('');
  const [country, setCountry] = useState<FamousCountry | 'all'>('all');
  const [minRating, setMinRating] = useState<'all' | 'A'>('all');

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return FAMOUS_CHARTS
      .filter((c) => country === 'all' || c.country === country)
      .filter((c) => minRating === 'all' || c.rodden === 'AA' || c.rodden === 'A')
      .filter((c) => !s || `${c.label} ${c.field} ${c.input.place}`.toLowerCase().includes(s))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [q, country, minRating]);

  return (
    <section className="card famous" aria-labelledby="famous-title">
      <div className="card-head">
        <h3 id="famous-title">Famous charts</h3>
        <button className="btn-ghost" onClick={onClose}>Close</button>
      </div>
      <p className="muted famous-intro">
        {FAMOUS_CHARTS.length} public figures from India, the United States and the United Kingdom whose birth data is publicly
        documented. Each one shows its Rodden rating, the scale astrologers use for how trustworthy a birth time is, and where
        the time comes from. People whose recorded times conflict are left out.
      </p>

      <div className="famous-tools">
        <label className="field famous-search">
          <span>Search</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, role or place" />
        </label>
        <div className="seg" role="radiogroup" aria-label="Country">
          <button role="radio" aria-checked={country === 'all'} className={country === 'all' ? 'is-active' : ''} onClick={() => setCountry('all')}>All</button>
          {COUNTRIES.map((k) => (
            <button key={k} role="radio" aria-checked={country === k} className={country === k ? 'is-active' : ''} onClick={() => setCountry(k)}>
              {k === 'GB' ? 'UK' : k === 'US' ? 'USA' : 'India'}
            </button>
          ))}
        </div>
        <div className="seg" role="radiogroup" aria-label="Reliability">
          <button role="radio" aria-checked={minRating === 'all'} className={minRating === 'all' ? 'is-active' : ''} onClick={() => setMinRating('all')}>Any rating</button>
          <button role="radio" aria-checked={minRating === 'A'} className={minRating === 'A' ? 'is-active' : ''} onClick={() => setMinRating('A')}>AA and A only</button>
        </div>
      </div>

      <details className="famous-legend">
        <summary>What the ratings mean</summary>
        <dl>
          {RATINGS.map((r) => (
            <div key={r}><dt><span className={`chip ${RATING_CLASS[r]}`}>{r}</span></dt><dd>{RODDEN_MEANING[r]}</dd></div>
          ))}
        </dl>
      </details>

      {list.length === 0 ? (
        <p className="muted">No one matches that search.</p>
      ) : (
        <ul className="famous-grid">
          {list.map((c) => (
            <li key={c.id} className="famous-item">
              <div className="famous-top">
                <div>
                  <b className="famous-name">{c.label}{caseStudyFor(c.id) && <span className="case-badge" title="Opens with an annotated case study">Case study</span>}</b>
                  <small className="muted">{c.field}</small>
                </div>
                <span className={`chip famous-rating ${RATING_CLASS[c.rodden]}`} title={`Rodden rating ${c.rodden}: ${RODDEN_MEANING[c.rodden]}`}>
                  {c.rodden}
                </span>
              </div>
              <p className="famous-data">
                {fmtDate(c.input.date)} · {c.input.time}<br />
                <span className="muted">{c.input.place}</span>
              </p>
              <p className="famous-source muted">
                Source: {c.source}{c.collector ? `, collected by ${c.collector}` : ''}.{' '}
                {c.sourceUrl && <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer">See the record</a>}
              </p>
              {c.note && <p className="famous-note muted">{c.note}</p>}
              <button className="btn-ghost sm famous-open" disabled={busy} onClick={() => onOpen(c)} aria-label={`Open the chart of ${c.label}`}>
                Open chart
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="muted famous-foot">
        Birth data as published by <a href="https://www.astrotheme.com/" target="_blank" rel="noopener noreferrer">Astrotheme</a>,
        whose records and ratings follow Lois Rodden's <a href="https://www.astro.com/astro-databank/" target="_blank" rel="noopener noreferrer">Astro-Databank</a>.
        Grouped by {COUNTRIES.map((k) => COUNTRY_NAMES[k]).join(', ')}.
      </p>
    </section>
  );
}
