import { useEffect, useMemo, useState } from 'react';
import type { Ephemeris, NatalChart } from '../src/types';
import type { DashaPeriod } from '../src/dasha';
import type { Window as TWindow } from '../src/timeline';
import { windowId } from '../src/ics';
import { markWindow, pastWindows, predictionRecord, type Outcome, type PredictionMark, type RuleRecord } from '../src/predictions';
import { fmtRange, signed } from './scale';

const SPANS = [
  { years: 5, label: '5 yrs' },
  { years: 15, label: '15 yrs' },
  { years: 40, label: '40 yrs' },
] as const;
const PAGE = 8;
const pct = (x: number) => `${Math.round(x * 100)}%`;

/**
 * Past windows with "happened / didn't" buttons, and the hit rate of every
 * rule behind them. Marks keep a snapshot of the rules, so the record is the
 * user's own and does not shift when the scoring is tuned.
 */
export function PredictionLog({ chart, ephemeris, dashas, marks, onChange }: {
  chart: NatalChart;
  ephemeris: Ephemeris;
  dashas: DashaPeriod[];
  marks: PredictionMark[];
  onChange: (marks: PredictionMark[]) => void;
}) {
  const [years, setYears] = useState<number>(15);
  const [windows, setWindows] = useState<TWindow[] | null>(null);
  const [shown, setShown] = useState(PAGE);
  const [filter, setFilter] = useState<'open' | 'all'>('all');
  const [tab, setTab] = useState<'windows' | 'record'>('windows');

  useEffect(() => {
    setWindows(null);
    // a few thousand transit samples: let the page paint first
    const t = setTimeout(() => {
      const now = new Date();
      const from = new Date(Math.max(chart.birth.getTime() + 365.25 * 864e5, now.getTime() - years * 365.25 * 864e5));
      setWindows(pastWindows(ephemeris, chart, dashas, { from, to: now }).filter((w) => w.end <= now).reverse());
    }, 40);
    return () => clearTimeout(t);
  }, [chart, ephemeris, dashas, years]);

  const byId = useMemo(() => new Map(marks.map((m) => [m.id, m])), [marks]);
  const record = useMemo(() => predictionRecord(marks), [marks]);
  const list = (windows ?? []).filter((w) => filter === 'all' || !byId.has(windowId(w)));

  const mark = (w: TWindow, outcome: Outcome | null) => {
    const id = windowId(w);
    const rest = marks.filter((m) => m.id !== id);
    onChange(outcome ? [...rest, markWindow(w, dashas, outcome)] : rest);
  };

  return (
    <section className="vt-card" id="vt-predictions">
      <h2>Did it happen?</h2>
      <p className="vt-sub">Mark past windows as delivered or not, and see how often each rule behind them has been right for you. Saved in this browser only.</p>
      <div className="vt-seg" role="group" aria-label="View" style={{ marginBottom: 10 }}>
        <button aria-pressed={tab === 'windows'} onClick={() => setTab('windows')}>Past windows</button>
        <button aria-pressed={tab === 'record'} onClick={() => setTab('record')}>Your record{marks.length ? ` (${marks.length})` : ''}</button>
      </div>

      {tab === 'windows' && (
        <>
          <div className="vt-spread" style={{ marginBottom: 8 }}>
            <div className="vt-seg" role="group" aria-label="How far back">
              {SPANS.map((s) => <button key={s.years} aria-pressed={years === s.years} onClick={() => { setYears(s.years); setShown(PAGE); }}>{s.label}</button>)}
            </div>
            <label className="vt-check"><input type="checkbox" checked={filter === 'open'} onChange={(e) => setFilter(e.target.checked ? 'open' : 'all')} /> Hide marked</label>
          </div>
          {!windows && <p className="vt-muted">Working out the past windows…</p>}
          {windows && !list.length && <p className="vt-muted">{windows.length ? 'Every window in this span is marked. Try a longer span.' : 'No windows stand out in this span.'}</p>}
          <div className="vt-list">
            {list.slice(0, shown).map((w) => {
              const m = byId.get(windowId(w));
              return (
                <div key={windowId(w)} className="vt-item" style={{ cursor: 'default' }}>
                  <div className="vt-spread">
                    <span className="t">{w.tone === 'favourable' ? '▲' : '▼'} {fmtRange(w.start, w.end)}</span>
                    <span className="vt-score">{signed(w.average)}</span>
                  </div>
                  <div className="d">{w.dashaPath.join(' – ')} dasha · {w.tone === 'favourable' ? 'expected to go well' : 'expected to be hard going'}</div>
                  <div className="vt-row" style={{ marginTop: 6 }} role="group" aria-label={`Outcome for ${fmtRange(w.start, w.end)}`}>
                    <button className="vt-chip vt-chip-btn" aria-pressed={m?.outcome === 'happened'} style={m?.outcome === 'happened' ? { background: 'var(--good)', color: '#fff' } : undefined} onClick={() => mark(w, m?.outcome === 'happened' ? null : 'happened')}>✓ Happened</button>
                    <button className="vt-chip vt-chip-btn" aria-pressed={m?.outcome === 'didnt'} style={m?.outcome === 'didnt' ? { background: 'var(--bad)', color: '#fff' } : undefined} onClick={() => mark(w, m?.outcome === 'didnt' ? null : 'didnt')}>✕ Didn’t</button>
                  </div>
                </div>
              );
            })}
          </div>
          {list.length > shown && <button className="vt-chip vt-chip-btn" style={{ marginTop: 8 }} onClick={() => setShown(shown + PAGE)}>Show {Math.min(PAGE, list.length - shown)} more</button>}
          <p className="vt-sub" style={{ margin: '10px 0 0' }}>“Happened” means the window felt the way it was flagged: a good stretch for a ▲ window, a hard one for a ▼.</p>
        </>
      )}

      {tab === 'record' && <Record record={record} onClear={() => { if (confirm('Clear every mark for this chart?')) onChange([]); }} />}
    </section>
  );
}

function Record({ record, onClear }: { record: ReturnType<typeof predictionRecord>; onClear: () => void }) {
  if (!record.total) return <p className="vt-muted">No marks yet. Mark a few past windows and the hit rates appear here.</p>;
  const toneLine = (t: { hits: number; n: number }, label: string) => t.n ? `${label}: ${t.hits} of ${t.n} (${pct(t.hits / t.n)})` : `${label}: none marked`;
  return (
    <>
      <p style={{ margin: '0 0 6px' }}><b>{record.hits} of {record.total}</b> marked windows delivered ({pct(record.rate)}).</p>
      <p className="vt-sub">{toneLine(record.favourable, '▲ favourable')} · {toneLine(record.challenging, '▼ challenging')}</p>
      <div className="vt-scroll">
        <table className="vt-table">
          <thead><tr><th>Rule</th><th>Hits</th><th>Rate</th><th title="90% Wilson interval: with few marks it is wide">Likely range</th></tr></thead>
          <tbody>{record.rules.map((r) => <RuleRow key={r.rule.key} r={r} base={record.rate} />)}</tbody>
        </table>
      </div>
      <p className="vt-sub" style={{ margin: '10px 0 0' }}>A rule needs about ten marks before its rate means much; the range column shows how unsure each one still is. Rules come from the dasha reasons and transits behind each window when you marked it.</p>
      <button className="vt-chip vt-chip-btn" onClick={onClear}>Clear all marks</button>
    </>
  );
}

function RuleRow({ r, base }: { r: RuleRecord; base: number }) {
  const thin = r.n < 5;
  const better = !thin && r.low > base, worse = !thin && r.high < base;
  return (
    <tr style={thin ? { opacity: 0.7 } : undefined}>
      <td>{r.rule.label} <span className="vt-muted" style={{ fontSize: 11 }}>{r.rule.family}</span></td>
      <td className="vt-score">{r.hits}/{r.n}</td>
      <td className="vt-score" style={{ color: better ? 'var(--good)' : worse ? 'var(--bad)' : undefined, fontWeight: better || worse ? 650 : undefined }}>{pct(r.rate)}</td>
      <td className="vt-score vt-muted">{pct(r.low)}–{pct(r.high)}</td>
    </tr>
  );
}
