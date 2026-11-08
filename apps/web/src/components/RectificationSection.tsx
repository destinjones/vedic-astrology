import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  EVENT_DEFS,
  SCORED_KINDS,
  diffCandidates,
  rectify,
  type Candidate,
  type CandidateDiff,
  type EventGroup,
  type LifeEvent,
  type LifeEventKind,
  type RectifyResult,
} from '@vedic/rectification';
import type { Chart } from '../types/chart';
import './rectification.css';

type Precision = 'day' | 'month' | 'year';
interface Row { id: number; kind: LifeEventKind; precision: Precision; date: string }

// The time window and life events are kept per person (birth date and place;
// not the time, which is what the finder changes), so one client's events never
// show up on the next client's chart. v2 kept a single set for everyone and is dropped.
const STORE_KEY = 'vedic.rectify.v3';
const LEGACY_KEY = 'vedic.rectify.v2';
const MAX_PEOPLE = 200;
const personKey = (i: { date: string; place: { latitude: number; longitude: number } }) => `${i.date}|${i.place.latitude.toFixed(4)}|${i.place.longitude.toFixed(4)}`;
const GROUPS: EventGroup[] = ['Relationships', 'Career and money', 'Home and movement', 'Health and loss', 'Other'];

const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const fromMin = (m: number) => { const x = ((Math.round(m) % 1440) + 1440) % 1440; return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`; };
const datePart = (row: Row) => (row.precision === 'year' ? row.date.slice(0, 4) : row.precision === 'month' ? row.date.slice(0, 7) : row.date);
/** The shared event model stores a full date plus its precision */
const fullDate = (row: Row) => (row.precision === 'year' ? `${datePart(row)}-01-01` : row.precision === 'month' ? `${datePart(row)}-01` : row.date);
const valid = (row: Row) => (row.precision === 'year' ? /^\d{4}$/ : row.precision === 'month' ? /^\d{4}-\d{2}$/ : /^\d{4}-\d{2}-\d{2}$/).test(datePart(row));

interface Saved { rows: Row[]; from?: string; to?: string; likely?: string; plusMinus?: number; useLikely?: boolean }
const readAll = (): Record<string, Saved> => {
  try {
    localStorage.removeItem(LEGACY_KEY);
    const v = JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}') as unknown;
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, Saved>) : {};
  } catch { return {}; }
};
const load = (key: string): Saved => {
  const s = readAll()[key];
  return s && Array.isArray(s.rows) ? s : { rows: [] };
};
const store = (key: string, s: Saved) => {
  try {
    const all = readAll();
    delete all[key];
    if (s.rows.length) all[key] = s;
    // newest last; keep the most recent people only
    const keys = Object.keys(all);
    for (const k of keys.slice(0, Math.max(0, keys.length - MAX_PEOPLE))) delete all[k];
    localStorage.setItem(STORE_KEY, JSON.stringify(all));
  } catch { /* storage full or blocked */ }
};

/**
 * Birth time finder. Takes the date and place of the current chart, a window
 * of possible times and dated life events, and ranks candidate times.
 */
export default function RectificationSection({ context, onApply, savedEvents = [] }: {
  context: NonNullable<Chart['engineContext']>;
  onApply: (date: string, time: string) => void;
  /** Events already recorded in the life event checker for this person */
  savedEvents?: { kind: LifeEventKind; date: string; precision?: Precision }[];
}) {
  const { engine, chart } = context;
  const input = chart.meta.input;
  const key = personKey(input);
  const saved = useMemo(() => load(key), [key]);
  const t = toMin(input.time.slice(0, 5));
  const [from, setFrom] = useState(saved.from ?? fromMin(t - 120));
  const [to, setTo] = useState(saved.to ?? fromMin(t + 120));
  const [useLikely, setUseLikely] = useState(saved.useLikely ?? true);
  const [likely, setLikely] = useState(saved.likely ?? input.time.slice(0, 5));
  const [plusMinus, setPlusMinus] = useState(saved.plusMinus ?? 30);
  const [rows, setRows] = useState<Row[]>(saved.rows);
  const [result, setResult] = useState<RectifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<number>(1);

  useEffect(() => {
    store(key, { rows, from, to, likely, plusMinus, useLikely });
  }, [key, rows, from, to, likely, plusMinus, useLikely]);

  const add = (kind: LifeEventKind) => setRows((r) => [...r, { id: Date.now() + Math.random(), kind, precision: 'month', date: '' }]);
  const update = (id: number, patch: Partial<Row>) => setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const remove = (id: number) => setRows((r) => r.filter((x) => x.id !== id));
  const ready = rows.filter(valid);
  const rowKey = (r: { kind: string; date: string }) => `${r.kind}|${r.date}`;
  const have = new Set(rows.filter(valid).map((r) => rowKey({ kind: r.kind, date: fullDate(r) })));
  const importable = savedEvents.filter((e) => e.kind !== 'other' && !have.has(rowKey(e)));
  const importSaved = () => setRows((r) => [
    ...r,
    ...importable.map((e, i) => ({ id: Date.now() + i + Math.random(), kind: e.kind, precision: e.precision ?? 'day', date: e.precision === 'year' ? e.date.slice(0, 4) : e.precision === 'month' ? e.date.slice(0, 7) : e.date })),
  ]);
  const [ranWith, setRanWith] = useState<LifeEvent[]>([]);
  const compare = useCallback((a: Candidate, b: Candidate): CandidateDiff => diffCandidates(engine, a.jd, b.jd, input.place, {
    ayanamsa: chart.meta.ayanamsa, nodeType: chart.meta.nodeType, events: ranWith,
  }), [engine, input.place, chart.meta.ayanamsa, chart.meta.nodeType, ranWith]);

  const run = () => {
    setBusy(true);
    setError(null);
    // let the button repaint before the (synchronous) search runs
    setTimeout(() => {
      try {
        const events: LifeEvent[] = ready.map((r) => ({ id: String(r.id), kind: r.kind, date: fullDate(r), precision: r.precision }));
        const res = rectify(engine, {
          date: input.date,
          from,
          to,
          place: { latitude: input.place.latitude, longitude: input.place.longitude, timezone: chart.meta.timezone },
          utcOffsetMinutes: input.utcOffsetMinutes,
          events,
          ayanamsa: chart.meta.ayanamsa,
          nodeType: chart.meta.nodeType,
          likely: useLikely && likely ? { time: likely, plusMinusMinutes: plusMinus } : undefined,
        });
        setResult(res);
        setRanWith(events);
        setOpen(1);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    }, 30);
  };

  return (
    <div className="rect">
      <div className="rect-steps">
        <div className="rect-step">
          <h4><span className="rect-num">1</span> When could you have been born?</h4>
          <p className="muted">On {input.date} in {input.place.name || 'your birthplace'}. Give the earliest and latest times that are possible. A window that crosses midnight is fine.</p>
          <div className="rect-row">
            <label className="field"><span>Earliest</span><input type="time" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
            <label className="field"><span>Latest</span><input type="time" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          </div>
          <label className="rect-check">
            <input type="checkbox" checked={useLikely} onChange={(e) => setUseLikely(e.target.checked)} />
            <span>I remember a rough time</span>
          </label>
          {useLikely && (
            <div className="rect-row">
              <label className="field"><span>Around</span><input type="time" value={likely} onChange={(e) => setLikely(e.target.value)} /></label>
              <label className="field">
                <span>Give or take</span>
                <select value={plusMinus} onChange={(e) => setPlusMinus(Number(e.target.value))}>
                  {[10, 15, 30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m} minutes</option>)}
                </select>
              </label>
            </div>
          )}
        </div>

        <div className="rect-step">
          <h4><span className="rect-num">2</span> What has happened in your life?</h4>
          <p className="muted">Add events you know the date of. Three or more, of different kinds, work best. A month is enough; a year still helps. An exact day is also checked against the sookshma, the fourth dasha level.</p>
          {importable.length > 0 && (
            <button type="button" className="btn-ghost sm rect-import" onClick={importSaved}>
              Use {importable.length} event{importable.length > 1 ? 's' : ''} from the life event checker
            </button>
          )}
          <div className="rect-chips">
            {GROUPS.map((g) => (
              <div key={g} className="rect-chip-group">
                <small>{g}</small>
                <div>
                  {SCORED_KINDS.filter((k) => EVENT_DEFS[k].group === g).map((k) => (
                    <button key={k} type="button" className="rect-chip" onClick={() => add(k)} title={EVENT_DEFS[k].question}>+ {EVENT_DEFS[k].label}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {rows.length > 0 && (
            <ul className="rect-events">
              {rows.map((r) => (
                <li key={r.id} className={valid(r) ? '' : 'is-incomplete'}>
                  <div className="rect-event-label">
                    <b>{EVENT_DEFS[r.kind].label}</b>
                    <small className="muted">{EVENT_DEFS[r.kind].question}</small>
                  </div>
                  <select aria-label="How well do you know the date" value={r.precision} onChange={(e) => update(r.id, { precision: e.target.value as Precision })}>
                    <option value="day">Exact day</option>
                    <option value="month">Month</option>
                    <option value="year">Year only</option>
                  </select>
                  {r.precision === 'day' && <input type="date" aria-label="Date" value={r.date.length === 10 ? r.date : ''} onChange={(e) => update(r.id, { date: e.target.value })} />}
                  {r.precision === 'month' && <input type="month" aria-label="Month" placeholder="YYYY-MM" value={r.date.slice(0, 7)} onChange={(e) => update(r.id, { date: e.target.value })} />}
                  {r.precision === 'year' && <input type="number" aria-label="Year" min={1900} max={2100} placeholder="Year" value={r.date.slice(0, 4)} onChange={(e) => update(r.id, { date: e.target.value })} />}
                  <button type="button" className="btn-ghost sm" aria-label={`Remove ${EVENT_DEFS[r.kind].label}`} onClick={() => remove(r.id)}>✕</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rect-go">
        <button className="btn-primary" disabled={busy} onClick={run}>
          {busy ? 'Testing every minute…' : ready.length ? `Find my birth time from ${ready.length} event${ready.length > 1 ? 's' : ''}` : 'Show the change points'}
        </button>
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>

      {result && <Results result={result} current={`${input.date} ${input.time.slice(0, 5)}`} open={open} setOpen={setOpen} onApply={onApply} compare={compare} />}

      <details className="rect-method">
        <summary>How the birth time finder works</summary>
        <p>Every minute or two across your window is cast as a chart. For each one, the tool asks of every event: were the dasha periods running on that date (mahadasha, antardasha and pratyantardasha) ruled by planets tied to that part of life in this chart? A marriage wants lords of the 7th, 2nd or 11th, planets sitting there, or Venus and Jupiter, and the navamsa (D9) has to agree. A child wants the 5th and 9th, Jupiter and the saptamsa (D7), and so on.</p>
        <p>It then checks the transits on the date: the double transit of Jupiter and Saturn over the event's house or its lord, and slow planets crossing the exact degree of your lagna or the event's house point. Because the Moon moves about half a degree an hour, a different birth time also shifts every dasha date, so the periods themselves line up differently for each candidate.</p>
        <p>Candidates are grouped by lagna and navamsa, which are what a correction of a few minutes really changes, and ranked. The D60 (shashtiamsa) is shown for each, since it changes about every two minutes and is the last step of fine rectification, which a careful astrologer checks against your life by hand.</p>
        <p className="muted">The weights are a reasoned synthesis of Parashari practice, not a single canonical formula. Treat the top result as a strong lead to check, not a certainty, especially when the scores are close.</p>
      </details>
    </div>
  );
}

function Results({ result, current, open, setOpen, onApply, compare }: {
  result: RectifyResult;
  current: string;
  open: number;
  setOpen: (n: number) => void;
  onApply: (date: string, time: string) => void;
  compare: (a: Candidate, b: Candidate) => CandidateDiff;
}) {
  const hasEvents = result.candidates[0]?.events.length > 0;
  const conf = {
    clear: 'A clear leader. The top time explains your events noticeably better than the rest.',
    moderate: 'A likely leader, with a runner-up close enough to be worth checking.',
    close: 'Several times score almost the same. More events, or more exact dates, will separate them.',
    none: 'These are the moments inside your window where the rising sign and its divisions change.',
  }[result.confidence];
  const changes = result.changePoints.filter((c) => c.kind !== 'shashtiamsa');
  const d60Count = result.changePoints.length - changes.length;
  return (
    <div className="rect-results">
      <p className={`rect-confidence is-${result.confidence}`}>{conf}</p>
      {result.notes.map((n) => <p key={n} className="muted rect-note">{n}</p>)}

      <Curve result={result} current={current} />

      {hasEvents && (
        <ol className="rect-candidates">
          {result.candidates.map((c) => (
            <CandidateCard key={c.jd} c={c} open={open === c.rank} onToggle={() => setOpen(open === c.rank ? 0 : c.rank)} onApply={onApply} />
          ))}
        </ol>
      )}

      {hasEvents && result.candidates.length > 1 && <FitMatrix candidates={result.candidates} />}
      {result.candidates.length > 1 && <DiffView candidates={result.candidates} compare={compare} />}

      <details className="rect-changes" open={!hasEvents}>
        <summary>Change points in your window ({changes.length} below, plus {d60Count} D60 changes)</summary>
        <table>
          <thead><tr><th>Local time</th><th>What changes</th><th>From</th><th>To</th></tr></thead>
          <tbody>
            {changes.map((c) => (
              <tr key={`${c.kind}-${c.jd}`} className={`is-${c.kind}`}>
                <td>{c.local.slice(11)}</td>
                <td>{c.kind === 'lagna' ? 'Lagna (rising sign)' : c.kind === 'navamsa' ? 'Navamsa lagna (D9)' : 'Moon pada'}</td>
                <td>{c.from}</td>
                <td>{c.to}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

function CandidateCard({ c, open, onToggle, onApply }: { c: Candidate; open: boolean; onToggle: () => void; onApply: (date: string, time: string) => void }) {
  return (
    <li className={`rect-cand ${open ? 'is-open' : ''}`}>
      <div className="rect-cand-head">
        <span className="rect-rank">{c.rank}</span>
        <div className="rect-cand-time">
          <b>{c.localTime}</b>
          <small className="muted">best inside {c.window.startLocal.slice(11, 16)}–{c.window.endLocal.slice(11, 16)}</small>
        </div>
        <div className="rect-score" aria-label={`Score ${c.score} of 100`}>
          <span style={{ width: `${Math.max(4, c.score)}%` }} />
          <em>{Math.round(c.score)}</em>
        </div>
        <div className="rect-cand-actions">
          <button className="btn-ghost sm" onClick={onToggle} aria-expanded={open}>{open ? 'Hide why' : 'Why'}</button>
          <button className="btn-primary sm" onClick={() => onApply(c.local.slice(0, 10), c.localTime)}>Use this time</button>
        </div>
      </div>
      <div className="rect-facts">
        <span><small>Lagna</small>{c.lagna.name} {Math.floor(c.lagna.degree)}°{String(Math.round((c.lagna.degree % 1) * 60)).padStart(2, '0')}′</span>
        <span><small>Navamsa (D9)</small>{c.navamsa.name}</span>
        <span><small>D60</small>{c.d60.signName}, {c.d60.name} <i className={`is-${c.d60.nature}`}>{c.d60.nature}</i></span>
        <span><small>Moon</small>{c.moon.nakshatra} {c.moon.pada}</span>
        <span><small>Dasha at birth</small>{c.moon.dashaLord}, {c.moon.balanceYears.toFixed(1)} y left</span>
      </div>
      <p className="rect-summary">{c.summary}</p>
      {open && (
        <ul className="rect-fits">
          {c.events.map((e, i) => (
            <li key={i} className={e.fitsBest ? 'is-best' : ''}>
              <div className="rect-fit-head">
                <b>{e.label}</b>
                <small className="muted">{e.event.precision === 'year' ? e.event.date.slice(0, 4) : e.event.precision === 'month' ? e.event.date.slice(0, 7) : e.event.date}</small>
                <span className="rect-fit-score">{Math.round(e.score)}</span>
                {e.fitsBest && <span className="rect-tag">best fit</span>}
              </div>
              <p>{e.summary}</p>
              <ul className="rect-reasons">
                {e.dasha.parts.map((p) => (
                  <li key={p.level}>
                    <b>{['Mahadasha', 'Antardasha', 'Pratyantardasha', 'Sookshma'][p.level - 1]} {p.lord}</b>: {p.reasons.length ? p.reasons.join('; ') : 'no link to this event'}
                  </li>
                ))}
                {e.transits.map((t) => <li key={t}><b>Transit</b>: {t}</li>)}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/** Every event against every candidate: which time explains which event best. */
function FitMatrix({ candidates }: { candidates: Candidate[] }) {
  const events = candidates[0].events;
  return (
    <details className="rect-matrix" open>
      <summary>Event fit across the candidates</summary>
      <div className="rect-table-wrap">
        <table>
          <thead>
            <tr><th>Event</th>{candidates.map((c) => <th key={c.jd}>#{c.rank} {c.localTime}</th>)}</tr>
          </thead>
          <tbody>
            {events.map((e, i) => {
              const scores = candidates.map((c) => c.events[i]?.score ?? 0);
              const max = Math.max(...scores);
              return (
                <tr key={i}>
                  <td><b>{e.label}</b> <small className="muted">{e.event.precision === 'year' ? e.event.date.slice(0, 4) : e.event.precision === 'month' ? e.event.date.slice(0, 7) : e.event.date}</small></td>
                  {candidates.map((c, k) => (
                    <td key={c.jd} className={scores[k] >= max - 0.05 ? 'is-best' : ''} title={c.events[i]?.dasha.chain}>
                      {Math.round(scores[k])}<small className="muted"> {c.events[i]?.dasha.chain}</small>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted rect-note">Each cell is how well that time explains the event (0–100) and the dasha chain running then. The highlighted cell is the best time for that event. A time that wins most rows, not just the total, is the stronger lead.</p>
    </details>
  );
}

/** Two candidates side by side: what choosing one over the other changes. */
function DiffView({ candidates, compare }: { candidates: Candidate[]; compare: (a: Candidate, b: Candidate) => CandidateDiff }) {
  const [ai, setAi] = useState(0);
  const [bi, setBi] = useState(1);
  const [all, setAll] = useState(false);
  const a = candidates[ai], b = candidates[bi];
  const diff = useMemo(() => (a && b && a !== b ? compare(a, b) : null), [a, b, compare]);
  const pick = (v: number, set: (n: number) => void) => (
    <select value={v} onChange={(e) => set(Number(e.target.value))}>
      {candidates.map((c, i) => <option key={c.jd} value={i}>#{c.rank} {c.localTime} ({c.lagna.name}, D9 {c.navamsa.name})</option>)}
    </select>
  );
  const rows = diff ? diff.rows.filter((r) => all || r.changed) : [];
  const groups = [...new Set(rows.map((r) => r.group))];
  return (
    <details className="rect-diff" open>
      <summary>Compare two times</summary>
      <div className="rect-row rect-diff-pick">
        <label className="field"><span>Time A</span>{pick(ai, setAi)}</label>
        <label className="field"><span>Time B</span>{pick(bi, setBi)}</label>
        <label className="rect-check"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /><span>Show what stays the same</span></label>
      </div>
      {!diff && <p className="muted">Pick two different times.</p>}
      {diff && (
        <>
          <p className="rect-summary">{diff.summary}</p>
          <div className="rect-table-wrap">
            <table>
              <thead><tr><th /><th>A · {a.localTime}</th><th>B · {b.localTime}</th></tr></thead>
              {groups.map((g) => (
                <tbody key={g}>
                  <tr className="rect-diff-group"><th colSpan={3}>{g}</th></tr>
                  {rows.filter((r) => r.group === g).map((r) => (
                    <tr key={r.label} className={r.changed ? 'is-changed' : ''}>
                      <td>{r.label}</td>
                      <td>{r.a}{r.scoreA !== undefined && <small className="muted"> · fit {Math.round(r.scoreA)}</small>}</td>
                      <td>{r.b}{r.scoreB !== undefined && <small className={`muted${(r.scoreB ?? 0) > (r.scoreA ?? 0) + 2 ? ' good' : (r.scoreA ?? 0) > (r.scoreB ?? 0) + 2 ? ' bad' : ''}`}> · fit {Math.round(r.scoreB)}</small>}</td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
          {!rows.length && <p className="muted">Nothing differs between these two times.</p>}
        </>
      )}
    </details>
  );
}

const SIGN_ABBR = ['Ar', 'Ta', 'Ge', 'Cn', 'Le', 'Vi', 'Li', 'Sc', 'Sg', 'Cp', 'Aq', 'Pi'];

function Curve({ result, current }: { result: RectifyResult; current: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 900, H = 220, P = { l: 36, r: 12, t: 26, b: 40 };
  const { startJd, endJd } = result.window;
  const x = (jd: number) => P.l + ((jd - startJd) / (endJd - startJd)) * (W - P.l - P.r);
  const pts = result.curve;
  const max = Math.max(10, ...pts.map((p) => p.score));
  const min = Math.min(...pts.map((p) => p.score));
  const lo = Math.max(0, Math.floor((min - 5) / 10) * 10), hi = Math.min(100, Math.ceil((max + 2) / 10) * 10);
  const y = (s: number) => P.t + (1 - (s - lo) / Math.max(1, hi - lo)) * (H - P.t - P.b);
  const hasScores = result.candidates[0]?.events.length > 0;
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.jd).toFixed(1)},${y(p.score).toFixed(1)}`).join('');
  const currentPt = pts.find((p) => p.local.slice(0, 16) === current);
  const hovered = hover !== null ? pts[hover] : null;

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    let best = 0;
    pts.forEach((p, i) => { if (Math.abs(x(p.jd) - px) < Math.abs(x(pts[best].jd) - px)) best = i; });
    setHover(best);
  };

  return (
    <div className="rect-curve">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Score for each candidate birth time" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        {result.lagnaSegments.map((s, i) => (
          <g key={s.startJd}>
            <rect x={x(s.startJd)} y={P.t} width={Math.max(0, x(s.endJd) - x(s.startJd))} height={H - P.t - P.b} className={i % 2 ? 'band-b' : 'band-a'} />
            {x(s.endJd) - x(s.startJd) > 40 && <text x={(x(s.startJd) + x(s.endJd)) / 2} y={16} className="band-label">{s.signName} lagna</text>}
          </g>
        ))}
        {result.navamsaSegments.map((s) => (
          <g key={`n${s.startJd}`}>
            <line x1={x(s.startJd)} x2={x(s.startJd)} y1={H - P.b} y2={H - P.b + 8} className="tick-d9" />
            {x(s.endJd) - x(s.startJd) > 18 && <text x={(x(s.startJd) + x(s.endJd)) / 2} y={H - P.b + 18} className="tick-label">{SIGN_ABBR[s.sign - 1]}</text>}
          </g>
        ))}
        {result.changePoints.filter((c) => c.kind === 'shashtiamsa').map((c) => (
          <line key={`s${c.jd}`} x1={x(c.jd)} x2={x(c.jd)} y1={H - P.b} y2={H - P.b + 3} className="tick-d60" />
        ))}
        {result.changePoints.filter((c) => c.kind === 'nakshatra').map((c) => (
          <line key={`k${c.jd}`} x1={x(c.jd)} x2={x(c.jd)} y1={P.t} y2={H - P.b} className="tick-nk" />
        ))}
        <text x={P.l} y={H - 6} className="tick-label start">{result.window.startLocal.slice(11, 16)}</text>
        <text x={W - P.r} y={H - 6} className="tick-label end">{result.window.endLocal.slice(11, 16)}</text>
        <text x={W / 2} y={H - 6} className="tick-label">navamsa signs · fine ticks are D60 changes · dashed lines are Moon pada changes</text>
        {hasScores && (
          <>
            {[lo, (lo + hi) / 2, hi].map((v) => (
              <g key={v}><line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} className="grid" /><text x={P.l - 6} y={y(v) + 4} className="axis">{Math.round(v)}</text></g>
            ))}
            <path d={path} className="curve" />
            {result.candidates.map((c) => (
              <g key={c.jd} transform={`translate(${x(c.jd)},${y(c.score)})`}>
                <circle r={9} className="cand-dot" /><text y={4} className="cand-num">{c.rank}</text>
              </g>
            ))}
          </>
        )}
        {currentPt && <line x1={x(currentPt.jd)} x2={x(currentPt.jd)} y1={P.t} y2={H - P.b} className="tick-current" />}
        {hovered && <line x1={x(hovered.jd)} x2={x(hovered.jd)} y1={P.t} y2={H - P.b} className="tick-hover" />}
      </svg>
      <p className="rect-hover muted" aria-live="polite">
        {hovered
          ? `${hovered.local.slice(11, 16)} · ${['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'][hovered.lagna - 1]} lagna, ${SIGN_ABBR[hovered.navamsa - 1]} navamsa${hasScores ? ` · score ${hovered.score}` : ''}`
          : currentPt ? 'The thin gold line is the time in your current chart. Hover the chart to inspect any minute.' : 'Hover the chart to inspect any minute.'}
      </p>
    </div>
  );
}
