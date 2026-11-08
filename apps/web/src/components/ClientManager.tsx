import { useEffect, useMemo, useRef, useState } from 'react';
import { buildIcs } from '@vedic/timing';
import { engineEphemeris, natalFromChart, scoredDashasFromChart } from '@vedic/timing/engine';
import type { BirthInput } from '../types/chart';
import type { Profile } from '../lib/profiles';
import { newTabId, type FollowUp, type Reading, type Tab, type Workspace } from '../lib/tabs';
import { buildClients, matchesClient, sortClients, type ClientRow, type ClientSort } from '../lib/clients';
import { chartAlerts, reachOutText, reminderAlerts, sortAlerts, type Alert, type AlertKind } from '../lib/alerts';
import { birthKey } from '../lib/lifeEvents';
import { downloadText } from '../lib/backup';
import { computeChart } from '../engine';
import './clients.css';

export type ClientPatch = Partial<Pick<Tab, 'readings' | 'followUp'>>;

interface Props {
  ws: Workspace;
  profiles: Profile[];
  busy: boolean;
  onOpen: (row: ClientRow) => void;
  /** Changes a client's readings or follow-up. A saved chart with no tab gets a closed tab to hold them. */
  onPatch: (row: ClientRow, patch: ClientPatch) => void;
  onNew: () => void;
  onBackup: () => void;
  onRestore: (text: string) => string;
  onClose: () => void;
}

const HORIZONS = [30, 90, 365] as const;
type Horizon = (typeof HORIZONS)[number];
const HORIZON_LABEL: Record<Horizon, string> = { 30: 'Next 30 days', 90: 'Next 3 months', 365: 'Next 12 months' };
const KIND_LABEL: Record<AlertKind, string> = { dasha: 'Dasha', saturn: 'Saturn', jupiter: 'Jupiter', nodes: 'Rahu · Ketu', 'follow-up': 'Follow-up', prediction: 'Prediction' };
const KINDS = Object.keys(KIND_LABEL) as AlertKind[];

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const fmtDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const monthOf = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' });
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const DAY = 86_400_000;

/* Chart alerts for 12 months, worked out once per birth per visit. */
const alertCache = new Map<string, Alert[] | 'none'>();
async function alertsFor(input: BirthInput, from: Date): Promise<Alert[] | 'none'> {
  const key = `${birthKey(input)}|${input.ayanamsa}|${from.toISOString().slice(0, 10)}`;
  const hit = alertCache.get(key);
  if (hit) return hit;
  const chart = await computeChart(input);
  const ctx = chart.engineContext;
  let out: Alert[] | 'none' = 'none';
  if (ctx) {
    const natal = natalFromChart(ctx.chart);
    const eph = engineEphemeris(ctx.engine, { ayanamsa: ctx.chart.meta.ayanamsa, nodeType: ctx.chart.meta.nodeType });
    out = chartAlerts(eph, natal, scoredDashasFromChart(ctx.chart, natal), from, new Date(from.getTime() + 366 * DAY));
  }
  alertCache.set(key, out);
  return out;
}

interface Upcoming extends Alert { row: ClientRow }

/** The astrologer's client list with readings, follow-ups and last predictions, and the alerts coming up for each client. */
export default function ClientManager({ ws, profiles, busy, onOpen, onPatch, onNew, onBackup, onRestore, onClose }: Props) {
  const [view, setView] = useState<'clients' | 'alerts'>('clients');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<ClientSort>('follow-up');
  const [horizon, setHorizon] = useState<Horizon>(90);
  const [kinds, setKinds] = useState<Set<AlertKind>>(() => new Set(KINDS));
  const [expanded, setExpanded] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [chartAlertsBy, setChartAlertsBy] = useState<Record<string, Alert[] | 'none' | 'error'>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const [today] = useState(todayStr);
  const [from] = useState(() => new Date(`${todayStr()}T00:00:00Z`));

  const rows = useMemo(() => buildClients(ws, profiles), [ws, profiles]);
  const shown = useMemo(() => sortClients(rows.filter((r) => matchesClient(r, query)), sort), [rows, query, sort]);

  // work out each client's chart alerts one at a time, so a long list stays responsive
  const births = rows.filter((r) => r.input).map((r) => ({ key: r.key, input: r.input! }));
  const birthSig = births.map((b) => `${b.key}:${birthKey(b.input)}`).join(',');
  useEffect(() => {
    let live = true;
    (async () => {
      for (const b of births) {
        if (!live) return;
        try {
          const a = await alertsFor(b.input, from);
          if (live) setChartAlertsBy((m) => ({ ...m, [b.key]: a }));
        } catch {
          if (live) setChartAlertsBy((m) => ({ ...m, [b.key]: 'error' }));
        }
        await new Promise((res) => setTimeout(res, 0));
      }
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [birthSig, from]);

  const end = new Date(from.getTime() + horizon * DAY);
  const endStr = end.toISOString().slice(0, 10);
  const upcoming: Upcoming[] = useMemo(() => {
    const out: Upcoming[] = [];
    for (const row of rows) {
      const own = row.tab ? reminderAlerts(row.tab, end, today) : [];
      const fromChart = chartAlertsBy[row.key];
      const chart = Array.isArray(fromChart) ? fromChart.filter((a) => a.date < endStr) : [];
      for (const a of sortAlerts([...own, ...chart])) if (kinds.has(a.kind)) out.push({ ...a, row });
    }
    return out.sort((a, b) => a.date.localeCompare(b.date) || a.row.label.localeCompare(b.row.label));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, chartAlertsBy, horizon, kinds, today]);
  const pending = births.filter((b) => !(b.key in chartAlertsBy)).length;
  const noEngine = births.filter((b) => chartAlertsBy[b.key] === 'none' || chartAlertsBy[b.key] === 'error').length;
  const dueSoon = rows.filter((r) => r.followUp && r.followUp.date <= new Date(from.getTime() + 7 * DAY).toISOString().slice(0, 10)).length;

  const copy = async (text: string, what: string) => {
    try { await navigator.clipboard.writeText(text); setStatus(`${what} copied. Paste it into WhatsApp, email or a text.`); }
    catch { setStatus('This browser would not copy. Select the text and copy it by hand.'); }
  };
  const calendar = () => {
    const events = upcoming.map((a) => ({
      uid: `${a.id}-${a.row.key}@jyotisha-explorer`,
      start: new Date(`${a.date}T00:00:00Z`),
      end: new Date(`${a.date}T00:00:00Z`),
      summary: `${a.row.label}: ${a.title}`,
      description: a.detail,
      categories: [KIND_LABEL[a.kind]],
      alarmHour: 9,
    }));
    downloadText(buildIcs(events, { name: 'Client alerts' }), `client-alerts-${today}.ics`);
  };
  const upload = async (f: File) => setStatus(onRestore(await f.text()));
  const toggleKind = (k: AlertKind) => setKinds((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n.size ? n : new Set(KINDS); });

  const setFollowUp = (row: ClientRow, f: FollowUp | undefined) => onPatch(row, { followUp: f });
  const groups = useMemo(() => {
    const g: { month: string; items: Upcoming[] }[] = [];
    for (const a of upcoming) {
      const m = a.date < today ? 'Overdue' : monthOf(a.date);
      if (g.at(-1)?.month !== m) g.push({ month: m, items: [] });
      g.at(-1)!.items.push(a);
    }
    return g;
  }, [upcoming, today]);

  return (
    <section className="card clients-card" id="clients">
      <div className="card-head">
        <h3>Clients</h3>
        <span className="muted">kept in this browser only, never in share links, hidden while presenting</span>
        <span className="data-row">
          <button type="button" className="btn-ghost sm" onClick={onBackup} title="One file with every client, note, reading, follow-up and saved chart">Back up</button>
          <button type="button" className="btn-ghost sm" onClick={() => fileRef.current?.click()} title="Merge a backup file into this browser">Restore</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ''; }} />
          <button type="button" className="btn-ghost sm" onClick={onClose}>Close</button>
        </span>
      </div>

      <div className="clients-tabs seg" role="tablist" aria-label="Client view">
        <button type="button" role="tab" aria-selected={view === 'clients'} className={view === 'clients' ? 'is-active' : ''} onClick={() => setView('clients')}>
          Client list ({rows.length})
        </button>
        <button type="button" role="tab" aria-selected={view === 'alerts'} className={view === 'alerts' ? 'is-active' : ''} onClick={() => setView('alerts')}>
          Upcoming alerts{pending ? '' : ` (${upcoming.length})`}
        </button>
      </div>
      {status && <p className="muted clients-status" role="status">{status}</p>}

      {view === 'clients' && (
        <>
          <div className="clients-toolbar">
            <input type="search" className="clients-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search names, places, notes, readings" aria-label="Search clients" />
            <label className="clients-sort">
              <span className="muted">Sort</span>
              <select value={sort} onChange={(e) => setSort(e.target.value as ClientSort)}>
                <option value="follow-up">Next follow-up</option>
                <option value="recent">Most recent</option>
                <option value="name">Name</option>
              </select>
            </label>
            <button type="button" className="btn-primary sm" onClick={onNew}>New client</button>
          </div>
          {dueSoon > 0 && <p className="clients-due">{dueSoon} follow-up{dueSoon === 1 ? ' is' : 's are'} due within a week.</p>}

          {rows.length === 0 ? (
            <p className="muted clients-empty">No clients yet. Work out a chart in a tab or save one, and the person appears here with their notes, readings and follow-ups.</p>
          ) : shown.length === 0 ? (
            <p className="muted clients-empty">No client matches “{query}”.</p>
          ) : (
            <ul className="clients-list">
              {shown.map((r) => {
                // a saved chart becomes a closed tab once it gets a reading, so expansion follows the birth
                const id = r.input ? birthKey(r.input) : r.key;
                return (
                <ClientItem key={r.key} row={r} busy={busy} today={today} open={expanded === id}
                  onToggle={() => setExpanded((x) => (x === id ? null : id))}
                  onOpen={() => onOpen(r)}
                  onFollowUp={(f) => setFollowUp(r, f)}
                  onReadings={(list) => onPatch(r, { readings: list.length ? list : undefined })}
                  alerts={upcoming.filter((a) => a.row.key === r.key).length}
                  onShowAlerts={() => { setQuery(''); setView('alerts'); }}
                />
                );
              })}
            </ul>
          )}
        </>
      )}

      {view === 'alerts' && (
        <>
          <div className="clients-toolbar">
            <select value={horizon} onChange={(e) => setHorizon(Number(e.target.value) as Horizon)} aria-label="How far ahead">
              {HORIZONS.map((h) => <option key={h} value={h}>{HORIZON_LABEL[h]}</option>)}
            </select>
            <div className="log-filter" role="group" aria-label="Kinds of alert">
              {KINDS.map((k) => (
                <button key={k} type="button" aria-pressed={kinds.has(k)} className={`chip ${kinds.has(k) ? 'is-active' : ''}`} onClick={() => toggleKind(k)}>{KIND_LABEL[k]}</button>
              ))}
            </div>
            <button type="button" className="btn-ghost sm" onClick={calendar} disabled={!upcoming.length} title="Download these alerts as a calendar file for Google, Apple or Outlook">Add to calendar</button>
          </div>
          <p className="muted clients-note">
            {pending ? `Working out charts, ${births.length - pending} of ${births.length} done…` : `Dasha changes (maha and antar), Saturn phases from the Moon, Saturn returns, Jupiter and Rahu changing sign, your follow-ups and predictions to check.`}
            {noEngine > 0 && ` ${noEngine} chart${noEngine === 1 ? '' : 's'} could not be worked out in full, so only your own reminders show for ${noEngine === 1 ? 'it' : 'them'}.`}
          </p>
          {!pending && upcoming.length === 0 && <p className="muted clients-empty">Nothing coming up for {rows.length ? 'your clients' : 'anyone yet'} in this window.</p>}
          {groups.map((g) => (
            <div key={g.month} className="alerts-group">
              <h4 className={g.month === 'Overdue' ? 'alerts-overdue' : ''}>{g.month}</h4>
              <ul className="alerts-list">
                {g.items.map((a) => (
                  <li key={`${a.row.key}-${a.id}`} className={`alert-item tone-${a.tone} kind-${a.kind}`}>
                    <div className="alert-date"><b>{fmtDay(a.date)}</b><span className="alert-kind">{KIND_LABEL[a.kind]}</span></div>
                    <div className="alert-body">
                      <p><b>{a.row.label}</b> · {a.title}</p>
                      <p className="muted">{a.detail}</p>
                    </div>
                    <div className="alert-tools">
                      <button type="button" className="btn-ghost sm" disabled={busy} onClick={() => onOpen(a.row)}>Open chart</button>
                      <button type="button" className="btn-ghost sm" onClick={() => void copy(reachOutText(a.row.input?.name || a.row.label, a), 'Message')} title="A short note to send the client, ready to edit">Copy message</button>
                      {a.kind !== 'follow-up' && (
                        <button type="button" className="btn-ghost sm" title="Set this client's follow-up a week before"
                          onClick={() => {
                            const d = new Date(Math.max(Date.parse(`${a.date}T00:00:00Z`) - 7 * DAY, from.getTime())).toISOString().slice(0, 10);
                            setFollowUp(a.row, { date: d, note: `Before: ${a.title} (${a.date})` });
                            setStatus(`Follow-up for ${a.row.label} set for ${fmtDay(d)}.`);
                          }}>Remind me</button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </>
      )}
    </section>
  );
}

const OUTCOME: Record<string, string> = { open: 'not yet known', 'came-true': 'came true', partly: 'partly', 'did-not': 'did not happen' };

interface ItemProps {
  row: ClientRow;
  busy: boolean;
  today: string;
  open: boolean;
  alerts: number;
  onToggle: () => void;
  onOpen: () => void;
  onFollowUp: (f: FollowUp | undefined) => void;
  onReadings: (list: Reading[]) => void;
  onShowAlerts: () => void;
}

function ClientItem({ row: r, busy, today, open, alerts, onToggle, onOpen, onFollowUp, onReadings, onShowAlerts }: ItemProps) {
  const [date, setDate] = useState(today);
  const [summary, setSummary] = useState('');
  const overdue = r.followUp && r.followUp.date < today;
  const addReading = (e: React.FormEvent) => {
    e.preventDefault();
    onReadings([{ id: newTabId(), date, summary: summary.trim().slice(0, 5000) }, ...r.readings].sort((a, b) => b.date.localeCompare(a.date)));
    setSummary('');
  };
  return (
    <li className={`client-item ${open ? 'is-open' : ''}`}>
      <div className="client-main">
        <button type="button" className="client-name" onClick={onToggle} aria-expanded={open}>
          <b>{r.label}</b>
          <small className="muted">
            {r.input ? `${fmtDay(r.input.date)} · ${r.input.place}` : 'No chart yet'}
            {r.where === 'closed' ? ' · closed tab' : r.where === 'saved' ? ' · saved chart' : ''}
          </small>
        </button>
        <div className="client-facts">
          <span title="Readings held">
            <small className="muted">Last reading</small>
            {r.lastReading ? <>{fmtDay(r.lastReading.date)}{r.readings.length > 1 ? <span className="muted"> · {r.readings.length} in all</span> : null}</> : <span className="muted">none logged</span>}
          </span>
          <span className={overdue ? 'is-overdue' : ''}>
            <small className="muted">Follow up</small>
            {r.followUp ? <>{fmtDay(r.followUp.date)}{overdue ? ' · overdue' : ''}</> : <span className="muted">not set</span>}
          </span>
          <span>
            <small className="muted">Predicted last time</small>
            {r.lastPrediction ? <span title={r.lastPrediction.text}>{clip(r.lastPrediction.text, 70)} <span className="muted">({OUTCOME[r.lastPrediction.outcome ?? 'open']})</span></span> : <span className="muted">nothing yet</span>}
          </span>
        </div>
        <div className="client-tools">
          <button type="button" className="btn-ghost sm" disabled={busy || !r.input && r.where === 'saved'} onClick={onOpen}>Open</button>
          <button type="button" className="btn-ghost sm" onClick={onToggle} aria-expanded={open}>{open ? 'Less' : 'More'}</button>
        </div>
      </div>

      {open && (
        <div className="client-detail">
          <div>
            <h5>Follow-up</h5>
            <div className="client-follow">
              <input type="date" value={r.followUp?.date ?? ''} aria-label={`Follow-up date for ${r.label}`}
                onChange={(e) => onFollowUp(e.target.value ? { date: e.target.value, ...(r.followUp?.note ? { note: r.followUp.note } : {}) } : undefined)} />
              <input type="text" value={r.followUp?.note ?? ''} placeholder="Why, e.g. check in after the job interview" maxLength={500} disabled={!r.followUp}
                aria-label="Follow-up note" onChange={(e) => r.followUp && onFollowUp({ date: r.followUp.date, ...(e.target.value ? { note: e.target.value } : {}) })} />
              {r.followUp && <button type="button" className="btn-ghost sm" onClick={() => onFollowUp(undefined)}>Done</button>}
            </div>
            {alerts > 0 && <p className="muted"><button type="button" className="link-btn" onClick={onShowAlerts}>{alerts} alert{alerts === 1 ? '' : 's'} coming up</button></p>}

            <h5>Notes</h5>
            {r.notes.trim() ? <p className="client-notes">{clip(r.notes.trim(), 600)}</p> : <p className="muted">No notes. Open the chart to write notes and log questions and predictions.</p>}
            {r.tab && r.tab.log.filter((e) => e.kind === 'prediction').length > 1 && (
              <>
                <h5>Earlier predictions</h5>
                <ul className="client-preds">
                  {r.tab.log.filter((e) => e.kind === 'prediction').slice(0, 6).map((e) => (
                    <li key={e.id}><span className="muted">{fmtDay(e.at.slice(0, 10))}</span> {clip(e.text, 140)} <span className="muted">({OUTCOME[e.outcome ?? 'open']})</span></li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <div>
            <h5>Readings</h5>
            <form className="client-reading-form" onSubmit={addReading}>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required aria-label="Reading date" />
              <textarea rows={2} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="What you covered, e.g. career timing, Saturn antardasha, suggested remedies" aria-label="Reading summary" />
              <button className="btn-primary sm" disabled={!date}>Log reading</button>
            </form>
            {r.readings.length === 0 ? <p className="muted">No readings logged yet.</p> : (
              <ol className="client-readings">
                {r.readings.map((x) => (
                  <li key={x.id}>
                    <b>{fmtDay(x.date)}</b> {x.summary || <span className="muted">no summary</span>}
                    <button type="button" className="tab-x" aria-label="Delete reading" title="Delete" onClick={() => onReadings(r.readings.filter((y) => y.id !== x.id))}>✕</button>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
