import { useEffect, useState } from 'react';
import type { Ephemeris, NatalChart, Planet } from '../src/types';
import { PLANETS, SIGNS } from '../src/types';
import { ordinal, signName, signOf } from '../src/astro';
import {
  type AspectKind, type NatalPoint, type TransitHit, type TransitQuery, type TransitSearchResult,
  canStation, DEFAULT_YEARS, EXAMPLE_QUESTIONS, NATAL_POINTS, parseTransitQuestion, resolveQuestion, searchTransits,
} from '../src/search';
import { SPECIAL_ASPECTS } from '../src/classical';
import { fmtDate, fmtRange, GLYPH } from './scale';

type Event = 'conjunction' | 'opposition' | 'special' | 'any' | 'return' | 'sign' | 'house' | 'ingress' | 'station-r' | 'station-d';

const EVENTS: { id: Event; label: string }[] = [
  { id: 'conjunction', label: 'crosses my natal…' },
  { id: 'opposition', label: 'opposes my natal…' },
  { id: 'special', label: 'casts its special aspect on…' },
  { id: 'any', label: 'conjoins or aspects…' },
  { id: 'return', label: 'returns to its natal degree' },
  { id: 'sign', label: 'enters the sign…' },
  { id: 'house', label: 'enters my house…' },
  { id: 'ingress', label: 'changes sign (any)' },
  { id: 'station-r', label: 'turns retrograde' },
  { id: 'station-d', label: 'turns direct' },
];

interface Form { planet: Planet; event: Event; target: NatalPoint; sign: number; house: number; fromYear: number; years: number }

const thisYear = () => new Date().getUTCFullYear();

/** Which events make sense for a planet. */
const eventsFor = (p: Planet) => EVENTS.filter((e) => {
  if (e.id === 'special') return !!SPECIAL_ASPECTS[p];
  if (e.id === 'station-r' || e.id === 'station-d') return canStation(p);
  return true;
});

function formToQuery(f: Form, chart: NatalChart): TransitQuery {
  const asc = signOf(chart.ascendant);
  switch (f.event) {
    case 'conjunction': case 'opposition': case 'special': case 'any':
      return f.target === f.planet && f.event === 'conjunction'
        ? { kind: 'return', planet: f.planet }
        : { kind: 'aspect', planet: f.planet, target: f.target, aspect: f.event as AspectKind };
    case 'return': return { kind: 'return', planet: f.planet };
    case 'sign': return { kind: 'ingress', planet: f.planet, sign: f.sign };
    case 'house': return { kind: 'ingress', planet: f.planet, sign: (asc + f.house - 1) % 12 };
    case 'ingress': return { kind: 'ingress', planet: f.planet };
    case 'station-r': return { kind: 'station', planet: f.planet, station: 'retrograde' };
    case 'station-d': return { kind: 'station', planet: f.planet, station: 'direct' };
  }
}

function queryToForm(q: TransitQuery, prev: Form, natalSign?: { house: number } | { of: NatalPoint }): Form {
  const base = { ...prev, planet: q.planet };
  if (q.kind === 'aspect') return { ...base, event: q.aspect, target: q.target };
  if (q.kind === 'return') return { ...base, event: 'return' };
  if (q.kind === 'station') return { ...base, event: q.station === 'direct' ? 'station-d' : 'station-r' };
  if (natalSign && 'house' in natalSign) return { ...base, event: 'house', house: natalSign.house };
  if (q.sign !== undefined) return { ...base, event: 'sign', sign: q.sign };
  return { ...base, event: 'ingress' };
}

const timeOf = (d: Date) => `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`;

export interface TransitSearchProps {
  chart: NatalChart;
  ephemeris: Ephemeris;
  result: TransitSearchResult | null;
  onResult: (r: TransitSearchResult | null) => void;
  /** Called when a result is clicked, to show it on the timeline. */
  onPick: (hit: TransitHit) => void;
  picked?: TransitHit | null;
}

/**
 * "When does Saturn next hit my Moon?" Type a question or build one from the
 * dropdowns; the dates are computed from the ephemeris, no AI involved.
 */
export function TransitSearch({ chart, ephemeris, result, onResult, onPick, picked }: TransitSearchProps) {
  const [text, setText] = useState('');
  const [form, setForm] = useState<Form>({ planet: 'Saturn', event: 'conjunction', target: 'Moon', sign: 10, house: 10, fromYear: thisYear(), years: DEFAULT_YEARS.Saturn });
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // A new chart invalidates old answers.
  useEffect(() => { onResult(null); setError(null); setNote(null); }, [chart]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = (query: TransitQuery, from: Date, to: Date, n: string | null) => {
    setBusy(true);
    setError(null);
    setNote(n);
    // Let the "Searching…" state paint before the (synchronous) search runs.
    setTimeout(() => {
      try {
        onResult(searchTransits(ephemeris, chart, query, { from, to, limit: 12 }));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    }, 10);
  };

  const rangeOf = (f: Form) => {
    const now = new Date();
    const from = f.fromYear === thisYear() ? now : new Date(Date.UTC(f.fromYear, 0, 1));
    return { from, to: new Date(from.getTime() + f.years * 365.25 * 864e5) };
  };

  const ask = (q: string) => {
    setText(q);
    const p = parseTransitQuestion(q);
    if ('error' in p) { setError(p.error); onResult(null); return; }
    const { query, note: n } = resolveQuestion(p.parsed, chart);
    const from = p.parsed.from ?? new Date();
    const to = p.parsed.to ?? new Date(from.getTime() + DEFAULT_YEARS[query.planet] * 365.25 * 864e5);
    const years = Math.max(1, Math.round((to.getTime() - from.getTime()) / (365.25 * 864e5)));
    // Mirror the question in the dropdowns so it can be tweaked.
    setForm({ ...queryToForm(query, form, p.parsed.natalSign), fromYear: from.getUTCFullYear(), years });
    run(query, from, to, n ?? null);
  };

  const submitForm = (f: Form) => {
    const q = formToQuery(f, chart);
    const { from, to } = rangeOf(f);
    let n: string | null = null;
    if (f.event === 'house') n = `Your ${ordinal(f.house)} house is ${signName((signOf(chart.ascendant) + f.house - 1) % 12)} (whole-sign from your Lagna).`;
    run(q, from, to, n);
  };

  const setPlanet = (planet: Planet) => {
    const allowed = eventsFor(planet).map((e) => e.id);
    setForm((f) => ({ ...f, planet, event: allowed.includes(f.event) ? f.event : 'conjunction', years: DEFAULT_YEARS[planet] }));
  };

  const needsTarget = ['conjunction', 'opposition', 'special', 'any'].includes(form.event);

  return (
    <div className="vt-search">
      <form className="vt-ask" onSubmit={(e) => { e.preventDefault(); if (text.trim()) ask(text); }}>
        <input
          type="search" value={text} onChange={(e) => setText(e.target.value)}
          placeholder="When does Saturn next hit my Moon?" aria-label="Ask a transit question"
        />
        <button type="submit" className="vt-btn" disabled={busy || !text.trim()}>Search</button>
      </form>
      <div className="vt-chips" style={{ marginTop: 8 }}>
        {EXAMPLE_QUESTIONS.slice(0, 6).map((q) => (
          <button key={q} type="button" className="vt-chip vt-chip-btn" onClick={() => ask(q)}>{q}</button>
        ))}
      </div>

      <form className="vt-builder" onSubmit={(e) => { e.preventDefault(); submitForm(form); }}>
        <span className="vt-muted">Or build it:</span>
        <span>When does</span>
        <select aria-label="Transiting planet" value={form.planet} onChange={(e) => setPlanet(e.target.value as Planet)}>
          {PLANETS.map((p) => <option key={p} value={p}>{GLYPH[p]} {p}</option>)}
        </select>
        <select aria-label="Event" value={form.event} onChange={(e) => setForm({ ...form, event: e.target.value as Event })}>
          {eventsFor(form.planet).map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
        </select>
        {needsTarget && (
          <select aria-label="Natal point" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value as NatalPoint })}>
            {NATAL_POINTS.map((p) => <option key={p} value={p}>{p === 'Ascendant' ? 'Ascendant (Lagna)' : `${p} (${signName(signOf(chart.planets[p].longitude))})`}</option>)}
          </select>
        )}
        {form.event === 'sign' && (
          <select aria-label="Sign" value={form.sign} onChange={(e) => setForm({ ...form, sign: +e.target.value })}>
            {SIGNS.map((s, i) => <option key={s} value={i}>{s}</option>)}
          </select>
        )}
        {form.event === 'house' && (
          <select aria-label="House" value={form.house} onChange={(e) => setForm({ ...form, house: +e.target.value })}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
              <option key={h} value={h}>{ordinal(h)} ({signName((signOf(chart.ascendant) + h - 1) % 12)})</option>
            ))}
          </select>
        )}
        <span>from</span>
        <input aria-label="From year" type="number" min={1800} max={2399} value={form.fromYear} onChange={(e) => setForm({ ...form, fromYear: +e.target.value || thisYear() })} style={{ width: 76 }} />
        <span>for</span>
        <select aria-label="Years to search" value={form.years} onChange={(e) => setForm({ ...form, years: +e.target.value })}>
          {[...new Set([1, 2, 3, 5, 10, 20, 30, 60, DEFAULT_YEARS[form.planet], form.years])].sort((a, b) => a - b).map((y) => <option key={y} value={y}>{y} {y === 1 ? 'year' : 'years'}</option>)}
        </select>
        <button type="submit" className="vt-btn" disabled={busy}>Find dates</button>
      </form>

      {busy && <p className="vt-muted" role="status">Searching…</p>}
      {error && <p className="vt-error" role="alert">{error}</p>}
      {result && !busy && (
        <div className="vt-results" aria-live="polite">
          <div className="vt-spread" style={{ margin: '14px 0 8px' }}>
            <b>{result.label}</b>
            <span className="vt-muted" style={{ fontSize: 12 }}>{fmtRange(result.from, result.to)} · {result.hits.length} {result.hits.length === 1 ? 'result' : 'results'}</span>
          </div>
          {note && <p className="vt-sub">{note}</p>}
          {result.hits.length === 0 && <p className="vt-muted">Nothing in this range. Try searching more years ahead.</p>}
          <div className="vt-list">
            {result.hits.map((h) => (
              <button key={h.id} type="button" className="vt-item" aria-pressed={picked?.id === h.id} onClick={() => onPick(h)}>
                <div className="vt-spread">
                  <span className="t">{GLYPH[h.planet]} {h.title}</span>
                  <span className="vt-score">{fmtDate(h.date)} <span className="vt-muted" style={{ fontSize: 11 }}>{timeOf(h.date)}</span></span>
                </div>
                <div className="d">{h.detail}</div>
                {h.passes.length > 1 && (
                  <div className="d">Exact: {h.passes.map((p) => `${fmtDate(p.date)}${p.retrograde ? ' ℞' : ''}`).join(' · ')}</div>
                )}
                {(h.start || h.end) && <div className="d">Within 1°: {fmtRange(h.start, h.end)}</div>}
              </button>
            ))}
          </div>
          <p className="vt-sub" style={{ marginTop: 8 }}>Click a result to mark it on the life weather timeline and open that day's transits. ℞ means the planet was retrograde as it crossed.</p>
        </div>
      )}
    </div>
  );
}
